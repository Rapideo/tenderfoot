/* THE FLOOR'S NUMBERS LIVE HERE AND NOWHERE ELSE.
 *
 * Design spec §3.2 (2026-09-03 data-fitness spec): "The predicates are the
 * design. The thresholds are a RULING." Both rulings have now been made, and
 * they went DIFFERENT WAYS: the floor's thresholds are RATIFIED (D4), the R7
 * block below is still PROVISIONAL (D5). Each block carries its own flag, and
 * §8.1's open question is closed for the first and open for the second.
 *
 * They are collected in one file so that ratifying them is a single visible
 * edit rather than a hunt through seven query modules -- and so nobody can
 * quietly introduce an eighth number by hard-coding it at a call site.
 *
 * ⚠️ A FLOOR WITH UNRATIFIED THRESHOLDS IS NOT YET BINDING. measureFloor()
 * reports `thresholdsRatified` from the flag below, so a caller cannot mistake
 * a provisional verdict for the real one.
 *
 * ⚖️ RATIFIED 2026-09-04 BY MATT — ruling sheet D4, option A, "approve them as
 * proposed". The six values below are no longer proposals; they are the
 * standard the floor's verdict is measured against.
 *
 * ⚠️ APPROVING UNBLOCKED NOTHING, and that was said plainly when he was asked.
 * The floor still fails four predicates. What changed is that the block is now
 * a legitimate finding rather than one person's opinion with a number attached
 * — which is what lets it survive being challenged. */
export const THRESHOLDS_RATIFIED = true;

export const THRESHOLDS = {
  /** F1 — sources with at least one completed ingest. RATIFIED 2026-09-04 (D4). */
  minIngestedSources: 2,
  /** F2 — ingested sources inside the Profile's primary geography. RATIFIED 2026-09-04 (D4). */
  minPrimaryGeographySources: 1,
  /** F4 — longest run of consecutive ISO weeks with no ingest. RATIFIED 2026-09-04 (D4). */
  maxIngestGapWeeks: 1,
  /** F5 — real triage decisions needed for Interested-per-hundred. RATIFIED 2026-09-04 (D4). */
  minDecisions: 100,
  /* ⚖️ F6 WAS AMENDED 2026-09-15 BY MATT — ruling sheet D17, option C. It read
   * `minDescriptionP10Chars: 200` from D4 until then, and the amendment
   * replaces the STATISTIC, not merely the number.
   *
   * Why the old one could not stand: a 10th percentile clears a floor only if
   * fewer than one row in ten sits below it. Measured 2026-09-13 over the real
   * population, HigherGov has 39.9% of biddable rows under 200 characters and
   * 27.8% under 100, so its p10 is 29 — and SAM.gov, the federal data D4's 200
   * was calibrated on, reads 68. EVERY live source failed, so the floor could
   * not pass while F6 was in it, and lowering 200 to 100 fixed nothing. The
   * state-and-local market publishes thin listings as a matter of course
   * (Kentucky's non-empty median is 38 characters); p10 was chosen for a
   * market that does not behave that way.
   *
   * ⚠️ 30% IS SET TO THE MARKET AS FOUND, and the sheet said so plainly rather
   * than dressing it as a standard: it sits just above today's worst source
   * (HigherGov 27.8%, SAM 14.0%, combined ≈22%). A future reader deciding
   * whether this is a real floor or a rubber stamp should know it was chosen
   * knowing that. The 100-character break is NOT arbitrary in the same way —
   * it is where Matt's own 150 dictated triage reasons stop citing thin
   * information (7 of 13 empty, 4 of 11 at 1–99, then 0 of 4 at 100–199).
   *
   * A per-source reading of description completeness stays on the rubric (R7),
   * where it already lives; this is the floor's holdings-wide question only. */
  /** F6 — the most biddable rows allowed to be too thin to triage, as a share. AMENDED 2026-09-15 (D17). */
  maxThinDescriptionShare: 0.3,
  /** F6 — a description under this many characters is too thin to triage from. AMENDED 2026-09-15 (D17). */
  thinDescriptionChars: 100,
  /** F7 — share of document-deferring rows for which we hold a document. RATIFIED 2026-09-04 (D4). */
  minDocumentReachability: 0.8,
} as const;

/* ---------------------------------------------------------------- R7 -- */

/* THE RUBRIC'S R7 BOUNDARIES. Added 2026-09-04, and STILL UNRATIFIED -- unlike
 * the floor's, which Matt ratified on 2026-09-04 (D4) while leaving these
 * provisional (D5).
 *
 * R7 asks how much of the property list a source actually SUPPLIES. Until this
 * block existed the dimension was a null check -- any recorded measurement,
 * however bad, graded `adequate`. These numbers are what turn a measurement
 * into a grade. They are a PROPOSAL, one visible edit away from being
 * ratified, and never hard-coded at a call site. They no longer share the
 * floor's status — see the D5 note below.
 *
 * ⚖️ LEFT PROVISIONAL 2026-09-04 BY MATT — ruling sheet D5, option C, "leave
 * them provisional". He ratified the FLOOR's thresholds the same day (D4), so
 * the two blocks in this file now have DIFFERENT STANDING, which is why the
 * flag below exists at all: until 2026-09-05 a single `THRESHOLDS_RATIFIED`
 * governed both, and his split answer was literally inexpressible.
 *
 * ⚠️ THE MIRROR IS NOW ASYMMETRIC BY RULING, NOT BY OVERSIGHT. F6's
 * `minDescriptionP10Chars: 200` is ratified; `p6DescriptionP10Adequate: 200`,
 * written to mirror it, is not. The warning below anticipated exactly this —
 * "if they drift apart that is a decision, and it will be visible here" — and
 * this is that decision. The numbers still agree; only their standing differs.
 *
 * 🔴 AND ON 2026-09-15 THE MIRROR BROKE COMPLETELY — D17, and again by ruling.
 * F6 no longer measures a 10th percentile AT ALL; it measures the share of
 * biddable rows under `thinDescriptionChars`. `p6DescriptionP10Adequate: 200`
 * now mirrors NOTHING: there is no longer an F6 number for it to agree with,
 * and the sentence above ("the numbers still agree") is true only of the day
 * it was written. The rubric's p10 was deliberately left alone — D17's own
 * text says a per-source reading "stays on the fitness rubric (R7) where it
 * already is", and R7 grades A SOURCE where the floor grades OUR HOLDINGS.
 * ⚠️ But R7's p10 will read the same collapsed value on a thin-listing source
 * that made F6's unusable (HigherGov's is 29), so an R7 description grade on
 * such a source is measuring the market, not the source. That is a live defect
 * in the rubric, NOT ruled on, and it should be put to Matt before R7 is
 * ratified — it is exactly the argument D17 accepted for the floor.
 *
 * D5 option C's stated consequence is that "grades keep shipping with the 'not
 * approved' caveat", so gradeCompleteness appends it to every R7 note while
 * this is false. Before the split that caveat lived ONLY in the floor's
 * summary, and ratifying D4 would have erased the last trace of it.
 *
 * ⚠️ ONE THING HE WAS TOLD AND SHOULD BE TOLD AGAIN IF THIS IS REVISITED: the
 * sheet argued C was "consistent with the floor's current status, so the two
 * match." D4 removed that reason. The choice still stands on its own — these
 * boundaries are a day old and two sources sit below their population floor —
 * but the argument he was shown for it is gone. */
export const R7_RATIFIED = false;

/* ⚠️ ONE OF THEM STILL MIRRORS THE FLOOR; THE OTHER NO LONGER CAN.
 * `p7ReachabilityAdequate` repeats F7's `minDocumentReachability`, and that
 * pair is intact. `p6DescriptionP10Adequate` USED TO repeat F6's
 * `minDescriptionP10Chars`, but D17 (2026-09-15) removed that threshold and
 * replaced the statistic, so this number now mirrors nothing — see the 🔴
 * paragraph above for what that means and what it leaves unruled.
 *
 * They were stated separately rather than aliased because the floor measures
 * OUR HOLDINGS and the rubric measures A SOURCE -- floor.ts's own header
 * insists those must not be conflated -- and ratifying one should not silently
 * move the other. That separation is exactly why D17 could amend the floor
 * without touching the rubric, which is the case for having written them
 * twice. If they drift apart that is a decision, and it will be visible here. */
export const R7 = {
  /* P6 — description sufficiency, 10th-percentile characters on biddable rows. */
  /** UNRATIFIED. */
  p6DescriptionP10Strong: 400,
  /** UNRATIFIED. Mirrors F6's threshold; see the warning above. */
  p6DescriptionP10Adequate: 200,

  /* P7 — document reachability, share of document-deferring rows we can read. */
  /** UNRATIFIED. */
  p7ReachabilityStrong: 0.95,
  /** UNRATIFIED. Mirrors F7's threshold; see the warning above. */
  p7ReachabilityAdequate: 0.8,

  /* P8 — value presence on open biddable rows. §8.5 asks for discovery
   * WEIGHTED BY VALUE, so a source supplying no value makes the gate's own
   * measure uncomputable. That is why the adequate bar is a majority. */
  /** UNRATIFIED. */
  p8ValuePresenceStrong: 0.8,
  /** UNRATIFIED. */
  p8ValuePresenceAdequate: 0.5,

  /* P14 — contract history: vendor, value and end date at depth. Graded on the
   * share of contracts carrying all three, because the expiration radar needs
   * all three on the SAME row -- a register with vendors here and end dates
   * there supports nothing. */
  /** UNRATIFIED. */
  p14CompletenessStrong: 0.9,
  /** UNRATIFIED. */
  p14CompletenessAdequate: 0.6,

  /* 🔴 A MEASUREMENT OVER TOO FEW ROWS IS NOT A MEASUREMENT. `Corpus import —
   * Indiana open` holds 61 solicitations and IDOA 45; a p10 over 45 rows is
   * noise wearing a grade's clothes. Below this population every property is
   * recorded `unknown` -- NOT `weak`, per spec §5.3, because a source nobody
   * has gathered enough of has not been shown to be bad. UNRATIFIED. */
  minPopulation: 100,

  /* One property is a fact about a field, not a profile of a source. Below this
   * many KNOWN properties R7 reports `unknown` rather than promote a single
   * sub-measure to the whole dimension. UNRATIFIED. */
  minKnownProperties: 2,
} as const;
