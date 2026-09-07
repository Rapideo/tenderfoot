/* THE GUARDED DOOR -- npm run ingest:highergov.
 *
 * ⚖️ CLOSED AT THE CONVERGENCE POINT, NOT AT EACH DOORWAY (review round 3).
 * Round 2 put the refusal in scrape/cli.ts, keyed on the raw --source
 * string -- and that shape already failed once: admin.ts's /run route
 * accepts BOTH the registry key ('highergov') and the canonical
 * source.name ('HigherGov') before ever reaching resolveSource(), and
 * admin.ts's /scrape route is a THIRD path with the identical gap. The
 * refusal now lives in resolve-source.ts, on registry.ts's `metered: true`
 * flag, checked on the RESOLVED registry key -- the one thing every call
 * site (this file, scrape/cli.ts, and both admin.ts routes) already agrees
 * on regardless of spelling. Only this file opts in
 * (`{ meteredAllowed: true }`), after it has measured and capped what
 * committing the window will cost. scrape/cli.ts keeps its OWN refusal too
 * -- a better message at the point of use, and defence in depth on a money
 * path is cheap. That is what makes this file genuinely the one path in,
 * not merely the one with the nicest message.
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
 * measurement before anything wider is attempted. A ZERO-record sample gets
 * the opposite defect -- it would make every window look free -- so it is
 * refused rather than projected from (review round 3, item 2).
 *
 * The sampled day is never billed twice: the day-walk below reuses the
 * sample's own already-paid-for data for that one day instead of
 * re-fetching it (review round 3, item 4).
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
/* The conservative "the most a single call could plausibly have cost when we
 * cannot read its response" figure, reused rather than re-guessed -- the same
 * import coverage/run.ts and extract/fetch-documents-for.ts already make for
 * the same question at their own metered call sites. */
import { COVERAGE } from "../coverage/thresholds.js";
import {
  higherGovClient,
  HIGHERGOV_SOURCE_NAME,
  redact,
  type FeedResult,
  type HigherGovClient,
} from "../coverage/highergov-client.js";
import {
  higherGovAdapter,
  HIGHERGOV_ADAPTER_KEY,
  scrubPayload,
} from "../scrape/adapters/highergov.js";
import { resolveSource } from "../scrape/resolve-source.js";
import { runScrape } from "../scrape/run.js";
import { readArtifact } from "../scrape/artifact.js";
import { DEFAULT_BUDGET_MS, type RunRequest } from "../scrape/contract.js";
import type { WindowedAdapter, WindowedItem, WindowedPage } from "../scrape/adapter.js";
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

/* ⚠️ KNOWN AND ACCEPTED: THIS CHARGES FOR THE SAMPLED DAY TWICE.
 *
 * `windowDays` counts every day in [from, to], the sampled day included --
 * but the day-walk below reuses the sample's already-paid-for data for that
 * one day and makes no second call for it (review round 3, item 4). So a
 * one-day window projects 2x what it will actually spend, a two-day window
 * 1.5x, and so on; the error shrinks as the window widens and never
 * disappears.
 *
 * It errs toward REFUSING a window that was in fact affordable, which is the
 * safe direction against a ceiling that cannot be read back from the vendor
 * (CLAUDE.md §5.1) -- the opposite error would be accepting a window that
 * crosses it. `projectWindow(rate, windowDays - 1) + rate` would be exact,
 * and is deliberately NOT what this does: a projection that shaves its own
 * margin to be precise about a rate measured on ONE day (R5's single
 * observation) buys accuracy in the wrong currency. Left as-is on purpose --
 * this note exists so the next reader does not re-derive it as a bug. */
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
  /** The sample's own raw result, kept (not discarded) so a caller
   * committing the window can reuse the sampled day's already-paid-for data
   * instead of re-fetching it (review round 3, item 4: "the sampled day is
   * bought twice"). Null exactly when `sampled` is false. */
  sampleResult: FeedResult | null;
}

/* Converts the dry run's own sample into the exact WindowedPage shape
 * adapters/highergov.ts's real fetchListing would have produced for the
 * same day -- so the day-walk can commit day one through runScrape's
 * ordinary artifact-writing path without a second live call for data
 * already billed (review round 3, item 4). Mirrors fetchListing's own
 * undated-skip logic exactly: a notice with no capturedDate is counted, not
 * silently dropped (adapter.ts §5.4). */
function sampleAsPage(sample: FeedResult, day: string): WindowedPage {
  let undatedSkipped = 0;
  const items: WindowedItem[] = [];
  for (const n of sample.notices) {
    if (!n.capturedDate) {
      undatedSkipped++;
      continue;
    }
    items.push({ externalId: n.externalId, modifiedAt: n.capturedDate, raw: n.raw });
  }
  return {
    items,
    undatedSkipped,
    nextCursor: null,
    requestUrl: `highergov:/opportunity/?captured_date=${day}&reused=dry-run-sample`,
    httpStatus: 200,
    /* scrubPayload() is idempotent (its own header) -- `n.raw` is already
     * redacted by highergov-client.ts's toNotice(), so this is a defensive
     * second pass, not a required one, and cannot change the bytes. */
    payload: scrubPayload(
      JSON.stringify({
        capturedDate: day,
        records: sample.records,
        feedCount: sample.feedCount,
        pages: sample.pages,
        results: sample.notices.map((n) => n.raw),
      }),
    ),
  };
}

/* A one-page WindowedAdapter that always answers with `page`, whatever
 * since/until it is asked for -- the day-walk only ever uses this for the
 * one day it already knows the answer to. */
function reuseSampleAdapter(page: WindowedPage): WindowedAdapter {
  return {
    shape: "windowed",
    name: HIGHERGOV_SOURCE_NAME,
    async fetchListing() {
      return page;
    },
  };
}

/* THE VENDOR-BILLED COUNT, read back from the artifact this call just wrote
 * -- not approximated from rows+undatedSkipped, which adapters/highergov.ts's
 * own comment says explicitly is NOT the billed count (a row dropped for a
 * missing source_id is billed but excluded from both). HigherGov's windowed
 * loop always writes exactly one capture per call (nextCursor is always
 * null), and that capture's payload is the adapter's own scrubbed JSON,
 * which carries `records` verbatim -- the exact figure the vendor billed.
 * adapters/highergov.test.ts now pins that the envelope actually carries it;
 * before that, deleting `records:` from the adapter left every test green
 * while every real day fell silently down the path below.
 *
 * 🔴 THE FALLBACK NOW MATCHES ITS OWN ARGUMENT (final review, fix 2). This
 * comment has always said under-reporting is the dangerous direction against
 * a ceiling that cannot be read back from the vendor (CLAUDE.md §5.1), "so a
 * fallback that could ever UNDER-count would be worse than one that merely
 * risks never firing" -- and then returned exactly `rows + undatedSkipped`,
 * which is the under-counting formula the paragraph above it rejects. It is
 * a FLOOR, not an estimate: every row we saw was billed, and the rows we
 * could not see were billed too.
 *
 * So the floor is kept as a floor and raised to the conservative upper bound
 * the other two metered call sites already use for the identical question
 * ("what could this call have cost when we cannot read its response"):
 * COVERAGE.unparseableResponseRecords. `Math.max` rather than the constant
 * alone, because a genuinely large day can exceed 40 rows, and taking the
 * constant would then under-count a figure we can partially see. */
function billedRecordsFromArtifact(artifactPath: string, atLeast: number): number {
  const conservative = Math.max(atLeast, COVERAGE.unparseableResponseRecords);
  try {
    const art = readArtifact(artifactPath);
    const capture = art.captures[0] as { payload?: unknown } | undefined;
    if (!capture || typeof capture.payload !== "string") return conservative;
    const parsed = JSON.parse(capture.payload) as { records?: unknown };
    return typeof parsed.records === "number" ? parsed.records : conservative;
  } catch {
    return conservative;
  }
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
      sampleResult: null,
    };
  }

  /* Sample the window's first day. Which day is sampled is not specified by
   * the brief and not asserted by any test -- `from` is chosen because it is
   * always inside the window and the caller already validated it.
   *
   * 🔴 THE MANDATORY SPEND, AND IT COULD VANISH FROM api_spend (final
   * review, fix 1). This call is unavoidable: the dry run ALWAYS runs, even
   * under --dry-run, and main() records its cost afterwards. Afterwards is
   * the problem. fetchDay can throw AFTER the vendor has already billed --
   * highergov-client.ts guards two such cases explicitly, a truncated 200
   * and a non-array `results`, and its own comment says plainly that neither
   * guard "makes the call free". An uncaught throw here therefore skipped
   * main()'s recordSpend entirely: ~5 records billed, no row written, and a
   * remaining-allowance figure wrong in the reassuring direction.
   *
   * The shape is coverage/run.ts's and extract/fetch-documents-for.ts's,
   * matched deliberately rather than reinvented: tally the conservative
   * upper bound, then let the error propagate UNCHANGED -- a malformed
   * response must still fail the run loudly, it just fails having recorded
   * that it spent something.
   *
   * ⚠️ THE SOURCE ROW IS LOOKED UP HERE, NOT PASSED IN. main() already holds
   * it, but dryRun() is exported and called directly by tests, and an
   * optional `sourceId` parameter would mean the tally silently does nothing
   * for exactly the callers most likely to exercise this path. The lookup is
   * free, on the failure path only, and by the time it runs main()'s own
   * loud check for a missing source row has already passed.
   *
   * ⚠️ IT OVER-REPORTS FOR A THROW THAT COST NOTHING -- an unset
   * HIGHERGOV_SEARCH_ID, the VITEST guard, a DNS failure. That is the same
   * trade both sibling call sites make and for the same stated reason:
   * over-reporting is merely conservative, under-reporting is what lets an
   * operator believe there is budget left when there is not (api-spend.ts's
   * header). Scoping by error type would mean this file deciding which
   * vendor failures bill, which is exactly the thing nobody can read back. */
  let sample: FeedResult;
  try {
    sample = await client.fetchDay(from);
  } catch (err) {
    const src = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
      HIGHERGOV_SOURCE_NAME,
    ]);
    if (src) {
      await recordSpend({ run: exec }, {
        sourceId: src.id,
        endpoint: "opportunity",
        records: COVERAGE.unparseableResponseRecords,
      });
    }
    throw err;
  }
  const projectedRecords = projectWindow(sample.records, windowDays);
  /* 🔴 NOT `MONTHLY_RECORD_CEILING - spent`. The sample above just billed
   * `sample.records` -- by the time this line runs, that spend is real,
   * whether or not it has been written to api_spend yet (recordSpend is the
   * caller's job, per this file's own header on the dry run's own spend).
   * A "remaining" figure that ignores it overstates headroom by exactly the
   * sample's own cost. */
  const remainingThisMonth = remainingBeforeSample - sample.records;
  /* 🔴 A ZERO-RECORD SAMPLE MUST NOT LOOK "FREE FOREVER" (review round 3,
   * item 2). A weekend, a holiday, or a --from ahead of the vendor's own
   * capture can all return zero. With sample.records === 0, projectedRecords
   * is ALSO 0 regardless of windowDays -- so ANY window length would pass
   * `projectedRecords <= remainingThisMonth` by construction, and the
   * day-walk's own per-day estimate would be 0 too, disabling ITS guard the
   * same way. Refusing to extrapolate a rate from an unmeasured day is the
   * safe direction; the operator can re-run with a different --from. */
  const affordable = sample.records > 0 && projectedRecords <= remainingThisMonth;
  return {
    sampledDay: from,
    sampled: true,
    recordsThatDay: sample.records,
    samplePages: sample.pages,
    windowDays,
    projectedRecords,
    remainingThisMonth,
    affordable,
    sampleResult: sample,
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

  /* 🔴 MOVED AHEAD OF THE SAMPLE (review round 3, item 3) -- this used to
   * run only in the committing branch, AFTER the sample had already billed.
   * HigherGov is seeded `enabled = false` (migration 019), so every real
   * invocation bought a sampled day and then died with "Source is
   * disabled": records bought, nothing loaded. This check is free (registry
   * + one row read, no vendor call), so it belongs before the one spend
   * that is NOT free. `{ meteredAllowed: true }` is what lets THIS caller
   * through resolve-source.ts's default refusal of a metered source --
   * see this file's own header. The resolved name is reused below, in the
   * day-walk, rather than resolved a second time. */
  const resolved = await resolveSource(HIGHERGOV_ADAPTER_KEY, { meteredAllowed: true });

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
   * rather than a bare "no". A zero-record sample gets its OWN message
   * (review round 3, item 2): the numbers involved (0 projected, against
   * whatever remains) would otherwise read as trivially affordable, which is
   * exactly the defect being refused, not a coincidence worth explaining. */
  if (!result.affordable) {
    if (result.recordsThatDay === 0) {
      throw new Error(
        `Refusing: the sampled day (${result.sampledDay}) returned 0 records. A ` +
          `zero-record sample cannot be extrapolated into a safe projection for the rest ` +
          `of the window -- re-run with a different --from, or a window known to have data.`,
      );
    }
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
   * ②'s 90-day backfill has no executor anywhere in this slice.
   * `resolved` was already computed above, before the sample -- not
   * re-resolved here. */
  const perDayEstimate = result.recordsThatDay;
  let committedDays = 0;
  let committedRecords = 0;
  /* Named `days`, not `windowDays` -- `result.windowDays` (a count) already
   * exists on this scope, and shadowing it with an array of the same near-
   * name is exactly the kind of thing that invites a future bug. */
  const days = daysInRange(from, to);

  for (const day of days) {
    /* THE SAMPLED DAY IS NEVER BILLED TWICE (review round 3, item 4). `day`
     * equals `result.sampledDay` on exactly the first iteration (dryRun()
     * always samples `from`, and `from` is always daysInRange's first
     * entry) -- reuse its already-paid-for data instead of re-fetching the
     * same day through the network a second time. */
    const isSampledDay = day === result.sampledDay;

    /* Stop BEFORE the call that would cross the ceiling -- skipped for the
     * sampled day, which makes no new network call and so cannot cross
     * anything. Re-read fresh each iteration rather than tracked locally:
     * recordSpend below commits immediately, so a fresh read reflects this
     * loop's own prior days, the dry run's own sample, and anything else
     * recorded meanwhile. perDayEstimate -- the dry run's own measured rate
     * -- is the only forward-looking signal available for a day not yet
     * fetched. `<= 0 ||` is defence in depth: dryRun() already refuses a
     * zero-record sample above, so perDayEstimate should never reach here
     * as 0, but a per-day guard that only fires on a STRICT less-than would
     * itself go silent at exactly zero remaining and zero estimated, the
     * same failure mode one layer up (review round 3, item 2). */
    if (!isSampledDay) {
      const spentSoFar = await spentThisMonth(HIGHERGOV_SOURCE_NAME);
      const remainingNow = MONTHLY_RECORD_CEILING - spentSoFar;
      if (remainingNow <= 0 || remainingNow < perDayEstimate) {
        console.log(
          `\nStopping before ${day}: ${committedDays} of ${days.length} day(s) loaded ` +
            `(${committedRecords} record(s) billed this run). ${remainingNow} remain(s) this ` +
            `month, below the measured rate of ${perDayEstimate}/day -- refusing before the ` +
            `call that would cross it.`,
        );
        break;
      }
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

    /* The sampled day reuses `result.sampleResult` (guaranteed non-null:
     * `result.sampled` was already checked true above) through a one-page
     * adapter instead of the real one -- same runScrape path, same
     * artifact-writing code, zero new network calls. */
    const dayAdapter = isSampledDay
      ? reuseSampleAdapter(sampleAsPage(result.sampleResult!, day))
      : adapter;

    /* 🔴 THE SECOND PLACE A BILLED CALL COULD VANISH (final review, fix 1).
     * runScrape does not catch what the adapter throws -- its own loop is
     * `try { ... } finally { art.finish(); art.close(); }` -- so a truncated
     * 200 or a non-array `results` on day seven propagates straight out of
     * here, past the recordSpend below, and takes the whole run down having
     * recorded nothing for a day the vendor already billed. Same shape and
     * same conservative figure as the dry run's own sample above.
     *
     * ⚠️ SCOPED TO !isSampledDay, and that scope is the whole correctness of
     * it. The sampled day runs through reuseSampleAdapter, which returns an
     * in-memory page and makes NO network call -- a throw on that iteration
     * (an artifact write failing, say) cost zero vendor records, and its
     * real cost was already tallied once as the dry run's own spend. Tallying
     * there would not be conservative, it would be fabricated, and it would
     * double-count the sample. Same distinction fetch-documents-for.ts draws
     * between HigherGov and free SAM.gov at its own catch. */
    let runResult: Awaited<ReturnType<typeof runScrape>>;
    try {
      runResult = await runScrape(req, dayAdapter, outPath);
    } catch (err) {
      if (!isSampledDay) {
        await recordSpend({ run: exec }, {
          sourceId: source.id,
          endpoint: "opportunity",
          records: COVERAGE.unparseableResponseRecords,
        });
      }
      throw err;
    }

    /* BILLED, read back from the artifact -- see billedRecordsFromArtifact's
     * own header for why this is not rows+undatedSkipped. */
    const dayRecords = billedRecordsFromArtifact(
      runResult.artifactPath,
      runResult.rows + runResult.undatedSkipped,
    );

    /* Recorded ONLY for a day that made a real, new call -- the sampled
     * day's cost was already recorded once, above, as the dry run's own
     * spend. Recording it again here would double-count a call that never
     * happened a second time. */
    if (!isSampledDay) {
      await recordSpend({ run: exec }, {
        sourceId: source.id,
        endpoint: "opportunity",
        records: dayRecords,
      });
      committedRecords += dayRecords;
    }
    committedDays += 1;

    const imported = await importArtifact(runResult.artifactPath);
    /* ⚠️ `imported.skipped` IS STRUCTURALLY UNREACHABLE FROM HERE, and the
     * branch is kept anyway (final review, fix 6). importArtifact dedups on
     * a sha256 of the WHOLE SQLite file, which carries run.started_at,
     * capture.fetched_at and sighting.seen_at -- so two runs over byte-
     * identical vendor data still hash differently, always. Every path
     * through this loop writes a fresh artifact to a fresh timestamped
     * filename, so nothing this CLI produces can collide with a row already
     * in ingest_run. The branch stays because it is free and importArtifact's
     * contract may outlive this reasoning; what it must NOT do is advertise a
     * de-duplication this command can never actually perform, which is why
     * the message now names it as defensive rather than reporting it as a
     * thing that happened for an ordinary reason. */
    console.log(
      `  ${day}: ${dayRecords} record(s) ` +
        (isSampledDay ? "(reused from the dry run's sample -- not re-billed)" : "billed") +
        `, ${imported.imported} sighting(s) imported` +
        (imported.skipped
          ? " (UNEXPECTED: importArtifact reported this artifact's hash as already " +
            "imported -- artifact hashes carry per-run timestamps, so this should not " +
            "be reachable from this command)."
          : "."),
    );
  }

  console.log(
    `\nDone: ${committedDays} of ${days.length} day(s) loaded, ${committedRecords} ` +
      `record(s) newly billed this run (plus ${result.recordsThatDay} sampled by the dry ` +
      `run above, reused for the sampled day rather than billed twice).`,
  );

  /* A mid-walk stop is a SUCCESSFUL refusal, not a crash -- it does not
   * throw. But exiting 0 regardless would make a partially loaded window
   * indistinguishable from a complete one to any wrapper or cron (review
   * round 3, item 6). Set, not thrown: the summary above is exactly the
   * information an operator needs, and a thrown Error here would bury it
   * under a stack trace for what is a legitimate, actionable outcome. */
  if (committedDays < days.length) {
    process.exitCode = 1;
    console.log(
      `⚠️  PARTIAL: ${committedDays} of ${days.length} requested day(s) loaded. ` +
        `Exiting non-zero.`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .catch((err) => {
      /* 🔴 REDACTED, AND DEFENCE IN DEPTH (final review, fix 6).
       * highergov-client.ts now guarantees that every error IT produces is
       * already scrubbed and carries no cause chain -- but this catch sees
       * everything, including errors from pg, node:fs and better-sqlite3,
       * and `console.error(err)` prints an Error's whole cause chain. The
       * boundary rule (CLAUDE.md §5.3 rule 2) is about what comes BACK, and
       * printing is the last thing that happens to it. `err.stack` rather
       * than `err` keeps the stack trace an operator needs; passing the
       * Error object itself is what would print the parts nobody vetted. */
      console.error(redact(err instanceof Error ? (err.stack ?? err.message) : String(err)));
      process.exitCode = 1;
    })
    .finally(() => close());
}
