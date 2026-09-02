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
