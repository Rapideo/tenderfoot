/* api-spend.ts's own final review found that the word "UNRATIFIED" in a
 * comment pinned NOTHING -- deleting it left the test green. The flag below
 * is the real mechanism, in the same style rubric.test.ts pins R7_RATIFIED
 * and THRESHOLDS_RATIFIED. */
import { expect, test } from "vitest";
import { COVERAGE, COVERAGE_RATIFIED, SPEND_LIMITS_RATIFIED } from "./thresholds.js";

/* ⚖️ Ruled 2026-09-07 (D8, D9, D11). This asserts the RULING, not a
 * permanent property -- if Matt ever withdraws it, this test is the thing
 * that must change with him rather than a comment nobody re-reads. */
test("the four GRADING thresholds are ratified", () => {
  expect(COVERAGE_RATIFIED).toBe(true);
});

/* 🔴 THE ASSERTION THAT KEEPS THE SPLIT HONEST. One flag over both blocks is
 * how fitness/thresholds.ts made a split answer inexpressible in D4/D5. The
 * three SPEND caps govern money against an allowance that cannot be read
 * back from the vendor, and Matt has never been asked about any of them --
 * so ratifying the grading thresholds must not carry them along. Delete the
 * split and this fails. */
test("the SPEND caps are NOT ratified by the grading ruling", () => {
  expect(SPEND_LIMITS_RATIFIED).toBe(false);
  expect(COVERAGE_RATIFIED).not.toBe(SPEND_LIMITS_RATIFIED);
});

/* The floor now MATCHES fitness/thresholds.ts's R7 population floor rather
 * than sitting below it -- that agreement was half of D9's argument, so it
 * is pinned rather than left to a comment. */
test("the cohort floor matches R7's population floor of 100", () => {
  expect(COVERAGE.minCohortSize).toBe(100);
});

test("every threshold is a usable number", () => {
  expect(COVERAGE.minCoverageRecall).toBeGreaterThan(0);
  expect(COVERAGE.minCoverageRecall).toBeLessThanOrEqual(1);
  expect(COVERAGE.minTimelyRecall).toBeGreaterThan(0);
  expect(COVERAGE.minTimelyRecall).toBeLessThanOrEqual(1);
  expect(COVERAGE.minLeadDays).toBeGreaterThan(0);
  expect(COVERAGE.minCohortSize).toBeGreaterThan(0);
  expect(COVERAGE.maxRecordsPerRun).toBeGreaterThan(0);
  expect(COVERAGE.maxCallsPerRun).toBeGreaterThan(0);
  expect(COVERAGE.unparseableResponseRecords).toBeGreaterThan(0);
});

/* The conservative-tally figure must not UNDER-report relative to the
 * per-run cap it is modelled on -- api-spend.ts's doctrine is that
 * over-reporting is the safe direction, so this must be AT LEAST as large as
 * "the most one call in a run is assumed to cost", never smaller. */
test("the unparseable-response tally is at least as large as a single call's assumed cost", () => {
  expect(COVERAGE.unparseableResponseRecords).toBeGreaterThanOrEqual(COVERAGE.maxRecordsPerRun);
});

/* C2 is a SUBSET of C1 -- a notice carried in time is also a notice carried.
 * A timely floor above the coverage floor is therefore unsatisfiable, and the
 * report would be permanently, silently wrong rather than failing loudly. */
test("the timely floor cannot exceed the coverage floor", () => {
  expect(COVERAGE.minTimelyRecall).toBeLessThanOrEqual(COVERAGE.minCoverageRecall);
});
