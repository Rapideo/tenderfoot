import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("results.json", "utf8"));

const parsed = rows.filter((r) => !["container", "skipped"].includes(r.verdict));
const topLevel = parsed.filter((r) => !r.container);
const inZip = parsed.filter((r) => r.container);

const by = (arr, k) => arr.reduce((m, r) => ((m[r[k]] ??= []).push(r), m), {});

console.log("=== OVERALL ===");
console.log("rows total:", rows.length,
  "| containers:", rows.filter((r) => r.verdict === "container").length,
  "| skipped members:", rows.filter((r) => r.verdict === "skipped").length,
  "| parsed attempts:", parsed.length);
console.log("  top-level files:", topLevel.length, "| inside zips:", inZip.length);

const verdicts = by(parsed, "verdict");
console.log("\nverdict counts:");
for (const [v, list] of Object.entries(verdicts).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${v.padEnd(8)} ${String(list.length).padStart(4)}  (${((list.length / parsed.length) * 100).toFixed(1)}%)`);
}

console.log("\n=== BY FORMAT ===");
console.log("ext      n   ok  thin empty fail   ok%    medianMs   totalMB");
for (const [ext, list] of Object.entries(by(parsed, "ext")).sort()) {
  const c = (v) => list.filter((r) => r.verdict === v).length;
  const ms = list.map((r) => r.ms).sort((a, b) => a - b);
  const med = ms[Math.floor(ms.length / 2)] ?? 0;
  const mb = list.reduce((s, r) => s + r.bytes, 0) / 1e6;
  console.log(
    `${ext.padEnd(7)} ${String(list.length).padStart(3)} ${String(c("ok")).padStart(4)} ${String(c("thin")).padStart(5)} ${String(c("empty")).padStart(5)} ${String(c("failed")).padStart(4)} ${((c("ok") / list.length) * 100).toFixed(0).padStart(5)}%  ${med.toFixed(0).padStart(8)}  ${mb.toFixed(1).padStart(8)}`,
  );
}

const bad = parsed.filter((r) => r.verdict !== "ok");
console.log(`\n=== EVERY NON-OK RESULT (${bad.length}) ===`);
for (const r of bad.sort((a, b) => a.verdict.localeCompare(b.verdict) || b.bytes - a.bytes)) {
  const where = r.container ? `  [in ${r.container}]` : "";
  console.log(`\n[${r.verdict}] ${r.label}${where}`);
  console.log(`   ${(r.bytes / 1024).toFixed(0)} KB, ${r.ms.toFixed(0)}ms, chars=${r.chars}, words=${r.words}` +
    (r.ratio !== undefined ? `, chars/byte=${r.ratio.toFixed(5)}` : ""));
  if (r.detail) console.log(`   detail: ${r.detail}`);
  if (r.error) console.log(`   ERROR: ${r.error}`);
}

console.log("\n=== ZIP CONTAINERS ===");
for (const r of rows.filter((x) => x.verdict === "container")) {
  const members = parsed.filter((m) => m.container === r.label);
  const skipped = rows.filter((m) => m.container === r.label && m.verdict === "skipped");
  const okc = members.filter((m) => m.verdict === "ok").length;
  console.log(`${r.label}  (${(r.bytes / 1e6).toFixed(1)} MB, ${r.detail}) -> parsed ${okc}/${members.length} ok, ${skipped.length} non-document member(s)`);
}

const skipExt = by(rows.filter((r) => r.verdict === "skipped"), "ext");
console.log("\n=== NON-DOCUMENT MEMBERS INSIDE ZIPS (not attempted) ===");
for (const [ext, l] of Object.entries(skipExt).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${ext.padEnd(10)} ${l.length}`);
}

const slow = [...parsed].sort((a, b) => b.ms - a.ms).slice(0, 8);
console.log("\n=== SLOWEST 8 ===");
for (const r of slow) console.log(`  ${r.ms.toFixed(0).padStart(7)}ms  ${(r.bytes / 1024).toFixed(0).padStart(6)} KB  ${r.ext.padEnd(6)} ${r.label.slice(0, 70)}`);

const total = parsed.reduce((s, r) => s + r.ms, 0);
const mb = parsed.reduce((s, r) => s + r.bytes, 0) / 1e6;
console.log(`\ntotal parse time: ${(total / 1000).toFixed(1)}s over ${mb.toFixed(1)} MB (${(mb / (total / 1000)).toFixed(1)} MB/s)`);

const mamm = parsed.filter((r) => r.ext === ".docx" && /message/.test(r.detail ?? ""));
console.log(`\ndocx files where mammoth reported unrepresentable content: ${mamm.length}/${parsed.filter((r) => r.ext === ".docx").length}`);
