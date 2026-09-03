// app/server/src/scrape/cli.test.ts
import { expect, test } from "vitest";
import { parseArgv, main } from "./cli.js";

test("parses long flags into a run request shape", () => {
  const o = parseArgv(["--source", "sam", "--since", "2026-08-01", "--depth", "listing"]);
  expect(o).toEqual({ source: "sam", since: "2026-08-01", depth: "listing" });
});

test("budgetMs is parsed as a number so validateRun does not reject it", () => {
  const o = parseArgv(["--source", "sam", "--since", "2026-08-01", "--budgetMs", "5000"]);
  expect(o.budgetMs).toBe(5000);
});

test("a leading positional argument throws", () => {
  expect(() =>
    parseArgv(["fake", "--source", "fake", "--since", "2026-08-01"]),
  ).toThrow(/Expected a flag/);
});

test("a flag with no following value throws", () => {
  expect(() =>
    parseArgv(["--source", "sam", "--since"]),
  ).toThrow(/requires a value/);
});

test("a flag with a following flag instead of value throws", () => {
  expect(() =>
    parseArgv(["--source", "sam", "--since", "--budgetMs", "5000"]),
  ).toThrow(/requires a value/);
});

test("--budgetMs with a non-numeric value throws", () => {
  expect(() =>
    parseArgv(["--source", "sam", "--since", "2026-08-01", "--budgetMs", "abc"]),
  ).toThrow(/--budgetMs.*positive number/);
});

/* Fix round 1 (2026-09-02): the adapter lookup moved ahead of validateRun
 * so `main` could learn the adapter's shape before validating -- and that
 * reorder collapsed "no --source at all" and "an unrecognised --source"
 * into the same "No adapter named undefined" message. This is untested
 * before the reorder was even possible, which is exactly how it slipped;
 * asserts the missing-source case gets its own message, distinct from an
 * unrecognised one. Runs with no DATABASE_URL_TEST needed: main() throws
 * here before ever touching ADAPTERS, resolveSource, or the network. */
test("a run with no --source at all is refused as a missing source, not an unknown adapter", async () => {
  await expect(main(["--since", "2026-08-01", "--depth", "listing"])).rejects.toThrow(
    /source is required/,
  );
});

/* Task 9: the document pass, chained by default. `main` takes an optional
 * second argument -- a partial `CliPasses` -- that replaces the listings
 * and/or documents pass with a fake. That seam did not exist before this
 * task (main() took only argv); it is added here because there was no other
 * way to observe which passes ran without a live database -- the real
 * passes call resolveSource(), which dynamically imports db/index.ts, and
 * that module throws at evaluation time with no DATABASE_URL (see
 * resolve-source.ts's own header on why that import is dynamic, and why
 * this file otherwise runs with none set: scripts/check.mjs strips it from
 * the test child's environment deliberately).
 *
 * `idoa` (not `sam`) is used throughout: it is a registered, real adapter
 * (registry.ts, Task 8) with shape "snapshot", so `validateRun` never asks
 * for `--since`/`--until` -- these calls exercise nothing but parseArgv,
 * the adapter lookup, and validateRun, all synchronous and DB-free, before
 * either fake pass is invoked. */
function runCliWith(argv: string[]): Promise<string[]> {
  const calls: string[] = [];
  return main(argv, {
    listings: async () => {
      calls.push("listings");
    },
    documents: async () => {
      calls.push("documents");
    },
  }).then(() => calls);
}

test("by default a run does listings AND documents", async () => {
  const calls = await runCliWith(["--source", "idoa"]);
  expect(calls).toEqual(["listings", "documents"]);
});

test("--listings-only does exactly one half", async () => {
  expect(await runCliWith(["--source", "idoa", "--listings-only"])).toEqual(["listings"]);
});

test("--documents-only does exactly the other half", async () => {
  expect(await runCliWith(["--source", "idoa", "--documents-only"])).toEqual(["documents"]);
});

test("the two flags together are refused rather than silently ranked", async () => {
  await expect(
    runCliWith(["--source", "idoa", "--listings-only", "--documents-only"]),
  ).rejects.toThrow(/mutually exclusive/);
});
