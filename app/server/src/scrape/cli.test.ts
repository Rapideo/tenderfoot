// app/server/src/scrape/cli.test.ts
import { expect, test } from "vitest";
import { parseArgv } from "./cli.js";

test("parses long flags into a run request shape", () => {
  const o = parseArgv(["--source", "sam", "--since", "2026-08-01", "--depth", "listing"]);
  expect(o).toEqual({ source: "sam", since: "2026-08-01", depth: "listing" });
});

test("budgetMs is parsed as a number so validateRun does not reject it", () => {
  const o = parseArgv(["--source", "sam", "--since", "2026-08-01", "--budgetMs", "5000"]);
  expect(o.budgetMs).toBe(5000);
});
