/* api-spend.ts's own final review found that the word "UNRATIFIED" in a
 * comment pinned NOTHING -- deleting it left the test green. The flag below
 * is the real mechanism, in the same style rubric.test.ts pins R7_RATIFIED
 * and THRESHOLDS_RATIFIED. */
import { expect, test } from "vitest";
import { COVERAGE, COVERAGE_RATIFIED } from "./thresholds.js";

test("the coverage thresholds ship UNRATIFIED, and a flag says so", () => {
  expect(COVERAGE_RATIFIED).toBe(false);
});

test("every threshold is a usable number", () => {
  expect(COVERAGE.minCoverageRecall).toBeGreaterThan(0);
  expect(COVERAGE.minCoverageRecall).toBeLessThanOrEqual(1);
  expect(COVERAGE.minTimelyRecall).toBeGreaterThan(0);
  expect(COVERAGE.minTimelyRecall).toBeLessThanOrEqual(1);
  expect(COVERAGE.minLeadDays).toBeGreaterThan(0);
  expect(COVERAGE.minCohortSize).toBeGreaterThan(0);
  expect(COVERAGE.maxRecordsPerRun).toBeGreaterThan(0);
});

/* C2 is a SUBSET of C1 -- a notice carried in time is also a notice carried.
 * A timely floor above the coverage floor is therefore unsatisfiable, and the
 * report would be permanently, silently wrong rather than failing loudly. */
test("the timely floor cannot exceed the coverage floor", () => {
  expect(COVERAGE.minTimelyRecall).toBeLessThanOrEqual(COVERAGE.minCoverageRecall);
});
