import { expect, test } from "vitest";
import { title } from "./title.js";

/* IDOA's own payload shape (adapters/idoa.ts's `IdoaRawItem`): the title
 * lives at `eventName`, and the field named `title` does not exist at all. */
test("an IDOA title comes from eventName, not title", () => {
  expect(
    title("Indiana IDOA solicitations", {
      eventId: "003000000088390",
      eventName: "RFP 26-87895 ATC Laboratory Services THC Testing",
      agency: "Indiana Department of Correction",
    }),
  ).toBe("RFP 26-87895 ATC Laboratory Services THC Testing");
});

/* THE REGRESSION THIS FIX MUST NOT INTRODUCE: SAM.gov's title still comes
 * from `title`, unchanged, once IDOA has its own path. */
test("a SAM.gov title still comes from title, unchanged", () => {
  expect(title("SAM.gov", { title: "Nursing services", eventName: "not this" })).toBe(
    "Nursing services",
  );
});

/* An IDOA payload with an empty or missing eventName has genuinely nothing
 * to show -- the fallback fires, and reading `title` (absent from IDOA's
 * shape) is not attempted as a rescue, because that would be guessing at a
 * field this source never sends. */
test("an IDOA payload with no eventName falls back to (untitled)", () => {
  expect(title("Indiana IDOA solicitations", { eventId: "1", agency: "IDOC" })).toBe(
    "(untitled)",
  );
  expect(title("Indiana IDOA solicitations", { eventName: "" })).toBe("(untitled)");
  expect(title("Indiana IDOA solicitations", { eventName: "   " })).toBe("(untitled)");
});

/* A source with neither a recognised name nor a usable `title` field gets
 * the same literal fallback -- this is the pre-existing behaviour merge.ts
 * always had, preserved rather than narrowed to only the two named sources
 * (see title.ts's header on why the default still reads `.title`). */
test("a source with nothing usable gets (untitled)", () => {
  expect(title("USASpending", { anything: 1 })).toBe("(untitled)");
  expect(title("some-future-source", {})).toBe("(untitled)");
  expect(title("SAM.gov", { title: "" })).toBe("(untitled)");
});

/* Absence must not throw: merge reads whatever the source stored, and a
 * sighting's raw column is nullable. */
test("null and non-object payloads yield (untitled), not a throw", () => {
  expect(title("SAM.gov", null)).toBe("(untitled)");
  expect(title("SAM.gov", undefined)).toBe("(untitled)");
  expect(title("Indiana IDOA solicitations", null)).toBe("(untitled)");
});

/* A non-string value at the title path is stringified with String(), not
 * rejected -- merge.ts's own note on why this stays in JS rather than
 * becoming `raw->>'title'`: `->>` would render an object as JSON text,
 * String() gives "[object Object]". This asserts the JS behaviour, not the
 * SQL one. */
test("a non-string value is stringified rather than rejected", () => {
  expect(title("SAM.gov", { title: { nested: true } })).toBe("[object Object]");
});

/* Whitespace-only titles are treated as absent, matching the description.ts
 * and closes-at.ts precedent that a value present-but-blank is not a fact. */
test("a whitespace-only title falls back to (untitled)", () => {
  expect(title("SAM.gov", { title: "   " })).toBe("(untitled)");
});

/* ── HigherGov's glued anchor text, added 2026-09-07 ──────────────────── */

/* The observed artifact, verbatim from
 * docs/2026-09-03-highergov-field-mapping.md:51 and from the adapter's own
 * fixture (`highergov-listing.json`): HigherGov's parser takes a table
 * cell's whole text where ours takes one anchor, so Indiana's "Bid
 * Documents" link arrives welded to the end of the event name with no
 * separator. */
test("HigherGov's glued Bid Documents anchor is stripped from the title", () => {
  expect(title("HigherGov", { title: "300 SP Salamonie Sludge and WW RemovalBid Documents" })).toBe(
    "300 SP Salamonie Sludge and WW Removal",
  );
});

/* An ordinary HigherGov title is untouched -- the repair is a strip of one
 * known string, not a cleaner that reshapes every title it sees. */
test("a HigherGov title without the artifact is passed through unchanged", () => {
  expect(title("HigherGov", { title: "AMB 28942 TOC Gas Gen" })).toBe("AMB 28942 TOC Gas Gen");
  expect(title("HigherGov", { title: "2027 Road Resurfacing Program" })).toBe(
    "2027 Road Resurfacing Program",
  );
});

/* 🔴 THE CONSERVATISM THIS TURNS ON. Glued to a word, the string cannot be
 * something a buyer typed. Separated by a space it is an ordinary English
 * phrase, and nothing distinguishes it from the artifact -- so it stays.
 * Under-repairing leaves an ugly title; over-repairing silently deletes
 * words the buyer wrote, on a screen where nobody can see the original. */
test("a spaced 'Bid Documents' is left alone: it may be the buyer's own words", () => {
  expect(title("HigherGov", { title: "Removal Bid Documents" })).toBe("Removal Bid Documents");
  expect(title("HigherGov", { title: "Bid Documents" })).toBe("Bid Documents");
});

/* Only at the END, and only that exact string. A title that mentions bid
 * documents in the middle is describing the work, not carrying a link. */
test("the strip is anchored to the end of the title and to that exact string", () => {
  expect(title("HigherGov", { title: "RemovalBid Documents Addendum 2" })).toBe(
    "RemovalBid Documents Addendum 2",
  );
  expect(title("HigherGov", { title: "Removalbid documents" })).toBe("Removalbid documents");
  expect(title("HigherGov", { title: "RemovalBid Document" })).toBe("RemovalBid Document");
});

/* Trailing whitespace around the artifact must not defeat the anchor: the
 * value is trimmed before the match, so the glued suffix is still the last
 * thing in the string. */
test("trailing whitespace does not hide the artifact", () => {
  expect(title("HigherGov", { title: "  WW RemovalBid Documents   " })).toBe("WW Removal");
});

/* Source-scoped, like every other rule in these modules. The artifact is a
 * property of HigherGov's parser, not of titles in general -- a source that
 * has never been seen to carry it is not put through a rule written for
 * someone else's bug. */
test("no other source's title is put through HigherGov's repair", () => {
  expect(title("SAM.gov", { title: "300 SP Salamonie Sludge and WW RemovalBid Documents" })).toBe(
    "300 SP Salamonie Sludge and WW RemovalBid Documents",
  );
  expect(
    title("Indiana IDOA solicitations", { eventName: "WW RemovalBid Documents" }),
  ).toBe("WW RemovalBid Documents");
});

/* The fallback still governs: a HigherGov row with nothing usable is
 * "(untitled)", and the repair cannot manufacture an empty title out of one
 * that had content. */
test("HigherGov's repair never produces an empty title", () => {
  expect(title("HigherGov", {})).toBe("(untitled)");
  expect(title("HigherGov", { title: "   " })).toBe("(untitled)");
  expect(title("HigherGov", { title: "xBid Documents" })).toBe("x");
});
