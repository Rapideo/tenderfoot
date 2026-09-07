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

/* ⚖️ Ruling ③ (Matt, 2026-09-07). sled_forecast is the pre-RFP layer §4.6
 * asks for (R4 found 8 in 100). It carries no deadline and no value, so it
 * is HELD and never QUEUED -- and `kind` is the discriminator NOT_BIDDABLE
 * already reads. */
test("a sled_forecast row is kind 'forecast'", () => {
  expect(noticeKind("HigherGov", { source_type: "sled_forecast" })).toBe("forecast");
});

/* 🔴 A real notice must NOT be given a kind we invented. `kind` feeds
 * NOT_BIDDABLE, so a wrong value here silently removes biddable work from
 * the queue -- the failure this project has already had to fix once. */
test("an ordinary sled row gets no invented kind", () => {
  expect(noticeKind("HigherGov", { source_type: "sled" })).toBeNull();
  expect(noticeKind("HigherGov", {})).toBeNull();
});

/* ── codes: the corpus path's shape, WIDENED 2026-09-02 ───────────────── */

/* The `*_labels` keys were added after Matt found the triage card showed
 * nothing about what a notice IS. A bare "339116" only helps a reader who
 * knows their codes by heart; "Dental Laboratories" is the same fact a person
 * can act on, and SAM has carried both all along as `{code, value}` -- we
 * stored half of it.
 *
 * ADDITIVE ON PURPOSE. Widening `naics`/`psc` themselves into objects would
 * have broken every reader reaching for `.naics[0]` silently. New sibling
 * keys leave those untouched; a corpus row that carries no labels simply has
 * no label chip, because the card reads them with optional chaining. */
test("naics and psc are collected in the shape the corpus path already uses", () => {
  expect(listingCodes("SAM.gov", SAM)).toEqual({
    naics: ["541611"],
    psc: ["R410", "R4 - PROFESSIONAL SERVICES"],
    /* The fixture's own labels, not empties -- SAM carries `{code, value}` and
     * the second psc entry has `value: null`, so exactly one label survives
     * there. That asymmetry is the point of keeping the lists flat and
     * independent rather than zipping them into pairs. */
    naics_labels: ["Administrative Management"],
    psc_labels: ["SUPPORT- PROFESSIONAL"],
  });
});

test("labels are carried alongside the codes, not instead of them", () => {
  /* The regression this guards: someone "simplifying" the two flat lists into
   * one array of {code, value} pairs. That is the tempting shape and it is
   * wrong here -- a code can be null while its value is present and vice
   * versa (the fixture below is real), so positional pairing would silently
   * mis-associate a label with the wrong code. */
  const withLabels = {
    naics: [{ code: "339116", value: "Dental Laboratories" }],
    psc: [{ code: "6520", value: "DENTAL INSTRUMENTS, EQUIPMENT, AND SUPPLIES" }],
  };
  expect(listingCodes("SAM.gov", withLabels)).toEqual({
    naics: ["339116"],
    psc: ["6520"],
    naics_labels: ["Dental Laboratories"],
    psc_labels: ["DENTAL INSTRUMENTS, EQUIPMENT, AND SUPPLIES"],
  });
});

test("a label with no code, and a code with no label, both survive independently", () => {
  const lopsided = {
    naics: [{ code: null, value: "Dental Laboratories" }, { code: "541611", value: null }],
  };
  expect(listingCodes("SAM.gov", lopsided)).toEqual({
    naics: ["541611"],
    psc: [],
    naics_labels: ["Dental Laboratories"],
    psc_labels: [],
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
    naics_labels: [],
    psc_labels: [],
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

/* ── HigherGov's codes and set-aside, added 2026-09-07 ────────────────── */

/* 🔴 THESE ARE MONEY TESTS, NOT DISPLAY TESTS. CLAUDE.md §5.2 prices human
 * triage at zero because the listing card carries NAICS, PSC and set_aside.
 * With those three unmapped, a sub-state notice with no description (58% of
 * that segment) offers a triager nothing to reject on, so they open
 * documents -- ~11 billed records each against a 1,000/month ceiling, and
 * roughly 90 opens exhausts the month.
 *
 * The real shape, per docs/2026-09-03-highergov-field-mapping.md:56-58: the
 * codes are NESTED OBJECTS whose inner key repeats the outer name, and
 * set_aside is flat. */
const HIGHERGOV = {
  source_id: "003000000088067",
  source_type: "sled",
  set_aside: "SBA",
  naics_code: { naics_code: "541611", naics_description: "Administrative Management" },
  psc_code: { psc_code: "R410", psc_description: "SUPPORT- PROFESSIONAL" },
};

test("HigherGov's nested naics_code and psc_code land as codes", () => {
  expect(listingCodes("HigherGov", HIGHERGOV)).toEqual({
    naics: ["541611"],
    psc: ["R410"],
    /* No labels: nothing in the field-mapping document records a description
     * field on these objects, and the card reads labels with optional
     * chaining. An invented field name would be a guess wearing a code's
     * clothes. The fixture above deliberately CARRIES plausible description
     * keys so that this assertion is about the choice, not about the data
     * being absent. */
    naics_labels: [],
    psc_labels: [],
  });
});

/* THE TRAP THIS CASE EXISTS FOR, and it has now sprung three times on this
 * one source (agency, opp_type, these). Reading the container flat yields
 * `undefined`; stringifying it yields "[object Object]", which is worse than
 * nothing because it looks like a code. Neither may happen. */
test("the code objects are never read flat or stringified", () => {
  const codes = listingCodes("HigherGov", HIGHERGOV);
  expect(codes?.naics).not.toContain("[object Object]");
  expect(codes?.psc).not.toContain("[object Object]");
  expect(codes?.naics).toEqual(["541611"]);
});

test("a HigherGov row with no codes yields null, so nothing is overwritten", () => {
  expect(listingCodes("HigherGov", { source_id: "x" })).toBeNull();
  expect(listingCodes("HigherGov", { naics_code: null, psc_code: null })).toBeNull();
  expect(listingCodes("HigherGov", { naics_code: {}, psc_code: {} })).toBeNull();
  expect(listingCodes("HigherGov", { naics_code: { naics_code: "" } })).toBeNull();
});

/* One present and the other absent is the ordinary case, not an edge one:
 * a row must not lose the code it HAS because its sibling is missing. */
test("one code present and the other absent still yields the one", () => {
  expect(listingCodes("HigherGov", { naics_code: { naics_code: "541611" } })).toEqual({
    naics: ["541611"],
    psc: [],
    naics_labels: [],
    psc_labels: [],
  });
  expect(listingCodes("HigherGov", { psc_code: { psc_code: "R410" } })).toEqual({
    naics: [],
    psc: ["R410"],
    naics_labels: [],
    psc_labels: [],
  });
});

/* The container's shape is exactly what the money rides on, so a wrong guess
 * about it must yield NO code rather than a throw or a fabricated one. */
test("a code container of the wrong shape yields nothing and never throws", () => {
  expect(listingCodes("HigherGov", { naics_code: "541611" })).toBeNull();
  expect(listingCodes("HigherGov", { naics_code: ["541611"] })).toBeNull();
  expect(listingCodes("HigherGov", { naics_code: 541611 })).toBeNull();
  expect(listingCodes("HigherGov", null)).toBeNull();
});

/* Cross-source discipline, the same closes-at.ts and title.ts hold to: one
 * source's field names mean nothing to another. */
test("HigherGov's code shape means nothing to SAM, and SAM's means nothing to HigherGov", () => {
  expect(listingCodes("SAM.gov", HIGHERGOV)).toBeNull();
  expect(listingCodes("HigherGov", SAM)).toBeNull();
});

test("HigherGov's set_aside lands verbatim", () => {
  expect(setAside("HigherGov", HIGHERGOV)).toBe("SBA");
  expect(setAside("HigherGov", { set_aside: "SDVOSBC" })).toBe("SDVOSBC");
});

/* ⚠️ THE SAME DISTINCTION THE SAM CASE TURNS ON, asserted separately here
 * because it is 100% present on Indiana and therefore the cheapest rejection
 * signal this source carries. "NONE" is the buyer STATING there is no
 * set-aside; null is the notice not saying. A later "tidy-up" that collapses
 * NONE into null must fail here. */
test("HigherGov's NONE is a stated fact, not an absence", () => {
  expect(setAside("HigherGov", { set_aside: "NONE" })).toBe("NONE");
  expect(setAside("HigherGov", { set_aside: "NONE" })).not.toBeNull();
  expect(setAside("HigherGov", {})).toBeNull();
  expect(setAside("HigherGov", { set_aside: null })).toBeNull();
  expect(setAside("HigherGov", { set_aside: "   " })).toBeNull();
  expect(setAside("HigherGov", { set_aside: { code: "SBA" } })).toBeNull();
});

test("set_aside is read flat for HigherGov and nested for SAM, never the other way round", () => {
  expect(setAside("HigherGov", SAM)).toBeNull();
  expect(setAside("SAM.gov", HIGHERGOV)).toBeNull();
});
