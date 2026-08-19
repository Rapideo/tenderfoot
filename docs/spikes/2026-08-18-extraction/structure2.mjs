/* Two follow-ups, because "counts disagree" is not the same as "content lost"
 * and I am not repeating yesterday's mistake of grading on a proxy. */
import { readFile } from "node:fs/promises";
import mammoth from "mammoth";
import XLSX from "xlsx";
import AdmZip from "adm-zip";

const C = "C:/Users/matts/Desktop/Tenderfoot/corpus/";

/* ---- A. the 72 -> 56 cell gap: defect, or correct merge collapsing? ---- */
const P = C + "indiana/005030000087847/Att A1 - IVOSB.docx";
const buf = await readFile(P);
const xml = new AdmZip(buf).getEntry("word/document.xml").getData().toString("utf8");

const n = (s, re) => (s.match(re) ?? []).length;
const vMergeCont = n(xml, /<w:vMerge(?!\s[^>]*w:val="restart")[^>]*\/>/g);
const vMergeAll = n(xml, /<w:vMerge[\s/>]/g);
const hMerge = n(xml, /<w:gridSpan[\s/>]/g);

console.log("=== A. .docx cell-count gap on the IVOSB form ===");
console.log(`  <w:tc> in XML                       : ${n(xml, /<w:tc[\s>]/g)}`);
console.log(`  <w:vMerge> total                    : ${vMergeAll}`);
console.log(`  <w:vMerge> CONTINUATION (no restart): ${vMergeCont}`);
console.log(`  <w:gridSpan> (horizontal merges)    : ${hMerge}`);

const html = (await mammoth.convertToHtml({ buffer: buf })).value;
const htmlCells = n(html, /<t[dh][\s>]/g);
console.log(`  <td|th> in mammoth HTML             : ${htmlCells}`);
console.log(`  gap                                 : ${n(xml, /<w:tc[\s>]/g) - htmlCells}`);
console.log(`  rowspan/colspan emitted by mammoth  : ${n(html, /rowspan=/g)} rowspan, ${n(html, /colspan=/g)} colspan`);
console.log(`\n  VERDICT: ${vMergeCont === n(xml, /<w:tc[\s>]/g) - htmlCells
  ? "NOT a defect -- the gap equals the vertical-merge CONTINUATION cells exactly.\n"
    + "           Those are not separate cells; they are the lower half of a merged one,\n"
    + "           and HTML represents them with rowspan on the first. Structure preserved."
  : "gap does NOT match vMerge continuations -- needs a closer look"}`);

/* Does the text survive regardless? That is the question that actually
 * matters, and it is independent of how cells are counted. */
const raw = (await mammoth.extractRawText({ buffer: buf })).value.replace(/\s+/g, " ").trim();
const truth = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(" ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
console.log(`\n  text: XML holds ${truth.length} chars, mammoth returns ${raw.length} -> ${((raw.length / truth.length) * 100).toFixed(0)}% kept`);

/* ---- B. the 1000-row sheets: real data or declared-dimension inflation? */
console.log("\n=== B. .xlsx -- declared !ref vs actually populated range ===");
for (const f of [
  "indiana/004050000086378/004050000086378/RFP 26-86378 - Att D - Cost Proposal Template.xlsx",
  "indiana/007000000087901/Att D - Cost Proposal.xlsx",
]) {
  const wb = XLSX.read(await readFile(C + f), { type: "buffer" });
  console.log(`\n${f.split("/").pop()}`);
  for (const name of wb.SheetNames.slice(0, 4)) {
    const ws = wb.Sheets[name];
    const declared = ws["!ref"];
    /* Recompute the range from cells that actually hold something. */
    let maxR = -1, maxC = -1, populated = 0;
    for (const k of Object.keys(ws)) {
      if (k.startsWith("!")) continue;
      const a = XLSX.utils.decode_cell(k);
      const v = ws[k].v;
      if (v === undefined || v === null || String(v).trim() === "") continue;
      populated++;
      if (a.r > maxR) maxR = a.r;
      if (a.c > maxC) maxC = a.c;
    }
    const naive = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }).length;
    const trimmed = maxR + 1;
    console.log(`  "${name}": declared ${declared} -> sheet_to_json ${naive} rows; ` +
      `truly populated ${populated} cells, last real row ${trimmed}` +
      `  => ${naive - trimmed} phantom row(s) (${((1 - trimmed / naive) * 100).toFixed(0)}% noise)`);
  }
}

/* ---- C. does SheetJS EVALUATE formulas, or only replay Excel's cache? -- */
console.log("\n=== C. .xlsx -- formulas: evaluated, or cached? ===");
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([[2], [3]]);
ws.A3 = { t: "n", f: "SUM(A1:A2)" };           // formula, NO cached value
ws["!ref"] = "A1:A3";
XLSX.utils.book_append_sheet(wb, ws, "t");
const round = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
const cell = round.Sheets.t.A3;
console.log(`  wrote A3 = SUM(A1:A2) with no cached value; on read back: v=${JSON.stringify(cell?.v)} f=${JSON.stringify(cell?.f)}`);
console.log(`  VERDICT: ${cell?.v === undefined
  ? "SheetJS does NOT evaluate -- it replays whatever value Excel last cached.\n"
    + "           A workbook saved by a tool that did not recalculate yields a\n"
    + "           formula with no value, or worse, a STALE one, with no signal."
  : "SheetJS evaluated the formula (unexpected -- check this)"}`);
