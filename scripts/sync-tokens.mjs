#!/usr/bin/env node
/* Copies the two frozen stylesheets out of prototype/PROTOTYPE/src/ into the
 * client, and — separately — proves the copies have not drifted from what
 * they were copied from.
 *
 * Why a copy at all, and not an import: workflow spec §2, "prototype/ stays
 * read-only forever. Production copies out of it; nothing points back into
 * it at runtime." A Vite build that imported CSS from prototype/ would make
 * the frozen reference a runtime dependency of the shipped app — exactly
 * what that rule forbids.
 *
 * Why the copy needs its own guard: prototype/tools/verify-tokens.py and
 * verify-type.py check prototype/PROTOTYPE/src/*.css against the frozen
 * bundle. Neither one ever looks at app/client/src/tokens/ — a copy can go
 * stale there and both verifiers keep passing, because they're checking the
 * source, not the copy. This project has already paid twice for "reported
 * success while doing nothing" (a migration CLI exiting 0; a gate that only
 * passed because of an unrecorded precondition). A sync script with no
 * companion check is a third instance of the same shape: it can silently
 * stop being run, or someone can hand-edit the copy, and nothing downstream
 * would notice.
 *
 * Usage:
 *   node scripts/sync-tokens.mjs            # copy source -> client (sync:tokens)
 *   node scripts/sync-tokens.mjs --check     # compare, fail loudly on drift (tokens gate)
 */
import { readFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved relative to this script, not the caller's cwd, so both npm
// scripts work the same from any directory -- mirrors the ROOT pattern in
// prototype/tools/verify-tokens.py and verify-type.py.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PAIRS = [
  {
    src: resolve(ROOT, "prototype/PROTOTYPE/src/tokens.css"),
    dest: resolve(ROOT, "app/client/src/tokens/tokens.css"),
  },
  {
    src: resolve(ROOT, "prototype/PROTOTYPE/src/type.css"),
    dest: resolve(ROOT, "app/client/src/tokens/type.css"),
  },
];

const checking = process.argv.includes("--check");

function firstDiff(a, b) {
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) i++;
  if (i === len && a.length === b.length) return -1; // identical
  return i;
}

function lineOf(buf, byteOffset) {
  return buf.subarray(0, byteOffset).toString("utf-8").split("\n").length;
}

if (checking) {
  let fail = 0;
  for (const { src, dest } of PAIRS) {
    const rel = dest.slice(ROOT.length + 1).replaceAll("\\", "/");
    const relSrc = src.slice(ROOT.length + 1).replaceAll("\\", "/");
    if (!existsSync(dest)) {
      console.log(`DRIFT  ${rel} is MISSING -- run "npm run sync:tokens"`);
      fail++;
      continue;
    }
    const srcBuf = readFileSync(src);
    const destBuf = readFileSync(dest);
    const at = firstDiff(srcBuf, destBuf);
    if (at === -1) {
      console.log(`OK     ${rel} matches ${relSrc} (${destBuf.length} bytes)`);
      continue;
    }
    const line = lineOf(srcBuf, Math.min(at, srcBuf.length));
    console.log(
      `DRIFT  ${rel} differs from ${relSrc} at byte ${at} (near line ${line}) -- ` +
        `${relSrc} is ${srcBuf.length} bytes, ${rel} is ${destBuf.length} bytes. ` +
        `Run "npm run sync:tokens" to refresh the copy.`,
    );
    fail++;
  }
  console.log(
    fail
      ? `\nFAIL: ${fail} copy/copies out of sync with prototype/PROTOTYPE/src/.`
      : "\nPASS: every client token copy is byte-identical to its prototype source.",
  );
  process.exit(fail ? 1 : 0);
} else {
  for (const { src, dest } of PAIRS) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    const rel = dest.slice(ROOT.length + 1).replaceAll("\\", "/");
    console.log(`copied -> ${rel}`);
  }
  console.log("\nRun with --check (or `npm run tokens`) to verify no drift.");
}
