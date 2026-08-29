import { afterAll, expect, test, vi } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

/* Point at a scratch SCHEMA before importing anything that opens a pool.
 * discover.ts has a STATIC top-level `import ... from "../db/index.js"`
 * (correct there -- every export of discover.ts is db-backed, unlike
 * precedence.ts, which keeps a pure half free of any database import). That
 * means importing discover.js itself, not only db/index.js directly, must
 * happen AFTER useTestSchema() runs: a static `import` at the top of THIS
 * file is hoisted ahead of any top-level statement regardless of where it
 * sits in the source, so db/index.ts's module-level `pool` would otherwise
 * get built from whatever DATABASE_URL happened to be ambient (unset under
 * `npm run check`, or the real one under a plain `vitest run` with .env
 * loaded) with no TENDERFOOT_SCHEMA search_path at all -- not this test's
 * isolated schema. Every other db-backed test file in this codebase
 * (db/schema.test.ts, db/migrate.test.ts, db/health-schema.test.ts,
 * extract/accuracy.test.ts) avoids exactly this by importing such modules
 * dynamically, after useTestSchema(); this file follows the same shape. */
useTestSchema("discover");

/* Ruling 6 (SP2 T2 coordinator review), same as every other db-backed test
 * file (db/schema.test.ts, db/migrate.test.ts, extract/accuracy.test.ts):
 * the shared Neon test-branch compute cold-starts at ~1.1s and is contended
 * by parallel test files, so the 5000ms/10000ms defaults are too tight. */
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const { migrate } = await import("../db/migrate.js");
const { discoverAttachments } = await import("./discover.js");
const { all, insert, close } = await import("../db/index.js");

afterAll(async () => {
  await close();
});

const SAM_RESPONSE = {
  _embedded: {
    opportunityAttachmentList: [
      {
        attachments: [
          { name: "RFP.pdf", resourceId: "r1", type: "file", fileExists: "1" },
          { name: "Pricing.xlsx", resourceId: "r2", type: "file", fileExists: "1" },
          { name: "Gone.pdf", resourceId: "r3", type: "file", fileExists: "0" },
        ],
      },
    ],
  },
};

test("inserts one pending document per existing attachment", async () => {
  await resetSchema();
  /* resetSchema() drops every table migrate() created, including
   * schema_migrations itself -- each test in this file wants its own
   * independently empty schema (unlike the other db-backed test files,
   * which reset once for the whole file), so migrate() must be re-run
   * after every reset or the INSERT below fails with "relation
   * \"solicitation\" does not exist". */
  await migrate(false);
  await insert(
    `INSERT INTO solicitation (title, external_id, closes_at)
     VALUES ('live one', 'abc123', $1) RETURNING id`,
    [new Date(Date.now() + 86_400_000).toISOString()],
  );
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));

  const r = await discoverAttachments(10, stub as unknown as typeof fetch);

  expect(r.documents).toBe(2); // fileExists "0" is not a document
  const docs = await all<{ filename: string; extract_status: string; source_url: string }>(
    `SELECT filename, extract_status, source_url FROM document ORDER BY filename`,
  );
  expect(docs.map((d) => d.filename)).toEqual(["Pricing.xlsx", "RFP.pdf"]);
  expect(docs.every((d) => d.extract_status === "pending")).toBe(true);
  expect(docs.every((d) => d.source_url.length > 0)).toBe(true);
});

test("writes the portal's own values as listing rows", async () => {
  /* WITHOUT THIS, NOTHING EVER WRITES origin='listing'. The accuracy query in
   * Task 8 self-joins on it, so it would return zero rows forever, and the
   * spec's whole ground-truth argument -- "the portal listing doubles as
   * ground truth ... Accuracy is a query" -- would be unbuildable. */
  await resetSchema();
  await migrate(false);
  await insert(
    `INSERT INTO solicitation (title, external_id, closes_at, set_aside, kind)
     VALUES ('live one', 'abc123', $1, 'SBA', 'RFP') RETURNING id`,
    [new Date(Date.now() + 86_400_000).toISOString()],
  );
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));

  await discoverAttachments(10, stub as unknown as typeof fetch);

  const listing = await all<{ field_name: string; value_text: string | null }>(
    `SELECT field_name, value_text FROM extracted_field
      WHERE origin = 'listing' ORDER BY field_name`,
  );
  const byName = Object.fromEntries(listing.map((r) => [r.field_name, r.value_text]));
  expect(byName["set_aside"]).toBe("SBA");
  expect(byName["closes_at"]).not.toBeNull();
  /* A field the portal does not carry is ABSENT, not omitted -- the same
   * three-state discipline the document side uses. */
  expect(byName).toHaveProperty("qa_closes_at", null);
});

test("does not duplicate listing rows when run twice", async () => {
  /* Discover skips solicitations that already have documents, but a
   * solicitation with NO attachments would be revisited. */
  await resetSchema();
  await migrate(false);
  await insert(
    `INSERT INTO solicitation (title, external_id, closes_at) VALUES ('s', 'abc123', $1) RETURNING id`,
    [new Date(Date.now() + 86_400_000).toISOString()],
  );
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));
  await discoverAttachments(10, stub as unknown as typeof fetch);
  await discoverAttachments(10, stub as unknown as typeof fetch);
  const rows = await all<{ c: string }>(
    `SELECT count(*) AS c FROM extracted_field WHERE origin = 'listing' AND field_name = 'closes_at'`,
  );
  expect(Number(rows[0]?.c)).toBe(1);
});

test("skips solicitations whose deadline has passed", async () => {
  await resetSchema();
  await migrate(false);
  await insert(
    `INSERT INTO solicitation (title, external_id, closes_at) VALUES ('closed', 'old', '2020-01-01') RETURNING id`,
  );
  const stub = vi.fn(async () => new Response("{}", { status: 200 }));
  const r = await discoverAttachments(10, stub as unknown as typeof fetch);
  expect(r.solicitations).toBe(0);
  expect(stub).not.toHaveBeenCalled();
});
