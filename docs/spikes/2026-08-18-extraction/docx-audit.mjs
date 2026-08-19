/* The size-ratio heuristic caught ONE silently-truncated .docx, and only
 * because that file happened to be 3.7 MB. A 100 KB file losing 95% of its
 * text would have graded 'ok'. So this replaces the heuristic with a direct
 * comparison that does not depend on file size at all:
 *
 *   ground truth  = every <w:t> run in the document's own XML parts
 *   under test    = what mammoth.extractRawText returns
 *
 * Ground truth is not a guess: <w:t> IS where Word stores literal text.
 * Comparing them turns "did it look plausible" into "how much did it lose".
 *
 * Reads header/footer/textbox parts too, because that is where the missing
 * text is most likely to be hiding. */
import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import mammoth from "mammoth";
import AdmZip from "adm-zip";

const ROOT = "C:/Users/matts/Desktop/Tenderfoot/corpus";

function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (extname(p).toLowerCase() === ".docx") acc.push(p);
  }
  return acc;
}

const norm = (s) => s.replace(/\s+/g, " ").trim();

function xmlText(zip, filter) {
  let out = "";
  for (const e of zip.getEntries()) {
    if (!filter(e.entryName)) continue;
    const xml = e.getData().toString("utf8");
    for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) out += m[1] + " ";
  }
  return norm(
    out
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'"),
  );
}

const rows = [];
for (const f of walk(ROOT).sort()) {
  const rel = relative(ROOT, f).replace(/\\/g, "/");
  const buf = await readFile(f);
  let zip;
  try { zip = new AdmZip(buf); } catch (e) { rows.push({ rel, err: "zip: " + e.message }); continue; }

  const body = xmlText(zip, (n) => n === "word/document.xml");
  const extra = xmlText(zip, (n) => /^word\/(header|footer)\d*\.xml$/.test(n));
  const truth = norm(body + " " + extra);

  let got = "", msgs = 0, err = null;
  try {
    const r = await mammoth.extractRawText({ buffer: buf });
    got = norm(r.value ?? "");
    msgs = (r.messages ?? []).length;
  } catch (e) { err = e.message; }

  const kept = truth.length === 0 ? 1 : got.length / truth.length;
  rows.push({ rel, bytes: buf.length, truth: truth.length, body: body.length, got: got.length, kept, msgs, err });
}

const bad = rows.filter((r) => r.err || r.kept < 0.85).sort((a, b) => a.kept - b.kept);
const withMsgs = rows.filter((r) => r.msgs > 0);

console.log("=== .docx: mammoth output vs the text actually present in the XML ===");
console.log(`files audited: ${rows.length}`);
console.log(`mammoth kept >=85% of the XML text: ${rows.length - bad.length}/${rows.length}`);
console.log(`files where mammoth reported ANY message: ${withMsgs.length}/${rows.length}` +
  "   <-- the earlier report said 105/105; that was a scanner bug, see below");

console.log(`\n=== FILES LOSING TEXT (${bad.length}) ===`);
for (const r of bad) {
  console.log(`\n${r.rel}`);
  if (r.err) { console.log(`   ERROR: ${r.err}`); continue; }
  console.log(`   ${(r.bytes / 1024).toFixed(0)} KB | XML holds ${r.truth} chars (body ${r.body}) | mammoth returned ${r.got}`);
  console.log(`   KEPT ${(r.kept * 100).toFixed(1)}%  -- LOST ${r.truth - r.got} chars, with ${r.msgs} warning(s)`);
}

const dist = { "100%": 0, ">=99%": 0, ">=95%": 0, ">=85%": 0, "<85%": 0 };
for (const r of rows) {
  if (r.err) continue;
  if (r.kept >= 0.999) dist["100%"]++;
  else if (r.kept >= 0.99) dist[">=99%"]++;
  else if (r.kept >= 0.95) dist[">=95%"]++;
  else if (r.kept >= 0.85) dist[">=85%"]++;
  else dist["<85%"]++;
}
console.log("\n=== fidelity distribution ===");
for (const [k, v] of Object.entries(dist)) console.log(`  ${k.padEnd(7)} ${v}`);
