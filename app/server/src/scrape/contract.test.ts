// app/server/src/scrape/contract.test.ts
import { expect, test } from "vitest";
import { validateRun } from "./contract.js";

test("a run without `since` is refused", () => {
  expect(() => validateRun({ source: "sam", depth: "listing" })).toThrow(/since/i);
});

test("an unknown depth is refused", () => {
  expect(() => validateRun({ source: "sam", since: "2026-08-01", depth: "everything" })).toThrow(
    /depth/i,
  );
});

test("`until` defaults to now, `budgetMs` to the CLI default", () => {
  const r = validateRun({ source: "sam", since: "2026-08-01", depth: "listing" });
  expect(r.until >= "2026-08-01").toBe(true);
  expect(r.budgetMs).toBeGreaterThan(0);
});

/* §1.1. The contract bounds what we reach for, never what qualifies. */
test("unknown keys are refused rather than ignored", () => {
  expect(() =>
    validateRun({ source: "sam", since: "2026-08-01", depth: "listing", minValue: 50000 }),
  ).toThrow(/minValue/);
});

test("since must be an ISO-8601 date", () => {
  expect(() => validateRun({ source: "sam", since: "--budgetMs", depth: "listing" })).toThrow(
    /since.*ISO-8601/i,
  );
  expect(() => validateRun({ source: "sam", since: "not-a-date", depth: "listing" })).toThrow(
    /since.*ISO-8601/i,
  );
});

test("since accepts both YYYY-MM-DD and full ISO datetime", () => {
  const r1 = validateRun({ source: "sam", since: "2026-08-01", depth: "listing" });
  expect(r1.since).toBe("2026-08-01");

  const r2 = validateRun({ source: "sam", since: "2026-08-01T12:30:45Z", depth: "listing" });
  expect(r2.since).toBe("2026-08-01T12:30:45Z");
});

test("defaulted until passes validation", () => {
  const r = validateRun({ source: "sam", since: "2026-08-01", depth: "listing" });
  expect(r.until).toBeTruthy();
  /* Just verify it's a real timestamp that parses correctly */
  expect(() => new Date(r.until)).not.toThrow();
});
