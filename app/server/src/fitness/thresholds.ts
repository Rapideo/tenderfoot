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
