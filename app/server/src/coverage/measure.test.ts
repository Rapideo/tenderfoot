import { expect, test } from "vitest";
import { measureCoverage } from "./measure.js";
import { COVERAGE, COVERAGE_RATIFIED } from "./thresholds.js";
import type { GradedItem } from "./measure.js";

function items(spec: {
  segment: "state_agency" | "sub_state";
  carried: number;
  timely: number;
  missing: number;
}): GradedItem[] {
  const out: GradedItem[] = [];
  let i = 0;
  for (let n = 0; n < spec.timely; n++)
    out.push({ externalId: `t${i++}`, segment: spec.segment, carried: "carried", leadDays: 30 });
  for (let n = 0; n < spec.carried; n++)
    out.push({ externalId: `c${i++}`, segment: spec.segment, carried: "carried", leadDays: 1 });
  for (let n = 0; n < spec.missing; n++)
    out.push({ externalId: `m${i++}`, segment: spec.segment, carried: "missing", leadDays: null });
  return out;
}

function find(rs: ReturnType<typeof measureCoverage>, id: string) {
  const r = rs.find((x) => x.id === id);
  if (!r) throw new Error(`no ${id}`);
  return r;
}

test("a healthy cohort passes C1 and C2", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 }));
  expect(find(rs, "C1").verdict).toBe("pass");
  expect(find(rs, "C2").verdict).toBe("pass");
});

/* 🔴 THE WHOLE POINT OF RULING ④. A source that carries everything, always,
 * but too late to bid, passes C1 and must FAIL C2. */
test("carried but always too late passes C1 and fails C2", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 40, timely: 0, missing: 0 }));
  expect(find(rs, "C1").verdict).toBe("pass");
  expect(find(rs, "C2").verdict).toBe("fail");
});

/* 🔴 THE WHOLE POINT OF RULING ③. Strong state-agency coverage must not
 * conceal weak sub-state coverage. Mirrors R7's weakest-property rule: a
 * minimum, unlike an average, cannot be talked up by adding strengths. */
test("a strong segment cannot rescue a weak one", () => {
  const rs = measureCoverage([
    ...items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 }),
    ...items({ segment: "sub_state", carried: 0, timely: 10, missing: 30 }),
  ]);
  expect(find(rs, "C1").verdict).toBe("fail");
  expect(find(rs, "C1").detail).toContain("sub_state");
});

/* Established practice: R7 recorded "61 rows -- below the population floor of
 * 100, measured and recorded as such". Below the floor grades UNKNOWN, never
 * pass -- a 100% recall over four notices is not evidence. */
test("a cohort below the floor is unknown, never pass", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 0, timely: 4, missing: 0 }));
  expect(find(rs, "C4").verdict).toBe("fail");
  expect(find(rs, "C1").verdict).toBe("unknown");
  expect(find(rs, "C2").verdict).toBe("unknown");
});

/* `unchecked` is not a miss and not a find. It must not enter either
 * numerator OR denominator, or a run that aborted at its budget cap changes
 * the score. */
test("unchecked notices are excluded from the cohort entirely", () => {
  const base = items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 });
  const withUnchecked: GradedItem[] = [
    ...base,
    ...Array.from({ length: 50 }, (_, n) => ({
      externalId: `u${n}`,
      segment: "state_agency" as const,
      carried: "unchecked" as const,
      leadDays: null,
    })),
  ];
  expect(find(measureCoverage(withUnchecked), "C1").measured).toBe(
    find(measureCoverage(base), "C1").measured,
  );
});

test("every predicate says its thresholds are unratified", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 }));
  for (const r of rs) expect(r.detail ?? "").toContain("not approved");
});

test("C3 reports median lead time without gating", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 }));
  expect(find(rs, "C3").verdict).toBe("unknown");
  expect(find(rs, "C3").measured).toBe(30);
});

test("the minLeadDays boundary is inclusive", () => {
  const rs = measureCoverage([
    { externalId: "a", segment: "state_agency", carried: "carried", leadDays: COVERAGE.minLeadDays },
  ]);
  expect(find(rs, "C2").measured).toBe(1);
});

/* FIX #1: CAVEAT is derived from the live COVERAGE_RATIFIED boolean.
 * When ratified, the caveat vanishes. When not, it reflects the actual flag value. */
test("the caveat reflects the actual COVERAGE_RATIFIED value, not a hard-coded literal", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 }));
  for (const r of rs) {
    if (COVERAGE_RATIFIED) {
      /* When ratified, detail should NOT contain "not approved" */
      expect(r.detail ?? "").not.toContain("not approved");
    } else {
      /* When not ratified, detail MUST contain "not approved" and reference the actual false value */
      expect(r.detail ?? "").toContain("not approved");
      expect(r.detail ?? "").toContain(`COVERAGE_RATIFIED = ${COVERAGE_RATIFIED}`);
    }
  }
});

/* FIX #2: C2 has a regression test for ratio vs count.
 * This cohort: state_agency 100/100 (1.0 ratio, 100 count) and sub_state 19/100 (0.19 ratio, 19 count).
 * If C2 used raw count instead of ratio, it would see 119 carried items and wrongly pass.
 * With correct ratio math, sub_state's 0.19 ratio fails the threshold. */
test("C2 measures ratio, not raw count, catching ratio-vs-count regressions", () => {
  const rs = measureCoverage([
    ...items({ segment: "state_agency", carried: 0, timely: 100, missing: 0 }),
    ...items({ segment: "sub_state", carried: 0, timely: 19, missing: 81 }),
  ]);
  expect(find(rs, "C2").measured).toBe(0.19);
  expect(find(rs, "C2").verdict).toBe("fail");
  expect(find(rs, "C2").detail).toContain("sub_state");
});

/* 🔴 FINAL REVIEW, item 4. The sub-state answer key is deliberately unbuilt,
 * so only state_agency is ever scored -- `weakest` returns the lone survivor
 * and the detail line used to name only it, leaving a reader to notice an
 * ABSENCE to realise sub_state was never measured at all. The whole reason
 * the weaker segment wins (ruling ③) is to stop a confident number about the
 * wrong segment; this is that same failure by omission. */
test("an unmeasured segment is named explicitly in C1 and C2, not silently dropped", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 }));
  expect(find(rs, "C1").detail).toContain("sub_state: NOT MEASURED");
  expect(find(rs, "C2").detail).toContain("sub_state: NOT MEASURED");
});

/* FIX #3: median's even-length branch with distinct values, not identical.
 * If the index math were off by one, [1, 2, 3, 4] would pick (1 + 2) / 2 = 1.5 (wrong low)
 * or (3 + 4) / 2 = 3.5 (wrong high) instead of (2 + 3) / 2 = 2.5, rounded to 3.
 * The rounded median catches index errors that coincidental rounding might hide. */
test("median computes correctly on even-length arrays with distinct values", () => {
  const rs = measureCoverage([
    { externalId: "a", segment: "state_agency", carried: "carried", leadDays: 1 },
    { externalId: "b", segment: "state_agency", carried: "carried", leadDays: 2 },
    { externalId: "c", segment: "state_agency", carried: "carried", leadDays: 3 },
    { externalId: "d", segment: "state_agency", carried: "carried", leadDays: 4 },
  ]);
  const c3 = find(rs, "C3");
  /* Median of sorted [1, 2, 3, 4] is (s[1] + s[2]) / 2 = (2 + 3) / 2 = 2.5, rounded to 3 */
  expect(c3.measured).toBe(3);
});
