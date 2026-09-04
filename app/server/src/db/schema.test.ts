import { afterAll, beforeAll, expect, test, vi } from "vitest";
/* Importing pg does not OPEN anything -- testdb.ts already imports it at module
 * level -- so this does not violate the "before anything that opens a pool"
 * rule below. The registry assertions need their own admin connection, outside
 * the pool, exactly as resetSchema() uses one. */
import pg from "pg";
import { useTestSchema, resetSchema } from "./testdb.js";

/* Scratch schema. Set before importing anything that opens a pool. */
const SCHEMA = useTestSchema("test_schema");
await resetSchema();

/* Ruling 6 (SP2 T2 coordinator review). Vitest's default 5000ms testTimeout
 * is too tight for tests that do live network round trips against the
 * shared Neon test-branch compute: a cold start alone measures ~1.1s, and
 * several agents can be running the suite concurrently against the same
 * compute, all genuinely contending for its connections.
 *
 * CORRECTED (SP6 final review). This comment used to add, as settled fact,
 * "(each gets its own SCHEMA -- SP1.5 Ruling 3 -- but they still contend for
 * the one compute's connections)". That parenthetical was FALSE for two
 * concurrent LOCAL runs: runSuffix() (testdb.ts) folded in GITHUB_RUN_ID,
 * defaulting to the literal string "local" when unset -- which it always was
 * outside CI -- so two local `npm run check` processes resolved to the SAME
 * schema name, and one's resetSchema() could DROP SCHEMA ... CASCADE the
 * other's tables mid-run. That is what actually produced the flaky,
 * file-varying test failures two review rounds saw from concurrent local
 * runs, and it is why this false claim mattered: it is what sent the first
 * diagnosis to connection contention instead -- contention predicts
 * connection errors, not a single wrong assertion inside an otherwise-
 * passing file. Fixed by scripts/check.mjs minting a TENDERFOOT_RUN_ID
 * (randomUUID()) per invocation, with runSuffix() now reading
 * GITHUB_RUN_ID ?? TENDERFOOT_RUN_ID ?? "local", so concurrent local runs
 * are schema-isolated the same way concurrent CI runs already were. What
 * remains true, and is this hook's actual justification, is the connection
 * contention named above: schema isolation does not create more connections
 * on the one shared compute. corpus.test.ts already carries a 120000ms hook
 * timeout for the exact same underlying reason (~200 rows, each several
 * round trips); 30000ms here is the equivalent margin sized to this file's
 * much smaller workload -- generous enough to absorb contention, not so high
 * that a genuine hang would pass for a slow test. */
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const { migrate } = await import("./migrate.js");
const { all, one, run, run: dbRun, insert, close } = await import("./index.js");

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
    run("INSERT INTO solicitation (org_id, title, source_id) VALUES (99999, 'ghost', (SELECT id FROM source WHERE name = 'SAM.gov'))"),
  ).rejects.toMatchObject({ code: "23503" });
});

/* §4.4 -- many sightings, one canonical record. If a unique constraint ever
 * appears on sighting.solicitation_id, deduplication across sources dies. */
test("many sightings may point at one solicitation", async () => {
  const orgId = await insert(
    "INSERT INTO organization (name) VALUES ('Test Agency') RETURNING id",
  );
  const solId = await insert(
    "INSERT INTO solicitation (org_id, title, source_id) VALUES ($1, 'Test RFP', (SELECT id FROM source WHERE name = 'SAM.gov')) RETURNING id",
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

test("document carries a fetch target and a bundle parent", async () => {
  const cols = await all<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'document'`,
  );
  const names = cols.map((c) => c.column_name);
  expect(names).toContain("source_url");
  expect(names).toContain("parent_document_id");
});

test("extracted_field keeps losing values instead of discarding them", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title, source_id) VALUES ('conflict fixture', (SELECT id FROM source WHERE name = 'SAM.gov')) RETURNING id`,
  );
  await dbRun(
    `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin, produced_by)
     VALUES ($1, 'closes_at', '2026-09-17', 'listing', 'mechanical')`,
    [sol],
  );
  await dbRun(
    `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin, quote, produced_by)
     VALUES ($1, 'closes_at', '2026-08-26', 'document', 'proposals due August 26, 2026', 'mechanical')`,
    [sol],
  );
  const rows = await all<{ origin: string }>(
    `SELECT origin FROM extracted_field WHERE solicitation_id = $1 AND field_name = 'closes_at'`,
    [sol],
  );
  /* Both survive. The conflict IS the two rows. */
  expect(rows).toHaveLength(2);
});

/* 23514 is check_violation, asserted by SQLSTATE rather than message text
 * -- same convention as the FK test above, and for the same reason: a bare
 * .rejects.toThrow() passes on ANY error, so this test would keep "passing"
 * even if a future migration replaced the CHECK with, say, a NOT NULL
 * elsewhere that throws first. */
test("origin is constrained to the two it may be", async () => {
  const sol = await insert(`INSERT INTO solicitation (title, source_id) VALUES ('x', (SELECT id FROM source WHERE name = 'SAM.gov')) RETURNING id`);
  await expect(
    dbRun(
      `INSERT INTO extracted_field (solicitation_id, field_name, origin) VALUES ($1, 'closes_at', 'guess')`,
      [sol],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});

test("a field may have many document rows but only one listing row", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title, source_id) VALUES ('one listing', (SELECT id FROM source WHERE name = 'SAM.gov')) RETURNING id`,
  );
  const doc = `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin, produced_by)
               VALUES ($1, 'closes_at', $2, 'document', 'mechanical')`;
  /* Many document rows are REQUIRED, not merely tolerated. */
  await dbRun(doc, [sol, "2026-08-26"]);
  await dbRun(doc, [sol, "2026-09-17"]);

  await dbRun(
    `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin, produced_by)
     VALUES ($1, 'closes_at', '2026-09-17', 'listing', 'mechanical')`,
    [sol],
  );
  /* 23505 is unique_violation, asserted by SQLSTATE rather than message text. */
  await expect(
    dbRun(
      `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin, produced_by)
       VALUES ($1, 'closes_at', '2026-10-01', 'listing', 'mechanical')`,
      [sol],
    ),
  ).rejects.toMatchObject({ code: "23505" });
});

test("triage_sample records the population it drew from", async () => {
  const src = await insert(`INSERT INTO source (name) VALUES ('sample fixture') RETURNING id`);
  const sample = await insert(
    `INSERT INTO triage_sample (source_id, seed, n_requested, population_size)
     VALUES ($1, 'seed-a', 100, 4812) RETURNING id`,
    [src],
  );
  const row = await one<{ population_size: number; n_requested: number }>(
    `SELECT population_size, n_requested FROM triage_sample WHERE id = $1`,
    [sample],
  );
  /* Both, separately. A source with 40 eligible rows and n=100 draws 40,
   * and one number cannot carry both facts. */
  expect(row?.population_size).toBe(4812);
  expect(row?.n_requested).toBe(100);
});

test("population_size cannot be left off a sample", async () => {
  const src = await insert(`INSERT INTO source (name) VALUES ('no denominator') RETURNING id`);
  await expect(
    dbRun(
      `INSERT INTO triage_sample (source_id, seed, n_requested) VALUES ($1, 'seed-b', 10)`,
      [src],
    ),
  ).rejects.toMatchObject({ code: "23502" });
});

/* This property predates migration 012 (append-only history was already
 * legal in the schema), so this test is not testing 012. It exists as a
 * regression guard: if anyone adds a UNIQUE constraint on
 * pursuit(solicitation_id) in the future, decisions recorded to the same
 * solicitation would silently fail. This test catches that silently-broken
 * invariant. */
test("pursuit permits history -- a regression guard, not a test of 012", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title, source_id) VALUES ('append fixture', (SELECT id FROM source WHERE name = 'SAM.gov')) RETURNING id`,
  );
  await dbRun(`INSERT INTO pursuit (solicitation_id, state) VALUES ($1, 'Interested')`, [sol]);
  await dbRun(
    `INSERT INTO pursuit (solicitation_id, state, reason) VALUES ($1, 'Not Interested', 'reversed')`,
    [sol],
  );
  const rows = await all<{ state: string }>(
    `SELECT state FROM pursuit WHERE solicitation_id = $1`,
    [sol],
  );
  /* Both survive. The reversal IS the second row. */
  expect(rows).toHaveLength(2);
});

test("pursuit_latest index exists, because every read depends on it", async () => {
  const idx = await all<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = 'pursuit'`,
    [SCHEMA],
  );
  expect(idx.map((i) => i.indexname)).toContain("pursuit_latest");
});

/* ---------------------------------------------------------------------------
 * Migration 018/019 -- the rubric's three missing columns, and the first
 * source in this project's history that costs money.
 * ------------------------------------------------------------------------ */

test("018 gives the registry the rubric dimensions it lacked", async () => {
  const cols = (
    await all<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'source'
          AND column_name IN
              ('cost_posture','annual_cost_usd','field_completeness','watermark_field')
        ORDER BY column_name`,
      [SCHEMA],
    )
  ).map((c) => c.column_name);
  expect(cols).toEqual([
    "annual_cost_usd",
    "cost_posture",
    "field_completeness",
    "watermark_field",
  ]);
});

/* A source nobody has priced is not a free source. NULL on annual_cost_usd
 * would mean "free" and "never priced" at once -- the exact conflation
 * health='unknown' exists to avoid (migration 006). */
test("cost_posture keeps free, paid and unknown apart and refuses anything else", async () => {
  const id = await insert(
    `INSERT INTO source (name, cost_posture) VALUES ('cost fixture', 'unknown') RETURNING id`,
  );
  expect(
    (await one<{ cost_posture: string }>(`SELECT cost_posture FROM source WHERE id = $1`, [id]))
      ?.cost_posture,
  ).toBe("unknown");
  await expect(
    dbRun(`INSERT INTO source (name, cost_posture) VALUES ('bad cost', 'cheap')`),
  ).rejects.toThrow();
  await dbRun(`DELETE FROM source WHERE name = 'cost fixture'`);
});

test("every source seeded before 2026-09-03 is free -- none has ever cost money", async () => {
  const paid = await all<{ name: string }>(
    `SELECT name FROM source WHERE cost_posture <> 'free' AND name <> 'HigherGov'`,
  );
  expect(paid.map((r) => r.name)).toEqual([]);
});

test("019 registers HigherGov as the first paid source, disabled and evidenced", async () => {
  const hg = await one<{
    legal_posture: string;
    legal_note: string | null;
    adapter_tier: string | null;
    cost_posture: string;
    annual_cost_usd: number | null;
    watermark_field: string | null;
    enabled: boolean;
    archive_depth: string | null;
  }>(`SELECT legal_posture, legal_note, adapter_tier, cost_posture, annual_cost_usd,
             watermark_field, enabled, archive_depth
        FROM source WHERE name = 'HigherGov'`);

  expect(hg, "HigherGov missing from the registry").toBeDefined();
  /* §5.5.1: posture `in` requires DOCUMENTED PERMISSION recorded on the row. */
  expect(hg!.legal_posture).toBe("in");
  expect(hg!.legal_note).toMatch(/attorney/i);
  expect(hg!.adapter_tier).toBe("1 api");
  expect(hg!.cost_posture).toBe("paid");
  expect(hg!.annual_cost_usd).toBe(500);
  /* `since = last successful run` needs a field to resume on. */
  expect(hg!.watermark_field).toBe("captured_date");
  /* Nothing is ever seeded enabled. */
  expect(hg!.enabled).toBe(false);
  /* The archive is the finding that overturned §5.8 -- it must be on the row. */
  expect(hg!.archive_depth).toMatch(/2013/);
});

/* §5.4. The most expensive thing to rediscover about this source is that three
 * plausible state parameters are accepted and silently ignored. If that fact
 * lives only in a document, the next person writes `pop_state=IN` and scores a
 * national result set. */
test("HigherGov's verified_facets record the silently-ignored state parameters", async () => {
  const row = await one<{ verified_facets: Record<string, unknown> | null }>(
    `SELECT verified_facets FROM source WHERE name = 'HigherGov'`,
  );
  const blob = JSON.stringify(row?.verified_facets ?? {});
  for (const p of ["pop_state", "state", "place_of_performance_state"]) {
    expect(blob, `${p} must be recorded as silently ignored`).toContain(p);
  }
  expect(blob).toContain("search_id");
  expect(blob.toLowerCase()).toContain("silently_ignored");
});

/* The metered allowance is the only budget in this project, and an ingest
 * cannot ask the API how much is left. The constraint has to travel with the
 * row that spends it. */
/* Migration 020. 003's row drew a consequence from a true finding and the
 * consequence turned out false. The finding must survive the correction --
 * IDOA really does publish no archive -- so this asserts BOTH halves: the
 * original fact is still stated, and the superseded claim is gone. */
test("021 adds sole_source and source_key, and sole_source is three-valued", async () => {
  const cols = (
    await all<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'solicitation'
          AND column_name IN ('sole_source', 'source_key') ORDER BY column_name`,
      [SCHEMA],
    )
  ).map((c) => c.column_name);
  expect(cols).toEqual(["sole_source", "source_key"]);

  /* NULL means "the source did not say", which is a different fact from
   * `false` -- the same three-state reasoning as document.extract_status. */
  const id = await insert(
    `INSERT INTO solicitation (title, source_id) VALUES ('021 fixture', 1) RETURNING id`,
  );
  const row = await one<{ sole_source: boolean | null; source_key: string | null }>(
    `SELECT sole_source, source_key FROM solicitation WHERE id = $1`, [id],
  );
  expect(row?.sole_source).toBeNull();
  expect(row?.source_key).toBeNull();
  await dbRun(`DELETE FROM solicitation WHERE id = $1`, [id]);
});

/* The rubric graded SAM.gov R9 UNKNOWN on its first production run -- but that
 * was a MEASURED fact nobody had recorded, not an unmeasured one. 003's own
 * verified_facets already said sort=-modifiedDate works while
 * sort=-publishDate is silently ignored. */
test("021 records the watermarks the registry already knew", async () => {
  const wm = async (name: string) =>
    (
      await one<{ watermark_field: string | null }>(
        `SELECT watermark_field FROM source WHERE name = $1`, [name],
      )
    )?.watermark_field;

  expect(await wm("SAM.gov")).toBe("modifiedDate");
  /* NOT endDate: that is a filter parameter on the Indiana API. The row's own
   * note says "Pagination sorted on publishDate silently dropped ~33% of a
   * window. Stop on modifiedDate instead." */
  expect(await wm("Indiana EDS contract register")).toBe("modifiedDate");
  expect(await wm("HigherGov")).toBe("captured_date");

  /* Sources whose watermark genuinely is unknown must stay NULL. Filling them
   * in with a guess is the failure this column exists to prevent. */
  expect(await wm("Illinois BidBuy")).toBeNull();
  expect(await wm("Michigan SIGMA VSS")).toBeNull();
});

test("020 corrects Indiana's archive claim without erasing the finding", async () => {
  const row = await one<{ archive_depth: string | null; source_note: string | null }>(
    `SELECT archive_depth, source_note FROM source WHERE name = 'Indiana IDOA solicitations'`,
  );
  const depth = row?.archive_depth ?? "";
  /* Still true, still said: IDOA itself retains nothing. */
  expect(depth).toMatch(/NONE AT IDOA/);
  /* The superseded consequence must not be readable as current. */
  expect(depth).toMatch(/CORRECTED 2026-09-03/);
  expect(depth).toMatch(/9,286/);
  /* The red flag and its cost belong on the row, not only in a document. */
  expect(row?.source_note ?? "").toMatch(/idoa-adapter/);
});

test("HigherGov's note carries the quota constraint, not just the capability", async () => {
  const row = await one<{ source_note: string | null }>(
    `SELECT source_note FROM source WHERE name = 'HigherGov'`,
  );
  expect(row?.source_note ?? "").toMatch(/10,?000/);
  expect((row?.source_note ?? "").toLowerCase()).toContain("document");
});

test("023 gives contract the columns an ingest needs", async () => {
  const cols = (
    await all<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'contract'
          AND column_name IN ('source_id','amendment','action_type','amount_cents')
        ORDER BY column_name`,
      [SCHEMA],
    )
  ).map((c) => c.column_name);
  expect(cols).toEqual(["action_type", "amendment", "amount_cents", "source_id"]);
});

/* The contract id is NOT unique: A337-6-CWI-104 appears as amendment 0 (New,
 * $40,000) and amendment 1 (Amendment, $70,000). Keying on external_id alone
 * would collapse a contract's history into one row -- the same class of error
 * as the external_id fusion fixed in migration 022. */
test("023's natural key is (source_id, external_id, amendment)", async () => {
  const src = await insert(`INSERT INTO source (name) VALUES ('023 fixture') RETURNING id`);

  const a = await insert(
    `INSERT INTO contract (source_id, external_id, amendment, amount_cents)
     VALUES ($1, 'A337-6-CWI-104', 0, 4000000) RETURNING id`, [src],
  );
  /* Same contract, different amendment -> a SECOND row, not a conflict. */
  const b = await insert(
    `INSERT INTO contract (source_id, external_id, amendment, amount_cents)
     VALUES ($1, 'A337-6-CWI-104', 1, 7000000) RETURNING id`, [src],
  );
  expect(a).not.toBe(b);

  /* The same amendment twice IS a conflict -- that is what makes a re-run
   * idempotent instead of duplicating. */
  await expect(
    dbRun(
      `INSERT INTO contract (source_id, external_id, amendment, amount_cents)
       VALUES ($1, 'A337-6-CWI-104', 0, 4000000)`, [src],
    ),
  ).rejects.toThrow();

  await dbRun(`DELETE FROM contract WHERE source_id = $1`, [src]);
  await dbRun(`DELETE FROM source WHERE id = $1`, [src]);
});

/* value_cents is the column that will one day hold PUBLISHED figures from
 * HigherGov's /sl-contract/. amount_cents holds what THIS source states, which
 * is a per-amendment delta and not a contract value. Keeping them apart is the
 * whole reason there are two columns. */
test("023 leaves value_cents alone -- it is not where the delta goes", async () => {
  const col = await one<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'contract' AND column_name = 'value_cents'`,
    [SCHEMA],
  );
  expect(col?.column_name).toBe("value_cents");
});


/* The single most expensive thing to rediscover about this source. If it lives
 * only in a spec, the next person writes a pagination loop and silently loads
 * the same 2,000 records twenty-one times. */
test("024 records that the EDS `page` parameter is silently ignored", async () => {
  const row = await one<{
    verified_facets: { silently_ignored?: string[]; page_note?: string } | null;
  }>(`SELECT verified_facets FROM source WHERE name = 'Indiana EDS contract register'`);
  /* Not just "does the blob mention page" -- a renamed or deleted source row
   * makes the migration's UPDATE a silent no-op (0 rows affected, no error),
   * and this asserts the row itself is still there before trusting anything
   * pulled from it. */
  expect(row).toBeDefined();
  /* FIXED (review round 1): checking the whole JSON blob for the substring
   * "page" and the key "silently_ignored" both pass against PRE-migration 003
   * data too -- 003's own `works` array already contains "pageSize" (which
   * contains "page"), and 003 already seeds a `silently_ignored` key. Neither
   * assertion depended on 024 having run. Reading the array itself and
   * checking its exact element and full contents does. */
  expect(row?.verified_facets?.silently_ignored).toContain("page");
  expect(row?.verified_facets?.silently_ignored).toEqual(
    expect.arrayContaining(["sort=-publishDate", "page", "vendorName", "agencyName"]),
  );
  expect(row?.verified_facets?.silently_ignored).toHaveLength(4);
  /* And the evidence, not just the claim. */
  expect(row?.verified_facets?.page_note).toMatch(/identical|same records|pages 1/i);
});

/* ⏰ THE SCHEMA REGISTERS ITS OWN AGE, and this test exists because the
 * registration is deliberately BEST EFFORT -- resetSchema() swallows any error
 * from it so a developer running one test file against a branch with no
 * registry never fails over bookkeeping.
 *
 * That swallowed catch is exactly what makes this test necessary. If
 * registration silently stops working, clean-test-schemas.mjs `--reap` reaps
 * nothing, the orphan backlog rebuilds, and the only symptom is the gate
 * getting slower and failing a different test on every run -- which is how the
 * 87-schema backlog was found on 2026-09-01, and the 106-schema one before it.
 * A no-op reaper looks identical to a working one until it is far too late.
 *
 * The registry table is created by clean-test-schemas.mjs (single-threaded, so
 * ~71 parallel workers never race on the DDL). This test creates it the same
 * way if it is absent, so it passes whether or not the gate ran first. */
test("resetSchema records the schema's creation time, so orphans can be reaped", async () => {
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA IF NOT EXISTS tenderfoot_meta`);
    await admin.query(
      `CREATE TABLE IF NOT EXISTS tenderfoot_meta.test_schema_registry (
         schema_name text PRIMARY KEY,
         created_at  timestamptz NOT NULL DEFAULT now()
       )`,
    );

    /* ⚠️ DELETE FIRST, and this line is the test.
     *
     * Without it this test passes against a row left by a PREVIOUS run: the
     * registration is an upsert, the row survives between runs, and the
     * freshness assertion below has a ten-minute window, so a re-run minutes
     * later still sees a "fresh" row that this run did not write. Proven by
     * mutation -- with registerSchema() stubbed out to do nothing, the version
     * of this test without this DELETE passed, which would have shipped a
     * reaper that silently reaps nothing. */
    await admin.query(`DELETE FROM tenderfoot_meta.test_schema_registry WHERE schema_name = $1`, [
      SCHEMA,
    ]);

    /* Re-register by resetting: the row must appear, and its timestamp must be
     * the DATABASE's clock, not this process's -- a laptop with a skewed clock
     * must never be able to make a live run's schemas look reapable. */
    await resetSchema();

    const { rows } = await admin.query<{ age_seconds: number }>(
      `SELECT EXTRACT(EPOCH FROM (now() - created_at)) AS age_seconds
         FROM tenderfoot_meta.test_schema_registry WHERE schema_name = $1`,
      [SCHEMA],
    );
    expect(rows.length).toBe(1);
    /* Fresh: nowhere near the 3-hour reap threshold. A negative age would mean
     * the timestamp came from somewhere other than the database. */
    expect(Number(rows[0]!.age_seconds)).toBeGreaterThanOrEqual(0);
    expect(Number(rows[0]!.age_seconds)).toBeLessThan(600);
  } finally {
    await admin.end();
  }
});
