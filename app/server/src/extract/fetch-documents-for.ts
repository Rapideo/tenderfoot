/* THE DOCUMENT SPEND, AND EVERY RULE THAT BOUNDS IT, IN ONE PLACE.
 *
 * ⚖️ Ruling D2 (Matt, 2026-09-04, option A): "fetch the documents only when
 * you open a listing." CLAUDE.md §5.2's asymmetry is what makes that work --
 * everything needed to REJECT a notice is already in the listing; documents
 * are only needed to ACCEPT one.
 *
 * WHY A SERVICE AND NOT A ROUTE HANDLER. `runDocumentsPass` already
 * dispatches per source; this is its singular sibling. One place owns
 * "have we looked · spend · write · stamp · tally", so the HTTP layer stays
 * a thin caller and nothing about spending policy lives in a request
 * handler. */
import { all, one, tx } from "../db/index.js";
import { DOCUMENT_CLIENTS } from "./document-clients.js";
import { recordSpend, spentThisMonth, MONTHLY_RECORD_CEILING } from "./api-spend.js";

export type FetchReason = "fetched" | "already-looked" | "unsupported" | "ceiling";

export interface FetchOutcome {
  reason: FetchReason;
  /** Records the vendor billed. Always 0 unless `reason` is "fetched". */
  spent: number;
  documents: number;
}

interface Row {
  id: number;
  external_id: string | null;
  source_id: number;
  source_name: string;
  checked: Date | null;
}

export async function fetchDocumentsFor(
  solicitationId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchOutcome> {
  const row = await one<Row>(
    `SELECT s.id, s.external_id, s.source_id, src.name AS source_name,
            s.attachments_checked_at AS checked
       FROM solicitation s
       JOIN source src ON src.id = s.source_id
      WHERE s.id = $1`,
    [solicitationId],
  );
  if (!row) throw new Error(`No solicitation ${solicitationId}`);

  /* THE GUARD. A stamp means WE LOOKED, never what we found -- so a notice
   * with zero documents is as free to reopen as one with twenty. Without
   * this, spend grows with browsing rather than with data. */
  if (row.checked !== null) return { reason: "already-looked", spent: 0, documents: 0 };

  const client = DOCUMENT_CLIENTS[row.source_name];
  /* NOT stamped on this path. We did not look; we were unable to. Stamping
   * would record an absence of capability as an absence of documents, which
   * is the D3 error in a third place. */
  if (!client || !row.external_id) return { reason: "unsupported", spent: 0, documents: 0 };

  if ((await spentThisMonth(row.source_name)) >= MONTHLY_RECORD_CEILING) {
    return { reason: "ceiling", spent: 0, documents: 0 };
  }

  /* Page one and stop -- CLAUDE.md §5.2. The client does not page. */
  const fetched = await client.fetchFor(row.external_id, fetchImpl);

  /* ONE TRANSACTION, and the reason is the failure it prevents: documents
   * written but the stamp lost means the next open pays again for rows we
   * already hold. The tally is inside for the mirror-image reason -- a tally
   * that survives a rolled-back write over-reports forever. */
  await tx(async (q) => {
    for (const d of fetched.documents) {
      await q.run(
        `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
         VALUES ($1, $2, $3, 'pending')`,
        [row.id, d.filename, d.sourceUrl],
      );
    }
    await q.run(`UPDATE solicitation SET attachments_checked_at = now() WHERE id = $1`, [row.id]);
    await recordSpend(q, {
      sourceId: row.source_id,
      endpoint: "document",
      records: fetched.records,
      solicitationId: row.id,
    });
  });

  return { reason: "fetched", spent: fetched.records, documents: fetched.documents.length };
}
