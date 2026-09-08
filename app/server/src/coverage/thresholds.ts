/* THE COVERAGE TEST'S NUMBERS LIVE HERE AND NOWHERE ELSE.
 *
 * Same argument as fitness/thresholds.ts: collected in one file so that
 * ratifying them is a single visible edit rather than a hunt through the
 * module -- and so nobody can quietly introduce another number by
 * hard-coding it at a call site.
 *
 * ⚖️ TWO FLAGS, NOT ONE, AND THE SPLIT IS THE POINT. Ratification arrived
 * 2026-09-07 for the GRADING thresholds (D8, D9, D11) and NOT for the SPEND
 * limits, which Matt has never been asked to rule on. A single flag would
 * have made that answer inexpressible -- and this project has already paid
 * for exactly that: fitness/thresholds.ts carried one THRESHOLDS_RATIFIED
 * over two blocks until D4/D5 went different ways on 2026-09-05 and it had
 * to be split under pressure. Splitting it here BEFORE the divergence is the
 * cheap version of the same lesson.
 *
 * Both keep the D4/D5 mechanism: an exported boolean that changes runtime
 * output and is pinned by a test, never merely the word UNRATIFIED in a
 * comment. api-spend.ts's final review found that a comment pins nothing --
 * delete the word and the test stayed green.
 *
 * ⚖️ THE SAME LESSON, ONE LEVEL DEEPER (2026-09-07, later the same day as
 * D8/D9/D11). Matt ruled on exactly ONE of the three SPEND caps --
 * `maxCallsPerRun`, raised from 100 to 500 so a year-long Indiana archive
 * walk (~365 one-call days, the same trial-ending motivation that raised
 * `MONTHLY_RECORD_CEILING` to 9,000 in extract/api-spend.ts) does not trip a
 * call-count cap sized for a much shorter run. `maxRecordsPerRun` and
 * `unparseableResponseRecords` were NOT put to him and stay exactly where
 * `SPEND_LIMITS_RATIFIED` already had them. Folding `maxCallsPerRun`'s
 * ratification into that same flag would recreate the inexpressible answer
 * this file's own split exists to avoid -- one flag, two calls ruled
 * differently. So it gets its OWN flag, `MAX_CALLS_PER_RUN_RATIFIED`,
 * defined right after `SPEND_LIMITS_RATIFIED` below, instead of reopening or
 * overloading that one. */

/* ⚖️ RATIFIED 2026-09-07 BY MATT. Governs the four GRADING thresholds only:
 * minCoverageRecall, minTimelyRecall, minLeadDays, minCohortSize. Ruling
 * sheet D8-D12 (artifact 63e9b5f6), the same shape D1-D7 took.
 *
 * ⚠️ WHAT RATIFYING DID AND DID NOT DO. It makes the VERDICT binding -- the
 * caveat stops printing on every predicate. It does NOT make the verdict
 * available: C1 and C2 still report `unknown` until the cohort reaches
 * minCohortSize, which is now further away than it was, by deliberate
 * choice. Approving the standard is not the same as meeting it. */
export const COVERAGE_RATIFIED = true;

/* ⚖️ STILL UNRATIFIED, and deliberately so: Matt has never been shown these
 * two. They cap SPENDING, not grading -- maxRecordsPerRun and
 * unparseableResponseRecords -- and both were picked by an agent from a
 * single dashboard reading. They govern money against an allowance that
 * cannot be read back from the vendor (CLAUDE.md §5.1), which is the reason
 * they are not folded into the flag above and quietly carried along by a
 * ruling that never mentioned them.
 *
 * ⚠️ THIS USED TO GOVERN A THIRD CAP, `maxCallsPerRun`, TOO. It was ruled on
 * separately 2026-09-07 and split out below into its own flag,
 * `MAX_CALLS_PER_RUN_RATIFIED` -- see this file's own header for why a
 * single flag over caps ruled on different days would make that difference
 * inexpressible. Leaving `maxCallsPerRun` listed here after that ruling
 * would have made this flag claim something no longer true the moment
 * `coverage-cli.ts` prints it. */
export const SPEND_LIMITS_RATIFIED = false;

/* ⚖️ RATIFIED 2026-09-07 BY MATT, split out from `SPEND_LIMITS_RATIFIED` the
 * moment `maxCallsPerRun` diverged from the other two spend caps -- see this
 * file's own header. Governs ONLY `maxCallsPerRun` below, raised from 100 to
 * 500: the trial ends in ~2 days with ~9,000 records unspent and Matt ruled
 * we spend them on a complete Indiana archive rather than lose them, and a
 * year-long walk is ~365 one-call days -- 100 would have refused that walk
 * on call count alone long before it ever came near the record ceiling.
 * `maxRecordsPerRun` and `unparseableResponseRecords` are untouched by this
 * ruling and remain under `SPEND_LIMITS_RATIFIED` above. */
export const MAX_CALLS_PER_RUN_RATIFIED = true;

/* The coverage harness's own per-run spend cap. ⚠️ `unparseableResponseRecords`
 * USED to reuse this number and no longer does -- see that field's comment for
 * the two 2026-09-08 measurements that separated them. Named apart because the
 * separation is deliberate: this bounds what a RUN may spend, that one prices a
 * single unreadable RESPONSE, and paging made those different questions. */
const MAX_RECORDS_PER_RUN = 40;

/* THE VENDOR'S OWN CEILING ON ONE RESPONSE, MEASURED RATHER THAN DOCUMENTED.
 * A run on 2026-09-08 requested `page_size=300` and got fourteen calls
 * returning exactly 100 records each -- so 100 is the most any single
 * response can bill, whatever we ask for. `unparseableResponseRecords` uses
 * it because a page that throws after the vendor billed could have cost this
 * much and no more. */
const VENDOR_PAGE_RECORD_CAP = 100;

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
   * ⚖️ RULED 100 BY MATT, 2026-09-07 (D9, option B), raising the agent's
   * proposal of 30. It now MATCHES R7's population floor rather than
   * departing from it, so there is no inconsistency left to explain.
   *
   * Two arguments carried it, and the second only surfaced while the first
   * was being explained:
   *
   * 1. GRANULARITY. At n=30 one notice is worth 3.3 points and no value
   *    lands on 0.95 at all -- 29/30 passes, 28/30 fails -- so the test was
   *    really "at most one miss", not "95%". At a TRUE recall of 0.98 (near
   *    the measured 0.986) that fails by luck about one run in eight. At
   *    n=100 the same source fails about one in sixty. The floor is not
   *    protecting against missing decay; it protects against INVENTING it,
   *    which is the error that wrongly un-shelves the adapter backlog.
   *
   * 2. IT FORCES THE TEST PAST THE CENSUS. Run one sweeps the whole open
   *    IDOA page, ~71 notices, whose lead times are inflated because they
   *    were captured long ago (spec §3.2 as amended). A floor of 30 is
   *    cleared part-way through that census, so the first binding verdict
   *    would have been a verdict ABOUT the census. Reaching 100 requires
   *    ~29 genuinely new notices -- one to two weeks at observed volumes --
   *    and those are the ones whose C2 means what it says.
   *
   * Accepted cost, in his words as much as mine: one to two weeks longer
   * before anything grades. */
  minCohortSize: 100,

  /** The hard stop. A run that would spend more than this aborts and reports
   * rather than continuing.
   *
   * It lives here rather than in run.ts because this file's whole purpose is
   * that no number is hard-coded at a call site -- and because the cost model
   * it derives from (R5: 5 records for one filtered Indiana day) is ITSELF
   * ONE OBSERVATION AT ONE MOMENT, which is the exact error
   * Proto2PRD-Lessons §2.15 exists for. A run that hits this cap is a
   * finding about volume, not a failure.
   *
   * ⚖️ UNRATIFIED -- see SPEND_LIMITS_RATIFIED. The agent declined to raise
   * it when the false-miss guard made a full first census cost more than one
   * run's cap, on the grounds that a cap on money is Matt's to move. That
   * reasoning still holds, and he has still not been asked. */
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
   * smaller number. Over-charging that way is OVER-reporting, which
   * api-spend.ts's header calls "merely conservative, not wrong" -- unlike
   * under-reporting, it cannot hide real consumption from the one instrument
   * that can still catch it, a person reading the account dashboard.
   *
   * 🔴 RAISED 40 -> 100 ON 2026-09-08, AND IT NO LONGER REUSES
   * `maxRecordsPerRun`. It used to, and the reuse was well argued at the
   * time: 40 was this file's answer to "the most one call in a run is assumed
   * to cost", an 8x margin over R5's measured 5 records for a filtered
   * Indiana day.
   *
   * **Two measurements killed that.** The vendor CAPS EVERY RESPONSE AT 100
   * RECORDS -- proved 2026-09-08 when a run requesting `page_size=300`
   * produced fourteen calls returning exactly 100 each. And `fetchDay` now
   * PAGES, so a single unreadable page can genuinely have cost 100. A
   * throwing page charged 40 would under-report by up to 60, which is the one
   * direction this whole mechanism exists to avoid.
   *
   * So the figure is now the measured page cap: the largest a single response
   * CAN cost, rather than the largest this file once assumed a call would.
   * `maxRecordsPerRun` stays at 40 -- it caps what the COVERAGE HARNESS may
   * spend in a run, a different question that paging did not change, and
   * raising it as a side effect would have quietly widened that budget.
   *
   * ⚖️ UNRATIFIED, but the RAISE was approved by Matt 2026-09-08 on the
   * reasoning above. `SPEND_LIMITS_RATIFIED` stays false: the number's
   * derivation is now measured rather than picked, which is not the same as
   * the value having been put to him as a budget. */
  unparseableResponseRecords: VENDOR_PAGE_RECORD_CAP,

  /** The hard stop on CALL COUNT, independent of records spent. A zero-result
   * day bills nothing (CLAUDE.md §5.1's meter counts records RETURNED), so
   * maxRecordsPerRun alone would let days() walk a wide, mostly-empty window
   * -- thousands of live requests -- without ever tripping the record cap.
   * "Errors and zero-result calls appear not to count" rests on ONE
   * dashboard reading (CLAUDE.md §5.1); an unbounded call count is a real
   * exposure against a claim that thin, not a hypothetical one.
   *
   * ⚖️ RATIFIED 2026-09-07 BY MATT (see MAX_CALLS_PER_RUN_RATIFIED above),
   * raised from 100 to 500. The HigherGov trial ends in ~2 days with ~9,000
   * records unspent, and Matt ruled we spend them on a complete Indiana
   * listing archive rather than lose them -- a year-long walk is ~365
   * one-call days, so 100 would have stopped the walk on call count alone
   * long before it ever approached the (also-raised) monthly ceiling. The
   * paragraph below is the ORIGINAL, pre-ruling reasoning for 100 -- kept
   * because it is still true of what a SHORT run needs, it is just no longer
   * what set the number: an explicit ruling did.
   *
   * ~~UNRATIFIED -- see SPEND_LIMITS_RATIFIED.~~ Picked loosely: comfortably
   * above what one run's day loop plus its per-key id-lookup loop needs at
   * current cohort sizes, without being so high it stops meaning anything. */
  maxCallsPerRun: 500,
} as const;
