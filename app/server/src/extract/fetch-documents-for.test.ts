/* THE SPEND GUARD. Every test here is about not paying twice. */
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

/* Task 7 review round 2. The new HigherGov-sourced tests below go through
 * the REAL higherGovDocumentClient -> higherGovClient.fetchDocuments chain
 * (DOCUMENT_CLIENTS["HigherGov"] is not swapped out for a fake), so apiKey()
 * runs and needs this set. HARD-SET rather than `??=`, same reasoning as
 * highergov-client.test.ts's own comment: if .env carries a real key,
 * defaulting would interpolate it into a URL string this file never sends
 * anywhere, but CLAUDE.md §5.3's posture is that this value is never handled
 * casually. */
process.env.HIGHERGOV_API_KEY = "TESTKEYTESTKEYTESTKEYTESTKEY0000";

useTestSchema("test_fetch_documents_for");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, one, close, insert, run } = await import("../db/index.js");
const { fetchDocumentsFor } = await import("./fetch-documents-for.js");
const { MONTHLY_RECORD_CEILING } = await import("./api-spend.js");
const { COVERAGE } = await import("../coverage/thresholds.js");

let samId: number;
let higherGovId: number;
let solicitationId: number;

const ONE_ATTACHMENT = {
  _embedded: {
    opportunityAttachmentList: [
      { attachments: [{ name: "rfp.pdf", resourceId: "abc123", fileExists: "1" }] },
    ],
  },
};
const stubFetch = (body: unknown, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

beforeAll(async () => {
  await migrate(false);
}, 120000);

beforeEach(async () => {
  await run(`DELETE FROM api_spend`);
  await run(`DELETE FROM document`);
  await run(`DELETE FROM solicitation WHERE title = 'doc fixture'`);
  samId = await one<{ id: number }>(`SELECT id FROM source WHERE name = 'SAM.gov'`).then(
    (r) => r!.id,
  );
  /* Seeded by migration 019 -- the same row highergov-client.ts and run.ts
   * assert exists before spending. */
  higherGovId = await one<{ id: number }>(`SELECT id FROM source WHERE name = 'HigherGov'`).then(
    (r) => r!.id,
  );
  solicitationId = await insert(
    `INSERT INTO solicitation (title, source_id, external_id, posted_at, posted_at_origin)
     VALUES ('doc fixture', $1, 'notice-1', '2026-08-01', 'published') RETURNING id`,
    [samId],
  );
});

async function insertHigherGovSolicitation(externalId: string): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id, external_id, posted_at, posted_at_origin)
     VALUES ('doc fixture', $1, $2, '2026-08-01', 'published') RETURNING id`,
    [higherGovId, externalId],
  );
}

afterAll(async () => {
  await close();
});

test("a first fetch writes the documents and stamps the solicitation", async () => {
  const out = await fetchDocumentsFor(solicitationId, stubFetch(ONE_ATTACHMENT));
  expect(out.reason).toBe("fetched");
  expect(out.documents).toBe(1);
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).not.toBeNull();
});

/* 🔴 THE LOAD-BEARING TEST. This is the entire ruling: opening a record
 * twice must cost what opening it once cost. */
test("a second fetch spends nothing and calls nobody", async () => {
  await fetchDocumentsFor(solicitationId, stubFetch(ONE_ATTACHMENT));
  const exploding = (async () => {
    throw new Error("the client must not be called a second time");
  }) as unknown as typeof fetch;

  const out = await fetchDocumentsFor(solicitationId, exploding);
  expect(out.reason).toBe("already-looked");
  expect(out.spent).toBe(0);
});

/* 🔴 §3's third row, and the one that bounds spend. A notice that genuinely
 * has no documents must be as free to reopen as one with twenty. */
test("a solicitation with no documents is still stamped, so reopening is free", async () => {
  const out = await fetchDocumentsFor(solicitationId, stubFetch({ _embedded: {} }));
  expect(out.reason).toBe("fetched");
  expect(out.documents).toBe(0);

  const again = await fetchDocumentsFor(solicitationId, stubFetch(ONE_ATTACHMENT));
  expect(again.reason).toBe("already-looked");
  const docs = await all(`SELECT id FROM document WHERE solicitation_id = $1`, [solicitationId]);
  expect(docs).toHaveLength(0);
});

/* A bad minute must not retire a notice permanently -- discover.ts learned
 * this on 2026-08-30 and it is the same rule here. Errors do not meter, so
 * retrying is free. */
test("a failed fetch leaves no stamp, no documents and no tally row", async () => {
  await expect(fetchDocumentsFor(solicitationId, stubFetch({}, false))).rejects.toThrow();
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).toBeNull();
  expect(await all(`SELECT id FROM api_spend`)).toHaveLength(0);
  expect(await all(`SELECT id FROM document`)).toHaveLength(0);
});

test("a fetch writes exactly one tally row, carrying what it cost", async () => {
  await fetchDocumentsFor(solicitationId, stubFetch(ONE_ATTACHMENT));
  const rows = await all<{ records: number; endpoint: string; solicitation_id: number }>(
    `SELECT records, endpoint, solicitation_id FROM api_spend`,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]!.endpoint).toBe("document");
  expect(rows[0]!.solicitation_id).toBe(solicitationId);
  /* SAM is free. The row proves the call; the zero proves the price. */
  expect(rows[0]!.records).toBe(0);
});

test("a source with no document client spends nothing and is not stamped", async () => {
  const otherSource = await insert(
    `INSERT INTO source (name) VALUES ('Source With No Client') RETURNING id`,
  );
  const other = await insert(
    `INSERT INTO solicitation (title, source_id, external_id, posted_at, posted_at_origin)
     VALUES ('doc fixture', $1, 'x-1', '2026-08-01', 'published') RETURNING id`,
    [otherSource],
  );
  const out = await fetchDocumentsFor(other, stubFetch(ONE_ATTACHMENT));
  expect(out.reason).toBe("unsupported");
  expect(out.spent).toBe(0);
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [other],
  );
  /* NOT stamped: we did not look, we were unable to look. Stamping here
   * would record an absence of capability as an absence of documents. */
  expect(s!.attachments_checked_at).toBeNull();
});

test("an unknown solicitation id is reported, not crashed on", async () => {
  await expect(fetchDocumentsFor(999999, stubFetch(ONE_ATTACHMENT))).rejects.toThrow(/999999/);
});

/* 🔴 THE CEILING REFUSES, IT DOES NOT THROW. An operator who has browsed
 * past the month's allowance should see a reason on the screen, not a stack
 * trace -- and the record itself must still open. */
test("at the ceiling the fetch refuses, without calling the source", async () => {
  const { MONTHLY_RECORD_CEILING } = await import("./api-spend.js");
  await run(
    `INSERT INTO api_spend (source_id, endpoint, records) VALUES ($1, 'document', $2)`,
    [samId, MONTHLY_RECORD_CEILING],
  );
  const exploding = (async () => {
    throw new Error("the ceiling must be checked before the source is called");
  }) as unknown as typeof fetch;

  const out = await fetchDocumentsFor(solicitationId, exploding);
  expect(out.reason).toBe("ceiling");
  expect(out.spent).toBe(0);
  /* Not stamped: we never looked, so a later month must be free to try. */
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).toBeNull();
});

/* 🔴 SPEC §9 ROW 4 — THE TRANSACTION, AND THE SPEND OUTSIDE IT.
 *
 * FINAL-REVIEW CORRECTION: this test used to assert `api_spend` was EMPTY
 * after this failure, on the premise that the tally was written inside the
 * same transaction as the documents and the stamp. It no longer is (see
 * fetch-documents-for.ts's own comment) -- `client.fetchFor` has already
 * returned by the time `tx()` opens, which means the vendor has already
 * billed the call, and the spend is now recorded in its own committed write
 * BEFORE the transaction that writes documents and the stamp even begins.
 * A failure inside that transaction must still roll back the documents and
 * the stamp together (that half of the guarantee is unchanged, and still
 * the point of this test), but it can no longer roll back a spend that was
 * never part of it. The call happened; the tally must say so regardless of
 * what happened afterward while writing what it found. */
test("a failure while writing leaves no documents, no stamp, but DOES leave the tally", async () => {
  /* A filename of NULL violates document.filename NOT NULL, so the INSERT
   * raises INSIDE the transaction -- after some work, before the commit.
   * That is the crash shape the transaction exists for. */
  const twoDocsOneBad = {
    _embedded: {
      opportunityAttachmentList: [
        { attachments: [
          { name: "good.pdf", resourceId: "r1", fileExists: "1" },
          { name: "x".repeat(3), resourceId: "r2", fileExists: "1" },
        ] },
      ],
    },
  };
  /* Force the second insert to fail by making the column reject it. */
  await run(`ALTER TABLE document ADD CONSTRAINT tmp_reject CHECK (filename <> 'xxx')`);
  try {
    await expect(
      fetchDocumentsFor(solicitationId, stubFetch(twoDocsOneBad)),
    ).rejects.toThrow();
  } finally {
    await run(`ALTER TABLE document DROP CONSTRAINT tmp_reject`);
  }

  expect(await all(`SELECT id FROM document WHERE solicitation_id = $1`, [solicitationId]))
    .toHaveLength(0);
  /* THE ONE ASSERTION THIS FIX CHANGES. `client.fetchFor` already answered
   * before the failing transaction ever opened, so the spend it recorded is
   * NOT inside that transaction and must survive its rollback -- the call
   * happened, whatever went wrong writing the documents afterward. */
  expect(await all(`SELECT id FROM api_spend`)).toHaveLength(1);
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).toBeNull();
});

/* 🔴 Task 7 review round 2, finding 1 -- THE THIRD CALL SITE. Before
 * HigherGov was registered, `client.fetchFor` here was always SAM.gov, whose
 * own thrown paths cost nothing regardless of whether anything tallied them.
 * Registering the first METERED document client made a genuinely billed
 * throw reachable: this goes through the REAL higherGovDocumentClient ->
 * higherGovClient.fetchDocuments chain (not a fake client), so a non-OK
 * response throws from inside highergov-client.ts's fetchValidated() AFTER
 * the vendor has already billed. */
test("a throw from a metered client still tallies a conservative spend before the error propagates", async () => {
  const hgSolicitationId = await insertHigherGovSolicitation("hg-notice-throw");
  const failing = (async () => ({
    ok: false,
    status: 500,
    json: async () => ({}),
  })) as unknown as typeof fetch;

  await expect(fetchDocumentsFor(hgSolicitationId, failing)).rejects.toThrow(/HigherGov answered/);

  const spendRows = await all<{ records: number; endpoint: string; solicitation_id: number }>(
    `SELECT records, endpoint, solicitation_id FROM api_spend WHERE solicitation_id = $1`,
    [hgSolicitationId],
  );
  expect(spendRows).toHaveLength(1);
  expect(spendRows[0]!.endpoint).toBe("document");
  /* We cannot know what an unparseable/failed response actually cost, so the
   * SAME conservative upper bound run.ts uses is tallied here -- see this
   * file's own import comment. */
  expect(spendRows[0]!.records).toBe(COVERAGE.unparseableResponseRecords);

  /* Not stamped, and no documents: we never learned what this call carried. */
  const hgStamp = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [hgSolicitationId],
  );
  expect(hgStamp!.attachments_checked_at).toBeNull();
  expect(await all(`SELECT id FROM document WHERE solicitation_id = $1`, [hgSolicitationId]))
    .toHaveLength(0);
});

/* 🔴 Task 7 review round 2, finding 2. HigherGov's /document/ response
 * carries `text_extract` -- already-extracted text (docs/2026-09-03-
 * highergov-field-mapping.md §2) -- and this is the ONLY thing that may earn
 * 'extracted' on arrival; every other source keeps starting 'pending'. */
test("a HigherGov document with text_extract lands extracted, carrying its text", async () => {
  const hgSolicitationId = await insertHigherGovSolicitation("hg-notice-extracted");
  const body = {
    meta: { pagination: { count: 1 } },
    results: [{ file_name: "sow.pdf", text_extract: "already extracted body text" }],
  };

  const out = await fetchDocumentsFor(hgSolicitationId, stubFetch(body));
  expect(out.reason).toBe("fetched");
  expect(out.documents).toBe(1);

  const doc = await one<{ extract_status: string; extracted_text: string | null }>(
    `SELECT extract_status, extracted_text FROM document WHERE solicitation_id = $1`,
    [hgSolicitationId],
  );
  expect(doc!.extract_status).toBe("extracted");
  expect(doc!.extracted_text).toBe("already extracted body text");
});

/* 🔴 THE OTHER HALF, AND THE FINAL REVIEW'S FIX 5. Field-mapping doc §2 says
 * text_extract is NULL for `.xlsx` -- exactly where cost proposals live --
 * and document-clients.ts sets sourceUrl null for every HigherGov row. This
 * test used to assert 'pending' and called that "picked up by the ordinary
 * download-and-parse queue later". It never was. run-extract.ts's queue takes
 * `extract_status = 'pending'`, finds a parser (`.xlsx` IS supported), then
 * hits its no-source_url branch and writes `failed` with a message about
 * re-expanding a parent bundle that HigherGov documents never had -- while
 * `attachments_checked_at` is already stamped, so nothing will ever re-buy
 * the row. The ~11-record purchase bought a filename and a permanent, wrong
 * explanation.
 *
 * The honest state is recorded where the fact is known. 'failed', not
 * 'absent': precedence.ts counts 'absent' as a document the extractor GOT TO
 * READ, and this one was never read. */
test("a HigherGov document with neither text nor an address is terminal, not queued", async () => {
  const hgSolicitationId = await insertHigherGovSolicitation("hg-notice-unreachable");
  const body = {
    meta: { pagination: { count: 1 } },
    results: [{ file_name: "cost-proposal.xlsx" }],
  };

  const out = await fetchDocumentsFor(hgSolicitationId, stubFetch(body));
  expect(out.reason).toBe("fetched");
  expect(out.documents).toBe(1);

  const doc = await one<{
    extract_status: string;
    extracted_text: string | null;
    source_url: string | null;
    source_note: string | null;
  }>(
    `SELECT extract_status, extracted_text, source_url, source_note
       FROM document WHERE solicitation_id = $1`,
    [hgSolicitationId],
  );
  expect(doc!.extract_status).toBe("failed");
  expect(doc!.extracted_text).toBeNull();
  expect(doc!.source_url).toBeNull();
  /* The note must describe THIS source's situation, not a parent bundle. */
  expect(doc!.source_note).toMatch(/no address to fetch it from/);
  expect(doc!.source_note).not.toMatch(/bundle/);
});

/* The row must be invisible to run-extract.ts's queue, which is the whole
 * point of not leaving it 'pending'. Asserted against the queue's own
 * predicate rather than by running the extractor, which would need bytes. */
test("the terminal row is not in run-extract's pending queue", async () => {
  const hgSolicitationId = await insertHigherGovSolicitation("hg-notice-not-queued");
  await fetchDocumentsFor(
    hgSolicitationId,
    stubFetch({ meta: { pagination: { count: 1 } }, results: [{ file_name: "costs.xlsx" }] }),
  );
  const queued = await all(
    `SELECT d.id FROM document d
       JOIN solicitation s ON s.id = d.solicitation_id
      WHERE d.extract_status = 'pending' AND d.parent_document_id IS NULL
        AND d.solicitation_id = $1`,
    [hgSolicitationId],
  );
  expect(queued).toHaveLength(0);
});

/* SAM must keep working exactly as it does: it has no text_extract concept
 * at all (FetchedDocument.extractedText stays `undefined`), and its rows
 * must still land 'pending' -- proving the new logic did not change SAM's
 * pre-existing behaviour.
 *
 * ⚠️ THIS IS ALSO THE BOUNDARY OF FIX 5, which is why source_url is asserted
 * here. Fix 5's condition is "no text AND no address", not "no text": a row
 * that HAS an address can still succeed, so it must keep starting 'pending'
 * and go through the ordinary download queue. Widening that condition would
 * redden this test, which is the point. */
test("SAM documents still land pending, unaffected by the extracted-text change", async () => {
  await fetchDocumentsFor(solicitationId, stubFetch(ONE_ATTACHMENT));
  const doc = await one<{
    extract_status: string;
    extracted_text: string | null;
    source_url: string | null;
  }>(
    `SELECT extract_status, extracted_text, source_url FROM document WHERE solicitation_id = $1`,
    [solicitationId],
  );
  expect(doc!.source_url).not.toBeNull();
  expect(doc!.extract_status).toBe("pending");
  expect(doc!.extracted_text).toBeNull();
});

/* 🔴 Task 7 review round 2, finding 3 -- THE SAME CEILING DEFECT run.ts was
 * fixed for (`>= MONTHLY_RECORD_CEILING` refuses only once the ceiling is
 * ALREADY crossed). A month sitting one record under it must still refuse a
 * call that could cost up to COVERAGE.unparseableResponseRecords more. The
 * old `>=` check would have let this exact case through -- it is a real
 * regression test, not a restatement of the existing exact-ceiling test
 * below. */
test("the ceiling refuses a fetch that would cross it, not only one that already has", async () => {
  await run(`INSERT INTO api_spend (source_id, endpoint, records) VALUES ($1, 'document', $2)`, [
    samId,
    MONTHLY_RECORD_CEILING - 1,
  ]);
  const exploding = (async () => {
    throw new Error("the ceiling must be checked before the source is called");
  }) as unknown as typeof fetch;

  const out = await fetchDocumentsFor(solicitationId, exploding);
  expect(out.reason).toBe("ceiling");
  expect(out.spent).toBe(0);
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).toBeNull();
});

/* The boundary's OTHER side: a fetch that would land EXACTLY on the ceiling
 * has not crossed it, and must still be allowed to proceed. */
test("the ceiling allows a fetch that would land exactly on it", async () => {
  await run(`INSERT INTO api_spend (source_id, endpoint, records) VALUES ($1, 'document', $2)`, [
    samId,
    MONTHLY_RECORD_CEILING - COVERAGE.unparseableResponseRecords,
  ]);
  const out = await fetchDocumentsFor(solicitationId, stubFetch(ONE_ATTACHMENT));
  expect(out.reason).toBe("fetched");
});
