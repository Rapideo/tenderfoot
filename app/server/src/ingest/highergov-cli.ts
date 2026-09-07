/* THE GUARDED DOOR -- npm run ingest:highergov.
 *
 * ⚖️ CLOSED, NOT MERELY GUARDED: scrape/cli.ts refuses `--source highergov`
 * outright (it never called recordSpend, so it silently under-reported
 * spentThisMonth against the ceiling this file depends on) -- so this really
 * is the one path in, not a second gate beside an open one.
 *
 * A costed dry run runs FIRST, always, and a window that would cross the
 * remaining monthly allowance is refused BEFORE any further spending is even
 * attempted -- never discovered halfway through a half-loaded window. Once
 * the window is judged affordable, THIS FILE also walks it day by day and
 * commits it (scrape -> import), because the adapter accepts exactly one day
 * per call and says so itself ("the caller must walk days itself") -- this
 * command is the only thing holding --from/--to, so it is that caller.
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
 */
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { close, one, run as exec } from "../db/index.js";
import { MONTHLY_RECORD_CEILING, recordSpend, spentThisMonth } from "../extract/api-spend.js";
import {
  higherGovClient,
  HIGHERGOV_SOURCE_NAME,
  type HigherGovClient,
} from "../coverage/highergov-client.js";
import { higherGovAdapter, HIGHERGOV_ADAPTER_KEY } from "../scrape/adapters/highergov.js";
import { resolveSource } from "../scrape/resolve-source.js";
import { runScrape } from "../scrape/run.js";
import { DEFAULT_BUDGET_MS, type RunRequest } from "../scrape/contract.js";
import type { WindowedAdapter } from "../scrape/adapter.js";
import { importArtifact } from "../ingest/import-artifact.js";

const USAGE = "Usage: npm run ingest:highergov -- --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run]";

function arg(argv: string[], name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

function flag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

/* Shape AND calendar validity -- identical check to coverage-cli.ts's
 * assertValidDate, copied rather than shared because that function is not
 * exported and this project's convention (see that file's own header) is to
 * duplicate a small, well-understood check rather than add a cross-module
 * dependency for four lines. The regex alone lets "2026-13-01" through, and
 * Date.parse alone lets "2026-02-30" through by rolling it forward to March
 * 2nd. Only the round-trip -- format the parsed date back to YYYY-MM-DD and
 * compare to the input -- catches both. EXPORTED so both calendar traps can
 * be pinned by a unit test rather than held in place only by pasted terminal
 * output that no future change re-runs. */
export function assertValidDate(name: string, value: string): void {
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

/* Every YYYY-MM-DD day in [from, to], inclusive. Mirrors coverage/run.ts's
 * own `days()` helper -- same shape, different file, kept duplicated for the
 * same reason assertValidDate is: a four-line function is cheaper to repeat
 * than to share across modules that otherwise have nothing to do with each
 * other. */
function daysInRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function projectWindow(recordsPerDay: number, windowDays: number): number {
  return recordsPerDay * windowDays;
}

export interface DryRunResult {
  sampledDay: string;
  /* Whether the sample's own network call actually happened. False only
   * when no allowance remained BEFORE sampling -- see dryRun()'s own guard
   * below. When false, every other numeric field reflects "nothing was
   * measured", not "zero records exist". */
  sampled: boolean;
  recordsThatDay: number;
  /* meta.pagination.pages on the sampled day, carried rather than
   * discarded. >1 means the client's page-one-only read truncated the
   * SAMPLE itself -- the measured rate is a floor, not the true rate, and
   * an operator committing 90 days on the strength of it needs to know
   * before, not after. */
  samplePages: number | null;
  windowDays: number;
  projectedRecords: number;
  remainingThisMonth: number;
  affordable: boolean;
}

/* Pure-ish and testable without a network: `client` is injectable (the real
 * `higherGovClient` only by default) and `alreadySpent` is a parameter with
 * a live-lookup default, exactly as the brief specifies. Requires a
 * DATABASE_URL to resolve MONTHLY_RECORD_CEILING's home module even when
 * `alreadySpent` is supplied directly (see highergov-cli.test.ts's own
 * useTestSchema() call and comment on why). */
export async function dryRun(
  from: string,
  to: string,
  client: HigherGovClient = higherGovClient,
  alreadySpent?: number,
): Promise<DryRunResult> {
  const spent = alreadySpent ?? (await spentThisMonth(HIGHERGOV_SOURCE_NAME));
  const windowDays = windowDayCount(from, to);
  const remainingBeforeSample = MONTHLY_RECORD_CEILING - spent;

  /* 🔴 CHECKED BEFORE THE SAMPLE'S OWN NETWORK CALL, not after. With no
   * allowance left at all, sampling to prove there is no allowance left
   * would itself spend against a budget that is already gone -- the exact
   * failure mode this whole file exists to prevent, just one call smaller. */
  if (remainingBeforeSample <= 0) {
    return {
      sampledDay: from,
      sampled: false,
      recordsThatDay: 0,
      samplePages: null,
      windowDays,
      projectedRecords: 0,
      remainingThisMonth: remainingBeforeSample,
      affordable: false,
    };
  }

  /* Sample the window's first day. Which day is sampled is not specified by
   * the brief and not asserted by any test -- `from` is chosen because it is
   * always inside the window and the caller already validated it. */
  const sample = await client.fetchDay(from);
  const projectedRecords = projectWindow(sample.records, windowDays);
  /* 🔴 NOT `MONTHLY_RECORD_CEILING - spent`. The sample above just billed
   * `sample.records` -- by the time this line runs, that spend is real,
   * whether or not it has been written to api_spend yet (recordSpend is the
   * caller's job, per this file's own header on the dry run's own spend).
   * A "remaining" figure that ignores it overstates headroom by exactly the
   * sample's own cost. */
  const remainingThisMonth = remainingBeforeSample - sample.records;
  return {
    sampledDay: from,
    sampled: true,
    recordsThatDay: sample.records,
    samplePages: sample.pages,
    windowDays,
    projectedRecords,
    remainingThisMonth,
    affordable: projectedRecords <= remainingThisMonth,
  };
}

export async function main(
  argv: string[] = process.argv.slice(2),
  client: HigherGovClient = higherGovClient,
  adapter: WindowedAdapter = higherGovAdapter(),
  /* Injectable so a test can point the day-walk's artifact files at a
   * temp directory instead of the repo's own gitignored `runs/` -- the
   * real CLI's default matches scrape/cli.ts's own convention exactly. */
  runsDir: string = resolvePath(process.cwd(), "runs"),
): Promise<void> {
  const from = arg(argv, "from");
  const to = arg(argv, "to");
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

  /* Checked BEFORE the dry run's own network call: a missing source row is
   * a misconfiguration, not a reason to spend first and discover it second
   * -- matching coverage/run.ts's own order, which fails loud on the same
   * check before its day loop ever calls fetchDay. */
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
  const result = await dryRun(from, to, client);

  if (!result.sampled) {
    /* No allowance remained even before the sample -- nothing was spent,
     * so there is nothing to record. */
    throw new Error(
      `Refusing: ${result.remainingThisMonth} record(s) remain this month for ` +
        `'${HIGHERGOV_SOURCE_NAME}' (ceiling ${MONTHLY_RECORD_CEILING}) -- not enough to ` +
        `even sample a day. Refusing before spending anything.`,
    );
  }

  console.log(
    `\nDry run: sampled ${result.sampledDay} at ${result.recordsThatDay} record(s)/day. ` +
      `Projected ${result.projectedRecords} record(s) across ${result.windowDays} day(s).`,
  );
  console.log(
    `Remaining this month: ${result.remainingThisMonth} of ${MONTHLY_RECORD_CEILING} ` +
      `(source '${HIGHERGOV_SOURCE_NAME}', after the sample above).`,
  );
  /* Paid for, not discarded. >1 means the sampled day was itself truncated
   * -- the single most important thing to know before committing to a much
   * wider window on the strength of this measurement. */
  if (result.samplePages !== null && result.samplePages > 1) {
    console.log(
      `⚠️  The sampled day was TRUNCATED: ${result.samplePages} page(s) exist but this ` +
        `client reads page one only. The measured rate above is a FLOOR -- the true ` +
        `per-day rate, and the true projection, may be higher.`,
    );
  }

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
        `(ceiling ${MONTHLY_RECORD_CEILING}). Narrow the window, or wait for the ceiling ` +
        `to reset next month.`,
    );
  }

  if (flag(argv, "dry-run")) {
    console.log("\n--dry-run: stopping here, before committing to the window.");
    return;
  }

  /* COMMITTING THE WINDOW. adapters/highergov.ts's own fetchListing throws
   * if since !== until and says so explicitly: "the caller must walk days
   * itself." This command is the only component holding the validated
   * --from/--to window, so it is that caller -- without this loop, ruling
   * ②'s 90-day backfill has no executor anywhere in this slice. */
  const resolved = await resolveSource(HIGHERGOV_ADAPTER_KEY);
  const perDayEstimate = result.recordsThatDay;
  let committedDays = 0;
  let committedRecords = 0;

  for (const day of daysInRange(from, to)) {
    /* Stop BEFORE the call that would cross the ceiling. Re-read fresh each
     * iteration rather than tracked locally: recordSpend below commits
     * immediately, so a fresh read reflects this loop's own prior days, the
     * dry run's own sample above, and anything else recorded meanwhile.
     * perDayEstimate -- the dry run's own measured rate -- is the only
     * forward-looking signal available for a day not yet fetched. */
    const spentSoFar = await spentThisMonth(HIGHERGOV_SOURCE_NAME);
    const remainingNow = MONTHLY_RECORD_CEILING - spentSoFar;
    if (remainingNow < perDayEstimate) {
      console.log(
        `\nStopping before ${day}: ${committedDays} of ${result.windowDays} day(s) loaded ` +
          `(${committedRecords} record(s) billed this run). ${remainingNow} remain(s) this ` +
          `month, below the measured rate of ${perDayEstimate}/day -- refusing before the ` +
          `call that would cross it.`,
      );
      break;
    }

    const req: RunRequest = {
      source: HIGHERGOV_ADAPTER_KEY,
      sourceName: resolved.sourceName,
      since: day,
      until: day,
      depth: "listing",
      budgetMs: DEFAULT_BUDGET_MS,
    };
    mkdirSync(runsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const outPath = join(runsDir, `run-highergov-${day}-${stamp}.db`);

    const runResult = await runScrape(req, adapter, outPath);
    /* BILLED, not merely WRITTEN. adapter.ts §5.4: a row with no usable
     * date is excluded from `items` (so from `rows`) but was still billed
     * -- runResult.undatedSkipped is the same count the client's own
     * FeedResult.records would carry, short only of the one edge case
     * highergov-client.ts's own comment names: a row missing source_id is
     * dropped by toNotice() before either counter sees it. That gap is
     * pre-existing and documented there, not introduced here. */
    const dayRecords = runResult.rows + runResult.undatedSkipped;
    await recordSpend({ run: exec }, {
      sourceId: source.id,
      endpoint: "opportunity",
      records: dayRecords,
    });
    committedRecords += dayRecords;
    committedDays += 1;

    const imported = await importArtifact(runResult.artifactPath);
    console.log(
      `  ${day}: ${dayRecords} record(s) billed, ${imported.imported} sighting(s) imported` +
        (imported.skipped ? " (artifact already imported -- skipped)." : "."),
    );
  }

  console.log(
    `\nDone: ${committedDays} of ${result.windowDays} day(s) loaded, ${committedRecords} ` +
      `record(s) billed this run (plus ${result.recordsThatDay} sampled by the dry run above).`,
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
