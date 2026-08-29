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
     AND NOT EXISTS (SELECT 1 FROM document d WHERE d.solicitation_id = s.id)
   ORDER BY s.closes_at ASC NULLS LAST
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
  value_cents: string | null;
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
 * conflict target. This is naturally idempotent (a re-run of a field that
 * already exists is a no-op) AND naturally self-repairing (a re-run finds
 * and fills only the fields still missing) -- both properties the old guard
 * actively prevented by returning early the moment ANY listing row existed. */
async function writeListingRows(c: Candidate): Promise<void> {
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

  await run(
    `INSERT INTO extracted_field
           (solicitation_id, field_name, value_text, origin, confidence, produced_by)
     SELECT $1, f.name, f.val, 'listing', 1.0, 'mechanical'
       FROM unnest($2::text[], $3::text[]) AS f(name, val)
     ON CONFLICT (solicitation_id, field_name) WHERE origin = 'listing' DO NOTHING`,
    [c.id, names, values],
  );
}

export async function discoverAttachments(
  limit: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ solicitations: number; skipped: number; documents: number }> {
  const rows = await all<Candidate>(CANDIDATES, [limit, SAM_SOURCE_NAME]);
  let documents = 0;
  let skipped = 0;

  for (const s of rows) {
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
  }
  return { solicitations: rows.length, skipped, documents };
}
