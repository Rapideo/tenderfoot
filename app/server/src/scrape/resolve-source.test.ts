// app/server/src/scrape/resolve-source.test.ts
/* FIX 1 / FIX 2 (final review, 2026-08-15). Two defects, one test file,
 * because the design ruled they share one up-front check:
 *
 * FIX 1: registry.ts's keys ('sam', 'usaspending') are CLI ergonomics, not
 * source.name rows -- the seed data names them 'SAM.gov' / 'USASpending'
 * (migrations/003_seed_source_registry.sql). Before this fix, a real scrape
 * ran to completion, spent its whole budget, and only THEN failed at
 * import time with `No source row named sam`. resolveSource() must catch
 * that before a single fetch happens.
 *
 * FIX 2: source.enabled was seeded on all 13 rows and read by nothing.
 * resolveSource() refuses a disabled source, fail-closed, naming the
 * source and telling the operator to enable it.
 */
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_resolve_source");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { run, close } = await import("../db/index.js");
const { resolveSource } = await import("./resolve-source.js");
const { ADAPTERS } = await import("./adapters/registry.js");

beforeAll(async () => {
  /* migrate(false) applies 003_seed_source_registry.sql too, which is what
   * actually seeds 'SAM.gov' and 'USASpending' -- exactly the rows this
   * fix must resolve the registry's short keys against. Every seeded row
   * is enabled = false (003's own header comment), which is what makes
   * this schema usable for the FIX 2 half of these tests without any
   * further setup. */
  await migrate(false);
}, 120000);

afterAll(async () => {
  await close();
});

test("an unknown registry key is refused before any DB lookup", async () => {
  await expect(resolveSource("not-a-real-adapter")).rejects.toThrow(/No adapter named/);
});

test("'fake' is exempt from resolution -- a dev fixture with no registry row", async () => {
  /* No source row named 'fake' exists anywhere in this schema (003 never
   * seeds one) -- if resolveSource tried to look it up the same way it
   * looks up 'sam', this would throw. It must not. */
  const resolved = await resolveSource("fake");
  expect(resolved.sourceName).toBe("fake");
});

test("a real registry key with no matching source row is refused (FIX 1)", async () => {
  /* Simulates the exact defect: the registry key resolves to a canonical
   * name the seed data does not carry under that spelling. */
  await run(`DELETE FROM source WHERE name = 'SAM.gov'`);
  await expect(resolveSource("sam")).rejects.toThrow(/No source row named 'SAM\.gov'/);
});

test("a disabled source is refused before scraping, naming the source (FIX 2)", async () => {
  await run(`UPDATE source SET enabled = false WHERE name = 'USASpending'`);
  await expect(resolveSource("usaspending")).rejects.toThrow(/USASpending/);
  await expect(resolveSource("usaspending")).rejects.toThrow(/disabled|enable/i);
});

test("an enabled source with a matching row resolves to the canonical name", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = 'USASpending'`);
  const resolved = await resolveSource("usaspending");
  expect(resolved.sourceName).toBe("USASpending");
});

/* Task 8: the registry entry itself, and the exact-string binding
 * resolve-source.ts depends on -- a near-miss sourceName silently fails to
 * resolve, per registry.ts's own comment on AdapterRegistryEntry. */
test("idoa resolves to the registry row it binds to", () => {
  expect(ADAPTERS.idoa).toBeDefined();
  expect(ADAPTERS.idoa!.sourceName).toBe("Indiana IDOA solicitations");
  expect(ADAPTERS.idoa!.make().shape).toBe("snapshot");
});
