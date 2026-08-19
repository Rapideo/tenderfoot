/* The size heuristic produced three false alarms, so it is discarded. For
 * PDFs the question that actually matters is not size at all -- it is
 * whether any page is a SCAN. An image-only page extracts to ~nothing, and
 * no parser in any runtime can fix that; it needs OCR. That is a gap that
 * would belong to Python and smart mode too, so it must be measured
 * separately from "can Node parse PDFs".
 *
 * Measured per PAGE, not per file: one scanned page inside a 40-page
 * document is invisible in a whole-file average. */
import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { getDocumentProxy } from "unpdf";

const ROOT = "C:/Users/matts/Desktop/Tenderfoot/corpus";

function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (extname(p).toLowerCase() === ".pdf") acc.push(p);
  }
  return acc;
}

const files = walk(ROOT).sort();
let pagesTotal = 0, pagesBlank = 0, pagesThin = 0;
const suspects = [];

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, "/");
  const buf = await readFile(f);
  let pdf;
  try { pdf = await getDocumentProxy(new Uint8Array(buf)); }
  catch (e) { suspects.push({ rel, note: "OPEN FAILED: " + e.message }); continue; }

  const n = pdf.numPages;
  const perPage = [];
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const chars = tc.items.reduce((s, it) => s + (it.str?.length ?? 0), 0);
    perPage.push(chars);
    pagesTotal++;
    if (chars === 0) pagesBlank++;
    else if (chars < 100) pagesThin++;
  }
  const blanks = perPage.filter((c) => c === 0).length;
  const thins = perPage.filter((c) => c > 0 && c < 100).length;
  if (blanks || thins) {
    suspects.push({
      rel, note: `${n} pages: ${blanks} with ZERO text, ${thins} under 100 chars` +
        `  [per-page: ${perPage.slice(0, 14).join(",")}${n > 14 ? ",…" : ""}]`,
    });
  }
}

console.log("=== PDF: per-page text audit (is anything a scan?) ===");
console.log(`files: ${files.length} | pages: ${pagesTotal}`);
console.log(`pages with ZERO extractable text : ${pagesBlank}  (${((pagesBlank / pagesTotal) * 100).toFixed(1)}%)`);
console.log(`pages under 100 chars            : ${pagesThin}  (${((pagesThin / pagesTotal) * 100).toFixed(1)}%)`);
console.log(`\nfiles containing any such page: ${suspects.length}`);
for (const s of suspects) console.log(`\n  ${s.rel}\n    ${s.note}`);
