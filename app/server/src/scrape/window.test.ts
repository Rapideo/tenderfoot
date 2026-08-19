import { expect, test } from "vitest";
import { resolveSince } from "./window.js";
import { validateRun } from "./contract.js";

/* THE BUG THIS FILE EXISTS FOR, found 2026-08-18 by clicking the button.
 *
 * `Admin.tsx` sent `since=${s.since_default}` straight from the row, and
 * `since_default` is an ISO-8601 DURATION ('P7D'), not a date --
 * 003_seed_source_registry.sql says so in as many words. `validateRun`
 * requires a date, so every click of Run answered
 *   400 since must be an ISO-8601 date (YYYY-MM-DD[T...]), got: P7D
 * and `last_run_at` never moved. D5 had never worked, in any browser, for
 * any source.
 *
 * The client's own unit test could not have caught it: it stubbed fetch to
 * return `{ok: true}` for every POST and then asserted the exact URL
 * ("/api/admin/run?source=SAM.gov&since=P7D"), pinning the defective value
 * as the expected one. A test that names a wrong constant is worse than no
 * test -- it makes the defect look deliberate.
 *
 * 003 also states the rule this module implements: "since_default is an
 * ISO-8601 duration and is only a SEED. The rule is `since = last successful
 * run`; a fixed lookback loses a day permanently when a run fails." */

const NOW = new Date("2026-08-18T12:00:00.000Z");

test("since is the last successful run when there has been one", () => {
  expect(
    resolveSince({ last_run_at: "2026-08-15T09:30:00.000Z", since_default: "P7D" }, NOW),
  ).toBe("2026-08-15T09:30:00.000Z");
});

/* The seed is the FALLBACK, not the window -- which is the distinction the
 * defect collapsed. */
test("a source that has never run falls back to now minus since_default", () => {
  expect(resolveSince({ last_run_at: null, since_default: "P7D" }, NOW)).toBe(
    "2026-08-11T12:00:00.000Z",
  );
});

test("last_run_at wins over since_default even when both are present", () => {
  expect(
    resolveSince({ last_run_at: "2026-08-17T00:00:00.000Z", since_default: "P30D" }, NOW),
  ).toBe("2026-08-17T00:00:00.000Z");
});

/* pg hands timestamptz back as a Date, not a string -- the route reads this
 * value straight off a row, so the Date spelling is the REAL call shape and
 * a string-only implementation would fail in production while passing here. */
test("accepts a Date for last_run_at, as pg actually returns it", () => {
  expect(
    resolveSince({ last_run_at: new Date("2026-08-16T06:00:00.000Z"), since_default: "P7D" }, NOW),
  ).toBe("2026-08-16T06:00:00.000Z");
});

test.each([
  ["P7D", "2026-08-11T12:00:00.000Z"],
  ["P1D", "2026-08-17T12:00:00.000Z"],
  ["P30D", "2026-07-19T12:00:00.000Z"],
  ["P1W", "2026-08-11T12:00:00.000Z"],
  ["PT12H", "2026-08-18T00:00:00.000Z"],
  ["P1M", "2026-07-18T12:00:00.000Z"],
  ["P1Y", "2025-08-18T12:00:00.000Z"],
])("parses the ISO-8601 duration %s", (duration, expected) => {
  expect(resolveSince({ last_run_at: null, since_default: duration }, NOW)).toBe(expected);
});

/* Fail closed, the same posture validateRun takes on a missing `since`: a
 * window nobody can compute must refuse, never quietly mean "everything". */
test("refuses when there is neither a last run nor a seed window", () => {
  expect(() => resolveSince({ last_run_at: null, since_default: null }, NOW)).toThrow(
    /no ingestion window/i,
  );
});

test("refuses a since_default that is not a duration it understands", () => {
  expect(() => resolveSince({ last_run_at: null, since_default: "7 days" }, NOW)).toThrow(
    /ISO-8601 duration/i,
  );
});

/* THE REGRESSION TEST THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. Every
 * other test here could pass while `/run` still handed validateRun something
 * it rejects; this one closes the loop by feeding the output into the very
 * validator that produced the 400. */
test.each(["P7D", "P1D", "P30D", "P1M"])(
  "the value produced from %s is accepted by validateRun",
  (duration) => {
    const since = resolveSince({ last_run_at: null, since_default: duration }, NOW);
    expect(() => validateRun({ source: "sam", since, depth: "listing" })).not.toThrow();
  },
);

test("the value produced from a last run is accepted by validateRun", () => {
  const since = resolveSince({ last_run_at: NOW, since_default: "P7D" }, NOW);
  expect(() => validateRun({ source: "sam", since, depth: "listing" })).not.toThrow();
});
