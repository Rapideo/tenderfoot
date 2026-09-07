/* THE GUARDED DOOR -- npm run ingest:highergov.
 *
 * `npm run scrape -- --source highergov` already reaches a registered,
 * working adapter and already spends metered records, with nothing in front
 * of it. This is the gate spec §7 requires: a costed dry run runs FIRST,
 * always, and a window that would cross the remaining monthly allowance is
 * refused BEFORE any further spending is even attempted -- never discovered
 * halfway through a half-loaded window.
 *
 * 🔴 R5's "5 records for one day" is ONE OBSERVATION ON ONE DAY
 * (Proto2PRD-Lessons §2.15). At 15/day a 90-day backfill is 1,350 records
 * against a 1,000 ceiling, and the ceiling would refuse the run partway
 * through. The dry run costs ~5 records and turns that guess into a real
 * measurement before anything wider is attempted.
 *
 * Mirrors coverage/coverage-cli.ts's shape deliberately: the same
 * shape-then-round-trip date validation (a bare regex lets 2026-13-01
 * through; Date.parse alone rolls 2026-02-30 forward to March 2nd), and the
 * same "database: <host>" announcement before any spend -- api_spend is
 * per-database, and a run against the wrong branch spends real vendor money
 * into a ledger the ceiling will never read.
 *
 * ⚠️ SCOPE, RECORDED RATHER THAN GUESSED AT. This file's job (task-8-brief.md)
 * is the guard: validate the window, measure it, refuse or proceed. It does
 * NOT walk the window and write/import an artifact for it -- that would mean
 * either (a) reimplementing spend tallying inside scrape/run.ts's windowed
 * loop, which never learns a page's vendor-billed record count (adapter.ts's
 * WindowedPage carries no such field, and this task's file list is exactly
 * three files: this one, its test, and package.json), or (b) bypassing that
 * loop entirely and hand-rolling artifact writes and imports with no test
 * coverage asked for anywhere in this slice. Task 8 is credited in the
 * plan's own self-review only for spec §7 (cost and the dry run) -- so once
 * the window is confirmed affordable, this prints that finding and stops;
 * it does not spend further on its own initiative. Flagged in the task
 * report as a scope question for review rather than resolved by guessing.
 */
import { pathToFileURL } from "node:url";
import { close, one, run as exec } from "../db/index.js";
import { MONTHLY_RECORD_CEILING, recordSpend, spentThisMonth } from "../extract/api-spend.js";
import {
  higherGovClient,
  HIGHERGOV_SOURCE_NAME,
  type HigherGovClient,
} from "../coverage/highergov-client.js";

const USAGE = "Usage: npm run ingest:highergov -- --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run]";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/* Shape AND calendar validity -- identical check to coverage-cli.ts's
 * assertValidDate, copied rather than shared because that function is not
 * exported and this project's convention (see that file's own header) is to
 * duplicate a small, well-understood check rather than add a cross-module
 * dependency for four lines. The regex alone lets "2026-13-01" through, and
 * Date.parse alone lets "2026-02-30" through by rolling it forward to March
 * 2nd. Only the round-trip -- format the parsed date back to YYYY-MM-DD and
 * compare to the input -- catches both. */
function assertValidDate(name: string, value: string): void {
  const shapeOk = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const ms = shapeOk ? Date.parse(`${value}T00:00:00Z`) : NaN;
  const roundTripsOk = !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
  if (!shapeOk || !roundTripsOk) {
    throw new Error(`${USAGE}\n--${name}=${value} is not a real YYYY-MM-DD calendar date.`);
  }
}

/* Inclusive day count -- "2026-09-01" to "2026-09-30" is 30 days, not 29. */
function windowDayCount(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export function projectWindow(recordsPerDay: number, windowDays: number): number {
  return recordsPerDay * windowDays;
}

export interface DryRunResult {
  sampledDay: string;
  recordsThatDay: number;
  windowDays: number;
  projectedRecords: number;
  remainingThisMonth: number;
  affordable: boolean;
}

/* Pure-ish and testable without a database: `client` is injectable (the real
 * `higherGovClient` only by default) and `alreadySpent` is a parameter with
 * a live-lookup default, exactly as the brief specifies -- the four tests in
 * highergov-cli.test.ts always pass it explicitly, so none of them ever
 * touch spentThisMonth() or a connection. */
export async function dryRun(
  from: string,
  to: string,
  client: HigherGovClient = higherGovClient,
  alreadySpent?: number,
): Promise<DryRunResult> {
  const spent = alreadySpent ?? (await spentThisMonth(HIGHERGOV_SOURCE_NAME));
  /* Sample the window's first day. Which day is sampled is not specified by
   * the brief and not asserted by any test -- `from` is chosen because it is
   * always inside the window and the caller already validated it. */
  const sample = await client.fetchDay(from);
  const windowDays = windowDayCount(from, to);
  const projectedRecords = projectWindow(sample.records, windowDays);
  const remainingThisMonth = MONTHLY_RECORD_CEILING - spent;
  return {
    sampledDay: from,
    recordsThatDay: sample.records,
    windowDays,
    projectedRecords,
    remainingThisMonth,
    affordable: projectedRecords <= remainingThisMonth,
  };
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

  /* Presence alone is not validity, and all of this happens before any
   * fetch -- an invalid window must cost nothing. */
  assertValidDate("from", from);
  assertValidDate("to", to);
  if (from > to) {
    throw new Error(`${USAGE}\n--from=${from} is after --to=${to}. The window must run forward.`);
  }

  /* api_spend is PER-DATABASE. Same format as db/migrate.ts's own print and
   * coverage-cli.ts's, matched deliberately so all three operator commands
   * read the same way. */
  console.log(`database: ${new URL(process.env.DATABASE_URL!).host}`);
  console.log(`Window: ${from} to ${to}.`);

  /* Checked BEFORE the dry run's own network call, not after (matching
   * coverage/run.ts's order, not this file's own earlier draft): a missing
   * source row is a misconfiguration, not a reason to spend first and
   * discover it second -- run.ts fails loud on the same check before its
   * day loop ever calls fetchDay. Recorded here so a review diffing this
   * file against its own history can see the fix, not just the result. */
  const source = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
    HIGHERGOV_SOURCE_NAME,
  ]);
  if (!source) {
    throw new Error(
      `No source row named '${HIGHERGOV_SOURCE_NAME}' (migration 019). ` +
        `Refusing to spend against an unknown source.`,
    );
  }

  /* THE DRY RUN ALWAYS RUNS, even without --dry-run -- that flag only stops
   * execution AFTER it. This is the one unavoidable spend: measuring the
   * window costs one sampled day, and there is no way to know whether a
   * window is affordable without spending that much to find out. */
  const result = await dryRun(from, to);

  console.log(
    `\nDry run: sampled ${result.sampledDay} at ${result.recordsThatDay} record(s)/day. ` +
      `Projected ${result.projectedRecords} record(s) across ${result.windowDays} day(s).`,
  );
  console.log(
    `Remaining this month: ${result.remainingThisMonth} of ${MONTHLY_RECORD_CEILING} ` +
      `(source '${HIGHERGOV_SOURCE_NAME}').`,
  );

  /* THE DRY RUN'S OWN SPEND IS RECORDED, unconditionally and regardless of
   * the affordability verdict below -- the vendor billed the moment
   * client.fetchDay() returned, and nothing downstream can un-bill it
   * (api-spend.ts's own header makes the same point about recordSpend). */
  await recordSpend({ run: exec }, {
    sourceId: source.id,
    endpoint: "opportunity",
    records: result.recordsThatDay,
  });

  /* REFUSING IS THE POINT. Both numbers are printed so the operator can see
   * exactly what was measured and exactly what it was measured against,
   * rather than a bare "no". */
  if (!result.affordable) {
    throw new Error(
      `Refusing: the projected ${result.projectedRecords} record(s) for this window ` +
        `exceeds the ${result.remainingThisMonth} remaining this month ` +
        `(ceiling ${MONTHLY_RECORD_CEILING}, already spent ${
          MONTHLY_RECORD_CEILING - result.remainingThisMonth
        }). Narrow the window, or wait for the ceiling to reset next month.`,
    );
  }

  if (flag("dry-run")) {
    console.log("\n--dry-run: stopping here, before committing to the window.");
    return;
  }

  /* See this file's own header: committing the window (walking every day,
   * writing and importing an artifact for each) is out of scope for this
   * task -- see the SCOPE comment above for why. */
  console.log(
    "\nAffordable. This command's job -- measuring the window's cost -- is done; " +
      "it does not itself walk the window and import it (see this file's header).",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => close());
}
