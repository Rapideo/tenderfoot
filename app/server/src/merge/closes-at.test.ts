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

/* Indiana IDOA. Verbatim strings from the committed fixture
 * (scrape/adapters/fixtures/idoa-listing.html), not invented ones -- US
 * month/day/year, 12-hour clock, AM/PM glued to the seconds, a trailing
 * named zone. */
test("reads an IDOA deadline as a bare calendar date", () => {
  expect(
    closesAt("Indiana IDOA solicitations", { responseDueBy: "10/05/2026 3:00:00PM EST" }),
  ).toBe("2026-10-05");
  expect(
    closesAt("Indiana IDOA solicitations", { responseDueBy: "09/29/2026 11:00:00AM EST" }),
  ).toBe("2026-09-29");
});

/* IDOA states this deadline in its own civil time, so -- unlike SAM's
 * responseDate/responseDateActual pair -- there is no UTC-vs-local
 * conversion to get right. The date component of the string IS the answer,
 * regardless of what the named zone says. */
test("does not shift the IDOA date for its stated timezone", () => {
  expect(
    closesAt("Indiana IDOA solicitations", { responseDueBy: "01/01/2026 12:00:00AM EST" }),
  ).toBe("2026-01-01");
});

/* THE CASE THE TASK CALLS OUT BY NAME: a string this function cannot parse
 * must return null, never a guess -- a wrong deadline sorts and filters the
 * queue on a lie, where a null just sorts last and says nothing. */
test("an unparseable IDOA date yields null rather than a guess", () => {
  expect(closesAt("Indiana IDOA solicitations", { responseDueBy: "TBD" })).toBeNull();
  expect(closesAt("Indiana IDOA solicitations", { responseDueBy: "" })).toBeNull();
  // Missing seconds -- close to the real shape, but not it.
  expect(closesAt("Indiana IDOA solicitations", { responseDueBy: "10/05/2026 3:00PM EST" })).toBeNull();
  // Missing AM/PM.
  expect(
    closesAt("Indiana IDOA solicitations", { responseDueBy: "10/05/2026 15:00:00 EST" }),
  ).toBeNull();
  // Missing the timezone abbreviation.
  expect(
    closesAt("Indiana IDOA solicitations", { responseDueBy: "10/05/2026 3:00:00PM" }),
  ).toBeNull();
  // ISO shape, not IDOA's own.
  expect(closesAt("Indiana IDOA solicitations", { responseDueBy: "2026-10-05" })).toBeNull();
  // Out-of-range month/day.
  expect(
    closesAt("Indiana IDOA solicitations", { responseDueBy: "13/40/2026 3:00:00PM EST" }),
  ).toBeNull();
  expect(closesAt("Indiana IDOA solicitations", { responseDueBy: 20261005 })).toBeNull();
  expect(closesAt("Indiana IDOA solicitations", {})).toBeNull();
});

/* A source with neither a recognised name nor a usable field still gets
 * nothing, exactly as SAM's own unknown-source case does. */
test("IDOA's own field means nothing to a different source", () => {
  expect(closesAt("SAM.gov", { responseDueBy: "10/05/2026 3:00:00PM EST" })).toBeNull();
});
