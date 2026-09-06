import { expect, test } from "vitest";
import { measureCoverage } from "./measure.js";
import { COVERAGE } from "./thresholds.js";
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
