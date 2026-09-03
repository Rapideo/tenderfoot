import { all, one } from "../db/index.js";
import { LATEST_PURSUIT } from "./latest.js";
import { ELIGIBLE, UNDECIDED, EFFECTIVE_CLOSES_AT, DEADLINE_UNRELIABLE } from "./eligibility.js";
import { getSample, type SampleHeader } from "./sample.js";
import { truncateWords } from "../merge/description.js";

export interface DeadlineConflict {
  value_text: string;
  origin: "listing" | "document";
  quote: string | null;
}

export interface QueueItem {
  id: number;
  title: string;
  org_name: string | null;
  jurisdiction: string | null;
  closes_at: string | null;
  posted_at: string | null;
  /* bigint column, but db/index.ts:20 parses OID 20 (bigint) to Number
   * centrally via pg.types.setTypeParser -- so this arrives as a number,
   * not the string a bare pg client would hand back. */
  value_cents: number | null;
  kind: string | null;
  set_aside: string | null;
  source_name: string | null;
  /* WHERE THE WORK IS — a two-letter state, or null. ~36% coverage by nature
   * of the source. The first filter a geographically-bounded firm applies,
   * and the card did not carry it until 2026-09-02. */
  place_of_performance: string | null;
  /* WHAT KIND OF WORK IT IS. `codes` is jsonb `{naics, psc, naics_labels,
   * psc_labels}`; the card shows the first LABEL because "Dental
   * Laboratories" is actionable where "339116" is a lookup. */
  codes: { naics?: string[]; psc?: string[]; naics_labels?: string[]; psc_labels?: string[] } | null;
  /* THE POSTING'S OWN WORDS, truncated for the card.
   *
   * Added 2026-09-02, after Matt could not triage sample 1: a card carrying a
   * title, a buyer and two dates asks a person to judge "would KP pursue this"
   * from the title alone. The text was in `sighting.raw` on 99.3% of SAM rows
   * all along and merge discarded it -- see merge/description.ts.
   *
   * TRUNCATED SERVER-SIDE on purpose. "About 200 words" is a content decision
   * (Matt, 2026-09-02), not a layout one, so it is not the client's to make --
   * and shipping the full text to a 25-row queue page would send a quarter of
   * a megabyte of prose the card never renders. The record view fetches the
   * whole thing separately. */
  description: string | null;
  /** True when `description` was cut, so the card can say so rather than
   * ending mid-thought and reading as complete. */
  description_truncated: boolean;
  documents: number;
  sightings: number;
  /* Region 1.1.1: show the disagreement rather than silently picking a
   * winner. Empty for the overwhelming majority of rows. */
  deadline_conflict: DeadlineConflict[];
  /* 🔴 The stored deadline is EARLIER THAN THE POSTING DATE, so it cannot be
   * true. 106 such rows on production, 62 of them biddable and recently posted
   * -- they used to be filed as closed and never reached the queue at all
   * (eligibility.ts). They now DO reach it, which makes telling the screen
   * necessary: `closes_at` still carries the source's claim, and rendering
   * "2006-09-24" as a live deadline would be a worse lie than hiding it was.
   * The screen shows the date is not usable; it does not invent one. */
  deadline_unreliable: boolean;
  /* SAMPLE MODE ONLY, spec §10: an item whose deadline passes mid-session
   * stays in the sample, marked closed, rather than becoming unreachable.
   * Always false in ordinary (non-sample) mode, where a closed item cannot
   * appear at all -- ELIGIBLE excludes it from membership there. */
  closed: boolean;
}

export interface QueuePage {
  mode: "all" | "sample";
  sample: SampleHeader | null;
  total: number;
  remaining: number;
  items: QueueItem[];
}

const NOW_ISO = () => new Date().toISOString().slice(0, 10);

export async function queuePage(
  opts: { limit?: number; offset?: number; sampleId?: number } = {},
): Promise<QueuePage> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 200));
  const offset = Math.max(0, opts.offset ?? 0);
  const today = NOW_ISO();

  const sample = opts.sampleId ? await getSample(opts.sampleId) : null;
  if (opts.sampleId && !sample) throw new Error(`No sample ${opts.sampleId}.`);

  /* In sample mode the population is the DRAWN SET, so membership is
   * restricted to it -- but the CLOSED half of eligibility does not apply
   * within it. Spec §10: "An item's deadline passes mid-session -> Stays in
   * the sample, marked closed." A drawn row that has since been DECIDED has
   * left the queue (UNDECIDED still applies); a drawn row that has since
   * CLOSED has not -- it stays reachable so it can actually be decided, and
   * a reader can tell "session half finished" from "some items became
   * untriageable" instead of the two looking identical. The
   * `triage_sample_item` row itself was never at risk either way: it
   * survives regardless, which is what keeps the denominator safe.
   *
   * Ordinary (non-sample) queue membership is UNCHANGED: full ELIGIBLE,
   * closed items excluded, exactly as before.
   *
   * sample.id is bound rather than interpolated, same discipline as
   * limit/offset below: it is round-tripped from getSample() (an
   * IDENTITY column, genuinely a number by the time it is here), but there
   * is no reason for this query to be the one place in the file that goes
   * back to string-building a value into SQL. */
  const membership = sample ? UNDECIDED : ELIGIBLE;

  /* Parameter numbering below is deliberately NOT a single fixed scheme
   * shared by both queries (the original scope(param) helper's mistake this
   * fix also corrects): UNDECIDED binds nothing, so in sample mode $1 is
   * free for something else in each query rather than sitting unreferenced.
   * An unreferenced $1 (a placeholder never appearing in the query text
   * that a param array still supplies a value for) is what postgres answers
   * with "could not determine data type of parameter $1" -- so every
   * placeholder number used below is one this query text actually contains,
   * per mode, checked by running the sample-mode tests this fix adds. */

  const countParams: unknown[] = sample ? [sample.id] : [today];
  const countScope = sample
    ? `AND EXISTS (
        SELECT 1 FROM triage_sample_item i
         WHERE i.sample_id = $1 AND i.solicitation_id = s.id)`
    : "";
  const counted = await one<{ total: number }>(
    `SELECT count(*) AS total
       FROM solicitation s
       LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
      WHERE ${membership} ${countScope}`,
    countParams,
  );
  // Number(...) stays even though setTypeParser already coerces OID 20 --
  // harmless belt-and-braces, not a claim that the driver still hands back a string.
  const total = Number(counted?.total ?? 0);

  /* today is bound as $1 here in BOTH modes -- in "all" mode ELIGIBLE reads
   * it directly; in sample mode UNDECIDED does not, but the `closed` column
   * below still needs it, so $1 is referenced either way and the gap this
   * comment block describes never opens. */
  const itemsParams: unknown[] = sample
    ? [today, limit, offset, sample.id]
    : [today, limit, offset];
  const itemsScope = sample
    ? `AND EXISTS (
        SELECT 1 FROM triage_sample_item i
         WHERE i.sample_id = $4 AND i.solicitation_id = s.id)`
    : "";

  /* ONE statement for the page, whatever its size -- including the
   * per-item document counts, sighting counts and deadline conflicts,
   * which are lateral aggregates rather than a query per row. This is
   * what the constancy test in queue.test.ts pins. */
  const items = await all<QueueItem>(
    `SELECT s.id, s.title, o.name AS org_name, o.jurisdiction,
            s.closes_at, s.posted_at, s.value_cents, s.kind, s.set_aside,
            s.description, s.place_of_performance, s.codes,
            src.name AS source_name,
            (SELECT count(*)::int FROM document d WHERE d.solicitation_id = s.id) AS documents,
            (SELECT count(*)::int FROM sighting g WHERE g.solicitation_id = s.id) AS sightings,
            COALESCE(
              (SELECT json_agg(json_build_object(
                        'value_text', ef.value_text,
                        'origin', ef.origin,
                        'quote', ef.quote))
                 FROM extracted_field ef
                WHERE ef.solicitation_id = s.id
                  AND ef.field_name = 'closes_at'
                  AND ef.value_text IS NOT NULL
                  AND s.closes_at IS NOT NULL
                  AND ef.value_text <> s.closes_at),
              '[]'::json) AS deadline_conflict,
            -- closed reads the EFFECTIVE deadline, not the stored one. An
            -- impossible date (closes before posted) is unknown rather than
            -- past, so it must not be marked closed: that flag is what put 62
            -- live opportunities out of the queue. See eligibility.ts.
            (${EFFECTIVE_CLOSES_AT} IS NOT NULL AND ${EFFECTIVE_CLOSES_AT} < $1) AS closed,
            ${DEADLINE_UNRELIABLE} AS deadline_unreliable
       FROM solicitation s
       LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
       LEFT JOIN organization o ON o.id = s.org_id
       LEFT JOIN source src ON src.id = s.source_id
      WHERE ${membership} ${itemsScope}
      -- ORDERS ON THE EFFECTIVE DEADLINE, and this line is why the fix is not
      -- a one-word change to ELIGIBLE. D16 sorts soonest-first, so a notice
      -- claiming 2006 sorts ABOVE everything real the moment it is let back
      -- in: admitting these rows without this line would put the worst data at
      -- the top of the Pri 5 screen. Unknown sorts last, where it belongs.
      ORDER BY ${EFFECTIVE_CLOSES_AT} ASC NULLS LAST, s.id ASC
      LIMIT $2 OFFSET $3`,
    itemsParams,
  );

  /* Truncation happens HERE rather than in SQL: `truncateWords` cuts on a word
   * boundary and prefers a nearby sentence end, which left(s.description, n)
   * cannot do without clipping mid-word. The cost is carrying the full text
   * for one page of rows, which is bounded by the page size. */
  const pageItems = items.map((i) => {
    if (i.description === null) return { ...i, description_truncated: false };
    const { text, truncated } = truncateWords(i.description);
    return { ...i, description: text, description_truncated: truncated };
  });

  return {
    mode: sample ? "sample" : "all",
    sample,
    total,
    remaining: Math.max(0, total - offset),
    items: pageItems,
  };
}
