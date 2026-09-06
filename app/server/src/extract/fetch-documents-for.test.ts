/* THE SPEND GUARD. Every test here is about not paying twice. */
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_fetch_documents_for");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, one, close, insert, run } = await import("../db/index.js");
const { fetchDocumentsFor } = await import("./fetch-documents-for.js");

let samId: number;
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
  solicitationId = await insert(
    `INSERT INTO solicitation (title, source_id, external_id, posted_at, posted_at_origin)
     VALUES ('doc fixture', $1, 'notice-1', '2026-08-01', 'published') RETURNING id`,
    [samId],
  );
});

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
