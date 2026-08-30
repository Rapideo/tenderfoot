import { expect, test } from "vitest";
import * as XLSX from "xlsx";
import { parseXlsx } from "./xlsx.js";

/* Built here rather than taken from corpus/ so the two traps are unambiguous:
 * a declared range far larger than the populated one, and a formula cell whose
 * cached value is stale. */
function workbook(): Buffer {
  const ws: XLSX.WorkSheet = {
    A1: { t: "s", v: "Item" },
    B1: { t: "s", v: "Cost" },
    A2: { t: "s", v: "Widget" },
    B2: { t: "n", v: 10 },
    B3: { t: "n", v: 999, f: "SUM(B2:B2)" }, // cached 999, would compute 10
    "!ref": "A1:Z5000",                       // fiction
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

test("computes the populated range instead of trusting !ref", async () => {
  /* Declared dimensions are fiction: 89-99% phantom rows in the corpus. */
  const r = await parseXlsx(workbook());
  if (r.kind !== "text") throw new Error("expected text");
  expect(r.text.split("\n").length).toBeLessThan(20);
});

test("records that a total is a CACHED value, not a computed one", async () => {
  /* SheetJS replays Excel's cached result. A workbook saved without
   * recalculation yields a stale total with no signal -- and with no scores in
   * V1, extraction accuracy is the only thing the system can be wrong about. */
  const r = await parseXlsx(workbook());
  if (r.kind !== "text") throw new Error("expected text");
  expect(r.notes.join(" ")).toMatch(/cached/i);
  expect(r.notes.join(" ")).toMatch(/B3/);
});
