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
