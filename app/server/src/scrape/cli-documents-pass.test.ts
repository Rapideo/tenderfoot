// app/server/src/scrape/cli-documents-pass.test.ts
/* FIX ROUND 1 (Important 1, Task 9.5 review): cli.test.ts fakes the WHOLE
 * `documents` pass via `main()`'s `passes` seam, so nothing anywhere
 * actually exercised `runDocumentsPass`'s dispatch branch -- a typo in its
 * `resolved.sourceName === ADAPTERS.idoa?.sourceName` comparison would have
 * compiled, silently fallen through to `discoverAttachments` for `--source
 * idoa`, and recreated the exact zero-candidates bug Task 9.5 exists to
 * close, with a fully green suite.
 *
 * This fakes one level LOWER than cli.test.ts does: `../extract/discover.js`
 * and `../extract/discover-idoa.js` are mocked (so no SAM network call and
 * no real document writes happen), and the REAL `runDocumentsPass` is
 * called directly with each of the two real source keys, asserting which
 * mock it reached.
 *
 * A separate file from cli.test.ts, not an addition to it, because
 * `runDocumentsPass` calls `resolveSource()`, which needs a real `source`
 * row to resolve against -- this file is DB-backed (useTestSchema()) the
 * same way discover.test.ts/resolve-source.test.ts are, while cli.test.ts's
 * whole point (its own header) is testing parseArgv/main's flag logic
 * WITHOUT ever touching resolveSource or the database. */
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_cli_documents_pass");
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

/* `mock`-prefixed, per Vitest's own hoisting-safety convention: `vi.mock`
 * calls are hoisted above every import (this file's included), but the
 * factories below are not INVOKED until something actually imports the
 * mocked module -- by which point these consts are long since initialised.
 * Fixed return shapes matching each real function's return type, so
 * `runDocumentsPass`'s own `console.log` template reads real fields rather
 * than `undefined`. */
const mockDiscoverAttachments = vi.fn(async () => ({
  solicitations: 0,
  skipped: 0,
  documents: 0,
  refreshed: 0,
}));
const mockDiscoverIdoaAttachments = vi.fn(async () => ({
  solicitations: 0,
  skipped: 0,
  documents: 0,
}));

vi.mock("../extract/discover.js", () => ({ discoverAttachments: mockDiscoverAttachments }));
vi.mock("../extract/discover-idoa.js", () => ({
  discoverIdoaAttachments: mockDiscoverIdoaAttachments,
  IDOA_SOURCE_NAME: "Indiana IDOA solicitations",
}));

const { migrate } = await import("../db/migrate.js");
const { run, close } = await import("../db/index.js");
const { runDocumentsPass } = await import("./cli.js");
const { ADAPTERS } = await import("./adapters/registry.js");

afterAll(async () => {
  await close();
});

/* `runExtract` is NOT mocked -- it is left to run for real against the
 * empty test schema, which is a legitimate, cheap, already-exercised path
 * (run-extract.test.ts) rather than something this file needs to fake to
 * isolate the dispatch branch under test. */
beforeEach(async () => {
  await resetSchema();
  await migrate(false);
  /* migrate(false) seeds both rows via 003_seed_source_registry.sql, but
   * every seeded row is `enabled = false` (that migration's own header) --
   * resolveSource() refuses a disabled source, so both must be enabled here
   * for `runDocumentsPass` to get past its own `resolveSource` call at all. */
  await run(
    `UPDATE source SET enabled = true WHERE name IN ('SAM.gov', 'Indiana IDOA solicitations')`,
  );
  mockDiscoverAttachments.mockClear();
  mockDiscoverIdoaAttachments.mockClear();
});

test("--source sam reaches discoverAttachments, never discoverIdoaAttachments", async () => {
  expect(ADAPTERS.sam?.sourceName).toBe("SAM.gov");

  await runDocumentsPass({ source: "sam", depth: "listing", budgetMs: 30_000 });

  expect(mockDiscoverAttachments).toHaveBeenCalledTimes(1);
  expect(mockDiscoverIdoaAttachments).not.toHaveBeenCalled();
});

test("--source idoa reaches discoverIdoaAttachments, never discoverAttachments", async () => {
  expect(ADAPTERS.idoa?.sourceName).toBe("Indiana IDOA solicitations");

  await runDocumentsPass({ source: "idoa", depth: "listing", budgetMs: 30_000 });

  expect(mockDiscoverIdoaAttachments).toHaveBeenCalledTimes(1);
  expect(mockDiscoverAttachments).not.toHaveBeenCalled();
});

/* Pins the ARGUMENTS too, not just which mock fired -- a dispatch that
 * called the right function with the wrong limit/budget would still pass
 * the two tests above. */
test("the resolved limit and budget reach whichever discoverer is chosen", async () => {
  await runDocumentsPass({ source: "idoa", depth: "listing", budgetMs: 12_345, limit: 7 });

  expect(mockDiscoverIdoaAttachments).toHaveBeenCalledWith(7, 12_345);
});
