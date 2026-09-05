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
  /** F6 — 10th-percentile description length on biddable rows, chars. RATIFIED 2026-09-04 (D4). */
  minDescriptionP10Chars: 200,
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

/* ⚠️ TWO OF THEM DELIBERATELY MIRROR THE FLOOR. `p6DescriptionP10Adequate`
 * repeats F6's `minDescriptionP10Chars` and `p7ReachabilityAdequate` repeats
 * F7's `minDocumentReachability`. They are stated separately rather than
 * aliased because the floor measures OUR HOLDINGS and the rubric measures A
 * SOURCE -- floor.ts's own header insists those must not be conflated -- and
 * ratifying one should not silently move the other. If they drift apart that is
 * a decision, and it will be visible here. */
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
