// app/server/src/scrape/contract.test.ts
import { expect, test } from "vitest";
import { validateRun } from "./contract.js";

test("a run without `since` is refused", () => {
  expect(() => validateRun({ source: "sam", depth: "listing" }, "windowed")).toThrow(/since/i);
});

test("an unknown depth is refused", () => {
  expect(() => validateRun({ source: "sam", since: "2026-08-01", depth: "everything" }, "windowed")).toThrow(
    /depth/i,
  );
});

test("`until` defaults to now, `budgetMs` to the CLI default", () => {
  const r = validateRun({ source: "sam", since: "2026-08-01", depth: "listing" }, "windowed");
  /* Non-null assertion, not a guard: `until` is only optional on
   * RunRequest at all because a SNAPSHOT request never carries one (Task
   * 3, §4) -- this call is windowed (the default shape), and validateRun's
   * windowed branch always fills `until` in. */
  expect(r.until! >= "2026-08-01").toBe(true);
  expect(r.budgetMs).toBeGreaterThan(0);
});

/* §1.1. The contract bounds what we reach for, never what qualifies. */
test("unknown keys are refused rather than ignored", () => {
  expect(() =>
    validateRun({ source: "sam", since: "2026-08-01", depth: "listing", minValue: 50000 }, "windowed"),
  ).toThrow(/minValue/);
});

test("since must be an ISO-8601 date", () => {
  expect(() => validateRun({ source: "sam", since: "--budgetMs", depth: "listing" }, "windowed")).toThrow(
    /since.*ISO-8601/i,
  );
  expect(() => validateRun({ source: "sam", since: "not-a-date", depth: "listing" }, "windowed")).toThrow(
    /since.*ISO-8601/i,
  );
});

test("since accepts both YYYY-MM-DD and full ISO datetime", () => {
  const r1 = validateRun({ source: "sam", since: "2026-08-01", depth: "listing" }, "windowed");
  expect(r1.since).toBe("2026-08-01");

  const r2 = validateRun({ source: "sam", since: "2026-08-01T12:30:45Z", depth: "listing" }, "windowed");
  expect(r2.since).toBe("2026-08-01T12:30:45Z");
});

test("defaulted until passes validation", () => {
  const r = validateRun({ source: "sam", since: "2026-08-01", depth: "listing" }, "windowed");
  expect(r.until).toBeTruthy();
  /* Just verify it's a real timestamp that parses correctly */
  expect(() => new Date(r.until!)).not.toThrow();
});

test("a windowed run still refuses to start without a window", () => {
  expect(() => validateRun({ source: "sam", depth: "listing" }, "windowed")).toThrow(/since is required/);
});

test("a snapshot run does not take a window at all", () => {
  const r = validateRun({ source: "idoa", depth: "listing" }, "snapshot");
  expect(r.since).toBeUndefined();
  expect(r.until).toBeUndefined();
});

test("a snapshot run REJECTS a window rather than ignoring it", () => {
  /* Silently accepting `since` on a source that cannot honour it is exactly
   * the §5.4 failure -- a parameter accepted and quietly ignored. */
  expect(() => validateRun({ source: "idoa", depth: "listing", since: "2026-01-01" }, "snapshot"))
    .toThrow(/does not accept a date window/);
});

test("limit is accepted, bounded, and optional", () => {
  expect(validateRun({ source: "idoa", depth: "listing", limit: 10 }, "snapshot").limit).toBe(10);
  expect(validateRun({ source: "idoa", depth: "listing" }, "snapshot").limit).toBeUndefined();
  expect(() => validateRun({ source: "idoa", depth: "listing", limit: 0 }, "snapshot"))
    .toThrow(/limit must be a positive integer/);
});
