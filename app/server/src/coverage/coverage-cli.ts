/* Thin CLI over run.ts and measure.ts. Mirrors fitness/fitness-cli.ts's
 * shape: same pathToFileURL entry guard, same catch/close handling, no
 * measurement logic here.
 *
 * WHY A CLI AND NOT A ROUTE: ruling 3A forbids new UI slices. A report a
 * person runs is the whole delivery.
 *
 * ⚠️ UNLIKE `npm run fitness`, THIS IS NOT READ-ONLY AND NOT FREE. It writes
 * coverage_run, coverage_item and api_spend, and it SPENDS METERED RECORDS.
 * CLAUDE.md §5.1 governs every invocation: inside the standing 500-record
 * budget calls may be made without asking each time, but every one is
 * counted, reported and justified in the same breath. */
import { pathToFileURL } from "node:url";
import { close } from "../db/index.js";
import { runCoverage, gradedItems } from "./run.js";
import { measureCoverage } from "./measure.js";
import { idoaKeyFrom } from "./answer-key.js";
import { COVERAGE, COVERAGE_RATIFIED } from "./thresholds.js";
import { IDOA_URL } from "../scrape/adapters/idoa.js";

const MARK: Record<string, string> = {
  pass: "PASS",
  fail: "FAIL",
  marginal: "MARGINAL",
  unknown: "UNKNOWN",
};

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

export async function main(): Promise<void> {
  const from = arg("from");
  const to = arg("to");
  if (!from || !to) {
    throw new Error(
      "Usage: npm run recall -- --from=YYYY-MM-DD --to=YYYY-MM-DD\n" +
        "The window is REQUIRED and never defaulted: a default window is a " +
        "default spend, and this command costs metered records.",
    );
  }

  /* The answer key is fetched FREE, from IDOA's own page. */
  const html = await (await fetch(IDOA_URL)).text();
  const key = idoaKeyFrom(html);
  console.log(`Answer key: ${key.length} notices from IDOA (free).`);

  const outcome = await runCoverage({ from, to, key });

  console.log(
    `\nRun ${outcome.runId}: ${outcome.itemsObserved} observed, ` +
      `${outcome.recordsSpent} records spent (ceiling per run ${COVERAGE.maxRecordsPerRun}).`,
  );
  if (outcome.aborted) console.log(`⚠️  ABORTED: ${outcome.abortReason}`);

  const items = await gradedItems();
  console.log(`\nCohort accumulated across all runs: ${items.length} settled notices.\n`);

  for (const p of measureCoverage(items)) {
    console.log(`  ${p.id}  ${MARK[p.verdict]!.padEnd(9)} ${p.statement}`);
    console.log(`        ${p.property} · threshold ${p.threshold} · measured ${p.measured}`);
    if (p.detail) console.log(`        ${p.detail}`);
  }

  if (!COVERAGE_RATIFIED) {
    console.log(
      `\n⚖️  THIS VERDICT IS NOT BINDING. The thresholds are proposals ` +
        `awaiting Matt's ruling (spec §8).`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => close());
}
