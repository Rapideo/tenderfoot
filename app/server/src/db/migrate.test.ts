import { afterAll, expect, test, vi } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { useTestSchema, resetSchema } from "./testdb.js";

/* Point at a scratch SCHEMA before importing anything that opens a pool --
 * the module reads the env vars at import time. */
useTestSchema("test_migrate");
await resetSchema();

/* Ruling 6 (SP2 T2 coordinator review). Vitest's default 5000ms testTimeout
 * is too tight for tests that do live network round trips against the
 * shared Neon test-branch compute: a cold start alone measures ~1.1s, and
 * several agents can be running the suite concurrently against the same
 * compute (each gets its own SCHEMA -- SP1.5 Ruling 3 -- but they still
 * contend for the one compute's connections). A 2.8s observation against a
 * 5000ms ceiling is only 1.8x headroom. corpus.test.ts already carries a
 * 120000ms hook timeout for the exact same underlying reason (~200 rows,
 * each several round trips); 30000ms here is the equivalent margin sized to
 * this file's much smaller workload -- generous enough to absorb
 * contention, not so high that a genuine hang would pass for a slow test. */
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const { migrate, appliedMigrations } = await import("./migrate.js");
const { run, one, insert, close } = await import("./index.js");

afterAll(async () => {
  await close();
});

/* Asserts BEHAVIOUR, not a list of filenames. The first version of this
 * test hard-coded ["001_app_meta.sql"] and broke the moment SP1 added a
 * second migration -- a failure that told us nothing except that the suite
 * was coupled to a list that is supposed to grow. */
test("migrations apply, and applying twice is a no-op", async () => {
  const onDisk = readdirSync(join(import.meta.dirname, "../../migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(onDisk.length).toBeGreaterThan(0);

  const first = await migrate(false);
  expect(first).toEqual(onDisk);

  const second = await migrate(false);
  expect(second).toEqual([]);
  expect(await appliedMigrations()).toEqual(onDisk);
});

/* Was: expect(db.pragma("foreign_keys")).toBe(1) -- an assertion about a
 * SETTING that any second connection could have lost. Postgres enforces FKs
 * unconditionally, so the correct test is that a violation is REFUSED.
 * 23503 is foreign_key_violation; asserted by SQLSTATE rather than by
 * message text, which is localised and version-dependent. */
test("foreign keys are enforced", async () => {
  await migrate(false);
  await expect(
    run("INSERT INTO sighting (source_id) VALUES (99999)"),
  ).rejects.toMatchObject({ code: "23503" });
});

/* THE BACKFILL, NOT JUST THE COLUMN. A fresh schema can never exercise
 * migration 010's UPDATE -- there are no pre-existing rows to backfill --
 * so this test rewinds that one file and re-applies it against rows that
 * predate it, which is the only situation the backfill exists for. Testing
 * that `source_id` merely EXISTS would pass against a migration whose
 * UPDATE did nothing at all, and production would come out the far side
 * with the column NOT NULL and every value wrong. */
test("010 backfills source_id from the LATEST sighting, then refuses a row without one", async () => {
  await migrate(false);

  await run(`DROP INDEX solicitation_source`);
  await run(`ALTER TABLE solicitation DROP COLUMN source_id`);
  await run(`DELETE FROM schema_migrations WHERE name = '010_solicitation_source.sql'`);

  const older = await insert(`INSERT INTO source (name) VALUES ('Older source') RETURNING id`);
  const newer = await insert(`INSERT INTO source (name) VALUES ('Newer source') RETURNING id`);
  const sol = await insert(`INSERT INTO solicitation (title) VALUES ('pre-010') RETURNING id`);
  await run(
    `INSERT INTO sighting (source_id, solicitation_id, seen_at)
     VALUES ($1, $2, now() - interval '2 days')`,
    [older, sol],
  );
  await run(
    `INSERT INTO sighting (source_id, solicitation_id, seen_at)
     VALUES ($1, $2, now() - interval '1 day')`,
    [newer, sol],
  );

  expect(await migrate(false)).toEqual(["010_solicitation_source.sql"]);

  /* The LATEST sighting wins, which is merge.ts's own `latest_source_id`
   * rule. An "earliest wins" backfill would pick `older` here and would
   * then disagree with every row merge.ts writes from that point on -- two
   * rules for one column, which is how a field stops meaning anything. */
  const row = await one<{ source_id: number }>(
    `SELECT source_id FROM solicitation WHERE id = $1`,
    [sol],
  );
  expect(row?.source_id).toBe(newer);

  /* 23502 is not_null_violation. This is the point of the whole column: a
   * row with no source is invisible to `WHERE source_id = ...`, so the
   * constraint is what turns a future omission into a loud failure rather
   * than a silently short candidate list. */
  await expect(
    run(`INSERT INTO solicitation (title) VALUES ('no source')`),
  ).rejects.toMatchObject({ code: "23502" });
});
