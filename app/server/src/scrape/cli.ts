/* Thin CLI over scrape/run. Argument parsing and file naming only — no
 * scrape logic lives here, so the HTTP handler in Task 9 is an equally thin
 * wrapper over the same library rather than a second implementation. */
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateRun } from "./contract.js";
import { runScrape } from "./run.js";
import { ADAPTERS } from "./adapters/registry.js";

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
  const req = validateRun(parseArgv(argv));
  const make = ADAPTERS[req.source];
  if (!make) throw new Error(`No adapter named ${req.source}. Known: ${Object.keys(ADAPTERS).join(", ")}`);

  const dir = resolve(process.cwd(), "runs");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const out = join(dir, `run-${req.source}-${stamp}.db`);

  const res = await runScrape(req, make(), out);
  console.log(JSON.stringify(res, null, 2));
  /* Resume LOWERS THE CEILING, it does not raise the floor. Sources page
   * newest-first, so an interrupted run has covered the recent end of the
   * window and the untouched work is older -- `since` stays put and `until`
   * comes down to where we got to. Corrected 2026-08-15 after review. */
  if (!res.done) {
    console.log(`\nNot finished. Resume with:  --since ${req.since} --until ${res.nextUntil}`);
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
