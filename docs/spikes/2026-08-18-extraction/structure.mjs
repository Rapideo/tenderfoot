/* SP4 SPIKE, PART TWO -- does STRUCTURE survive extraction?
 *
 * Part one measured characters recovered and reported 172/172. That is the
 * right answer to the wrong question for the documents that decide a bid: a
 * cost proposal's meaning is which number sits in which row and column, and
 * a parser can recover every character of it while destroying all of that.
 *
 * Ground truth, per format, never the parser's own opinion:
 *   .docx  -- <w:tbl>/<w:tr>/<w:tc> in the document's own XML
 *   .xlsx  -- the worksheet's declared !ref dimensions, merges and formulas
 *   .pdf   -- there IS no structure in the format; measured as "what happens
 *             to a table when you ask for its text"
 */
import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import mammoth from "mammoth";
import XLSX from "xlsx";
import AdmZip from "adm-zip";
import { getDocumentProxy } from "unpdf";

const ROOT = "C:/Users/matts/Desktop/Tenderfoot/corpus";

function walk(dir, exts, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, exts, acc);
    else if (exts.has(extname(p).toLowerCase())) acc.push(p);
  }
  return acc;
}
const rel = (f) => relative(ROOT, f).replace(/\\/g, "/");
const count = (s, re) => (s.match(re) ?? []).length;

/* ================= 1. .docx tables ===================================== */
console.log("=== 1. .docx -- do tables survive as tables? ===");
console.log("ground truth = <w:tbl>/<w:tr>/<w:tc> in word/document.xml");
console.log("under test   = mammoth.convertToHtml (extractRawText flattens by design)\n");

let dTables = 0, dRows = 0, dCells = 0, gTables = 0, gRows = 0, gCells = 0;
const docxBad = [];

for (const f of walk(ROOT, new Set([".docx"])).sort()) {
  const buf = await readFile(f);
  const xml = new AdmZip(buf).getEntry("word/document.xml")?.getData().toString("utf8") ?? "";
  const t = count(xml, /<w:tbl[\s>]/g);
  const r = count(xml, /<w:tr[\s>]/g);
  const c = count(xml, /<w:tc[\s>]/g);
  if (t === 0) continue;

  const html = (await mammoth.convertToHtml({ buffer: buf })).value;
  const ht = count(html, /<table[\s>]/g);
  const hr = count(html, /<tr[\s>]/g);
  const hc = count(html, /<t[dh][\s>]/g);

  gTables += t; gRows += r; gCells += c;
  dTables += ht; dRows += hr; dCells += hc;
  if (ht !== t || hr !== r || hc !== c) docxBad.push({ f: rel(f), t, r, c, ht, hr, hc });
}

console.log(`XML declares : ${gTables} tables, ${gRows} rows, ${gCells} cells`);
console.log(`mammoth HTML : ${dTables} tables, ${dRows} rows, ${dCells} cells`);
console.log(`files where the counts disagree: ${docxBad.length}`);
for (const b of docxBad.slice(0, 8)) {
  console.log(`  ${b.f}\n     tbl ${b.t}->${b.ht}  tr ${b.r}->${b.hr}  tc ${b.c}->${b.hc}`);
}

/* ================= 2. .xlsx -- dimensions, merges, FORMULAS ============= */
console.log("\n=== 2. .xlsx -- a cost proposal's totals are formulas ===");
for (const f of walk(ROOT, new Set([".xlsx", ".xls"])).sort()) {
  if (!/cost|budget|price/i.test(f)) continue;
  const buf = await readFile(f);
  const wb = XLSX.read(buf, { type: "buffer", cellFormula: true, cellNF: true });
  console.log(`\n${rel(f)}`);
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const ref = ws["!ref"] ?? "(empty)";
    const merges = (ws["!merges"] ?? []).length;
    let cells = 0, formulas = 0, cached = 0;
    for (const k of Object.keys(ws)) {
      if (k.startsWith("!")) continue;
      cells++;
      if (ws[k].f) { formulas++; if (ws[k].v !== undefined) cached++; }
    }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    console.log(`  sheet "${name}": ref ${ref}, ${cells} cells, ${merges} merged range(s), ` +
      `${formulas} formula(s) (${cached} with a cached value), sheet_to_json -> ${rows.length} row(s)`);
    if (formulas) {
      const k = Object.keys(ws).find((x) => !x.startsWith("!") && ws[x].f);
      console.log(`     e.g. ${k}: formula="${ws[k].f}"  cachedValue=${JSON.stringify(ws[k].v)}`);
    }
  }
}

/* ================= 3. .pdf -- what a table becomes ===================== */
console.log("\n=== 3. .pdf -- there is no table structure in the format ===");
const pdfs = walk(ROOT, new Set([".pdf"])).sort();
let withGeometry = 0;
for (const f of pdfs.slice(0, 1)) {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(f)));
  const page = await pdf.getPage(1);
  const tc = await page.getTextContent();
  const item = tc.items.find((i) => i.str?.trim());
  console.log(`\nsample: ${rel(f)}`);
  console.log(`  pdf.js gives ${tc.items.length} positioned text items on page 1`);
  console.log(`  each carries geometry: transform=${JSON.stringify(item?.transform)} width=${item?.width}`);
}
for (const f of pdfs) {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(f)));
  const tc = await (await pdf.getPage(1)).getTextContent();
  if (tc.items.some((i) => Array.isArray(i.transform))) withGeometry++;
}
console.log(`\nPDFs whose text items carry x/y geometry: ${withGeometry}/${pdfs.length}`);
console.log("  -> table reconstruction is POSSIBLE from geometry, and is NOT PROVIDED.");
console.log("  -> `extractText` returns a flat string: rows and columns are gone.");
