import { all, run, insert } from "../db/index.js";
import { SAM_HOST } from "../scrape/adapters/sam.js";

/* Task 9 fix round 1 (CRITICAL): the original host here was
 * `https://api.sam.gov/prod/opportunity/v1/api/`, written from memory and
 * never verified -- it 404s on every id shape, so this function inserted
 * zero documents, ever. The real, working, unauthenticated endpoints (same
 * host the scrape adapter and health probe already use -- see SAM_HOST's
 * own comment) are:
 *
 *   {SAM_HOST}/opps/v3/opportunities/{noticeId}/resources           -- list
 *   {SAM_HOST}/opps/v3/opportunities/resources/files/{resourceId}/download
 *                                                    -- 303 -> signed S3
 *
 * The response SHAPE this file already parses (_embedded.
 * opportunityAttachmentList[].attachments[]) was correct from the start;
 * only the URL was wrong. */
const resourcesUrl = (noticeId: string): string =>
  `${SAM_HOST}/opps/v3/opportunities/${encodeURIComponent(noticeId)}/resources`;
const downloadUrl = (resourceId: string): string =>
  `${SAM_HOST}/opps/v3/opportunities/resources/files/${encodeURIComponent(resourceId)}/download`;

/* Two fix-round-1 defects live in this query, and they compound, so they
 * are documented together.
 *
 * ONE (Critical): `left(closes_at, 10) >= ...` is NULL when closes_at is
 * NULL, and WHERE treats NULL as false -- so every row without a close date
 * was silently dropped. That is not a small subset: NO SAM.gov solicitation
 * carries one. SAM ingest never populates the column, which is a gap in the
 * ingestion slice surfacing here rather than something this task owns or
 * can repair; all this fix does is stop excluding every affected row.
 * Undated rows are admitted and sort last, so a real deadline still wins
 * the ordering wherever one exists.
 *
 * TWO (Critical, found while fixing ONE): this query selected EVERY
 * portal's rows and handed their external_ids to SAM.gov's attachment API,
 * which has never heard of them. At the time `solicitation` had no source
 * column at all -- the only link to a source was a `sighting` row -- so the
 * first fix spelled that join out inline here. Migration 010 since put
 * `source_id` ON the solicitation, NOT NULL, which is what this query now
 * reads. The two defects compound in the worst direction: the rows that
 * carry a close date are precisely the ones from the WRONG source, so
 * ONE's `NULLS LAST` sorts all of them ahead of every real candidate. The
 * first batches would have been pure 404s and -- thanks to the new
 * `skipped` counter -- would have read as a network fault rather than a
 * query bug.
 *
 * The shape above was measured directly against DATABASE_URL before either
 * fix was written: 1,925 solicitations, 1,724 of them SAM.gov with a close
 * date on none, 201 corpus imports with a close date on all. Filtering to
 * SAM.gov leaves 1,724 candidates, so TWO narrows the set without
 * re-creating the emptiness ONE just repaired. (An earlier reading logged
 * during review reported the same SHAPE at a different scale -- 9,682
 * SAM.gov rows, 22 dated non-SAM ones. Both support both fixes; the
 * discrepancy is flagged in progress.md and is about which database was
 * being read, not about what the query does.)
 *
 * The source name is spelled as the seed spells it
 * (003_seed_source_registry.sql). resolve-source.ts's FIX 1 is the
 * cautionary tale: the adapter registry's short key 'sam' is NOT the row's
 * name, and assuming it was cost a full live scrape before the mismatch
 * surfaced at import time. */
const SAM_SOURCE_NAME = "SAM.gov";

const CANDIDATES = `
  SELECT s.id, s.external_id, s.closes_at, s.set_aside, s.prebid_required, s.value_cents
    FROM solicitation s
    JOIN source src ON src.id = s.source_id
   WHERE s.external_id IS NOT NULL
     AND src.name = $2
     AND (s.closes_at IS NULL OR left(s.closes_at, 10) >= to_char(now(), 'YYYY-MM-DD'))
     AND (s.attachments_checked_at IS NULL
          OR s.attachments_checked_at < now() - interval '1 day')
     AND NOT EXISTS (SELECT 1 FROM document d WHERE d.solicitation_id = s.id)
   ORDER BY s.closes_at ASC NULLS LAST
   LIMIT $1`;

/* REVIEW FINDING 1 (Major, 2026-08-30). ASCENDING ORDER OVER AN UNFILTERED
 * SET PUTS THE LONGEST-EXPIRED ROW FIRST, which is the exact inverse of the
 * rule REFRESH's own comment claims. CANDIDATES gets away with a bare
 * `closes_at ASC` because it also FILTERS to live rows; REFRESH deliberately
 * does not filter -- it exists to repair rows the main loop will never visit
 * -- so it has to say what it means in the ORDER BY instead.
 *
 * The consequence was not cosmetic. With the screen's limit of ten, run one
 * repaired the ten oldest closed notices, the `IS DISTINCT FROM` guard
 * suppressed every later write, `refreshed` reported 0 forever, and the
 * listing rows for LIVE solicitations -- the only ones accuracyByField can
 * use -- were never repaired at all.
 *
 * A NULL closes_at makes the first key `false`, not NULL, because the
 * `IS NOT NULL` conjunct is evaluated first: undated rows sort with the
 * expired group and then last within it.
 *
 * REVIEW ROUND 2, FINDING 5: three keys, not two. The second orders the LIVE
 * group by nearest deadline and is NULL for everything else, so the expired
 * rows tie on it and fall through to the third -- which sorts them
 * most-recently-closed FIRST. Two keys left the expired group in ascending
 * order, i.e. the 2020 notices ahead of last week's, and that is not a corner
 * case: on 2026-08-30 every document in the queue belonged to a closed
 * solicitation, so the live-first key selected nothing and the sort collapsed
 * to exactly the ordering it was added to replace. */
const LIVE_FIRST = `(s.closes_at IS NOT NULL AND left(s.closes_at, 10) >= to_char(now(), 'YYYY-MM-DD')) DESC,
            CASE WHEN s.closes_at IS NOT NULL AND left(s.closes_at, 10) >= to_char(now(), 'YYYY-MM-DD')
                 THEN s.closes_at END ASC NULLS LAST,
            s.closes_at DESC NULLS LAST`;

/* THE ROWS DISCOVER WOULD OTHERWISE NEVER LOOK AT AGAIN.
 *
 * CANDIDATES above excludes any solicitation that already has a document --
 * correct for its job, which is finding attachments not yet fetched. But it
 * means ground truth is written ONCE, at the moment a solicitation is first
 * walked, and never revisited. If the portal's value was unknown then and
 * known now, that row stays wrong forever.
 *
 * This is not hypothetical and it is not rare. `closes_at` was null on all
 * 9,682 SAM.gov solicitations until closes-at.ts taught merge to read the
 * deadline out of the payload it was already holding. Any solicitation
 * discovered before that ran carries a listing row saying the portal states
 * no deadline, about a notice whose deadline the portal has published all
 * along. Nothing enforces that merge runs first, and nothing can: the two
 * are separate operations over a corpus that keeps arriving.
 *
 * So instead of ordering them, this makes the order stop mattering. Whichever
 * ran last, a later discover repairs the copy. Bounded by the same `limit`,
 * and ordered LIVE FIRST -- see LIVE_FIRST above for why it cannot simply
 * copy CANDIDATES' `closes_at ASC`, which only reads as "nearest deadline"
 * because CANDIDATES also filters the expired rows out. */
const REFRESH = `
  SELECT s.id, s.external_id, s.closes_at, s.set_aside, s.prebid_required, s.value_cents
    FROM solicitation s
    JOIN source src ON src.id = s.source_id
   WHERE src.name = $2
     AND EXISTS (SELECT 1 FROM extracted_field ef
                  WHERE ef.solicitation_id = s.id AND ef.origin = 'listing')
   ORDER BY ${LIVE_FIRST}
   LIMIT $1`;

/* The six fields SP4 extracts (fields.ts's FieldDraft["field_name"]). The
 * portal carries four of them; the other two exist only in documents, and
 * get an ABSENT listing row so that "the portal does not carry this" is a
 * recorded fact rather than a gap. */
const LISTING_FIELDS = [
  "closes_at", "set_aside", "prebid_required", "value_cents", "qa_closes_at", "prebid_at",
] as const;

interface Candidate {
  id: number;
  external_id: string;
  closes_at: string | null;
  set_aside: string | null;
  prebid_required: boolean | null;
  // bigint column; db/index.ts:20 parses OID 20 (bigint) to Number
  // centrally, so this arrives as a number, not a string.
  value_cents: number | null;
}

interface AttachmentsResponse {
  _embedded?: { opportunityAttachmentList?: { attachments?: Record<string, string>[] }[] };
}

/* THE GROUND TRUTH ROWS. corpus/FINDINGS.md §1 established that the portal's
 * structured field was right where all three documents were unreliable, so the
 * listing is what document extraction is measured AGAINST. Nothing else in this
 * slice writes origin='listing'; without this, Task 8's accuracy query joins
 * against an empty set forever.
 *
 * Fix round 1, item 8: this used to be a read-then-write guard ("if any
 * listing row exists for this solicitation, do nothing") wrapped around six
 * separate INSERTs. That guard's failure mode is PERMANENT, not merely
 * racy: a run that died after writing three of six fields left the
 * solicitation looking "already done" forever, and nothing ever repaired
 * it. It also could not be made concurrency-safe by bolting `ON CONFLICT
 * DO NOTHING` onto `insert()` -- that helper throws when a conflict
 * produces no RETURNING row, which is exactly what DO NOTHING does.
 *
 * Replaced with ONE statement via `run()`, driven by two parallel arrays
 * unnested into rows, with the partial index from migration 009 as the
 * conflict target. This is naturally idempotent AND naturally self-repairing
 * -- both properties the old guard actively prevented by returning early the
 * moment ANY listing row existed.
 *
 * DO UPDATE, REVERSING THE DO NOTHING THIS SHIPPED WITH. That earlier choice
 * rested on a premise that turned out to be false: that a re-run's recomputed
 * value is "equally correct, but different-looking-in-principle", so leaving
 * the first write alone loses nothing. It can be MORE correct, and routinely
 * is. Ground truth here is a COPY of a solicitation column, and that column
 * changes -- merge.ts rewrites closes_at whenever a source amends a deadline,
 * and closes-at.ts only started reading SAM deadlines at all on 2026-08-29,
 * which filled 1,337 columns that had been null since ingest. Every listing
 * row written before that moment records ABSENT for a value the portal was
 * publishing the whole time. DO NOTHING made those rows permanent.
 *
 * That is not a small distinction in this slice specifically: ABSENT and
 * "we had not read it yet" are DIFFERENT FACTS, and the three-state
 * discipline this file is built on exists to keep them apart. Recording the
 * second as the first is the one way a ground-truth row can lie.
 *
 * The `WHERE ... IS DISTINCT FROM` on the DO UPDATE keeps a steady-state run
 * free -- an unchanged field is not rewritten, so rowCount is a count of
 * real corrections rather than of rows visited. */
async function writeListingRows(c: Candidate): Promise<number> {
  const value: Record<string, string | null> = {
    /* Fix round 1, item 7: normalised to the date prefix on write.
     * accuracyByField compares value_text by raw string equality and the
     * document side always emits YYYY-MM-DD (fields.ts's `iso()`).
     * Production's closes_at values happen to already be bare dates today,
     * but this fixture (and any future ISO-8601-with-time value) is not --
     * left uncut, a correct document extraction would compare
     * "2026-08-28" against "2026-08-28T00:00:00.000Z" and score as a
     * disagreement, in the slice's own ground truth. */
    closes_at: c.closes_at === null ? null : c.closes_at.slice(0, 10),
    set_aside: c.set_aside,
    prebid_required: c.prebid_required === null ? null : String(c.prebid_required),
    value_cents: c.value_cents === null ? null : String(c.value_cents),
    qa_closes_at: null,
    prebid_at: null,
  };
  const names = [...LISTING_FIELDS];
  const values = names.map((f) => value[f] ?? null);

  return run(
    `INSERT INTO extracted_field
           (solicitation_id, field_name, value_text, origin, confidence, produced_by)
     SELECT $1, f.name, f.val, 'listing', 1.0, 'mechanical'
       FROM unnest($2::text[], $3::text[]) AS f(name, val)
     ON CONFLICT (solicitation_id, field_name) WHERE origin = 'listing'
     DO UPDATE SET value_text = EXCLUDED.value_text
               WHERE extracted_field.value_text IS DISTINCT FROM EXCLUDED.value_text`,
    [c.id, names, values],
  );
}

/* REVIEW FINDING 5 (Medium, 2026-08-30): this had NO time budget, while the
 * handler comment about budgets sat directly above it in routes/admin.ts.
 * Up to MAX_BATCH (50) sequential fetches with no clock check runs past
 * Vercel's 300s ceiling on a slow day, and a killed request reports NOTHING
 * -- the precise failure RUN_HANDLER_BUDGET_MS exists to prevent, and the
 * one the extract phase already had a budget for.
 *
 * Defaulted generously rather than required, which is the shape scrape/run.ts
 * established and STATUS records: "the CLI passes a generous budget, the HTTP
 * handler one below 300s, and the same code serves both." */
export async function discoverAttachments(
  limit: number,
  fetchImpl: typeof fetch = fetch,
  budgetMs: number = Number.POSITIVE_INFINITY,
): Promise<{ solicitations: number; skipped: number; documents: number; refreshed: number }> {
  const started = Date.now();
  /* BEFORE the main loop, deliberately. Run afterwards it would also re-visit
   * the solicitations this very call just wrote, which cannot be stale, and
   * `refreshed` would stop meaning "corrections to rows that were already
   * here". */
  let refreshed = 0;
  for (const s of await all<Candidate>(REFRESH, [limit, SAM_SOURCE_NAME])) {
    refreshed += await writeListingRows(s);
  }

  const rows = await all<Candidate>(CANDIDATES, [limit, SAM_SOURCE_NAME]);
  let documents = 0;
  let skipped = 0;

  let walked = 0;
  for (const s of rows) {
    if (Date.now() - started >= budgetMs) break;
    walked++;
    await writeListingRows(s);

    /* Fix round 1, item 4: a thrown fetch (network error) used to kill the
     * WHOLE batch, while a non-OK response only skipped this one
     * solicitation -- an inconsistency, not a deliberate distinction. Both
     * now skip just this solicitation and are counted the same way, so an
     * operator can tell "nothing to fetch" (skipped: 0) from "every request
     * failed" (skipped === solicitations) once this fix lands. The
     * User-Agent is not decoration -- sam.ts's adapter and probe both treat
     * it as mandatory; the default Node agent is rejected. */
    const url = resourcesUrl(s.external_id);
    let res: Response;
    try {
      res = await fetchImpl(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    } catch {
      skipped++;
      continue;
    }
    if (!res.ok) {
      skipped++;
      continue;
    }

    let body: AttachmentsResponse;
    try {
      body = (await res.json()) as AttachmentsResponse;
    } catch {
      skipped++;
      continue;
    }

    const list = body._embedded?.opportunityAttachmentList ?? [];
    for (const group of list) {
      for (const a of group.attachments ?? []) {
        if (a.fileExists !== "1") continue;
        /* Fix round 1, item 3: `a.name` is typed as string but SAM.gov can
         * hand back an attachment with no name at runtime. document.filename
         * is NOT NULL, so an unguarded insert throws 23502 with no
         * try/catch around this loop -- which aborted this solicitation's
         * WHOLE remaining attachment list AND every candidate after it in
         * the batch. Skip just the malformed attachment instead; it is
         * simply never counted as a document.
         *
         * `a.resourceId` needs the SAME guard for a quieter reason: it is
         * NOT NULL-constrained by anything, so a missing one produces the
         * perfectly well-formed URL `.../files/undefined/download` and a
         * document row that Task 10 then fetches, fails, and marks failed
         * forever. tsconfig's noUncheckedIndexedAccess is what forces the
         * check to be written; the runtime reason is the one that matters. */
        if (!a.name || !a.resourceId) continue;
        await insert(
          `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
           VALUES ($1, $2, $3, 'pending') RETURNING id`,
          [s.id, a.name, downloadUrl(a.resourceId)],
        );
        documents++;
      }
    }

    /* REVIEW FINDING 2 (Major, 2026-08-30). STAMPED HERE, AND ONLY HERE:
     * after SAM.gov has actually answered. Until this column existed, the
     * only thing that retired a candidate was the existence of a `document`
     * row -- so a notice that legitimately carries NO attachments qualified
     * again on every single run, forever, and discovery could not advance
     * past it. Ten such notices at the head of the queue stall the phase
     * completely under the screen's `?limit=10`.
     *
     * The 2026-08-30 click-through reported exactly that shape -- "0
     * document(s) from 10 solicitation(s), 0 skipped" -- and it was read as
     * the benign case when it was also the stuck one.
     *
     * Every `continue` above this line leaves the stamp NULL on purpose: a
     * request that timed out, 502'd, or returned unparseable JSON has not
     * answered anything, and retiring a notice on the strength of one bad
     * minute would hide its attachments permanently. Only the path that got
     * a real attachment list gets here. */
    await run(`UPDATE solicitation SET attachments_checked_at = now() WHERE id = $1`, [s.id]);
  }
  /* WALKED, not selected. Reporting `rows.length` after a budget stop would
   * claim work this call did not do -- and `solicitations` is the number an
   * operator divides `skipped` against to tell "nothing to fetch" from
   * "every request failed". */
  return { solicitations: walked, skipped, documents, refreshed };
}
