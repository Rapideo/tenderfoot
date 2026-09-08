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
import { one, run, tx } from "../db/index.js";
import { DOCUMENT_CLIENTS, type DocumentFetchResult } from "./document-clients.js";
import { recordSpend, spentThisMonth, MONTHLY_RECORD_CEILING } from "./api-spend.js";
/* Task 7 review round 2. `COVERAGE.unparseableResponseRecords` is coverage/
 * thresholds.ts's own answer to "the most a single call could plausibly have
 * cost when we cannot read its response" (it reuses maxRecordsPerRun's 40,
 * an 8x margin over R5's measured 5 records/day) -- reused here rather than
 * a second, drift-prone guess, for the exact same question at a second call
 * site. Cross-importing from extract/ into coverage/ already has precedent:
 * document-clients.ts does it for higherGovClient itself. */
import { COVERAGE } from "../coverage/thresholds.js";
import { isMeteredSourceName } from "../scrape/adapters/registry.js";

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

  /* 🔴 FIXED (Task 7 review round 2, the same defect run.ts was fixed for).
   * `>= MONTHLY_RECORD_CEILING` only refuses once the ceiling is ALREADY
   * crossed -- a month sitting one record under it would still wave through
   * a call that could cost up to COVERAGE.unparseableResponseRecords more,
   * crossing the ceiling anyway. The refusal must account for what THIS call
   * could still spend, not merely what has already been spent. */
  const alreadySpent = await spentThisMonth(row.source_name);
  if (alreadySpent + COVERAGE.unparseableResponseRecords > MONTHLY_RECORD_CEILING) {
    return { reason: "ceiling", spent: 0, documents: 0 };
  }

  /* Page one and stop -- CLAUDE.md §5.2. The client does not page. */
  let fetched: DocumentFetchResult;
  try {
    fetched = await client.fetchFor(row.external_id, fetchImpl);
  } catch (err) {
    /* 🔴 THE THIRD CALL SITE (Task 7 review round 2). Before HigherGov was
     * registered, `client` here was always SAM.gov -- free, and every one of
     * its own thrown paths ("a non-OK response throws, so the caller leaves
     * no stamp") always cost zero regardless of whether this caught it.
     * Registering the first METERED document client made this reachable:
     * highergov-client.ts's fetchDocuments can throw AFTER the vendor has
     * already billed ~11 records (a malformed 200, a non-array "results" --
     * its own two guards), and until now nothing here tallied that --
     * exactly the under-report api-spend.ts's header calls the dangerous
     * direction. Same reasoning as run.ts's two call sites (and the same
     * constant): we cannot know what an unparseable response actually cost,
     * so we tally the conservative upper bound before letting the error
     * propagate, rather than silently losing a call the vendor already
     * booked.
     *
     * ⚠️ SCOPED TO A KNOWN-METERED SOURCE, NOT EVERY THROW. `client` here is
     * whichever `DOCUMENT_CLIENTS[row.source_name]` resolves to, and SAM.gov
     * is UNCONDITIONALLY free -- no path through it, success or failure, was
     * ever billed a real record (its own header: "SAM.gov costs nothing.
     * The zero is what lets D2's whole mechanism be proven..."). Tallying a
     * "conservative" spend against SAM on a network hiccup would not be
     * conservative, it would be FABRICATED: api_spend exists to record what
     * the VENDOR billed, and SAM never bills anything, on any path. A first
     * attempt at this fix tallied unconditionally and broke the pre-existing
     * "a failed fetch leaves no stamp, no documents and no tally row" test
     * for exactly that reason -- real evidence, not a guess, that the
     * unscoped version was wrong. The risk this branch exists for is
     * specific to a source whose true cost cannot be read back from the
     * vendor at all (CLAUDE.md §5.1); today that is HigherGov alone.
     *
     * 🔴 FIXED (code review off the D2 branch): this used to compare
     * `row.source_name === HIGHERGOV_SOURCE_NAME` -- a positive equality
     * check against one hardcoded name, correct today only because HigherGov
     * happens to be the only metered document client. The day a second one
     * is registered, a billed call that throws would vanish from `api_spend`
     * silently, and no existing test would fail, because every test here was
     * written around the one source named in the comparison. `registry.ts`
     * already carries `metered: true` as a structural property of the
     * registry entry (`resolve-source.ts` already refuses metered sources on
     * that property, not on a name) -- `isMeteredSourceName` is the
     * name-keyed form of the same question, so this branch now tracks the
     * registry's own flag for however many metered sources ever exist, not a
     * string literal. */
    if (isMeteredSourceName(row.source_name)) {
      await recordSpend(
        { run },
        {
          sourceId: row.source_id,
          endpoint: "document",
          records: COVERAGE.unparseableResponseRecords,
          solicitationId: row.id,
        },
      );
    }
    throw err;
  }

  /* FINAL-REVIEW FIX: the spend is recorded HERE, in its own committed write,
   * before `tx()` even opens -- not inside the transaction below. By the time
   * `fetchFor` has returned, the vendor has already metered the call; nothing
   * that happens next can un-bill it. Tallying inside the transaction meant a
   * later failure writing documents rolled the tally back too, so the vendor
   * had charged us for a call our own records showed as free. Against a
   * ceiling whose true consumption CANNOT be read back from the vendor
   * (CLAUDE.md §5.1), under-reporting is the dangerous direction: it is what
   * lets an operator believe there is budget left when there is not. A
   * spend row that outlives a rolled-back document write is simply
   * over-reporting, which is safe, not a bug -- migration 030's own header
   * says it plainly: "records IS WHAT THE VENDOR BILLED, NOT WHAT WE KEPT." */
  await recordSpend(
    { run },
    {
      sourceId: row.source_id,
      endpoint: "document",
      records: fetched.records,
      solicitationId: row.id,
    },
  );

  /* ONE TRANSACTION for the two writes that must commit together: documents
   * written but the stamp lost means the next open pays again for rows we
   * already hold. The spend above is deliberately NOT part of this -- see the
   * comment there. */
  await tx(async (q) => {
    for (const d of fetched.documents) {
      /* 🔴 Task 7 review round 2. HigherGov's ~11-record purchase buys
       * already-extracted text (docs/2026-09-03-highergov-field-mapping.md
       * §2's `text_extract`) for most `.docx` documents -- discarding it here
       * and leaving the row `pending` meant run-extract.ts would later reach
       * it (no source_url to fetch bytes from) and mark it `failed` with a
       * message about recovering a bundle member, which is wrong for every
       * HigherGov document: there is no parent bundle, and the text this
       * "failure" claims we could not get was already sitting in `fetched`.
       * A non-empty string is the ONLY thing that earns 'extracted' --
       * `undefined` (SAM, which has no such concept) and `null`/'' (HigherGov
       * .xlsx, which the vendor never extracts) do not.
       *
       * ⚠️ THE SENTENCE THAT USED TO END THIS PARAGRAPH WAS WRONG, and the
       * block below is the correction: it claimed a text-less row was left
       * "'pending' ... picked up by the normal download queue or (for a
       * null-source_url row) the existing stranded-member handling in
       * run-extract.ts". The stranded-member handling only ever touches rows
       * with a `parent_document_id`, which these do not have, and the
       * download queue has nothing to download. See below. */
      const hasText = typeof d.extractedText === "string" && d.extractedText.length > 0;

      /* 🔴 FINAL REVIEW, FIX 5: 'pending' WAS A LIE FOR EVERY `.xlsx`, AND
       * `.xlsx` IS WHERE THE COST PROPOSALS LIVE.
       *
       * The comment above used to promise that a HigherGov row with no
       * text_extract would be "picked up by the normal download queue or
       * (for a null-source_url row) the existing stranded-member handling in
       * run-extract.ts". Neither happens. run-extract.ts's queue selects
       * `extract_status = 'pending'`, finds a parser (`.xlsx` IS supported,
       * parse.ts), then hits its own no-source_url branch and records
       * `failed` with "no source_url: expand its parent bundle again to
       * recover this member" -- a message about a parent bundle HigherGov
       * documents do not have, because document-clients.ts sets sourceUrl
       * null for all of them (the address field embeds the api_key or expires
       * in 60 minutes, so it is never stored). The row then sits 'failed'
       * forever, and `attachments_checked_at` is already stamped, so
       * fetchDocumentsFor's own guard above will never re-buy it. A ~11-record
       * purchase bought a filename and a misleading permanent failure.
       *
       * So the honest state is recorded HERE, at the point the fact is known,
       * rather than queueing a row that cannot succeed and letting a later
       * pass invent a reason for it.
       *
       * ⚖️ WHY 'failed' AND NOT 'absent'. The vocabulary is fixed by
       * migration 002 -- pending | extracted | absent | failed -- and this
       * invents nothing new. 'absent' means WE READ IT AND THE VALUE IS NOT
       * THERE: precedence.ts counts 'extracted' and 'absent' together as "the
       * two states that mean the extractor got to read it", and uses them as
       * the denominator for the miss rate. Marking this 'absent' would enter
       * a document nobody ever read into that denominator and manufacture
       * misses out of a fetch we could not make -- precedence.ts's own words:
       * "a document we never managed to read is not a missed extraction, it
       * is a missed FETCH, and conflating them would blame the extractor for
       * the network." 'failed' is exactly that state, and it is excluded from
       * the denominator for exactly that reason.
       *
       * ⚠️ NOTHING THAT COULD SUCCEED IS MARKED FAILED. The condition is
       * source-agnostic and narrow: no text AND no address. A row with an
       * address stays 'pending' and goes through the ordinary download queue
       * (every SAM row, which is why that path is untouched); a row with text
       * is 'extracted'. Only a row with neither -- no bytes to fetch and no
       * text to keep -- is terminal, and it is terminal as a matter of
       * arithmetic, not policy. */
      const unreachable = !hasText && !d.sourceUrl;
      await q.run(
        `INSERT INTO document
           (solicitation_id, filename, source_url, extracted_text, extract_status, source_note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          row.id,
          d.filename,
          d.sourceUrl,
          hasText ? d.extractedText : null,
          hasText ? "extracted" : unreachable ? "failed" : "pending",
          unreachable
            ? "not read: the source returned no extracted text for this file and no address " +
              "to fetch it from, so there are no bytes to parse. This is terminal -- the " +
              "solicitation is stamped as checked and re-asking would cost metered records " +
              "for the same answer."
            : null,
        ],
      );
    }
    await q.run(`UPDATE solicitation SET attachments_checked_at = now() WHERE id = $1`, [row.id]);
  });

  return { reason: "fetched", spent: fetched.records, documents: fetched.documents.length };
}
