/* SP4 EXTRACTION SPIKE -- can Node parse the real corpus?
 *
 * Ruled 2026-08-18: do not pick a runtime by argument. The claim the whole
 * decision rested on ("Node is the weakest major runtime for this") had never
 * been tested against a single file, and corpus/ has held 96 real government
 * documents the entire time.
 *
 * ⚠️ THE MEASUREMENT THAT MATTERS IS NOT "DID IT THROW".
 * Today's defect was a control that answered 200 and did nothing. A parser
 * that returns an empty string for a 3.9 MB .docx has "succeeded" by every
 * signal except the only one that counts. So every file gets a VERDICT:
 *
 *   ok      -- extracted text that looks like prose or tabular data
 *   empty   -- parsed without error and produced nothing usable (SILENT FAILURE)
 *   thin    -- produced something, but far less than the file size suggests
 *   failed  -- threw
 *
 * `thin` and `empty` are the interesting ones. A runtime that fails loudly is
 * cheap to work around; one that succeeds quietly is the expensive kind.
 */
import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { performance } from "node:perf_hooks";

import mammoth from "mammoth";
import XLSX from "xlsx";
import AdmZip from "adm-zip";
import { extractText, getDocumentProxy } from "unpdf";

const ROOT = "C:/Users/matts/Desktop/Tenderfoot/corpus";
const PARSEABLE = new Set([".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".zip"]);

/* ---------- quality signals ------------------------------------------- */

const WORD = /[A-Za-z]{3,}/g;

function assess(text, bytes, kind) {
  const chars = text.length;
  const words = (text.match(WORD) ?? []).length;
  /* Printable ratio catches the classic "parsed the binary as text" result:
   * a long string that is mostly control characters and mojibake. */
  const printable = chars === 0 ? 0 : (text.match(/[\x20-\x7E\s\u00A0-\uFFFF]/g) ?? []).length / chars;

  if (chars === 0 || words === 0) return { verdict: "empty", chars, words, printable };

  /* A yardstick, not a law. Office formats compress and carry a lot of
   * non-text payload, so a low ratio is only a FLAG to look at the file --
   * which is why every thin result is listed individually in the report
   * rather than just counted. */
  const ratio = chars / bytes;
  const floor = kind === "pdf" ? 0.002 : 0.0008;
  if (ratio < floor) return { verdict: "thin", chars, words, printable, ratio };

  return { verdict: "ok", chars, words, printable, ratio };
}

/* ---------- per-format extractors -------------------------------------- */

async function fromPdf(buf) {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: String(text ?? ""), detail: `${totalPages} pages` };
}

async function fromDocx(buf) {
  const r = await mammoth.extractRawText({ buffer: buf });
  /* mammoth reports what it could not represent. Worth surfacing: it is the
   * difference between "extracted the text" and "extracted the document". */
  const warn = (r.messages ?? []).length;
  return { text: r.value ?? "", detail: warn ? `${warn} mammoth message(s)` : "no messages" };
}

function fromSheet(buf) {
  const wb = XLSX.read(buf, { type: "buffer" });
  let out = "";
  for (const name of wb.SheetNames) out += XLSX.utils.sheet_to_csv(wb.Sheets[name]) + "\n";
  return { text: out, detail: `${wb.SheetNames.length} sheet(s)` };
}

/* No maintained Node library extracts .pptx text. A .pptx IS a zip of XML,
 * so this reads the slide parts directly -- which is itself a finding: the
 * "Node library" for this format is hand-rolled. */
function fromPptx(buf) {
  const zip = new AdmZip(buf);
  const slides = zip.getEntries().filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName));
  let out = "";
  for (const s of slides) {
    const xml = s.getData().toString("utf8");
    for (const m of xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)) out += m[1] + " ";
    out += "\n";
  }
  return { text: out, detail: `${slides.length} slide(s), hand-rolled XML` };
}

async function extractOne(buf, ext, label) {
  switch (ext) {
    case ".pdf": return { ...(await fromPdf(buf)), kind: "pdf" };
    case ".docx": return { ...(await fromDocx(buf)), kind: "docx" };
    case ".xlsx":
    case ".xls": return { ...fromSheet(buf), kind: "sheet" };
    case ".pptx": return { ...fromPptx(buf), kind: "pptx" };
    default: throw new Error(`no extractor for ${ext} (${label})`);
  }
}

/* ---------- walk -------------------------------------------------------- */

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (PARSEABLE.has(extname(p).toLowerCase())) acc.push(p);
  }
  return acc;
}

const results = [];

async function measure(label, bytes, ext, fn, container = null) {
  const t0 = performance.now();
  try {
    const { text, detail, kind } = await fn();
    const ms = performance.now() - t0;
    results.push({ label, container, ext, bytes, ms, detail, error: null, ...assess(text, bytes, kind) });
  } catch (e) {
    results.push({
      label, container, ext, bytes, ms: performance.now() - t0,
      detail: null, error: (e?.message ?? String(e)).slice(0, 200),
      verdict: "failed", chars: 0, words: 0, printable: 0,
    });
  }
}

const files = walk(ROOT).sort();
console.error(`scanning ${files.length} files...`);

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, "/");
  const bytes = statSync(f).size;
  const ext = extname(f).toLowerCase();
  const buf = await readFile(f);

  if (ext === ".zip") {
    /* The nested-bundle case the stack doc named specifically. A zip is not
     * "extracted" -- its MEMBERS are, so it is measured by whether every
     * member could be reached and parsed. */
    let entries;
    try {
      entries = new AdmZip(buf).getEntries().filter((e) => !e.isDirectory);
    } catch (e) {
      results.push({ label: rel, container: null, ext, bytes, ms: 0, detail: null,
        error: `zip open failed: ${e.message}`, verdict: "failed", chars: 0, words: 0, printable: 0 });
      continue;
    }
    results.push({ label: rel, container: null, ext, bytes, ms: 0,
      detail: `${entries.length} member(s)`, error: null, verdict: "container",
      chars: 0, words: 0, printable: 0 });

    for (const e of entries) {
      const mext = extname(e.entryName).toLowerCase();
      if (!PARSEABLE.has(mext) || mext === ".zip") {
        results.push({ label: e.entryName, container: rel, ext: mext || "(none)",
          bytes: e.header.size, ms: 0, detail: "not a parseable format", error: null,
          verdict: "skipped", chars: 0, words: 0, printable: 0 });
        continue;
      }
      const mbuf = e.getData();
      await measure(e.entryName, mbuf.length, mext, () => extractOne(mbuf, mext, e.entryName), rel);
    }
    continue;
  }

  await measure(rel, bytes, ext, () => extractOne(buf, ext, rel));
}

console.log(JSON.stringify(results, null, 1));
console.error(`done: ${results.length} rows`);
