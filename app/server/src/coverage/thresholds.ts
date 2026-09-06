/* THE COVERAGE TEST'S NUMBERS LIVE HERE AND NOWHERE ELSE.
 *
 * Same argument as fitness/thresholds.ts: collected in one file so that
 * ratifying them is a single visible edit rather than a hunt through the
 * module -- and so nobody can quietly introduce another number by
 * hard-coding it at a call site.
 *
 * ⚖️ ALL UNRATIFIED. These are PROPOSALS awaiting Matt's ruling, in the
 * shape D4/D5 established: an exported boolean that changes runtime output
 * and is pinned by a test, never merely the word UNRATIFIED in a comment.
 * api-spend.ts's final review found that a comment pins nothing -- delete
 * the word and the test stayed green. */
export const COVERAGE_RATIFIED = false;

export const COVERAGE = {
  /** C1 — share of answer-key notices HigherGov carried AT ALL. The
   * 2026-09-03 measurement was 69/70 = 0.986, from one observation. */
  minCoverageRecall: 0.95,

  /** C2 — share carried with at least `minLeadDays` left to bid. THE GATE.
   * Below minCoverageRecall by construction: C2's numerator is a subset of
   * C1's, and thresholds.test.ts pins that relationship. */
  minTimelyRecall: 0.9,

  /** Days remaining at `captured_date` for a notice to count as timely.
   * Measured against the DEADLINE, never against when IDOA published --
   * HigherGov scrapes more sources than IDOA and can legitimately carry a
   * notice first, which would make an IDOA-relative lead time negative and
   * meaningless (spec §3.5). */
  minLeadDays: 7,

  /** C4 — below this the verdict is `unknown`, NEVER `pass`.
   *
   * ⚠️ THIS IS THE ONE TO LOOK AT HARDEST. It is BELOW R7's population floor
   * of 100, traded down to keep the test bounded as Matt asked. A 100-notice
   * cohort of genuinely NEW Indiana notices needs roughly three weeks of
   * forward running at observed volumes. The trade is his to accept or
   * reject (spec §8). */
  minCohortSize: 30,

  /** The hard stop. A run that would spend more than this aborts and reports
   * rather than continuing.
   *
   * It lives here rather than in run.ts because this file's whole purpose is
   * that no number is hard-coded at a call site -- and because the cost model
   * it derives from (R5: 5 records for one filtered Indiana day) is ITSELF
   * ONE OBSERVATION AT ONE MOMENT, which is the exact error
   * Proto2PRD-Lessons §2.15 exists for. A run that hits this cap is a
   * finding about volume, not a failure. */
  maxRecordsPerRun: 40,
} as const;
