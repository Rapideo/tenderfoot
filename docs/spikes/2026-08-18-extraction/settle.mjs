/* Two of my own scanners disagreed about one file. Settling it directly.
 *
 * verify.mjs used  /<w:t[^>]*>([\s\S]*?)<\/w:t>/   and reported 10,675 chars
 * docx-audit used  /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/  and reported no loss
 *
 * The difference is that `<w:t[^>]*>` also matches `<w:tbl>`, `<w:tc>`,
 * `<w:tr>` -- so it opens on a TABLE tag and then captures raw XML markup up
 * to the next literal </w:t>, counting angle brackets as document text. */
import { readFile } from "node:fs/promises";
import mammoth from "mammoth";
import AdmZip from "adm-zip";

const P = "C:/Users/matts/Desktop/Tenderfoot/corpus/indiana/004050000086378/004050000086378/RFP 26-86378 - Att I - Pre-proposal Network Opp Form.docx";
const buf = await readFile(P);
const zip = new AdmZip(buf);

console.log(`file: ${(buf.length / 1024).toFixed(0)} KB`);
console.log("\n--- what is actually IN this 3.7 MB file? largest parts ---");
const entries = zip.getEntries().map((e) => ({ n: e.entryName, c: e.header.compressedSize, u: e.header.size }))
  .sort((a, b) => b.u - a.u).slice(0, 6);
for (const e of entries) console.log(`  ${(e.u / 1024).toFixed(0).padStart(7)} KB uncompressed  ${e.n}`);
console.log(`  total entries: ${zip.getEntries().length}`);

const xml = zip.getEntry("word/document.xml").getData().toString("utf8");

const loose = [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("");
const strict = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("");

console.log("\n--- the two scanners on word/document.xml ---");
console.log(`  loose  /<w:t[^>]*>/      -> ${loose.length} chars`);
console.log(`  strict /<w:t(\\s[^>]*)?>/ -> ${strict.length} chars`);
console.log(`  does the LOOSE capture contain raw XML markup? ${/<w:|<\/w:/.test(loose) ? "YES -- it is counting tags as text" : "no"}`);
console.log(`  markup chars inside the loose capture: ${(loose.match(/<[^>]+>/g) ?? []).join("").length}`);

const r = await mammoth.extractRawText({ buffer: buf });
console.log(`\n  mammoth returned        -> ${r.value.length} chars, ${(r.messages ?? []).length} message(s)`);

/* Third, independent method: count only text nodes, by stripping every tag
 * from the body and keeping what is left. Agrees with neither scanner if
 * both are wrong. */
const stripped = xml
  .replace(/<w:instrText[\s\S]*?<\/w:instrText>/g, "")
  .replace(/<[^>]+>/g, "\u0000")
  .split("\u0000").join("")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
console.log(`  strip-all-tags method   -> ${stripped.replace(/\s+/g, " ").trim().length} chars`);

const n = (s) => s.replace(/\s+/g, " ").trim();
console.log(`\n  strict vs mammoth: ${n(strict).length} vs ${n(r.value).length} -> mammoth kept ${((n(r.value).length / n(strict).length) * 100).toFixed(1)}%`);
console.log(`\n  first 200 chars of the STRICT extraction:`);
console.log("   " + n(strict).slice(0, 200));
