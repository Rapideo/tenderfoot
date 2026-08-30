import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { parsePdf } from "./pdf.js";

const FIXTURE = new URL(
  "../../../../../corpus/federal/HPLRFI2026/HPL RFI 2026_07_30.pdf",
  import.meta.url,
);

test("reads text out of a real corpus PDF", async () => {
  const r = await parsePdf(Buffer.from(readFileSync(FIXTURE)));
  expect(r.kind).toBe("text");
  if (r.kind !== "text") return;
  expect(r.text.length).toBeGreaterThan(500);
});

test("records that a PDF carries no table structure", async () => {
  /* The format has no table structure to preserve -- geometry is present,
   * reconstruction is not provided (spike part two). Saying so in `notes`
   * keeps it from being mistaken for a parser limitation later. */
  const r = await parsePdf(Buffer.from(readFileSync(FIXTURE)));
  if (r.kind !== "text") throw new Error("expected text");
  expect(r.notes.join(" ")).toMatch(/no table structure/i);
});

/* A minimal but VALID PDF: catalogue, page tree, one page, and no content
 * stream at all -- which is the shape a scanned document has once the image
 * is taken away. Built here rather than taken from corpus/ because the
 * corpus has no scan-only file and the point is the absence, not the image. */
function emptyPagePdf(): Buffer {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/* FOUND BY THE FIRST LIVE RUN, 2026-08-30: `Sign In Sheet 8-10.pdf` is an
 * image-only scan. It parsed to an empty string, and the orchestrator's
 * fail-closed branch recorded "parsed but produced no text" -- true, and
 * indistinguishable from a corrupt file, a wrong media type, or a parser
 * fault. A page count separates them: pages but no text is a SCAN, and that
 * is a category decision (OCR is out of scope), not a failure to investigate.
 *
 * The table-structure note is dropped in this case on purpose. It describes
 * what was lost from text that exists; with no text at all it is noise
 * sitting in front of the only fact that matters. */
test("a PDF with pages but no text layer says so, and drops the irrelevant note", async () => {
  const r = await parsePdf(emptyPagePdf());
  if (r.kind !== "text") throw new Error("expected text");
  expect(r.text).toBe("");
  expect(r.notes.join(" ")).toMatch(/1 page/i);
  expect(r.notes.join(" ")).toMatch(/no text layer/i);
  expect(r.notes.join(" ")).not.toMatch(/no table structure/i);
});
