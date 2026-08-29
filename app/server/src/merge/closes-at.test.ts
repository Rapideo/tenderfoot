import { expect, test } from "vitest";
import { closesAt } from "./closes-at.js";

/* Pure -- no useTestSchema(), no database, no timeout accommodation. Same
 * posture as the resolveField half of precedence.ts: a rule that reads a
 * payload should be testable without a Postgres connection. */

/* The real shape, from a stored SAM.gov sighting. Trimmed to the fields
 * this function reads plus the one that explains them. */
const SAM = {
  responseDate: "2026-09-02T03:59:00+00:00",
  responseDateActual: "2026-09-01T23:59:00-04:00",
  responseTimeZone: "America/New_York",
  originalResponseDate: "2025-10-16T03:59:00+00:00",
};

test("reads the deadline as a bare calendar date", () => {
  expect(closesAt("SAM.gov", SAM)).toBe("2026-09-01");
});

/* THE WHOLE REASON THIS FUNCTION PICKS A FIELD RATHER THAN TAKING THE FIRST
 * ONE. responseDate and responseDateActual are the same instant written in
 * UTC and in the notice's own timezone. For an evening deadline the UTC
 * rendering rolls past midnight, so truncating it records the deadline a day
 * LATE -- measured at 39 of 1,338 live SAM deadlines. Late is the one
 * direction that actively misleads a bidder, so this asserts the local date
 * wins, not merely that some date is returned. */
test("prefers local time over UTC, so an evening deadline keeps its own day", () => {
  expect(closesAt("SAM.gov", SAM)).toBe("2026-09-01");
  expect(closesAt("SAM.gov", SAM)).not.toBe("2026-09-02");
});

/* Not the pre-amendment date. A solicitation whose deadline was extended
 * would otherwise be recorded as closed months before it is. */
test("ignores originalResponseDate, which is the superseded deadline", () => {
  expect(closesAt("SAM.gov", SAM)).not.toBe("2025-10-16");
});

/* One live row carries responseDate and no responseDateActual, so the
 * fallback is exercised by real data, not defensiveness. */
test("falls back to the UTC field when it is the only one present", () => {
  expect(closesAt("SAM.gov", { responseDate: "2026-09-02T03:59:00+00:00" })).toBe("2026-09-02");
});

test("a payload with no deadline yields null, not a guess", () => {
  expect(closesAt("SAM.gov", { title: "no dates here" })).toBeNull();
  expect(closesAt("SAM.gov", {})).toBeNull();
});

/* Absence must not throw: merge reads whatever the source stored, and a
 * sighting's raw column is nullable. */
test("null and non-object payloads yield null", () => {
  expect(closesAt("SAM.gov", null)).toBeNull();
  expect(closesAt("SAM.gov", undefined)).toBeNull();
});

/* A value that is present but not a date must not be passed through. The
 * column feeds `left(closes_at, 10) >= to_char(now(), 'YYYY-MM-DD')`, where
 * a non-date string compares lexically and silently rather than failing. */
test("a non-date value yields null rather than being passed through", () => {
  expect(closesAt("SAM.gov", { responseDateActual: "TBD" })).toBeNull();
  expect(closesAt("SAM.gov", { responseDateActual: 20260901 })).toBeNull();
  expect(closesAt("SAM.gov", { responseDateActual: "" })).toBeNull();
});

/* Same discipline as orgChain's default branch: an unrecognised source
 * returns nothing rather than hunting for a field name that might happen to
 * exist in its payload. USASpending reports awards and has no deadline. */
test("an unknown source yields null even when the payload looks familiar", () => {
  expect(closesAt("USASpending", SAM)).toBeNull();
  expect(closesAt("Corpus import — Indiana open (2026-08-04)", SAM)).toBeNull();
  expect(closesAt("", SAM)).toBeNull();
});
