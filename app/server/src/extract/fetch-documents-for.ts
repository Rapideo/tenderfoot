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
import { costOfThrownCall, redact } from "../coverage/highergov-client.js";
import { isMeteredSourceName } from "../scrape/adapters/registry.js";

/* "no-document-key" (2026-09-13): the source's client is keyed by
 * `document_key` and this row has none -- ingested before the key was
 * captured. Nothing is stamped, so the row stays askable.
 *
 * ⚠️ IT NO LONGER ALWAYS COSTS NOTHING (D15, 2026-09-15). Where the client
 * can buy a key, one call is made first; this outcome then means the VENDOR
 * answered and had no key to give, which is a billed call. Free only where
 * the client has no `fetchKeyFor` at all. */
export type FetchReason =
  | "fetched"
  | "already-looked"
  | "unsupported"
  | "no-document-key"
  | "ceiling";

export interface FetchOutcome {
  reason: FetchReason;
  /** Records the vendor billed across every call this open made.
   *
   * ⚠️ NO LONGER "always 0 unless `reason` is 'fetched'", which it was until
   * D15 (2026-09-15). A keyless row now buys its key BEFORE it can ask for
   * documents, and the vendor can answer that lookup without a key -- so a
   * `no-document-key` outcome can carry a real, non-zero cost. Anything
   * reading this to mean "a refusal was free" is reading a rule that has
   * been repealed; `ceiling` and `unsupported` are still genuinely free,
   * because neither reaches the vendor at all. */
  spent: number;
  documents: number;
}

interface Row {
  id: number;
  external_id: string | null;
  document_key: string | null;
  source_id: number;
  source_name: string;
  checked: Date | null;
}

export async function fetchDocumentsFor(
  solicitationId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchOutcome> {
  const row = await one<Row>(
    `SELECT s.id, s.external_id, s.document_key, s.source_id, src.name AS source_name,
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
  /* Captured into a const rather than re-read off `row` below: narrowing on a
   * mutable object property does not survive the intervening awaits and the
   * closure that captures `row`, and the key lookup needs a plain `string`. */
  const externalId = row.external_id;
  /* NOT stamped on this path. We did not look; we were unable to. Stamping
   * would record an absence of capability as an absence of documents, which
   * is the D3 error in a third place. */
  if (!client || !externalId) return { reason: "unsupported", spent: 0, documents: 0 };

  /* 🔴 THE KEY THE CLIENT IS ASKED BY, and the refusal when there is none
   * (2026-09-13). HigherGov's /document/ takes `related_key`, stored as
   * `document_key`; a row ingested before that was captured has none, and
   * the only thing sending anything else buys is a 400. Nothing is stamped
   * on that path (we did not look, and the row must stay askable), and the
   * outcome has a reason of its own so a caller CAN tell it from "no
   * documents".
   *
   * ✅ A CALLER NOW DOES, and the row is no longer simply refused. Two things
   * changed on 2026-09-15: D16 gave Record.tsx the `DOCUMENTS NOT REQUESTED`
   * head for exactly this outcome (deviation D31), retiring the note that
   * used to stand here saying no caller could tell; and D15, directly below,
   * made the missing key something we BUY rather than something we give up
   * on -- so "the request is not made, nothing spent" is true now only of a
   * source with no `fetchKeyFor`. SAM is keyed by external_id, already
   * checked above, and is untouched by either. */
  let key = client.keyedBy === "document-key" ? row.document_key : externalId;

  /* ⚖️ D15 (Matt, 2026-09-15, option A). A keyless row is no longer simply
   * refused: if the source can be ASKED for the key, we buy it here, once,
   * and the row becomes askable for good. All 3,238 HigherGov rows predate
   * the parse that captures it, and a backfill of them would be 3,238-6,500
   * records spent overwhelmingly on rows that are never opened (the sitting
   * ran about one Interested in ten). `fetchKeyFor`'s ABSENCE is what still
   * makes a row refusable -- SAM has no such concept. */
  const needsKeyLookup = !key && typeof client.fetchKeyFor === "function";
  if (!key && !needsKeyLookup) return { reason: "no-document-key", spent: 0, documents: 0 };

  /* 🔴 FIXED (Task 7 review round 2, the same defect run.ts was fixed for).
   * `>= MONTHLY_RECORD_CEILING` only refuses once the ceiling is ALREADY
   * crossed -- a month sitting one record under it would still wave through
   * a call that could cost up to COVERAGE.unparseableResponseRecords more,
   * crossing the ceiling anyway. The refusal must account for what THIS call
   * could still spend, not merely what has already been spent.
   *
   * 🔴 D15 WIDENED THIS, and the widening is the point. The refusal must
   * account for what THIS OPEN could still spend -- which is now up to TWO
   * calls for a keyless row (the key, then the documents), not one. Leaving
   * it at one would let an open begin with exactly one call's headroom, buy
   * the key, and then be unable to afford the documents it was bought for:
   * the worst possible outcome, money spent for nothing. */
  const callsThisOpen = needsKeyLookup ? 2 : 1;
  const alreadySpent = await spentThisMonth(row.source_name);
  if (alreadySpent + callsThisOpen * COVERAGE.unparseableResponseRecords > MONTHLY_RECORD_CEILING) {
    return { reason: "ceiling", spent: 0, documents: 0 };
  }

  /* The conservative tally both metered call sites need, written once. See
   * the long comment on the document call's own catch below for why an
   * unparseable response must be priced at all, why a REFUSAL must not be,
   * and why the tally's own failure may never replace the vendor's error. */
  const tallyThrownCall = async (endpoint: "opportunity" | "document", err: unknown) => {
    if (!isMeteredSourceName(row.source_name)) return;
    try {
      await recordSpend(
        { run },
        {
          sourceId: row.source_id,
          endpoint,
          records: costOfThrownCall(err, COVERAGE.unparseableResponseRecords),
          solicitationId: row.id,
        },
      );
    } catch (tallyErr) {
      console.error(
        redact(
          `Failed to record conservative spend after a vendor error (original error follows): ${
            tallyErr instanceof Error ? (tallyErr.stack ?? tallyErr.message) : String(tallyErr)
          }`,
        ),
      );
    }
  };

  /* D15-A: THE KEY PURCHASE. Committed the moment it is known, in its own
   * write, for the same reason the document spend below is: once the vendor
   * has answered, nothing that fails afterwards can un-bill it, and a key
   * lost to a rolled-back transaction is a key we would buy a second time. */
  let spentOnKey = 0;
  if (needsKeyLookup) {
    let bought: { key: string | null; records: number };
    try {
      bought = await client.fetchKeyFor!(externalId, fetchImpl);
    } catch (err) {
      await tallyThrownCall("opportunity", err);
      throw err;
    }
    spentOnKey = bought.records;
    await recordSpend(
      { run },
      {
        sourceId: row.source_id,
        endpoint: "opportunity",
        records: bought.records,
        solicitationId: row.id,
      },
    );
    /* THE VENDOR ANSWERED AND HAD NO KEY. Still refused, still unstamped --
     * we did not look -- but no longer free, so the cost is reported rather
     * than swallowed. `keylessPaths` on the ingest measures how often this
     * shape occurs; if it is EVERY row, the parse is wrong and not the
     * vendor (review finding, 2026-09-13). */
    if (!bought.key) return { reason: "no-document-key", spent: spentOnKey, documents: 0 };
    await run(`UPDATE solicitation SET document_key = $1 WHERE id = $2`, [bought.key, row.id]);
    key = bought.key;
  }

  /* Unreachable today, and written as a real check rather than a `key!`
   * assertion on purpose: the guard above returns when a row has no key and
   * no way to buy one, and the purchase block either returns or assigns one,
   * so `key` is a string by here. An edit that breaks that invariant should
   * fail as a refusal that costs nothing, not as a request to the vendor
   * carrying `null`. */
  if (!key) return { reason: "no-document-key", spent: spentOnKey, documents: 0 };

  /* Page one and stop -- CLAUDE.md §5.2. The client does not page. */
  let fetched: DocumentFetchResult;
  try {
    fetched = await client.fetchFor(key, fetchImpl);
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
     * 🔴 BUT NOT FOR A REFUSAL (2026-09-08, the phantom 100). A non-OK
     * status is the vendor answering with NO records, and the meter counts
     * records returned -- so that call cost nothing, and tallying the bound
     * for it inflated the ledger by 100 per click on a row that, correctly
     * unstamped, stayed clickable. `costOfThrownCall` is the one place that
     * tells the two apart; this site only asks it. A zero-record row is
     * still written: it is the observation "answered, with nothing", which
     * is what a dashboard reading reconciles against.
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
    /* 🔴 FIXED (same review), and since D15 this lives in `tallyThrownCall`
     * above because a second metered call site now needs it identically. The
     * catch this comment sits in exists so the VENDOR's error always reaches
     * the caller -- but `recordSpend` is a database write and can itself
     * throw (a degraded compute, CLAUDE.md §4's own "Connection terminated
     * unexpectedly"). Unguarded, that second throw would replace `err` before
     * `throw err` below ever ran: the ledger is unaffected either way (no row
     * is written in either case), but the operator would see a database error
     * instead of the vendor's own -- exactly the diagnostic this catch exists
     * to preserve. Same shape as the two equivalent catches in
     * ingest/highergov-cli.ts (commit 05dd64e): the tally is wrapped and its
     * own failure only logged, never allowed to compete with the error it was
     * recording. */
    await tallyThrownCall("document", err);
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

  /* `spent` is the WHOLE operation's bill, so a key bought on the way in
   * (D15) is included. A caller reading this to decide what an open cost
   * must not be handed the documents call alone. */
  return {
    reason: "fetched",
    spent: spentOnKey + fetched.records,
    documents: fetched.documents.length,
  };
}
