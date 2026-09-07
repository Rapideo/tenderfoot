/* Thin CLI over run.ts and measure.ts. Mirrors fitness/fitness-cli.ts's
 * shape: same pathToFileURL entry guard, no measurement logic here. The
 * catch/close handling does NOT match, though: this file sets
 * process.exitCode and closes the pool in a .finally(), where
 * fitness-cli.ts closes inside .then()/.catch() and calls process.exit(1)
 * explicitly. Said this way because a false precedent citation misleads the
 * next reader more than no citation at all.
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

const USAGE = "Usage: npm run recall -- --from=YYYY-MM-DD --to=YYYY-MM-DD";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

/* Shape AND calendar validity. The regex alone lets "2026-13-01" through --
 * and Date.parse alone lets "2026-02-30" through, rolling it forward to
 * March 2nd rather than rejecting it. Only the round-trip (format the parsed
 * date back to YYYY-MM-DD and compare to the input) catches both: a date
 * that survives isn't just parseable, it's the exact calendar day named. */
function assertValidDate(name: string, value: string): void {
  const shapeOk = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const ms = shapeOk ? Date.parse(`${value}T00:00:00Z`) : NaN;
  const roundTripsOk = !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
  if (!shapeOk || !roundTripsOk) {
    throw new Error(
      `${USAGE}\n` + `--${name}=${value} is not a real YYYY-MM-DD calendar date.`,
    );
  }
}

export async function main(): Promise<void> {
  const from = arg("from");
  const to = arg("to");
  if (!from || !to) {
    throw new Error(
      `${USAGE}\n` +
        "The window is REQUIRED and never defaulted: a default window is a " +
        "default spend, and this command costs metered records.",
    );
  }

  /* Presence alone is not validity. A malformed or reversed window used to
   * pass this point silently, run zero days, and print a report that looked
   * like a real measurement of nothing. All of this happens before any
   * fetch -- an invalid window must cost nothing. */
  assertValidDate("from", from);
  assertValidDate("to", to);
  if (from > to) {
    throw new Error(
      `${USAGE}\n` + `--from=${from} is after --to=${to}. The window must run forward.`,
    );
  }

  /* The operator's last chance to notice a wrong window before money moves. */
  console.log(`Window: ${from} to ${to}.`);

  /* The answer key is fetched FREE, from IDOA's own page. */
  const res = await fetch(IDOA_URL);
  if (!res.ok) {
    throw new Error(
      `IDOA fetch failed: ${res.status} ${res.statusText}. Refusing to treat an ` +
        `error page as a 0-notice answer key.`,
    );
  }
  const html = await res.text();
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
