/* Thin CLI over scrape/run. Argument parsing and file naming only — no
 * scrape logic lives here, so the HTTP handler in Task 9 is an equally thin
 * wrapper over the same library rather than a second implementation. */
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateRun } from "./contract.js";
import { runScrape } from "./run.js";
import { ADAPTERS } from "./adapters/registry.js";
import { resolveSource } from "./resolve-source.js";

export function parseArgv(argv: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith("--")) {
      throw new Error(`Expected a flag starting with --, got: ${token}`);
    }
    const name = token.slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) {
      throw new Error(`Flag --${name} requires a value (not another flag)`);
    }
    i++; /* consume the value */

    if (name === "budgetMs") {
      const num = Number(v);
      if (!Number.isFinite(num) || num <= 0) {
        throw new Error(`--budgetMs must be a positive number, got: ${v}`);
      }
      out[name] = num;
    } else {
      out[name] = v;
    }
  }
  return out;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgv(argv);
  /* The adapter lookup now has to happen BEFORE validateRun, not after --
   * validateRun needs the resolved adapter's `shape` (windowed vs
   * snapshot) as its second argument, so there is no "validate first, look
   * up the adapter second" ordering left that also knows the shape. */
  const sourceKey = typeof parsed.source === "string" ? parsed.source : undefined;
  const entry = sourceKey !== undefined ? ADAPTERS[sourceKey] : undefined;
  if (!entry) {
    throw new Error(`No adapter named ${sourceKey}. Known: ${Object.keys(ADAPTERS).join(", ")}`);
  }
  const adapter = entry.make();
  const req = validateRun(parsed, adapter.shape);

  /* FIX 1 / FIX 2 (final review, 2026-08-15): resolve the registry key
   * against the source registry UP FRONT, before any fetching. This is
   * what turns "a real scrape can never be imported" (No source row named
   * sam, discovered only at import time after the whole budget was spent)
   * into an immediate, cheap failure -- and it refuses a disabled source
   * before it ever reaches the network, fail-closed. */
  const resolved = await resolveSource(req.source);
  req.sourceName = resolved.sourceName;

  const dir = resolve(process.cwd(), "runs");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const out = join(dir, `run-${req.source}-${stamp}.db`);

  const res = await runScrape(req, adapter, out);
  console.log(JSON.stringify(res, null, 2));
  /* FIX 4 (final review, 2026-08-15): make the undated-skip count visible
   * in the CLI output on its own line, not just buried in the JSON dump
   * above -- adapter.ts's promise was "visible rather than silent" (§5.4),
   * and a count nobody reads without grepping the JSON does not meet it. */
  if (res.undatedSkipped > 0) {
    console.log(
      `\n${res.undatedSkipped} record(s) had no usable date and were skipped ` +
        `(not silently -- spec §5.4). See the artifact's run.undated_skipped.`,
    );
  }
  /* Resume LOWERS THE CEILING, it does not raise the floor. Sources page
   * newest-first, so an interrupted run has covered the recent end of the
   * window and the untouched work is older -- `since` stays put and `until`
   * comes down to where we got to. Corrected 2026-08-15 after review. */
  if (!res.done) {
    if (res.noProgress) {
      /* FIX 5 (Critical, final review 2026-08-15): a tie block wider than
       * this run's budget -- see run.ts's module header. Printing the
       * ordinary "resume with" advice here would be actively wrong: this
       * exact resume marker was already re-fetched and re-written by THIS
       * run without moving, and re-invoking with it unchanged will do the
       * same thing again, forever, silently, unless something changes. */
      console.warn(
        `\nWARNING: no forward progress was made -- too many records share ` +
          `one timestamp (${res.nextUntil}) for this budget to walk past ` +
          `them. Re-invoking with --until ${res.nextUntil} unchanged will ` +
          `re-fetch and re-write the SAME records, not advance. Widen the ` +
          `window (adjust --since) or raise --budgetMs before re-invoking.`,
      );
    } else {
      console.log(`\nNot finished. Resume with:  --since ${req.since} --until ${res.nextUntil}`);
    }
  }
}

/* Only run when invoked directly, so importing this file in a test does not
 * start a scrape. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
