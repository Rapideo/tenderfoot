import { afterAll, expect, test, vi } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

/* Same "point at a scratch schema, then import DB-backed modules
 * dynamically" shape discover.test.ts already uses, and for the identical
 * reason: discover-idoa.ts has a static top-level `import ... from
 * "../db/index.js"`, so importing it before useTestSchema() runs would build
 * db/index.ts's pool against whatever DATABASE_URL is ambient rather than
 * this test's isolated schema.
 *
 * Named "test_discover_idoa", not "discover_idoa" -- scripts/clean-test-
 * schemas.mjs only reclaims schemas matching test_%/bench_%/verify_%, and a
 * bare prefix is exactly the leak that script's own header documents having
 * already cost the project once (106 abandoned schemas). */
useTestSchema("test_discover_idoa");

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const { migrate } = await import("../db/migrate.js");
const { discoverIdoaAttachments, IDOA_SOURCE_NAME } = await import("./discover-idoa.js");
const { all, run, insert, close } = await import("../db/index.js");

afterAll(async () => {
  await close();
});

/* Mirrors discover.test.ts's `seed`, plus a `raw` payload -- the whole
 * mechanism under test reads `sighting.raw.documentsUrl`, so a fixture with
 * no sighting row at all could not exist in production (every solicitation
 * has one) and would not exercise anything real. `documentsUrl` defaults to
 * a real-shaped IDOA zip URL rather than being required on every call, since
 * most tests care about the "has one" path. */
interface Fixture {
  externalId: string;
  title?: string;
  documentsUrl?: string | null;
  source?: string;
}

async function seed(f: Fixture): Promise<number> {
  const name = f.source ?? IDOA_SOURCE_NAME;
  await run(`INSERT INTO source (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [name]);
  const id = await insert(
    `INSERT INTO solicitation (title, external_id, source_id)
     SELECT $1, $2, src.id FROM source src WHERE src.name = $3 RETURNING id`,
    [f.title ?? "fixture", f.externalId, name],
  );
  const url = f.documentsUrl === undefined
    ? `https://www.in.gov/idoa/proc/solicitations/files/${f.externalId}.zip`
    : f.documentsUrl;
  const raw = {
    eventId: f.externalId,
    eventName: f.title ?? "fixture",
    agency: "Test Agency",
    description: "a test solicitation",
    responseDueBy: "2099-01-01",
    contact: "buyer@in.gov",
    documentsUrl: url,
  };
  await insert(
    `INSERT INTO sighting (source_id, solicitation_id, external_id, raw)
     SELECT id, $2, $3, $4::jsonb FROM source WHERE name = $1 RETURNING id`,
    [name, id, f.externalId, JSON.stringify(raw)],
  );
  return id;
}

test("a row WITH a documentsUrl produces exactly one pending document, filename taken from the URL", async () => {
  await resetSchema();
  await migrate(false);
  await seed({
    externalId: "002300000087895",
    documentsUrl: "https://www.in.gov/idoa/proc/solicitations/files/002300000087895.zip",
  });

  const r = await discoverIdoaAttachments(10);

  expect(r.solicitations).toBe(1);
  expect(r.documents).toBe(1);
  expect(r.skipped).toBe(0);

  const docs = await all<{ filename: string; source_url: string; extract_status: string }>(
    `SELECT filename, source_url, extract_status FROM document`,
  );
  expect(docs).toHaveLength(1);
  expect(docs[0]?.filename).toBe("002300000087895.zip");
  expect(docs[0]?.source_url).toBe(
    "https://www.in.gov/idoa/proc/solicitations/files/002300000087895.zip",
  );
  expect(docs[0]?.extract_status).toBe("pending");
});

test("a row WITHOUT a documentsUrl is skipped, not thrown", async () => {
  /* 5 of 71 live IDOA rows carry no Bid Documents link at all (adapters/
   * idoa.ts). document.filename is NOT NULL, so a naive implementation that
   * inserts whatever the payload holds -- including null -- would throw
   * 23502 here instead of skipping cleanly. */
  await resetSchema();
  await migrate(false);
  await seed({ externalId: "no-docs-1", documentsUrl: null });

  const r = await discoverIdoaAttachments(10);

  expect(r.solicitations).toBe(1);
  expect(r.documents).toBe(0);
  expect(r.skipped).toBe(1);

  const docs = await all<{ id: number }>(`SELECT id FROM document`);
  expect(docs).toHaveLength(0);
});

test("a solicitation that already has a document is not re-processed", async () => {
  await resetSchema();
  await migrate(false);
  const id = await seed({
    externalId: "already-has-one",
    documentsUrl: "https://www.in.gov/idoa/proc/solicitations/files/already-has-one.zip",
  });
  await insert(
    `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
     VALUES ($1, 'existing.zip', 'https://example.test/existing.zip', 'extracted') RETURNING id`,
    [id],
  );

  const r = await discoverIdoaAttachments(10);

  expect(r.solicitations).toBe(0);
  expect(r.documents).toBe(0);

  /* Still exactly the one pre-existing row -- a second document was not
   * inserted alongside it. */
  const docs = await all<{ filename: string }>(`SELECT filename FROM document`);
  expect(docs.map((d) => d.filename)).toEqual(["existing.zip"]);
});

test("never selects a solicitation from another source", async () => {
  /* The whole mechanism keys off `src.name = IDOA_SOURCE_NAME`. Without that
   * filter this would happily read a SAM.gov (or any other source's) row's
   * `raw` and, if it happened to carry no `documentsUrl` field at all (the
   * ordinary case for every other source), silently count it as `skipped`
   * rather than never selecting it -- which would still look "fine" in a
   * summary count while quietly processing the wrong rows. */
  await resetSchema();
  await migrate(false);
  await seed({ externalId: "sam-1", source: "SAM.gov" });
  await seed({ externalId: "idoa-1" });

  const r = await discoverIdoaAttachments(10);

  expect(r.solicitations).toBe(1);
  expect(r.documents).toBe(1);
  const docs = await all<{ filename: string }>(`SELECT filename FROM document`);
  expect(docs.map((d) => d.filename)).toEqual(["idoa-1.zip"]);
});

test("honours limit", async () => {
  await resetSchema();
  await migrate(false);
  for (let i = 0; i < 3; i++) {
    await seed({ externalId: `many-${i}` });
  }

  const r = await discoverIdoaAttachments(1);

  expect(r.solicitations).toBe(1);
  expect(r.documents).toBe(1);
  const docs = await all<{ id: number }>(`SELECT id FROM document`);
  expect(docs).toHaveLength(1);
});

test("honours budgetMs, reporting only what it actually walked", async () => {
  /* Same reasoning as discover.test.ts's own budget test: `solicitations`
   * must count WALKED candidates, not the size of the query result, or a
   * budget stop would claim work it never did. A budget of 0 forces the
   * clock check at the top of the very first iteration to fail before any
   * candidate is touched -- deterministic, unlike racing a real delay
   * against a fast in-process loop. */
  await resetSchema();
  await migrate(false);
  await seed({ externalId: "would-have-worked" });

  const r = await discoverIdoaAttachments(10, 0);

  expect(r.solicitations).toBe(0);
  expect(r.documents).toBe(0);
  const docs = await all<{ id: number }>(`SELECT id FROM document`);
  expect(docs).toHaveLength(0);
});
