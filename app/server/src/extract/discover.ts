import { all, one, insert } from "../db/index.js";

const SAM_RESOURCES = "https://api.sam.gov/prod/opportunity/v1/api/";

/* Nearest LIVE deadline first; closed solicitations are skipped entirely.
 * Production holds ~9,900 solicitations and most are closed, so this makes
 * the first batch the useful batch. */
const CANDIDATES = `
  SELECT s.id, s.external_id, s.closes_at, s.set_aside, s.prebid_required, s.value_cents
    FROM solicitation s
   WHERE s.external_id IS NOT NULL
     AND left(s.closes_at, 10) >= to_char(now(), 'YYYY-MM-DD')
     AND NOT EXISTS (SELECT 1 FROM document d WHERE d.solicitation_id = s.id)
   ORDER BY s.closes_at ASC
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

/* THE GROUND TRUTH ROWS. corpus/FINDINGS.md §1 established that the portal's
 * structured field was right where all three documents were unreliable, so the
 * listing is what document extraction is measured AGAINST. Nothing else in this
 * slice writes origin='listing'; without this, Task 8's accuracy query joins
 * against an empty set forever. */
async function writeListingRows(c: Candidate): Promise<void> {
  const already = await one<{ c: string }>(
    `SELECT count(*) AS c FROM extracted_field WHERE solicitation_id = $1 AND origin = 'listing'`,
    [c.id],
  );
  if (Number(already?.c ?? 0) > 0) return;

  const value: Record<string, string | null> = {
    closes_at: c.closes_at,
    set_aside: c.set_aside,
    prebid_required: c.prebid_required === null ? null : String(c.prebid_required),
    value_cents: c.value_cents === null ? null : String(c.value_cents),
    qa_closes_at: null,
    prebid_at: null,
  };
  for (const f of LISTING_FIELDS) {
    await insert(
      `INSERT INTO extracted_field
         (solicitation_id, field_name, value_text, origin, confidence, produced_by)
       VALUES ($1, $2, $3, 'listing', 1.0, 'mechanical') RETURNING id`,
      [c.id, f, value[f] ?? null],
    );
  }
}

export async function discoverAttachments(
  limit: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ solicitations: number; documents: number }> {
  const rows = await all<Candidate>(CANDIDATES, [limit]);
  let documents = 0;

  for (const s of rows) {
    await writeListingRows(s);
    const url = `${SAM_RESOURCES}${encodeURIComponent(s.external_id)}/resources`;
    const res = await fetchImpl(url);
    if (!res.ok) continue;
    const body = (await res.json()) as {
      _embedded?: { opportunityAttachmentList?: { attachments?: Record<string, string>[] }[] };
    };
    const list = body._embedded?.opportunityAttachmentList ?? [];
    for (const group of list) {
      for (const a of group.attachments ?? []) {
        if (a.fileExists !== "1") continue;
        await insert(
          `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
           VALUES ($1, $2, $3, 'pending') RETURNING id`,
          [s.id, a.name, `${SAM_RESOURCES}core/download?token=${a.resourceId}`],
        );
        documents++;
      }
    }
  }
  return { solicitations: rows.length, documents };
}
