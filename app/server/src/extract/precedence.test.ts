import { expect, test } from "vitest";
import { resolveField } from "./precedence.js";

/* The FSSA bundle, 26-87847. Three boilerplate PDFs, two deadlines, and the
 * CORRECT date in the file with the LEAST specific name. Two of the three
 * documents carry the stale date; the listing is what actually settles it.
 * (A bare "pick the later/greater date" heuristic also lands on the right
 * answer here, by coincidence of this corpus's real numbers -- that is not
 * a heuristic this fixture can discredit without inventing data. What it
 * DOES test is that resolveField() prefers 'listing' as an ORIGIN, not as
 * an accident of array position: the listing row sits after the first
 * document row, not at index 0, so a resolver that merely returns its
 * first argument cannot pass by luck.) */
const FSSA = [
  { value_text: "2026-08-26", origin: "document" as const, quote: "due August 26, 2026", document_id: 1 },
  { value_text: "2026-09-17", origin: "listing" as const, quote: null, document_id: null },
  { value_text: "2026-09-17", origin: "document" as const, quote: "due September 17, 2026", document_id: 2 },
  { value_text: "2026-08-26", origin: "document" as const, quote: "due August 26, 2026", document_id: 3 },
];

test("listing metadata outranks document text", () => {
  expect(resolveField(FSSA).value).toBe("2026-09-17");
});

test("the disagreement survives instead of being resolved away", () => {
  /* Fed 26 August, a deadline-passed gate would have silently eliminated the
   * best-fit opportunity in the corpus three weeks early. The conflict is the
   * only thing that makes that inspectable. */
  const r = resolveField(FSSA);
  expect(r.conflicts.map((c) => c.value_text)).toContain("2026-08-26");
  expect(r.conflicts.every((c) => c.origin === "document")).toBe(true);
});

test("documents decide when the listing has nothing to say", () => {
  /* qa_closes_at is document-only; the listing does not carry it. */
  const r = resolveField([
    { value_text: "2026-08-05", origin: "document", quote: "questions by August 5", document_id: 9 },
  ]);
  expect(r.value).toBe("2026-08-05");
  expect(r.origin).toBe("document");
});

test("precedence is origin-based, not date-based", () => {
  /* Synthetic, not the FSSA citation: the FSSA fixture's values are a
   * multiset whose maximum already equals the correct (listing) answer, so
   * no reordering of it can distinguish resolveField() from a bare
   * "pick the later date" heuristic (fix round 1 finding). Here the
   * document's date is chronologically LATER than the listing's, so a
   * max-date mutant returns 2026-10-01 and fails; the real rule returns the
   * listing's 2026-09-17 regardless. */
  const r = resolveField([
    { value_text: "2026-10-01", origin: "document", quote: "due October 1, 2026", document_id: 1 },
    { value_text: "2026-09-17", origin: "listing", quote: null, document_id: null },
  ]);
  expect(r.value).toBe("2026-09-17");
});

test("looked-for-and-absent is not a conflict", () => {
  const r = resolveField([
    { value_text: "2026-09-17", origin: "listing", quote: null, document_id: null },
    { value_text: null, origin: "document", quote: null, document_id: 4 },
  ]);
  expect(r.value).toBe("2026-09-17");
  expect(r.conflicts).toHaveLength(0);
});
