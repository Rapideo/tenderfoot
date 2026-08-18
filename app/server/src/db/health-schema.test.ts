import { expect, test, beforeAll, afterAll } from "vitest";
import { useTestSchema, resetSchema } from "./testdb.js";

useTestSchema("test_health_schema");
await resetSchema();

const { migrate } = await import("./migrate.js");
const { one, run, all, close } = await import("./index.js");
const { loadCorpus } = await import("../ingest/corpus.js");

beforeAll(async () => {
  await migrate(false);
  await loadCorpus(false);
}, 120000);
afterAll(async () => { await close(); });

test("the four health columns exist", async () => {
  const cols = await all<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'source' AND table_schema = current_schema()`,
  );
  const names = cols.map((c) => c.column_name);
  for (const c of ["health_checked_at", "health_method", "health_note", "probe_url"]) {
    expect(names, `missing column ${c}`).toContain(c);
  }
});

/* The hole this closes: `legal_posture` has had a CHECK since 002 and
 * `health` never did, so any string at all could be stored. */
test("an invalid health value is refused by the database", async () => {
  await expect(
    run(`UPDATE source SET health = 'banana' WHERE name = 'SAM.gov'`),
  ).rejects.toThrow(/source_health_valid|violates check constraint/);
});

test("every one of the five legal values is accepted", async () => {
  for (const v of ["ok", "failing", "rot", "excluded", "unknown"]) {
    await run(`UPDATE source SET health = $1 WHERE name = 'SAM.gov'`, [v]);
  }
  expect((await one<{ health: string }>(`SELECT health FROM source WHERE name = 'SAM.gov'`))!.health)
    .toBe("unknown");
});

/* Six rows can never be probed: four by their own terms, two because they
 * are fixed snapshots with no endpoint. Compare a JS-sorted array to make
 * the test collation-independent. */
test("the six never-probeable rows are backfilled to excluded", async () => {
  const rows = await all<{ name: string }>(
    `SELECT name FROM source WHERE health = 'excluded'`,
  );
  const names = rows.map((r) => r.name).sort();
  expect(names).toEqual([
    "BidNet Direct",
    "BidPrime",
    "Corpus import — Indiana open (2026-08-04)",
    "Corpus import — federal calibration (2026-08-10)",
    "GovWin IQ",
    "Ohio OhioBuys",
  ]);
});

test("the seven probeable rows keep unknown", async () => {
  const n = await one<{ n: number }>(`SELECT count(*) n FROM source WHERE health = 'unknown'`);
  expect(n!.n).toBe(7);
});
