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

/* Fix round 1: measured on production, SAM.gov holds 9,682 solicitations and
 * ZERO with a non-null closes_at -- they are not closed, SAM ingest simply
 * never populates the column. That is a gap in the ingestion slice
 * surfacing here, not something this task owns or can repair; the fix here
 * is only to stop silently excluding every one of them. `left(...) >= ...`
 * on a NULL closes_at evaluates to NULL, which WHERE treats as false, so
 * the original predicate passed only the 22 Indiana notices that happen to
 * carry a date -- handing THEIR external_ids to the SAM.gov attachment API,
 * which is wrong for a non-SAM source. Undated rows are now admitted and
 * sort last, so a live deadline still wins the ordering when one exists. */
const CANDIDATES = `
  SELECT s.id, s.external_id, s.closes_at, s.set_aside, s.prebid_required, s.value_cents
    FROM solicitation s
   WHERE s.external_id IS NOT NULL
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
  const rows = await all<Candidate>(CANDIDATES, [limit]);
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
