/* THE FLOOR'S NUMBERS LIVE HERE AND NOWHERE ELSE.
 *
 * Design spec §3.2 (2026-09-03 data-fitness spec): "The predicates are the
 * design. The thresholds are a RULING." Every value below is a PROPOSAL that
 * Matt has not ratified, and §8.1 carries them as an open question.
 *
 * They are collected in one file so that ratifying them is a single visible
 * edit rather than a hunt through seven query modules -- and so nobody can
 * quietly introduce an eighth number by hard-coding it at a call site.
 *
 * ⚠️ A FLOOR WITH UNRATIFIED THRESHOLDS IS NOT YET BINDING. measureFloor()
 * reports `thresholdsRatified: false` while the flag below is false, so a
 * caller cannot mistake a provisional verdict for the real one. */
export const THRESHOLDS_RATIFIED = false;

export const THRESHOLDS = {
  /** F1 — sources with at least one completed ingest. UNRATIFIED. */
  minIngestedSources: 2,
  /** F2 — ingested sources inside the Profile's primary geography. UNRATIFIED. */
  minPrimaryGeographySources: 1,
  /** F4 — longest run of consecutive ISO weeks with no ingest. UNRATIFIED. */
  maxIngestGapWeeks: 1,
  /** F5 — real triage decisions needed for Interested-per-hundred. UNRATIFIED. */
  minDecisions: 100,
  /** F6 — 10th-percentile description length on biddable rows, chars. UNRATIFIED. */
  minDescriptionP10Chars: 200,
  /** F7 — share of document-deferring rows for which we hold a document. UNRATIFIED. */
  minDocumentReachability: 0.8,
} as const;

/* ---------------------------------------------------------------- R7 -- */

/* THE RUBRIC'S R7 BOUNDARIES. Added 2026-09-04, and UNRATIFIED exactly as the
 * floor's are.
 *
 * R7 asks how much of the property list a source actually SUPPLIES. Until this
 * block existed the dimension was a null check -- any recorded measurement,
 * however bad, graded `adequate`. These numbers are what turn a measurement
 * into a grade, so they carry the same status as the floor's: a PROPOSAL, one
 * visible edit away from being ratified, and never hard-coded at a call site.
 *
 * ⚠️ TWO OF THEM DELIBERATELY MIRROR THE FLOOR. `p6DescriptionP10Adequate`
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
