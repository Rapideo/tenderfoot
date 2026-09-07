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

/* Named apart from the object below so `unparseableResponseRecords` can
 * reuse the exact number rather than a second literal that could drift from
 * it -- see that field's own comment for why reusing it is deliberate, not
 * laziness. */
const MAX_RECORDS_PER_RUN = 40;

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
  maxRecordsPerRun: MAX_RECORDS_PER_RUN,

  /** What to TALLY when a call throws before its response can be read at all
   * -- a malformed 200 or a non-array "results" field, highergov-client.ts's
   * two guards. By the time either guard fires, the VENDOR HAS ALREADY
   * BILLED the call; the guard turns a leaky TypeError/SyntaxError into a
   * clean, redacted error, it does not and cannot un-bill anything. Recording
   * 0 for a call we could not parse is exactly the under-report api-spend.ts's
   * header (lines 9-24) names as the dangerous direction: it is what lets an
   * operator believe there is budget left when there is not, against a
   * ceiling that cannot be read back from the vendor at all (CLAUDE.md §5.1).
   *
   * We cannot know what an unparseable response actually cost, so this picks
   * the largest a single call could plausibly have cost rather than guess a
   * smaller number. It reuses `maxRecordsPerRun`'s own figure rather than a
   * fresh one: that number is already this file's answer to "the most one
   * call in a run is assumed to cost" (R5 measured 5 records for one
   * filtered Indiana day -- this is an 8x margin over it), so charging a
   * single unreadable call the full per-run cap is deliberately generous, not
   * arbitrary. Over-charging this way is OVER-reporting, which api-spend.ts's
   * header calls "merely conservative, not wrong" -- unlike under-reporting,
   * it cannot hide real consumption from the one instrument that can still
   * catch it, a person reading the account dashboard.
   *
   * ⚖️ UNRATIFIED, same as its neighbours above. */
  unparseableResponseRecords: MAX_RECORDS_PER_RUN,

  /** The hard stop on CALL COUNT, independent of records spent. A zero-result
   * day bills nothing (CLAUDE.md §5.1's meter counts records RETURNED), so
   * maxRecordsPerRun alone would let days() walk a wide, mostly-empty window
   * -- thousands of live requests -- without ever tripping the record cap.
   * "Errors and zero-result calls appear not to count" rests on ONE
   * dashboard reading (CLAUDE.md §5.1); an unbounded call count is a real
   * exposure against a claim that thin, not a hypothetical one.
   *
   * ⚖️ UNRATIFIED, same as its neighbours above -- a proposal, not Matt's
   * ruling. Picked loosely: comfortably above what one run's day loop plus
   * its per-key id-lookup loop needs at current cohort sizes, without being
   * so high it stops meaning anything. */
  maxCallsPerRun: 100,
} as const;
