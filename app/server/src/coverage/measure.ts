/* C1--C4. PURE: takes graded items, returns predicates.
 *
 * Reuses fitness/floor.ts's PredicateResult rather than declaring a parallel
 * shape, because a reader of `npm run fitness` should not have to learn a
 * second vocabulary for the same idea. */
import type { PredicateResult } from "../fitness/floor.js";
import type { Carried } from "./compare.js";
import type { Segment } from "./answer-key.js";
import { COVERAGE, COVERAGE_RATIFIED } from "./thresholds.js";

export interface GradedItem {
  externalId: string;
  segment: Segment;
  carried: Carried;
  leadDays: number | null;
}

/* D5's stated consequence, applied here: while the numbers are unratified,
 * EVERY verdict carries the caveat -- exactly as gradeCompleteness appends it
 * to every R7 note. A provisional verdict a reader could mistake for the real
 * one is the failure this prevents.
 *
 * CAVEAT is DERIVED from the live COVERAGE_RATIFIED boolean, not hard-coded.
 * The moment the thresholds are ratified, every predicate stops announcing
 * "not approved" without requiring hand-edits to literals. */
const CAVEAT = COVERAGE_RATIFIED
  ? null
  : `Thresholds are not approved (COVERAGE_RATIFIED = ${COVERAGE_RATIFIED}).`;
const note = (s?: string) => (CAVEAT ? (s ? `${s} ${CAVEAT}` : CAVEAT) : s);

const SEGMENTS: Segment[] = ["state_agency", "sub_state"];

/* `unchecked` is excluded from the cohort ENTIRELY -- not counted as a find,
 * not counted as a miss. A run that stopped at its budget cap must not move
 * the score in either direction.
 *
 * EXPORTED so coverage-cli.ts's headline count can be the SAME filter C4's
 * `measured` uses, rather than a second copy that can drift from this one --
 * which is exactly how the CLI used to print "N settled notices" one line
 * above a C4 that measured a smaller N (review finding #5). */
export const settled = (items: GradedItem[]) => items.filter((i) => i.carried !== "unchecked");

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

interface SegmentScore {
  segment: Segment;
  n: number;
  recall: number;
  timely: number;
}

function scoreSegment(items: GradedItem[], segment: Segment): SegmentScore | null {
  const rows = settled(items).filter((i) => i.segment === segment);
  if (rows.length === 0) return null;
  const carried = rows.filter((r) => r.carried === "carried");
  const timely = carried.filter(
    (r) => r.leadDays !== null && r.leadDays >= COVERAGE.minLeadDays,
  );
  return {
    segment,
    n: rows.length,
    recall: carried.length / rows.length,
    timely: timely.length / rows.length,
  };
}

/* WEAKEST SEGMENT WINS. Mirrors R7, rebuilt 2026-09-04 to "grade the
 * measurement and take the WEAKEST property", on the reasoning that a
 * minimum, unlike an average, cannot be talked up by adding strengths. The
 * argument is stronger here: a blended recall would let strong state-agency
 * coverage conceal weak sub-state coverage, which is the exact failure
 * ruling ③ exists to prevent. */
function weakest(scores: SegmentScore[], by: (s: SegmentScore) => number): SegmentScore | null {
  let worst: SegmentScore | null = null;
  for (const s of scores) if (!worst || by(s) < by(worst)) worst = s;
  return worst;
}

/* The sub-state answer key is deliberately unbuilt, so `scores` routinely
 * holds only state_agency -- and `weakest` above returns that lone survivor
 * without complaint, because there is nothing else to compare it against.
 * The whole reason the weaker segment wins (ruling ③) is to stop a confident
 * number about the wrong segment; a detail line that silently drops the
 * segment it never measured recreates exactly that failure by omission. This
 * renders EVERY segment, not just the ones with a score, so "sub_state: NOT
 * MEASURED" sits right next to state_agency's real number and cannot be
 * missed the way an absence can. */
function segmentSummary(scores: SegmentScore[], by: (s: SegmentScore) => number): string {
  return SEGMENTS.map((segment) => {
    const s = scores.find((x) => x.segment === segment);
    return s ? `${segment} ${by(s).toFixed(3)}` : `${segment}: NOT MEASURED`;
  }).join(" · ");
}

export function measureCoverage(items: GradedItem[]): PredicateResult[] {
  const cohort = settled(items);
  const scores = SEGMENTS.map((s) => scoreSegment(items, s)).filter(
    (s): s is SegmentScore => s !== null,
  );

  const bigEnough = cohort.length >= COVERAGE.minCohortSize;

  const c4: PredicateResult = {
    id: "C4",
    property: "cohort",
    statement: "The settled cohort is large enough to grade",
    threshold: COVERAGE.minCohortSize,
    measured: cohort.length,
    verdict: bigEnough ? "pass" : "fail",
    detail: note(
      bigEnough
        ? undefined
        : `Below the floor, so C1 and C2 report unknown rather than pass. ` +
          `Keep running: the cohort accumulates across runs (spec §5.5).`,
    ),
  };

  const worstRecall = weakest(scores, (s) => s.recall);
  const worstTimely = weakest(scores, (s) => s.timely);

  const c1: PredicateResult = {
    id: "C1",
    property: "coverage recall",
    statement: "The weaker segment's share of key notices HigherGov carried at all",
    threshold: COVERAGE.minCoverageRecall,
    measured: worstRecall ? Number(worstRecall.recall.toFixed(3)) : "n/a",
    verdict: !bigEnough || !worstRecall
      ? "unknown"
      : worstRecall.recall >= COVERAGE.minCoverageRecall
        ? "pass"
        : "fail",
    detail: note(
      worstRecall
        ? `Weakest segment: ${worstRecall.segment} (n=${worstRecall.n}). ` +
          segmentSummary(scores, (s) => s.recall)
        : `No settled items in any segment. ${segmentSummary(scores, (s) => s.recall)}`,
    ),
  };

  const c2: PredicateResult = {
    id: "C2",
    property: "timely recall",
    statement: `Share carried with at least ${COVERAGE.minLeadDays} days left to bid — THE GATE`,
    threshold: COVERAGE.minTimelyRecall,
    measured: worstTimely ? Number(worstTimely.timely.toFixed(3)) : "n/a",
    verdict: !bigEnough || !worstTimely
      ? "unknown"
      : worstTimely.timely >= COVERAGE.minTimelyRecall
        ? "pass"
        : "fail",
    detail: note(
      worstTimely
        ? `Weakest segment: ${worstTimely.segment} (n=${worstTimely.n}). ` +
          `A notice carried too late to bid is a miss with a tick beside it. ` +
          segmentSummary(scores, (s) => s.timely)
        : `No settled items in any segment. ${segmentSummary(scores, (s) => s.timely)}`,
    ),
  };

  const leads = cohort
    .filter((i) => i.carried === "carried" && i.leadDays !== null)
    .map((i) => i.leadDays!);

  const c3: PredicateResult = {
    id: "C3",
    property: "capture latency",
    statement: "Median days of bidding time remaining when HigherGov first carried it",
    threshold: "reported, not gating",
    measured: median(leads) ?? "n/a",
    /* Deliberately never pass/fail: ruling ④ made lead time gating THROUGH
     * C2. C3 is the distribution behind that gate, reported so the number can
     * be ratified later against real data rather than guessed at now. */
    verdict: "unknown",
    detail: note(`n=${leads.length} carried notices with a computable lead time.`),
  };

  return [c1, c2, c3, c4];
}
