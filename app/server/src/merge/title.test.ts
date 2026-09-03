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
