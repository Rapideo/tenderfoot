import { expect, test } from "vitest";
import { placeOfPerformance } from "./place.js";

/* A REAL production payload fragment, copied verbatim 2026-09-02 from the
 * "Dental prosthetics - Blanket purchase agreement" notice -- the exact card
 * that made Matt call the queue unworkable. Note `city` is a NUMERIC code,
 * which is why stateCode checks the SHAPE rather than trusting the field. */
const REAL = {
  placeOfPerformance: [
    { zip: "86042", city: "56890", state: "AZ", country: "USA", streetAddress: null },
  ],
};

test("reads the state out of a payload the card could not show", () => {
  expect(placeOfPerformance("SAM.gov", REAL)).toBe("AZ");
});

test("only the FIRST place is read, and that is deliberate", () => {
  /* A multi-site IDIQ genuinely has several. Flattening them would assert a
   * single location the source did not; first-or-nothing matches what SAM's
   * own summary shows, and the record view can read the whole array. */
  const multi = { placeOfPerformance: [{ state: "IN" }, { state: "OH" }] };
  expect(placeOfPerformance("SAM.gov", multi)).toBe("IN");
});

test("a city code is not mistaken for a state", () => {
  /* The regression this guards is real: SAM's `city` is numeric, so a loose
   * "non-empty string" test would happily store "56890" as a location. */
  expect(placeOfPerformance("SAM.gov", { placeOfPerformance: [{ state: "56890" }] })).toBeNull();
  expect(placeOfPerformance("SAM.gov", { placeOfPerformance: [{ state: "Arizona" }] })).toBeNull();
});

test("absent geography is null, never a placeholder", () => {
  /* 36% coverage means absent is the COMMON case. Null keeps the chip off the
   * card entirely; anything else would print more often than the fact. */
  expect(placeOfPerformance("SAM.gov", { placeOfPerformance: [] })).toBeNull();
  expect(placeOfPerformance("SAM.gov", {})).toBeNull();
  expect(placeOfPerformance("SAM.gov", null)).toBeNull();
});

test("IDOA gets null rather than an invented 'IN'", () => {
  /* IDOA publishes no location. Hardcoding the state agency's own state would
   * assert a fact the source never stated -- a state agency can and does buy
   * services delivered elsewhere. This is D27's lesson applied forward. */
  expect(placeOfPerformance("Indiana IDOA solicitations", { agency: "Education" })).toBeNull();
});

test("an unknown source gets null, not a guess", () => {
  expect(placeOfPerformance("Some Future Portal", { placeOfPerformance: [{ state: "IN" }] })).toBeNull();
});
