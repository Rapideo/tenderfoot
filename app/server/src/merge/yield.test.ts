import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_yield");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { one, run, close } = await import("../db/index.js");
const { mergeSightings } = await import("./merge.js");
const { perSourceYield } = await import("./yield.js");

beforeAll(async () => {
  await migrate(false);
  /* Migration 022: cross-source identity now requires the sources to declare
   * their external ids globally unique. This test asserts exactly that sharing,
   * so the declaration belongs in its fixture. */
  await run(
    `INSERT INTO source (name, enabled, external_id_scope)
     VALUES ('src-a', true, 'global'), ('src-b', true, 'global')`,
  );
  const a = (await one(`SELECT id FROM source WHERE name = 'src-a'`)).id;
  const b = (await one(`SELECT id FROM source WHERE name = 'src-b'`)).id;
  const ins = `INSERT INTO sighting (source_id, external_id, seen_at, raw, mode)
               VALUES ($1,$2,$3,$4,'mechanical')`;
  // Shared between both sources.
  await run(ins, [a, "SHARED", "2026-08-10T00:00:00Z", JSON.stringify({ title: "Shared" })]);
  await run(ins, [b, "SHARED", "2026-08-10T00:00:00Z", JSON.stringify({ title: "Shared" })]);
  // Only source A carries this one.
  await run(ins, [a, "ONLY-A", "2026-08-10T00:00:00Z", JSON.stringify({ title: "Only A" })]);
  await mergeSightings();
}, 120000);
afterAll(async () => {
  await close();
});

/* "Honest" is the operative word: two sources carrying the same solicitation
 * must not both be credited with a unique find, or the yield figure argues
 * for keeping a source that adds nothing. */
test("yield distinguishes total sightings from solicitations unique to a source", async () => {
  const rows = await perSourceYield();
  const a = rows.find((r) => r.name === "src-a")!;
  const b = rows.find((r) => r.name === "src-b")!;

  expect(a.sightings).toBe(2);
  expect(a.canonical).toBe(2);
  expect(a.unique_to_source).toBe(1); // ONLY-A

  expect(b.sightings).toBe(1);
  expect(b.canonical).toBe(1);
  expect(b.unique_to_source).toBe(0); // SHARED is also carried by src-a
});

async function sight(sourceId: number, externalId: string | null, title: string, seenAt: string) {
  await run(
    `INSERT INTO sighting (source_id, external_id, seen_at, raw, mode)
     VALUES ($1,$2,$3,$4,'mechanical')`,
    [sourceId, externalId, seenAt, JSON.stringify({ title })],
  );
}

/* Fix round 1: the primary test above proves the two-source case works, but
 * every other branch of this query was only hand-verified, never pinned.
 * "A one-off manual check does not survive the next edit to the query" --
 * each of the four tests below guards one branch a plausible-but-wrong
 * rewrite of yield.ts could silently break. */

/* REGRESSION GUARD: a dead source must not vanish from the report -- that is
 * precisely the failure an honest yield report exists to reveal. The LEFT
 * JOIN from `source` (not an INNER JOIN) is what keeps it present; count(g.id)
 * and count(DISTINCT g.solicitation_id) both count a COLUMN rather than a
 * row, so the single NULL-filled joined row a source with no sightings
 * produces counts to zero rather than dropping out of the GROUP BY entirely.
 * Asserting the row is defined -- not just checking its fields -- is the
 * point: an implementation that switched to an INNER JOIN would fail this
 * test by finding nothing, not by finding the wrong numbers. */
test("a source with no sightings appears with zeros, not absent", async () => {
  await run(`INSERT INTO source (name, enabled) VALUES ('src-dead', true)`);

  const rows = await perSourceYield();
  const dead = rows.find((r) => r.name === "src-dead");

  expect(dead).toBeDefined();
  expect(dead!.sightings).toBe(0);
  expect(dead!.canonical).toBe(0);
  expect(dead!.unique_to_source).toBe(0);
});

/* REGRESSION GUARD, the subtlest branch: the FILTER's correlated subquery
 * excludes rows on `o.source_id <> g.source_id`, deliberately -- a sibling
 * sighting from the SAME source can never satisfy that condition and so can
 * never self-exclude a solicitation this source alone carries. An
 * implementation that correlated on `o.id <> g.id` instead would see this
 * source's own second sighting as "another" sighting of the same
 * solicitation and wrongly report unique_to_source: 0 here -- this
 * assertion catches exactly that mistake. */
test("two sightings from the same source, same solicitation, still count as one unique find", async () => {
  await run(`INSERT INTO source (name, enabled) VALUES ('src-self', true)`);
  const srcSelf = (await one(`SELECT id FROM source WHERE name = 'src-self'`)).id;

  await sight(srcSelf, "SELF-DOUBLE", "Self double", "2026-08-10T00:00:00Z");
  await sight(srcSelf, "SELF-DOUBLE", "Self double (amended)", "2026-08-11T00:00:00Z");
  await mergeSightings();

  const row = (await perSourceYield()).find((r) => r.name === "src-self")!;

  expect(row.sightings).toBe(2);
  expect(row.canonical).toBe(1); // DISTINCT collapses the two sightings
  expect(row.unique_to_source).toBe(1); // no OTHER source saw it
});

/* REGRESSION GUARD: `NULL = NULL` is never TRUE, so the FILTER's
 * `o.solicitation_id = g.solicitation_id` can never match an unmerged
 * sighting (solicitation_id IS NULL) against anything -- NOT EXISTS is
 * trivially satisfied for it, same as for a merged, truly-unique row. But
 * `count(DISTINCT g.solicitation_id)` separately ignores NULL inputs, so
 * canonical does not move either. This test pins both facts together: an
 * unmerged sighting must raise `sightings` and nothing else. */
test("an unmerged sighting (external_id NULL) raises sightings but not canonical or unique_to_source", async () => {
  await run(`INSERT INTO source (name, enabled) VALUES ('src-partial', true)`);
  const srcPartial = (await one(`SELECT id FROM source WHERE name = 'src-partial'`)).id;

  await sight(srcPartial, "PARTIAL-1", "Partial", "2026-08-10T00:00:00Z");
  await mergeSightings();

  const before = (await perSourceYield()).find((r) => r.name === "src-partial")!;
  expect(before.sightings).toBe(1);
  expect(before.canonical).toBe(1);
  expect(before.unique_to_source).toBe(1);

  // external_id NULL: mergeSightings() only ever selects sightings whose
  // external_id IS NOT NULL (merge.ts), so this one is never merged and its
  // solicitation_id stays NULL permanently, not just until the next run.
  await sight(srcPartial, null, "Untitled draft", "2026-08-12T00:00:00Z");
  await mergeSightings();

  const after = (await perSourceYield()).find((r) => r.name === "src-partial")!;
  expect(after.sightings).toBe(2);
  expect(after.canonical).toBe(1);
  expect(after.unique_to_source).toBe(1);
});

/* REGRESSION GUARD: extends the two-source case to three. Every pairwise
 * NOT EXISTS still finds at least one OTHER source on the shared
 * solicitation, so all three sources read unique_to_source: 0 -- not one of
 * three credited, not "n-1" credited, nobody credited. */
test("three sources sharing one solicitation all read unique_to_source: 0", async () => {
  /* Same as above: three sources sharing ONE solicitation is the assertion, and
   * sharing requires the declaration as of migration 022. */
  await run(
    `INSERT INTO source (name, enabled, external_id_scope)
     VALUES ('src-x', true, 'global'), ('src-y', true, 'global'), ('src-z', true, 'global')`,
  );
  const x = (await one(`SELECT id FROM source WHERE name = 'src-x'`)).id;
  const y = (await one(`SELECT id FROM source WHERE name = 'src-y'`)).id;
  const z = (await one(`SELECT id FROM source WHERE name = 'src-z'`)).id;

  await sight(x, "TRIPLE", "Triple", "2026-08-10T00:00:00Z");
  await sight(y, "TRIPLE", "Triple", "2026-08-10T00:00:00Z");
  await sight(z, "TRIPLE", "Triple", "2026-08-10T00:00:00Z");
  await mergeSightings();

  const rows = await perSourceYield();
  for (const name of ["src-x", "src-y", "src-z"]) {
    const row = rows.find((r) => r.name === name)!;
    expect(row.canonical).toBe(1);
    expect(row.unique_to_source).toBe(0);
  }
});
