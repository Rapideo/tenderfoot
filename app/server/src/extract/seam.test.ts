import { expect, test } from "vitest";
import { readFileSync, globSync } from "node:fs";
import { parsePdf } from "./parsers/pdf.js";
import { extractFields } from "./fields.js";
import { resolveField, type FieldRow } from "./precedence.js";

/* corpus/FINDINGS.md §1 -- "the single most important finding here". The FSSA
 * External Quality Reviews RFP (26-87847, event 005030000087847) ships three
 * boilerplate PDFs carrying TWO different submission deadlines, and the
 * portal says 17 September. Fed the stale 26 August, §6.1 Stage 0's
 * deadline-passed gate would have silently eliminated the corpus's single
 * best-fit opportunity on 27 August -- three weeks before it actually closed.
 *
 * No database here on purpose. This is the seam between the three pure
 * pieces -- parse, extract, resolve -- over the real bytes, which is exactly
 * where a wrong answer would come from. */
const BUNDLE = new URL("../../../../corpus/indiana/005030000087847/", import.meta.url);

/* Every filename in this bundle contains spaces. */
const read = (name: string) => Buffer.from(readFileSync(new URL(encodeURIComponent(name), BUNDLE)));

const STALE = "2026-08-26";
const CORRECT = "2026-09-17";

test("the stale deadline really is in the bundle, in more than one file", async () => {
  /* The corpus is the premise of every other assertion here. If these files
   * are ever replaced or re-exported, this fails FIRST and says why, rather
   * than letting the tests below pass over a bundle that no longer contains
   * the hazard they describe. Task 9's lesson, in test form: green tests over
   * a premise nobody checked. */
  const pdfs = globSync("*.pdf", { cwd: BUNDLE });
  expect(pdfs.length).toBeGreaterThanOrEqual(3);

  let carryingStale = 0;
  for (const name of pdfs) {
    const parsed = await parsePdf(read(name));
    if (parsed.kind !== "text") continue;
    if (/august\s+26,\s*2026/i.test(parsed.text)) carryingStale++;
  }
  expect(carryingStale).toBeGreaterThanOrEqual(2);
});

test("whatever the documents say, the listing wins and the date is the correct one", async () => {
  const pdfs = globSync("*.pdf", { cwd: BUNDLE });
  const rows: FieldRow[] = [
    { value_text: CORRECT, origin: "listing", quote: null, document_id: null },
  ];
  for (const [i, name] of pdfs.entries()) {
    const parsed = await parsePdf(read(name));
    if (parsed.kind !== "text") continue;
    const closes = extractFields(parsed.text).find((f) => f.field_name === "closes_at");
    rows.push({
      value_text: closes?.value_text ?? null,
      origin: "document",
      quote: closes?.quote ?? null,
      document_id: i + 1,
    });
  }

  const resolved = resolveField(rows);
  expect(resolved.value).toBe(CORRECT);
  expect(resolved.origin).toBe("listing");
  /* And never the stale one, by any route. */
  expect(resolved.value).not.toBe(STALE);

  /* At least one document was actually READ -- otherwise this test would
   * pass just as happily against a parser that returned nothing at all, and
   * would be measuring the listing row it wrote itself. */
  expect(rows.some((r) => r.origin === "document" && r.value_text !== null)).toBe(true);
});

/* THE PROTECTION ITSELF, with the documented values fed in directly, and it
 * is a SEPARATE test on purpose.
 *
 * Today's extractor does not surface the stale date at all, so the test
 * above cannot observe a conflict. That is an ACCIDENT, not a safeguard, and
 * measuring it would be worse than useless -- see the note below. Precedence
 * is what stands between a stale cover page and a wrongly-eliminated
 * opportunity, so it is pinned here on its own terms, where no change to
 * fields.ts can quietly empty it out.
 *
 * WHY THE EXTRACTOR MISSES IT, measured 2026-08-30 and worth not
 * re-deriving. The cover pages read `Submission Due Date and Time:\nAugust
 * 26, 2026` -- cue and date on DIFFERENT lines. fields.ts clamps the
 * lookback at a block boundary, so the cue is outside the window and the
 * date is never classified. The schedule tables read `Submission Due
 * Date/Time September 17, 2026` on ONE line, which matches. So the
 * extractor is blind to the label-above-value layout, which is how most
 * cover pages are set -- and the day that clamp is relaxed, these documents
 * begin stating 2026-08-26 and this test stops being hypothetical. */
test("a document's stale deadline never outranks the listing, and is kept with its evidence", () => {
  const rows: FieldRow[] = [
    {
      value_text: STALE,
      origin: "document",
      quote: "Submission Due Date and Time: August 26, 2026, by 03:00 PM ET",
      document_id: 1,
    },
    { value_text: CORRECT, origin: "listing", quote: null, document_id: null },
    {
      value_text: CORRECT,
      origin: "document",
      quote: "Submission Due Date/Time September 17, 2026",
      document_id: 2,
    },
  ];

  const resolved = resolveField(rows);

  /* The listing wins even though a document row came FIRST in the list. */
  expect(resolved.value).toBe(CORRECT);
  expect(resolved.origin).toBe("listing");

  /* The stale date is KEPT, not discarded, and it keeps its quote. A
   * rejection you cannot inspect is a bug you will never find -- and the
   * agreeing document is not a conflict, so exactly one row should be here. */
  expect(resolved.conflicts).toHaveLength(1);
  expect(resolved.conflicts[0]?.value_text).toBe(STALE);
  expect(resolved.conflicts[0]?.quote).toMatch(/August 26, 2026/);
});
