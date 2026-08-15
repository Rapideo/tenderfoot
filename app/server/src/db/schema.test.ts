import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { useTestSchema, resetSchema } from "./testdb.js";

/* Scratch schema. Set before importing anything that opens a pool. */
const SCHEMA = useTestSchema("test_schema");
await resetSchema();

/* Ruling 6 (SP2 T2 coordinator review). Vitest's default 5000ms testTimeout
 * is too tight for tests that do live network round trips against the
 * shared Neon test-branch compute: a cold start alone measures ~1.1s, and
 * several agents can be running the suite concurrently against the same
 * compute (each gets its own SCHEMA -- SP1.5 Ruling 3 -- but they still
 * contend for the one compute's connections). corpus.test.ts already
 * carries a 120000ms hook timeout for the exact same underlying reason
 * (~200 rows, each several round trips); 30000ms here is the equivalent
 * margin sized to this file's much smaller workload -- generous enough to
 * absorb contention, not so high that a genuine hang would pass for a slow
 * test. */
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const { migrate } = await import("./migrate.js");
const { all, one, run, insert, close } = await import("./index.js");

beforeAll(async () => {
  await migrate(false);
});

afterAll(async () => {
  await close();
});

/* information_schema, scoped to THIS test's schema by name -- an unscoped
 * table list would see every other schema in the same database (other test
 * files, other runs) and pass for the wrong reason. */
const tables = async () =>
  (
    await all<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1",
      [SCHEMA],
    )
  ).map((r) => r.table_name);

test("all eleven objects plus the two alias tables exist", async () => {
  const t = await tables();
  for (const name of [
    "organization",
    "vendor",
    "firm_profile",
    "solicitation",
    "award",
    "contract",
    "source",
    "sighting",
    "document",
    "assessment",
    "pursuit",
    "organization_alias",
    "vendor_alias",
  ]) {
    expect(t, `${name} missing`).toContain(name);
  }
});

/* §2.2 -- the whole point of putting FKs in the first migration is that they
 * are enforced. An unenforced constraint is a comment. 23503 is
 * foreign_key_violation, asserted by SQLSTATE rather than message text,
 * which is localised and version-dependent. */
test("foreign keys are enforced, not decorative", async () => {
  await expect(
    run("INSERT INTO solicitation (org_id, title) VALUES (99999, 'ghost')"),
  ).rejects.toMatchObject({ code: "23503" });
});

/* §4.4 -- many sightings, one canonical record. If a unique constraint ever
 * appears on sighting.solicitation_id, deduplication across sources dies. */
test("many sightings may point at one solicitation", async () => {
  const orgId = await insert(
    "INSERT INTO organization (name) VALUES ('Test Agency') RETURNING id",
  );
  const solId = await insert(
    "INSERT INTO solicitation (org_id, title) VALUES ($1, 'Test RFP') RETURNING id",
    [orgId],
  );
  const srcId = await insert(
    "INSERT INTO source (name) VALUES ('Test Source') RETURNING id",
  );

  await run("INSERT INTO sighting (source_id, solicitation_id) VALUES ($1, $2)", [srcId, solId]);
  await run("INSERT INTO sighting (source_id, solicitation_id) VALUES ($1, $2)", [srcId, solId]);

  const n = await one<{ n: number }>(
    "SELECT count(*) AS n FROM sighting WHERE solicitation_id = $1",
    [solId],
  );
  expect(n!.n).toBe(2);
});

/* §4.2 -- KP is one vendor row with is_self. A second would make "which
 * firm is this system for" ambiguous, which is the portability claim. */
test("only one vendor may be is_self", async () => {
  /* Migration 004 already seeds the self vendor, so this asserts that a
   * SECOND one is refused rather than creating the first. Written before that
   * seed existed and corrected when it arrived. 23505 is unique_violation. */
  const selves = await one<{ n: number }>("SELECT count(*) AS n FROM vendor WHERE is_self");
  expect(selves!.n).toBe(1);
  await expect(
    run("INSERT INTO vendor (name, is_self) VALUES ('Impostor', true)"),
  ).rejects.toMatchObject({ code: "23505" });
});

test("aliases cascade when their entity is deleted", async () => {
  const orgId = await insert(
    "INSERT INTO organization (name) VALUES ('Doomed Agency') RETURNING id",
  );
  await run("INSERT INTO organization_alias (org_id, alias) VALUES ($1, 'DA')", [orgId]);
  await run("DELETE FROM organization WHERE id = $1", [orgId]);
  const n = await one<{ n: number }>(
    "SELECT count(*) AS n FROM organization_alias WHERE org_id = $1",
    [orgId],
  );
  expect(n!.n).toBe(0);
});

/* §5.5.1 -- the standing rule. A source defaults to OUT, and the posture
 * vocabulary is closed so a typo cannot invent a fourth state. 23514 is
 * check_violation. */
test("a source defaults to legal_posture 'out' and rejects unknown postures", async () => {
  const id = await insert("INSERT INTO source (name) VALUES ('Unvetted Portal') RETURNING id");
  const row = await one<{ legal_posture: string }>(
    "SELECT legal_posture FROM source WHERE id = $1",
    [id],
  );
  expect(row!.legal_posture).toBe("out");
  await expect(
    run("INSERT INTO source (name, legal_posture) VALUES ('Bad', 'probably-fine')"),
  ).rejects.toMatchObject({ code: "23514" });
});

/* Mechanical vs smart must be recorded IN THE DATA (Pinned-Ingestion-
 * Scaffolding, proposal 4). A free-text column would drift into 'llm',
 * 'gpt', 'auto' and stop being comparable. */
test("document.produced_by accepts only the two modes, or nothing yet", async () => {
  const sol = await one<{ id: number }>("SELECT id FROM solicitation LIMIT 1");
  await run(
    "INSERT INTO document (solicitation_id, filename, produced_by) VALUES ($1, 'a.pdf', $2)",
    [sol!.id, "mechanical"],
  );
  await run(
    "INSERT INTO document (solicitation_id, filename, produced_by) VALUES ($1, 'a.pdf', $2)",
    [sol!.id, "smart"],
  );
  await run(
    "INSERT INTO document (solicitation_id, filename, produced_by) VALUES ($1, 'a.pdf', $2)",
    [sol!.id, null],
  );
  await expect(
    run(
      "INSERT INTO document (solicitation_id, filename, produced_by) VALUES ($1, 'a.pdf', $2)",
      [sol!.id, "llm"],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});

/* §1.1 -- matching is parked. The table exists so scorer_version never has
 * to be retrofitted; nothing writes to it in V1. */
test("assessment exists and is empty", async () => {
  const n = await one<{ n: number }>("SELECT count(*) AS n FROM assessment");
  expect(n!.n).toBe(0);
});

/* The Source Registry seed (003). These assert the RESEARCH survived into
 * the database, not merely that rows exist -- the registry is V1's only
 * control surface, and a seed that quietly loses a legal posture or a
 * verified facet is worse than an empty table. */
test("the source registry is seeded, and nothing is enabled yet", async () => {
  /* Assert the seeded rows BY NAME rather than a total count: earlier tests
   * in this file insert their own sources, and a bare count would fail for a
   * reason that has nothing to do with the seed. Same brittleness as the
   * migration list this suite already learned about. */
  const seeded = [
    "SAM.gov",
    "USASpending",
    "Indiana IDOA solicitations",
    "Indiana EDS contract register",
    "Illinois BidBuy",
    "Michigan SIGMA VSS",
    "Kentucky eMARS VSS",
    "Ohio OhioBuys",
    "GovWin IQ",
    "BidNet Direct",
    "BidPrime",
  ];
  const names = (await all<{ name: string }>("SELECT name FROM source")).map((r) => r.name);
  for (const n of seeded) expect(names, `${n} missing from the seed`).toContain(n);

  /* SP3 turns the first one on deliberately, and only after the ingestion
   * window exists in code. */
  const on = await one<{ n: number }>("SELECT count(*) AS n FROM source WHERE enabled");
  expect(on!.n).toBe(0);
});

test("legal postures match the 2026-08-12 research", async () => {
  const posture = async (name: string) =>
    (
      await one<{ legal_posture: string }>("SELECT legal_posture FROM source WHERE name = $1", [
        name,
      ])
    )?.legal_posture;
  expect(await posture("Illinois BidBuy")).toBe("in");
  expect(await posture("Michigan SIGMA VSS")).toBe("in");
  expect(await posture("Kentucky eMARS VSS")).toBe("in");
  expect(await posture("Ohio OhioBuys")).toBe("manual-only");
  for (const agg of ["GovWin IQ", "BidNet Direct", "BidPrime"]) {
    expect(await posture(agg), `${agg} must stay out`).toBe("out");
  }
});

/* §5.5.1 -- the evidence is recorded ON THE ROW. A posture without a note
 * is a decision nobody can audit, which is the thing the rule exists to
 * prevent. */
test("every non-default posture carries its evidence", async () => {
  const rows = await all<{ name: string; legal_note: string | null }>(
    "SELECT name, legal_note FROM source WHERE legal_posture != 'out' OR name LIKE '%Bid%' OR name LIKE '%GovWin%'",
  );
  for (const r of rows) {
    expect(r.legal_note, `${r.name} has no legal_note`).toBeTruthy();
  }
});

/* DELETED 2026-08-13. It asserted that verified_facets parses as JSON. The
 * column is jsonb now, so the database refuses invalid JSON at write time
 * and the test can no longer fail. A test that cannot fail is not a test.
 * The GUARANTEE got stronger; the assertion became noise. */

/* §5.4. The silent-failure record is the most expensive thing we learned,
 * and it lives here so an adapter author reads it before repeating it. */
test("the silent-failure findings survived into the registry", async () => {
  /* jsonb comes back already parsed -- no JSON.parse here, unlike the
   * SQLite version, where verified_facets was TEXT. */
  const sam = await one<{ v: { silently_ignored?: string[] } }>(
    "SELECT verified_facets AS v FROM source WHERE name = 'SAM.gov'",
  );
  expect(sam!.v.silently_ignored).toContain("sort=-publishDate");

  const mi = await one<{ v: { silently_ignored?: string[] } }>(
    "SELECT verified_facets AS v FROM source WHERE name = 'Michigan SIGMA VSS'",
  );
  expect(mi!.v.silently_ignored).toContain("Show Me");
});
