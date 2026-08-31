import { all, one } from "../db/index.js";
import { LATEST_PURSUIT } from "./latest.js";
import { ELIGIBLE } from "./eligibility.js";
import { getSample, type SampleHeader } from "./sample.js";

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
  /* bigint column, but db/index.ts:20 parses OID 20 (bigint) to Number
   * centrally via pg.types.setTypeParser -- so this arrives as a number,
   * not the string a bare pg client would hand back. */
  value_cents: number | null;
  kind: string | null;
  set_aside: string | null;
  source_name: string | null;
  documents: number;
  sightings: number;
  /* Region 1.1.1: show the disagreement rather than silently picking a
   * winner. Empty for the overwhelming majority of rows. */
  deadline_conflict: DeadlineConflict[];
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
   * restricted to it -- but eligibility still applies within it, because a
   * drawn row that has since been decided has left the queue. It has NOT
   * left the sample: the denominator does not move.
   *
   * sample.id is bound rather than interpolated, same discipline as
   * limit/offset below: it is round-tripped from getSample() (an
   * IDENTITY column, genuinely a number by the time it is here), but there
   * is no reason for this query to be the one place in the file that goes
   * back to string-building a value into SQL. */
  const scope = (param: number) =>
    sample
      ? `AND EXISTS (
        SELECT 1 FROM triage_sample_item i
         WHERE i.sample_id = $${param} AND i.solicitation_id = s.id)`
      : "";

  const countParams: unknown[] = sample ? [today, sample.id] : [today];
  const counted = await one<{ total: number }>(
    `SELECT count(*) AS total
       FROM solicitation s
       LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
      WHERE ${ELIGIBLE} ${scope(2)}`,
    countParams,
  );
  // Number(...) stays even though setTypeParser already coerces OID 20 --
  // harmless belt-and-braces, not a claim that the driver still hands back a string.
  const total = Number(counted?.total ?? 0);

  const itemsParams: unknown[] = sample
    ? [today, limit, offset, sample.id]
    : [today, limit, offset];

  /* ONE statement for the page, whatever its size -- including the
   * per-item document counts, sighting counts and deadline conflicts,
   * which are lateral aggregates rather than a query per row. This is
   * what the constancy test in queue.test.ts pins. */
  const items = await all<QueueItem>(
    `SELECT s.id, s.title, o.name AS org_name, o.jurisdiction,
            s.closes_at, s.value_cents, s.kind, s.set_aside,
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
              '[]'::json) AS deadline_conflict
       FROM solicitation s
       LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
       LEFT JOIN organization o ON o.id = s.org_id
       LEFT JOIN source src ON src.id = s.source_id
      WHERE ${ELIGIBLE} ${scope(4)}
      ORDER BY s.closes_at ASC NULLS LAST, s.id ASC
      LIMIT $2 OFFSET $3`,
    itemsParams,
  );

  return {
    mode: sample ? "sample" : "all",
    sample,
    total,
    remaining: Math.max(0, total - offset),
    items,
  };
}
