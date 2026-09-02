import { expect, test } from "vitest";
import { description, stripHtml, truncateWords } from "./description.js";

/* The opening of a REAL production payload, copied verbatim from a SAM.gov
 * sighting on 2026-09-02 (solicitation N6426726Q4229). Boilerplate and all --
 * a fixture written from imagination would not have the &nbsp; that broke the
 * first draft of the stripper. */
const REAL_SAM = {
  descriptions: [
    {
      content:
        "<p>This is a combined synopsis/solicitation for commercial items prepared in " +
        "accordance with the format in Subpart 12.6, as supplemented with additional " +
        "information included in this notice.</p><p>This announcement constitutes the " +
        "only solicitation; proposals are being requested and a written solicitation " +
        "will not be issued.&nbsp; The solicitation document and incorporated " +
        "provisions and clauses are those in effect.</p>",
    },
  ],
};

test("reads SAM's description out of the payload it has always carried", () => {
  const d = description("SAM.gov", REAL_SAM);
  expect(d).toBeTruthy();
  expect(d).toContain("combined synopsis/solicitation for commercial items");
  /* No markup survives. */
  expect(d).not.toMatch(/<[^>]+>/);
  /* &nbsp; became a space, not the literal entity -- the defect that would
   * render as "issued.&nbsp; The" on screen. */
  expect(d).not.toContain("&nbsp;");
});

test("paragraph breaks survive, so the record view is readable", () => {
  const d = description("SAM.gov", REAL_SAM)!;
  /* Two <p> blocks must not run into one line. Without the block-boundary
   * rule in stripHtml this reads "...in this notice.This announcement...". */
  expect(d).toContain("\n");
  expect(d).not.toMatch(/notice\.This announcement/);
});

test("the longest description wins when a source ships several", () => {
  const d = description("SAM.gov", {
    descriptions: [{ content: "<p>Short.</p>" }, { content: "<p>A considerably longer one.</p>" }],
  });
  expect(d).toBe("A considerably longer one.");
});

test("IDOA's Event Description column is read as the plain text it already is", () => {
  const d = description("Indiana IDOA solicitations", {
    description: "RFP 26-87895 ATC Laboratory Services THC Testing. The purpose of this RFP is…",
  });
  expect(d).toContain("ATC Laboratory Services THC Testing");
});

test("a source with nothing to read returns null rather than an empty string", () => {
  /* Null skips the update map. An empty string would OVERWRITE a real
   * description with a blank on the next re-merge, and would render as an
   * empty panel that reads as a rendering bug rather than an absent fact. */
  expect(description("USASpending", { anything: 1 })).toBeNull();
  expect(description("SAM.gov", { descriptions: [] })).toBeNull();
  expect(description("SAM.gov", { descriptions: [{ content: "<p>  </p>" }] })).toBeNull();
  expect(description("SAM.gov", null)).toBeNull();
});

test("script and style bodies are removed, not read as text", () => {
  const d = stripHtml("<p>Real text.</p><script>var x = 'not text';</script>");
  expect(d).toBe("Real text.");
});

test("truncateWords cuts on a word boundary and marks that it cut", () => {
  const text = Array.from({ length: 250 }, (_, i) => `word${i}`).join(" ");
  const { text: cut, truncated } = truncateWords(text, 200);
  expect(truncated).toBe(true);
  expect(cut.split(/\s+/).length).toBeLessThanOrEqual(201); // 200 + the ellipsis token
  /* The ellipsis is load-bearing: without it a truncated description reads as
   * a complete one that simply stops. */
  expect(cut.endsWith("…")).toBe(true);
  expect(cut).not.toContain("word200");
});

test("truncateWords leaves a short description completely alone", () => {
  const { text, truncated } = truncateWords("Three words here.", 200);
  expect(truncated).toBe(false);
  expect(text).toBe("Three words here.");
});

test("truncateWords prefers a sentence end when one is near the cut", () => {
  const words = Array.from({ length: 195 }, (_, i) => `w${i}`).join(" ");
  const { text } = truncateWords(`${words}. ${"tail ".repeat(30)}`, 200);
  /* Ends on the full stop rather than mid-clause, and therefore needs no
   * ellipsis to read as finished. */
  expect(text.endsWith(".")).toBe(true);
});
