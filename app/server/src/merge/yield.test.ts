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
  await run(`INSERT INTO source (name, enabled) VALUES ('src-a', true), ('src-b', true)`);
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
