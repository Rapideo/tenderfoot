import { expect, test } from "vitest";
import { noticeKind, listingCodes, setAside } from "./listing-facts.js";

/* Pure -- no useTestSchema(), no database. Same posture as closes-at.test.ts:
 * a rule that reads a payload should be testable without a Postgres
 * connection.
 *
 * Every fixture below is the REAL shape, taken from stored SAM.gov sightings
 * and from adapters/fixtures/sam-listing.json -- including the awkward parts,
 * which is the point. A tidied fixture would not have caught the null psc
 * code or the category string sitting in a code field. */

const SAM = {
  type: { code: "o", value: "Combined Synopsis/Solicitation" },
  naics: [{ code: "541611", id: 1806, value: "Administrative Management" }],
  psc: [
    { code: "R410", id: 11106, value: "SUPPORT- PROFESSIONAL" },
    { code: "R4 - PROFESSIONAL SERVICES", id: null, value: null },
  ],
  solicitation: {
    setAside: { code: "SBA", value: "Total Small Business Set-Aside" },
    originalSetAside: { code: "NONE", value: null },
  },
};

/* ── kind: SAM's own word, no mapping ─────────────────────────────────── */

test("the notice type is stored in SAM's own word", () => {
  expect(noticeKind("SAM.gov", SAM)).toBe("Combined Synopsis/Solicitation");
});

/* ⚖️ Matt's ruling, 2026-09-01. The column comment says `RFP | RFI | RFQ |
 * IFB | sources-sought` and SAM says none of those. A mapping would be a
 * judgement about what a notice IS, made invisibly inside a merge function.
 * This asserts the absence of one: if someone later "tidies" this into RFP,
 * that is a reversal of a ruling and should fail here rather than pass. */
test("no vocabulary mapping is invented", () => {
  expect(noticeKind("SAM.gov", SAM)).not.toBe("RFP");
  expect(noticeKind("SAM.gov", { type: { value: "Award Notice" } })).toBe("Award Notice");
  expect(noticeKind("SAM.gov", { type: { value: "Sources Sought" } })).toBe("Sources Sought");
});

test("a source with no notice type yields null rather than a guess", () => {
  expect(noticeKind("USASpending", SAM)).toBeNull();
  expect(noticeKind("SAM.gov", {})).toBeNull();
  expect(noticeKind("SAM.gov", null)).toBeNull();
});

/* ── codes: the shape ingest/corpus.ts already writes ─────────────────── */

test("naics and psc are collected in the shape the corpus path already uses", () => {
  expect(listingCodes("SAM.gov", SAM)).toEqual({
    naics: ["541611"],
    psc: ["R410", "R4 - PROFESSIONAL SERVICES"],
  });
});

/* Real data, not defensiveness: one fixture record carries psc
 * [{code:'AG11'}, {code:null}]. A null is the ABSENCE of a code, so it must
 * not become an entry -- an array with a null in it would break any consumer
 * that assumes string[], and would do it only on some rows. */
test("a null code is dropped, not carried as an entry", () => {
  expect(listingCodes("SAM.gov", { psc: [{ code: "AG11" }, { code: null }] })).toEqual({
    naics: [],
    psc: ["AG11"],
  });
});

/* Null, not an empty object. An empty `{naics:[],psc:[]}` written over a
 * populated column would erase codes the corpus path had set. */
test("a payload with no codes at all yields null, so nothing is overwritten", () => {
  expect(listingCodes("SAM.gov", { title: "x" })).toBeNull();
  expect(listingCodes("SAM.gov", { naics: [], psc: [] })).toBeNull();
  expect(listingCodes("USASpending", SAM)).toBeNull();
});

/* ── set_aside: NONE is a value ───────────────────────────────────────── */

test("the current set-aside wins over the pre-amendment one", () => {
  expect(setAside("SAM.gov", SAM)).toBe("SBA");
  expect(setAside("SAM.gov", SAM)).not.toBe("NONE");
});

/* THE DISTINCTION THIS WHOLE FIELD TURNS ON, and the reason it is asserted
 * rather than assumed. "NONE" means the buyer STATED there is no set-aside;
 * null means the notice did not say. Collapsing them destroys the same
 * we-looked / we-did-not-look distinction View 2.3 enforces on every
 * extracted field -- and does it where no citation exists to check it. */
test("NONE is stored as a stated fact, and a missing field is null", () => {
  expect(setAside("SAM.gov", { solicitation: { setAside: { code: "NONE" } } })).toBe("NONE");
  expect(setAside("SAM.gov", { solicitation: {} })).toBeNull();
  expect(setAside("SAM.gov", {})).toBeNull();
});

test("originalSetAside is read only when the current one is absent entirely", () => {
  expect(
    setAside("SAM.gov", { solicitation: { originalSetAside: { code: "WOSB" } } }),
  ).toBe("WOSB");
  /* Present-but-empty is still present: it must not fall through. */
  expect(
    setAside("SAM.gov", {
      solicitation: { setAside: { code: "8A" }, originalSetAside: { code: "WOSB" } },
    }),
  ).toBe("8A");
});
