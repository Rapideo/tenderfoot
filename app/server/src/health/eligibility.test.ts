import { expect, test } from "vitest";
import { probeEligibility } from "./eligibility.js";

const row = (over: Partial<Parameters<typeof probeEligibility>[0]> = {}) => ({
  name: "X", legal_posture: "in", platform: "SAM", ...over,
});

test("an 'in' source on a real platform is probeable", () => {
  expect(probeEligibility(row())).toEqual({ probeable: true });
});

/* The four rows whose own terms forbid contact. §5.5.1's precedent is that
 * "terms are respected even where access is technically possible", and a
 * liveness probe is exactly the case that tests it. */
test("an 'out' source is refused, and the reason names its posture", () => {
  const e = probeEligibility(row({ legal_posture: "out", name: "GovWin IQ" }));
  expect(e.probeable).toBe(false);
  expect((e as { reason: string }).reason).toMatch(/out/);
});

test("a 'manual-only' source is refused", () => {
  const e = probeEligibility(row({ legal_posture: "manual-only", name: "Ohio OhioBuys" }));
  expect(e.probeable).toBe(false);
  expect((e as { reason: string }).reason).toMatch(/manual-only/);
});

test("a Manual import source is refused -- there is no endpoint to probe", () => {
  const e = probeEligibility(row({ platform: "Manual import" }));
  expect(e.probeable).toBe(false);
  expect((e as { reason: string }).reason).toMatch(/no endpoint/);
});

/* The load-bearing distinction: `enabled` governs INGESTION, `legal_posture`
 * governs CONTACT. Twelve of thirteen rows are disabled; consulting `enabled`
 * would leave exactly one row with a health value. */
test("enabled is not consulted -- a disabled source is still probeable", () => {
  expect(probeEligibility({ ...row(), enabled: false } as never)).toEqual({ probeable: true });
});

test("a null platform is refused rather than assumed probeable", () => {
  expect(probeEligibility(row({ platform: null })).probeable).toBe(false);
});
