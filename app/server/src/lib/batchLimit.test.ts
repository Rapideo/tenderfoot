import { expect, test } from "vitest";
import { batchLimit, MAX_BATCH, DEFAULT_BATCH } from "./batchLimit.js";

test("an absent limit is the default", () => {
  expect(batchLimit(undefined)).toBe(DEFAULT_BATCH);
});

test("a sensible limit is taken as given", () => {
  expect(batchLimit("5")).toBe(5);
});

/* The 2026-08-27 failure with a different trigger: a batch big enough to
 * outrun the function ceiling is killed mid-work, and what it had written
 * before the kill is whatever it happened to reach. The clamp is what makes
 * an operator's typo cost one narrow batch instead. */
test("a limit past the ceiling is clamped, not trusted", () => {
  expect(batchLimit("99999")).toBe(MAX_BATCH);
});

/* `Number(x) || DEFAULT` -- the obvious spelling, and the one this replaces
 * -- lets a negative straight through, because -5 is truthy. It reaches
 * Postgres as `LIMIT -5`, which is an error, so the operator's typo returns
 * a 500 naming a SQL fault rather than doing the smaller thing they meant.
 * Math.min alone does not catch it either: -5 is already below the maximum. */
test("a negative limit does not reach the query", () => {
  expect(batchLimit("-5")).toBe(DEFAULT_BATCH);
});

test("a limit of zero is the default, not a batch that can do nothing", () => {
  expect(batchLimit("0")).toBe(DEFAULT_BATCH);
});

test("a limit that is not a number at all is the default", () => {
  expect(batchLimit("abc")).toBe(DEFAULT_BATCH);
  expect(batchLimit("")).toBe(DEFAULT_BATCH);
});

/* LIMIT takes an integer. A fractional one is the caller's arithmetic
 * showing through, not an instruction. */
test("a fractional limit is floored", () => {
  expect(batchLimit("7.9")).toBe(7);
});

/* Express hands back an ARRAY for a repeated query parameter --
 * `?limit=5&limit=6` -- and `Number(["5", "6"])` is NaN while `Number(["5"])`
 * is 5. Neither is a limit anyone typed on purpose. */
test("a repeated query parameter is the default, not one of its values", () => {
  expect(batchLimit(["5", "6"])).toBe(DEFAULT_BATCH);
  expect(batchLimit(["5"])).toBe(DEFAULT_BATCH);
});
