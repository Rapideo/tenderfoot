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
 * ⚖️ QUALIFIED 2026-09-08, WHEN THE CLIENT LEARNED TO PAGE. The sample is now
 * budgeted down to ONE PAGE (dryRun's own comment says why: an unbudgeted
 * sample would buy a whole day, up to 1,000 records, BEFORE the affordability
 * check that might refuse the window anyway). A one-page sample of a busy day
 * is a FRAGMENT, and committing a fragment as that day's archive entry would
 * put a knowingly incomplete first day into every backfill -- so a partial
 * sample's day is re-fetched in full and page one is bought twice. A WHOLE
 * sample -- a quiet single-page day -- is still reused exactly as before, and
 * costs nothing new. The projection is unaffected either way: it infers the
 * day's true size from `pages` (estimateFullDay) rather than treating the
 * page it bought as the day, which is the defect that made a 30-day window
 * project 780 records and cost 151.
 *
 * ⚖️ `--axis`, ADDED 2026-09-07 ON MATT'S RULING (design spec §3.2's
 * amendment). The BACKFILL runs on `posted_date`; LIVE operation stays on
 * `captured_date`, which is the default and stays the default. A historical
 * `captured_date` window returns re-captures of notices we already hold, and
 * the vendor bills per record RETURNED -- so the money is spent and the merge
 * layer correctly throws the row away. The flag threads all the way down: the
 * query parameter, the item's `modifiedAt`, the requestUrl, the artifact
 * envelope, and the dry run's own printed projection all name the SAME axis,
 * because a projection measured on one axis and reported as another is a
 * spending decision made on evidence that lies.
 *
 * Mirrors coverage/coverage-cli.ts's shape deliberately: the same
 * shape-then-round-trip date validation (a bare regex lets 2026-13-01
 * through; Date.parse alone rolls 2026-02-30 forward to March 2nd), and the
 * same "database: <host>" announcement before any spend -- api_spend is
 * per-database, and a run against the wrong branch spends real vendor money
 * into a ledger the ceiling will never read.
 *
 * ⚖️ `--max-records`, ADDED 2026-09-07 ON MATT'S RULING. The trial ends in
 * ~2 days with ~9,000 records unspent, and he ruled we spend them on a
 * complete Indiana listing archive rather than lose them -- which is why
 * MONTHLY_RECORD_CEILING (extract/api-spend.ts) and COVERAGE.maxCallsPerRun
 * (coverage/thresholds.ts) were both raised the same day. This flag is the
 * other half: a review gate roughly every 1,000 records so a multi-day
 * archive walk does not run unattended all the way to 9,000 before a person
 * looks at it. A DATE WINDOW CANNOT BE THAT GATE -- measured daily volume
 * swings from 4 to 67 records, so a 38-day window might cost 150 records or
 * 2,500 -- so this is a hard cap on records spent WITHIN ONE RUN, checked
 * before each day's call the same way the monthly ceiling already is, and
 * reported as its own, third stop reason: not a ceiling refusal, not a
 * completed window, but a deliberate stop for review. Optional and defaulted
 * to `undefined` (unset), like `--page-size` and `--axis` before it: an
 * invocation that never asks for a cap must behave exactly as it did before
 * this flag existed.
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
  DEFAULT_FEED_AXIS,
  FEED_AXES,
  higherGovClient,
  HIGHERGOV_SOURCE_NAME,
  isPartialDay,
  recordsAlreadyBilled,
  redact,
  singlePageBudget,
  type FeedAxis,
  type FeedResult,
  type HigherGovClient,
} from "../coverage/highergov-client.js";
import {
  axisValue,
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

const USAGE =
  "Usage: npm run ingest:highergov -- --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run] " +
  `[--page-size=N] [--axis=${FEED_AXES.join("|")}] [--max-records=N]`;

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

/* ⚖️ NOT A DOCUMENTED VENDOR LIMIT -- a sanity rail this project owns, not a
 * ceiling HigherGov has published (docs/2026-09-03-highergov-field-mapping.md
 * names no such limit either). R5/2026-09-07's own measurement -- 10 records
 * on page one with 3 more pages behind it, so a few dozen at most for one
 * Indiana day -- puts the real single-day volume nowhere near this. 1000 is
 * a wide margin above that (room to fetch a whole day, or several, in one
 * call) while still refusing an obvious typo (a stray zero or three) before
 * it can turn into a bill nobody asked for. Raise it only on purpose, not by
 * discovering it is "too small" for a value that was itself a mistake. */
export const MAX_PAGE_SIZE = 1000;

/* Validates and parses `--page-size`'s raw string value. CALLED ONLY WHEN THE
 * FLAG IS PRESENT (main() leaves pageSize `undefined` otherwise) -- there is
 * nothing to validate about a knob nobody touched, and highergov-client.ts's
 * fetchDay depends on that exact distinction to leave today's request
 * unchanged. Every rejection fires BEFORE main()'s own dry run makes its one
 * unavoidable network call (CLAUDE.md §5.1: refuse before spending, not
 * after), and every message names the cost consequence rather than just
 * "invalid" -- billing is per record returned, so this is a money guard, not
 * a type check. */
export function assertValidPageSize(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `${USAGE}\n--page-size=${raw} is not a positive integer. Billing is per record ` +
        "returned (CLAUDE.md §5.1), so an invalid page size is refused before any call is " +
        "made rather than sent to the vendor to see what happens.",
    );
  }
  if (value > MAX_PAGE_SIZE) {
    throw new Error(
      `${USAGE}\n--page-size=${raw} exceeds the sanity cap of ${MAX_PAGE_SIZE}. Raising ` +
        "page_size does NOT reduce spend -- billing is per record returned, so a page this " +
        "large risks billing far more per call than intended. Refusing before any call is made.",
    );
  }
  return value;
}

/* Validates and parses `--axis`'s raw string value. CALLED ONLY WHEN THE FLAG
 * IS PRESENT -- main() leaves the axis at DEFAULT_FEED_AXIS otherwise, which
 * is the same "an unasked-for knob changes nothing" discipline
 * assertValidPageSize is held to just above.
 *
 * ⚖️ WHY THE DEFAULT IS `captured_date` AND NOT THE NEW THING. Matt's
 * 2026-09-07 ruling moved the BACKFILL to `posted_date` and left LIVE
 * operation on `captured_date`. This command serves both, so the axis is a
 * flag rather than a new default -- and an invocation that does not ask must
 * be byte-identical to one made before the flag existed, because this is a
 * metered API and a silently changed question is a silently changed bill.
 *
 * 🔴 REFUSED BEFORE ANY CALL IS MADE, like every other guard in this file. An
 * unrecognised axis sent to the vendor would be SILENTLY IGNORED and billed in
 * full -- R1 measured exactly that behaviour on this endpoint, where
 * pop_state, state and place_of_performance_state were all accepted, ignored,
 * and charged (5,266 records for one unfiltered Indiana day). So a typo like
 * `--axis=posted-date` must die here, at zero cost, rather than quietly
 * becoming an unaxised nationwide-shaped pull. */
export function assertValidAxis(raw: string): FeedAxis {
  const hit = FEED_AXES.find((a) => a === raw);
  if (!hit) {
    throw new Error(
      `${USAGE}\n--axis=${raw} is not a recognised axis. Accepted: ${FEED_AXES.join(", ")}. ` +
        "HigherGov SILENTLY IGNORES parameters it does not know and bills the response in " +
        "full (R1, CLAUDE.md §5.1), so an unrecognised axis is refused before any call is " +
        "made rather than sent to the vendor to see what happens.",
    );
  }
  return hit;
}

/* Validates and parses `--max-records`'s raw string value. CALLED ONLY WHEN
 * THE FLAG IS PRESENT (main() leaves maxRecords `undefined` otherwise) --
 * the same "an unasked-for knob changes nothing" discipline
 * assertValidPageSize and assertValidAxis are held to above: an invocation
 * that omits this flag must be byte-identical to one made before it existed.
 * Every rejection fires BEFORE main()'s own dry run makes its one
 * unavoidable network call (CLAUDE.md §5.1: refuse before spending, not
 * after).
 *
 * ⚖️ ADDED 2026-09-07 ON MATT'S RULING -- see this file's own header. A date
 * window cannot substitute for this: measured daily volume swings from 4 to
 * 67 records (recorded observation), so a 38-day window might cost 150
 * records or 2,500. This is instead a hard cap on records spent WITHIN ONE
 * RUN, independent of how many days that turns out to be.
 *
 * Unlike `--page-size`, there is no upper sanity cap (MAX_PAGE_SIZE) here: a
 * page size that is too large risks an unintentionally expensive CALL, but a
 * max-records value that is "too large" is merely a looser review gate --
 * the operator is choosing it specifically to sit below the monthly ceiling,
 * so there is no typo-shaped failure mode to guard against the way an
 * oversized page-size has one. */
export function assertValidMaxRecords(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `${USAGE}\n--max-records=${raw} is not a positive integer. This is a per-run spend cap ` +
        "-- a review gate, not the monthly ceiling -- so an invalid value is refused before " +
        "any call is made rather than silently ignored.",
    );
  }
  return value;
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

/* ⚖️ THE PER-DAY RATE THE PROJECTION SHOULD ACTUALLY USE, and getting this
 * wrong was measured rather than theorised: a 30-day window projected 780
 * records and cost 151, and a different window projected 240 and cost 1,556.
 * Both errors came from the same place -- the sample measured PAGE ONE and
 * the projection treated it as the whole day.
 *
 * The sample is still deliberately page-one-sized (see dryRun below: buying a
 * whole day to price a window would spend up to 1,000 records BEFORE the
 * affordability check that might refuse the window anyway). So the true day
 * size has to be inferred rather than bought, and page one carries exactly
 * what is needed to infer it: `pages`.
 *
 * `records / pagesFetched` is the observed price of a page; multiplied by the
 * vendor's own page count it is the most the whole day can cost. It is an
 * UPPER bound, not a best guess, and that is deliberate -- the failure mode
 * of over-projecting is a window refused that was affordable; the failure
 * mode of under-projecting is a window accepted that crosses a ceiling which
 * cannot be read back from the vendor (CLAUDE.md §5.1). `Math.ceil` for the
 * same reason: a fractional record is not a smaller record.
 *
 * A day that came back WHOLE needs no inference at all -- `records` IS the
 * day -- so it is returned unchanged, which is what keeps every single-page
 * day's projection byte-identical to what it was before paging existed. */
export function estimateFullDay(sample: FeedResult): number {
  if (!isPartialDay(sample) || sample.pagesFetched < 1) return sample.records;
  return Math.ceil(sample.records / sample.pagesFetched) * sample.pages!;
}

export interface DryRunResult {
  sampledDay: string;
  /** WHICH AXIS THE SAMPLE WAS MEASURED ON. A projection is a spending
   * decision, and the two axes return materially different volumes for the
   * same day -- spec §3.2's amendment records the same saved search
   * disagreeing by 7x between two days. So a rate carried without its axis is
   * a number nobody can act on. Reported, not merely stored (main() below). */
  axis: FeedAxis;
  /* Whether the sample's own network call actually happened. False only
   * when no allowance remained BEFORE sampling -- see dryRun()'s own guard
   * below. When false, every other numeric field reflects "nothing was
   * measured", not "zero records exist". */
  sampled: boolean;
  recordsThatDay: number;
  /* meta.pagination.pages on the sampled day, carried rather than
   * discarded: how many pages the VENDOR says that day has. Compared against
   * `samplePagesFetched` below, it is what says whether the sample saw the
   * whole day -- and, when it did not, it is what `estimateFullDay` uses to
   * project the rest rather than pretending page one was the day. */
  samplePages: number | null;
  /** How many of those pages the sample actually bought. The sample is
   * budgeted down to one page on purpose (see dryRun), so on any busy day
   * this is 1 and `samplePages` is more. */
  samplePagesFetched: number;
  /** The sampled day's TRUE size, inferred where it had to be -- see
   * estimateFullDay. This, not `recordsThatDay`, is what the projection and
   * the day-walk's own per-day guard are built on. */
  estimatedRecordsPerDay: number;
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
 * undated-skip logic exactly: a notice with no value ON THE WALKED AXIS is
 * counted, not silently dropped (adapter.ts §5.4).
 *
 * 🔴 `axis` IS NOT DECORATION HERE. This page is fed to runScrape exactly as
 * the real adapter's would be, so its `modifiedAt` values become the run's
 * low-water resume marker and its envelope becomes the artifact. It uses the
 * adapter's own exported `axisValue()` rather than choosing the field a second
 * time, because two independent choices of "which date is this" is precisely
 * how the sampled day would come to disagree with every other day in the same
 * window. */
function sampleAsPage(sample: FeedResult, day: string, axis: FeedAxis): WindowedPage {
  let undatedSkipped = 0;
  const items: WindowedItem[] = [];
  for (const n of sample.notices) {
    const modifiedAt = axisValue(n, axis);
    if (!modifiedAt) {
      undatedSkipped++;
      continue;
    }
    items.push({ externalId: n.externalId, modifiedAt, raw: n.raw });
  }
  return {
    items,
    undatedSkipped,
    nextCursor: null,
    requestUrl: `highergov:/opportunity/?${axis}=${day}&reused=dry-run-sample`,
    httpStatus: 200,
    /* scrubPayload() is idempotent (its own header) -- `n.raw` is already
     * redacted by highergov-client.ts's toNotice(), so this is a defensive
     * second pass, not a required one, and cannot change the bytes. */
    payload: scrubPayload(
      JSON.stringify({
        axis,
        day,
        records: sample.records,
        feedCount: sample.feedCount,
        pages: sample.pages,
        pagesFetched: sample.pagesFetched,
        results: sample.notices.map((n) => n.raw),
      }),
    ),
  };
}

/* HOW THE DAY-WALK OBTAINS THE ADAPTER FOR ONE DAY. A factory rather than an
 * adapter, because since the client learned to page the adapter carries a
 * BUDGET -- and the budget is recomputed for every day from what is actually
 * left of the monthly ceiling and of `--max-records`. One adapter built once
 * would be carrying day one's budget on day ninety.
 *
 * main() accepts either shape: a plain WindowedAdapter (what every existing
 * test injects, and what a caller with no interest in the budget wants) or a
 * factory, which is the only way to SEE the budget a given day was handed.
 * The real CLI always uses a factory. */
export type DayAdapterFactory = (maxRecordsPerDay: number | undefined) => WindowedAdapter;

function resolveDayAdapter(
  injected: WindowedAdapter | DayAdapterFactory | undefined,
  budget: number | undefined,
  pageSize: number | undefined,
  axis: FeedAxis,
): WindowedAdapter {
  if (typeof injected === "function") return injected(budget);
  if (injected) return injected;
  return higherGovAdapter(fetch, pageSize, axis, budget);
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
/* THE ONE WAY TO INTERROGATE A DAY'S ARTIFACT, not two. Both
 * billedRecordsFromArtifact (the vendor's own billed count) and
 * truncationFromArtifact (whether this day's capture was complete) below read
 * the same envelope -- adapters/highergov.ts's own comment names `records`,
 * `feedCount`, `pages`, `pagesFetched` and (since the axis ruling) `axis`+`day`
 * as the scalars it carries specifically so a caller can answer both questions
 * from one parse. THESE TWO READ `records`, `pages` AND `pagesFetched` ONLY:
 * the envelope's day label was renamed from `capturedDate` to `axis`+`day`
 * when the axis became a choice, and nothing here -- or anywhere else in the
 * repo -- ever read the old key. Returns null on anything
 * that stops this from answering (missing capture, non-string payload, bad
 * JSON) -- both callers already have their own conservative fallback for
 * that case, which is why this itself never needs one. */
function readArtifactEnvelope(
  artifactPath: string,
): { records?: unknown; pages?: unknown; pagesFetched?: unknown } | null {
  try {
    const art = readArtifact(artifactPath);
    const capture = art.captures[0] as { payload?: unknown } | undefined;
    if (!capture || typeof capture.payload !== "string") return null;
    return JSON.parse(capture.payload) as {
      records?: unknown;
      pages?: unknown;
      pagesFetched?: unknown;
    };
  } catch {
    return null;
  }
}

function billedRecordsFromArtifact(artifactPath: string, atLeast: number): number {
  const conservative = Math.max(atLeast, COVERAGE.unparseableResponseRecords);
  const envelope = readArtifactEnvelope(artifactPath);
  return envelope && typeof envelope.records === "number" ? envelope.records : conservative;
}

/* WAS THIS DAY'S CAPTURE COMPLETE? Returns the two figures the answer is made
 * of -- how many pages the vendor said there were, and how many this run
 * actually bought -- or null when the envelope cannot answer at all (an
 * artifact from a source that never wrote them, or one that failed to parse).
 * Null is "unknown", not "not truncated", and callers must not conflate the
 * two.
 *
 * ⚖️ THIS USED TO BE `pagesFromArtifact`, RETURNING `pages` ALONE, and the
 * rename is the change rather than decoration. While fetchDay read page one
 * only, `pages > 1` and "truncated" were the same fact, so one number
 * answered both. Now that it pages, a three-page day bought WHOLE and a
 * three-page day stopped after one both write `pages: 3` -- and only
 * `pagesFetched` beside it separates them. A caller left reading `pages`
 * alone would report every complete busy day as truncated, which is the kind
 * of false alarm that gets a real warning ignored.
 *
 * ⚠️ A MISSING `pagesFetched` DEFAULTS TO 1, not to `pages`. Artifacts
 * written before this field existed came from a client that genuinely read
 * one page, so 1 is the true value for them -- and it is also the
 * conservative direction for anything else: it reports "we may have missed
 * rows" rather than quietly asserting completeness nobody recorded. */
function truncationFromArtifact(
  artifactPath: string,
): { pages: number; pagesFetched: number } | null {
  const envelope = readArtifactEnvelope(artifactPath);
  if (!envelope || typeof envelope.pages !== "number") return null;
  return {
    pages: envelope.pages,
    pagesFetched: typeof envelope.pagesFetched === "number" ? envelope.pagesFetched : 1,
  };
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
  /* Threaded straight from main()'s `--page-size` flag, already validated by
   * assertValidPageSize before this ever runs. Left `undefined` (the
   * default) it changes nothing about the sample's own request -- see
   * highergov-client.ts's fetchDay for why that has to be provably true. */
  pageSize?: number,
  /* Threaded straight from main()'s `--axis` flag, already validated by
   * assertValidAxis before this ever runs. Defaulted rather than left
   * `undefined` so the value can be REPORTED on the result: an operator
   * reading a projection must be able to see which question produced it, and
   * "undefined" is not an answer to that. The default IS what the client would
   * have used anyway, so the request is unchanged. */
  axis: FeedAxis = DEFAULT_FEED_AXIS,
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
      axis,
      sampled: false,
      recordsThatDay: 0,
      samplePages: null,
      samplePagesFetched: 0,
      estimatedRecordsPerDay: 0,
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
    /* 🛑 THE SAMPLE IS BUDGETED DOWN TO EXACTLY ONE PAGE, and this is the
     * single most important line in this function now that the client pages.
     *
     * Without a budget, "sample one day" would walk that day whole -- up to
     * MAX_PAGES_PER_DAY * 100 = 1,000 records -- and it would do so BEFORE
     * the affordability check below, which might then refuse the window
     * anyway. A window that gets refused would cost a thousand records to
     * refuse. The whole argument for a dry run is that measuring is cheap
     * relative to committing.
     *
     * `singlePageBudget(pageSize)` is the client's own answer to "what is
     * the most one page can bill", so passing it as the day's whole budget
     * makes the walk stop before page two by construction: page one is
     * unbudgeted (it IS the measurement), and page two would cross. It works
     * for a small --page-size too, where pricing a page at a flat 100 would
     * instead have let the sample buy ten pages of ten.
     *
     * What is lost is completeness of the SAMPLED day, and it is not lost
     * silently: `samplePages` vs `samplePagesFetched` records it, the
     * projection infers the rest from it (estimateFullDay), and main()'s
     * day-walk re-fetches that day properly rather than committing a page of
     * it. */
    sample = await client.fetchDay(from, undefined, pageSize, axis, singlePageBudget(pageSize));
  } catch (err) {
    /* 🔴 THE TALLY ITSELF MUST NOT SWALLOW `err` (final review, fix 2). This
     * whole catch exists so the vendor's error is never lost -- but `one()`
     * and `recordSpend` are themselves a DB round trip, and on a degraded
     * compute (CLAUDE.md §4's own "Connection terminated unexpectedly") they
     * can throw too. Unguarded, that second throw would replace `err` before
     * `throw err` below ever ran: the ledger is unaffected either way (no row
     * gets written in either case), but the operator would see a database
     * error instead of the vendor's own -- exactly the diagnostic this catch
     * was written to preserve. So the tally is wrapped and its own failure
     * only logged, never allowed to compete with the error it was recording. */
    try {
      const src = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
        HIGHERGOV_SOURCE_NAME,
      ]);
      if (src) {
        await recordSpend({ run: exec }, {
          sourceId: src.id,
          endpoint: "opportunity",
          /* 🔴 PLUS WHAT THE SAMPLE'S EARLIER PAGES ALREADY COST. The sample
           * is budgeted to one page, so this is normally 0 -- but a caller
           * passing a larger budget, or a page size small enough to fit
           * several pages inside one page's price, makes a part-billed throw
           * reachable, and 40 flat would then under-report it. Zero for any
           * error that carries no such figure. */
          records: COVERAGE.unparseableResponseRecords + recordsAlreadyBilled(err),
        });
      }
    } catch (tallyErr) {
      console.error(
        redact(
          `Failed to record conservative spend after a vendor error (original error follows): ${
            tallyErr instanceof Error ? (tallyErr.stack ?? tallyErr.message) : String(tallyErr)
          }`,
        ),
      );
    }
    throw err;
  }
  /* 🔴 THE PROJECTION IS BUILT ON THE DAY'S TRUE SIZE, NOT ON WHAT THE
   * SAMPLE HAPPENED TO BUY. `projectWindow(sample.records, ...)` was the old
   * line, and on a busy day it projected page one as if it were the day --
   * measured under-projections of 5x and 6x, in the one direction that lets
   * a window be accepted that the ceiling cannot afford. estimateFullDay()
   * carries the whole argument. */
  const estimatedRecordsPerDay = estimateFullDay(sample);
  const projectedRecords = projectWindow(estimatedRecordsPerDay, windowDays);
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
    axis,
    sampled: true,
    recordsThatDay: sample.records,
    samplePages: sample.pages,
    samplePagesFetched: sample.pagesFetched,
    estimatedRecordsPerDay,
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
  /* ⚠️ NO EAGER DEFAULT, DELIBERATELY. The real adapter needs `pageSize`,
   * which is only known once argv has been parsed and validated below -- and
   * a parameter's default expression runs at call time, before this
   * function's own body does. `undefined` (a test always supplies its own
   * fake adapter, so this only matters for the real CLI entrypoint at the
   * bottom of this file) is resolved further down, AFTER pageSize exists --
   * and now also after each day's own budget exists, which is why a FACTORY
   * is accepted alongside a plain adapter (see DayAdapterFactory above). */
  adapter?: WindowedAdapter | DayAdapterFactory,
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

  /* Same "before any fetch" posture as the date checks just above --
   * `undefined` when the flag is absent (unset is the required default: a
   * page-size opt-in changes nothing about today's request), validated and
   * parsed together the moment it IS present, and checked here rather than
   * inside dryRun()/the adapter so a bad value never reaches even the one
   * unavoidable network call below. */
  const pageSizeArg = arg(argv, "page-size");
  const pageSize: number | undefined =
    pageSizeArg === undefined ? undefined : assertValidPageSize(pageSizeArg);

  /* Same posture again, and for a sharper reason than page-size: an axis the
   * vendor does not recognise is SILENTLY IGNORED and billed in full (R1), so
   * a typo would not fail -- it would succeed at asking the wrong question and
   * charge for the answer. Absent, this is DEFAULT_FEED_AXIS (`captured_date`)
   * and every existing invocation is unchanged. */
  const axisArg = arg(argv, "axis");
  const axis: FeedAxis = axisArg === undefined ? DEFAULT_FEED_AXIS : assertValidAxis(axisArg);

  /* Same posture again: unset (the default, `undefined`) leaves the
   * day-walk's existing ceiling-only stop condition byte-identical to before
   * this flag existed -- see assertValidMaxRecords's own comment for why a
   * date window cannot substitute for a hard per-run record cap. Present, it
   * adds a SECOND, independent stop condition that the day-walk checks
   * BEFORE the ceiling check (below), from this run's own local totals --
   * no extra query needed to decide it, unlike the ceiling check right next
   * to it. */
  const maxRecordsArg = arg(argv, "max-records");
  const maxRecords: number | undefined =
    maxRecordsArg === undefined ? undefined : assertValidMaxRecords(maxRecordsArg);

  /* api_spend is PER-DATABASE. Same format as db/migrate.ts's own print and
   * coverage-cli.ts's, matched deliberately so all three operator commands
   * read the same way. */
  console.log(`database: ${new URL(process.env.DATABASE_URL!).host}`);
  /* THE AXIS IS ANNOUNCED BESIDE THE WINDOW, because on its own the window is
   * ambiguous: "2026-06-01 to 2026-08-31" means two different pulls, at two
   * different prices, depending on whether it is asking what was PUBLISHED or
   * what was CRAWLED then (spec §3.2's amendment). */
  console.log(
    `Window: ${from} to ${to}, on ${axis} ` +
      `(${axis === "posted_date" ? "what was PUBLISHED" : "what HigherGov CRAWLED"} that day).`,
  );

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
  const result = await dryRun(from, to, client, undefined, pageSize, axis);

  if (!result.sampled) {
    /* No allowance remained even before the sample -- nothing was spent,
     * so there is nothing to record. */
    throw new Error(
      `Refusing: ${result.remainingThisMonth} record(s) remain this month for ` +
        `'${HIGHERGOV_SOURCE_NAME}' (ceiling ${MONTHLY_RECORD_CEILING}) -- not enough to ` +
        `even sample a day. Refusing before spending anything.`,
    );
  }

  /* 🔴 THE AXIS IS PART OF THE MEASUREMENT, NOT CONTEXT AROUND IT. A
   * projection is a spending decision, and the same saved search on the same
   * parameter has been measured 7x apart on two days (spec §3.2's amendment) --
   * so "5 record(s)/day" with no axis attached is a number an operator cannot
   * act on and cannot audit afterwards. It is printed on the sample line
   * itself, not only in the window announcement above, so that the one line an
   * operator is most likely to paste into a decision carries its own units. */
  console.log(
    `\nDry run: sampled ${result.axis}=${result.sampledDay} at ` +
      `${result.estimatedRecordsPerDay} record(s)/day. Projected ` +
      `${result.projectedRecords} record(s) across ${result.windowDays} day(s), all on ` +
      `${result.axis}.`,
  );
  console.log(
    `Remaining this month: ${result.remainingThisMonth} of ${MONTHLY_RECORD_CEILING} ` +
      `(source '${HIGHERGOV_SOURCE_NAME}', after the sample above).`,
  );
  /* Paid for, not discarded. The sample is budgeted to ONE page on purpose
   * (dryRun's own comment), so on any busy day this fires -- and what it
   * reports is no longer "the rate above is a floor" but "the rate above is
   * an INFERENCE, and here is what it was inferred from". An operator
   * committing 90 days on the strength of one page is entitled to see that
   * the arithmetic happened. */
  if (result.samplePages !== null && result.samplePages > result.samplePagesFetched) {
    console.log(
      `ℹ️  The sampled day spans ${result.samplePages} page(s); the sample deliberately ` +
        `bought ${result.samplePagesFetched} of them (${result.recordsThatDay} record(s)) so ` +
        `that pricing a window stays cheap. The ${result.estimatedRecordsPerDay} record(s)/day ` +
        `above is that page's rate carried across all ${result.samplePages} page(s) -- an ` +
        `UPPER bound, not a measurement. The day-walk below re-fetches this day in full ` +
        `rather than committing a fraction of it.`,
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
  /* 🔴 THE DAY'S TRUE SIZE, NOT THE SAMPLE'S RECEIPT. This used to be
   * `result.recordsThatDay` -- the records the sample happened to buy -- and
   * that is now page one of a day, not the day. Every forward-looking guard
   * below ("can we afford the next day?") is built on this number, so an
   * under-stated rate silently disables all of them at once: the walk would
   * step past both the run cap and the monthly ceiling believing each day
   * cost a fifth of what it did. estimateFullDay() carries the argument. */
  const perDayEstimate = result.estimatedRecordsPerDay;
  let committedDays = 0;
  let committedRecords = 0;
  /* Named `days`, not `windowDays` -- `result.windowDays` (a count) already
   * exists on this scope, and shadowing it with an array of the same near-
   * name is exactly the kind of thing that invites a future bug. */
  const days = daysInRange(from, to);
  /* Every day whose OWN artifact reported more than one page -- built as the
   * loop goes, then read once for the end-of-run summary below. A day here
   * does not mean this run failed to finish; it means what it captured for
   * that day is incomplete, which is a DIFFERENT fact from a mid-walk stop
   * (see the `committedDays < days.length` check at the very end). */
  const truncatedDays: string[] = [];
  /* Which of the two independent stop conditions, if either, ended the walk
   * before the requested window finished -- read only by the end-of-run
   * summary below, so a --max-records stop and a ceiling stop are reported
   * as the two distinct facts they are, never folded into one generic
   * "stopped early" message. `null` means the walk reached the end of the
   * requested window on its own. `stoppedAtDay` is the day the walk stopped
   * BEFORE (never billed this run), which is exactly the day the next chunk
   * should resume from. */
  let stopReason: "cap" | "ceiling" | null = null;
  let stoppedAtDay: string | null = null;

  for (const day of days) {
    /* THE SAMPLED DAY IS NEVER BILLED TWICE (review round 3, item 4). `day`
     * equals `result.sampledDay` on exactly the first iteration (dryRun()
     * always samples `from`, and `from` is always daysInRange's first
     * entry) -- reuse its already-paid-for data instead of re-fetching the
     * same day through the network a second time.
     *
     * ⚖️ BUT ONLY WHEN THE SAMPLE IS A WHOLE DAY, and that qualifier is new
     * with paging. The sample is budgeted to one page (dryRun's own comment),
     * so on a busy day `result.sampleResult` is a FRACTION of that day.
     * Reusing it would commit page one of day one into the archive
     * permanently and mark it loaded -- a knowingly incomplete first day in
     * every backfill, which is the exact opposite of the ruling this work
     * exists to serve ("build paging, then buy complete days").
     *
     * So a partial sample is re-fetched properly, and page one of that day is
     * bought a second time. That is a real, acknowledged cost of at most one
     * page (<=100 records) per run, paid once, to keep the archive honest --
     * and it is the same direction of error this file's own projectWindow()
     * comment already accepts for the same reason. A whole sample is still
     * reused exactly as before, so a quiet single-page day costs nothing new. */
    const reusesSample = day === result.sampledDay && !isPartialDay(result.sampleResult!);

    /* THE BUDGET HANDED TO THIS ONE DAY'S OWN PAGING WALK. Null for a reused
     * sample (no call is made at all). See where it is set below: it is what
     * is genuinely left, so a day that turns out much bigger than the
     * estimate comes back PARTIAL instead of walking past the ceiling. */
    let dayBudget: number | undefined;

    /* Stop BEFORE the call that would cross the ceiling -- skipped when the
     * sample is being reused, which makes no new network call and so cannot
     * cross anything. Re-read fresh each iteration rather than tracked
     * locally: recordSpend below commits immediately, so a fresh read
     * reflects this loop's own prior days, the dry run's own sample, and
     * anything else recorded meanwhile. perDayEstimate -- the dry run's own
     * measured rate -- is the only forward-looking signal available for a day
     * not yet fetched. `<= 0 ||` is defence in depth: dryRun() already
     * refuses a zero-record sample above, so perDayEstimate should never
     * reach here as 0, but a per-day guard that only fires on a STRICT
     * less-than would itself go silent at exactly zero remaining and zero
     * estimated, the same failure mode one layer up (review round 3, item 2).
     *
     * ⚠️ THE GATE IS `!reusesSample`, NOT `!isSampledDay`. Since a PARTIAL
     * sample's day is now re-fetched (see above), the sampled day can make a
     * real, billed call -- and a day that makes a call must pass the same
     * checks every other day does. Gating on "is this the sampled day" would
     * have exempted the one day most likely to be large. */
    if (!reusesSample) {
      /* THE CAP CHECK RUNS FIRST, and needs no database read to decide --
       * unlike the ceiling check right below it, "how much has THIS RUN
       * spent" is fully known from local totals: the dry run's own
       * mandatory sample (result.recordsThatDay, always billed exactly once
       * per run) plus every day this loop has itself billed so far
       * (committedRecords, which by construction excludes the reused
       * sampled day -- see where it is incremented further down).
       * perDayEstimate is the same forward-looking figure the ceiling check
       * uses for the same reason: a day's REAL cost is not known until
       * after the call that would cross the cap, and the whole point is
       * refusing BEFORE that call, never after. */
      if (maxRecords !== undefined) {
        const spentThisRun = result.recordsThatDay + committedRecords;
        if (spentThisRun + perDayEstimate > maxRecords) {
          stopReason = "cap";
          stoppedAtDay = day;
          console.log(
            `\nStopping before ${day}: continuing would push this run's own spend past the ` +
              `--max-records=${maxRecords} cap (${spentThisRun} record(s) spent this run so ` +
              `far, plus the measured rate of ${perDayEstimate}/day). ${committedDays} of ` +
              `${days.length} day(s) loaded so far. This is a DELIBERATE STOP FOR REVIEW -- ` +
              `not the monthly ceiling, and not a completed window. Resume the next chunk ` +
              `with --from=${day} once reviewed.`,
          );
          break;
        }
      }

      const spentSoFar = await spentThisMonth(HIGHERGOV_SOURCE_NAME);
      const remainingNow = MONTHLY_RECORD_CEILING - spentSoFar;
      if (remainingNow <= 0 || remainingNow < perDayEstimate) {
        stopReason = "ceiling";
        stoppedAtDay = day;
        console.log(
          `\nStopping before ${day}: ${committedDays} of ${days.length} day(s) loaded ` +
            `(${committedRecords} record(s) billed this run). ${remainingNow} remain(s) this ` +
            `month, below the measured rate of ${perDayEstimate}/day -- refusing before the ` +
            `call that would cross it.`,
        );
        break;
      }

      /* 🛑 THE PER-DAY CEILING ON THE PAGING WALK ITSELF, and it is the guard
       * the checks above cannot be. Both of those refuse a day whose
       * ESTIMATED cost will not fit; neither can do anything about a day
       * whose REAL cost turns out to be five times the estimate, because
       * they run before the call. That gap used to be worth at most one page;
       * with paging it is worth up to MAX_PAGES_PER_DAY pages.
       *
       * So the day is told what it may spend, from the two limits that are
       * actually binding right now: what remains of the monthly ceiling, and
       * (when set) what remains of this run's own --max-records review gate.
       * A day that would exceed either stops mid-walk and comes back partial,
       * which the truncation reporting below then makes loud. */
      dayBudget = remainingNow;
      if (maxRecords !== undefined) {
        dayBudget = Math.min(dayBudget, maxRecords - (result.recordsThatDay + committedRecords));
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

    /* A WHOLE sampled day reuses `result.sampleResult` (guaranteed non-null:
     * `result.sampled` was already checked true above) through a one-page
     * adapter instead of the real one -- same runScrape path, same
     * artifact-writing code, zero new network calls.
     *
     * ⚠️ THE REAL ADAPTER IS BUILT HERE, INSIDE THE LOOP, and not once above
     * it. It carries `dayBudget`, which is recomputed every iteration from
     * what is actually left -- an adapter constructed once would be carrying
     * the first day's budget on the ninetieth day, which is a budget that
     * stopped being true the moment the first day billed. A test always
     * injects its own `adapter`, so the constructed branch is only ever live
     * for the real CLI entrypoint (see this function's `adapter` parameter
     * comment for why the default cannot be an eager one). */
    const dayAdapter = reusesSample
      ? reuseSampleAdapter(sampleAsPage(result.sampleResult!, day, axis))
      : resolveDayAdapter(adapter, dayBudget, pageSize, axis);

    /* 🔴 THE SECOND PLACE A BILLED CALL COULD VANISH (final review, fix 1).
     * runScrape does not catch what the adapter throws -- its own loop is
     * `try { ... } finally { art.finish(); art.close(); }` -- so a truncated
     * 200 or a non-array `results` on day seven propagates straight out of
     * here, past the recordSpend below, and takes the whole run down having
     * recorded nothing for a day the vendor already billed. Same shape and
     * same conservative figure as the dry run's own sample above.
     *
     * ⚠️ SCOPED TO !reusesSample, and that scope is the whole correctness of
     * it. A REUSED sampled day runs through reuseSampleAdapter, which returns
     * an in-memory page and makes NO network call -- a throw on that
     * iteration (an artifact write failing, say) cost zero vendor records,
     * and its real cost was already tallied once as the dry run's own spend.
     * Tallying there would not be conservative, it would be fabricated, and
     * it would double-count the sample. Same distinction
     * fetch-documents-for.ts draws between HigherGov and free SAM.gov at its
     * own catch. A RE-FETCHED sampled day (the partial-sample case) does make
     * a real call, and falls on the tallying side of this line exactly like
     * every other day. */
    let runResult: Awaited<ReturnType<typeof runScrape>>;
    try {
      runResult = await runScrape(req, dayAdapter, outPath);
    } catch (err) {
      /* 🔴 SAME GUARD AS THE DRY RUN'S OWN CATCH ABOVE (final review, fix 2):
       * `recordSpend` is a DB write and can itself throw, and unguarded that
       * would replace `err` before it ever reached the `throw err` below --
       * trading the vendor's own diagnostic for a database error, on the one
       * call site where the vendor's message is the thing worth keeping. */
      if (!reusesSample) {
        try {
          await recordSpend({ run: exec }, {
            sourceId: source.id,
            endpoint: "opportunity",
            /* 🔴 PLUS THE PAGES OF THIS DAY THAT ALREADY BILLED. runScrape
             * does not catch what the adapter throws, so a PartialDayBilledError
             * from a mid-day failure arrives here intact carrying what pages
             * one to N-1 cost. Charging the flat conservative figure alone
             * would drop them. Zero for every other error. */
            records: COVERAGE.unparseableResponseRecords + recordsAlreadyBilled(err),
          });
        } catch (tallyErr) {
          console.error(
            redact(
              `Failed to record conservative spend after a vendor error (original error follows): ${
                tallyErr instanceof Error ? (tallyErr.stack ?? tallyErr.message) : String(tallyErr)
              }`,
            ),
          );
        }
      }
      throw err;
    }

    /* BILLED, read back from the artifact -- see billedRecordsFromArtifact's
     * own header for why this is not rows+undatedSkipped. */
    const dayRecords = billedRecordsFromArtifact(
      runResult.artifactPath,
      runResult.rows + runResult.undatedSkipped,
    );

    /* TRUNCATION, FOR THIS DAY -- not only the sampled one. `pages` and
     * `pagesFetched` ride on every day's artifact (adapters/highergov.ts,
     * and sampleAsPage() above for the reused sampled day). Truncation is
     * the COMPARISON of the two, never `pages > 1`: since the client walks
     * pages, a three-page day bought whole is complete, and calling it
     * truncated would cry wolf on almost every busy day. */
    const dayTruncation = truncationFromArtifact(runResult.artifactPath);
    const dayTruncated = dayTruncation !== null && dayTruncation.pagesFetched < dayTruncation.pages;
    if (dayTruncated) {
      truncatedDays.push(day);
    }

    /* Recorded ONLY for a day that made a real, new call -- a REUSED sampled
     * day's cost was already recorded once, above, as the dry run's own
     * spend. Recording it again here would double-count a call that never
     * happened a second time. A re-fetched sampled day did make a call, and
     * is billed like any other. */
    if (!reusesSample) {
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
        (reusesSample ? "(reused from the dry run's sample -- not re-billed)" : "billed") +
        `, ${imported.imported} sighting(s) imported` +
        (imported.skipped
          ? " (UNEXPECTED: importArtifact reported this artifact's hash as already " +
            "imported -- artifact hashes carry per-run timestamps, so this should not " +
            "be reachable from this command)."
          : "."),
    );
    /* SAID FOR EVERY DAY, NOT JUST THE SAMPLED ONE (contrast the dry run's
     * own `result.samplePages` check higher up, which only ever covered the
     * one day it measured). Printed immediately, per day, rather than saved
     * only for the end-of-run summary below -- an operator watching a long
     * run scroll by should not have to wait for the last line to learn that
     * today's day was incomplete. */
    if (dayTruncated) {
      console.log(
        `    ⚠️  ${day} was TRUNCATED: ${dayTruncation!.pagesFetched} of ` +
          `${dayTruncation!.pages} page(s) were fetched -- this day's capture is ` +
          "INCOMPLETE. The walk stopped on a budget or on the per-day page ceiling, " +
          "not because the rows were absent.",
      );
    }
  }

  console.log(
    `\nDone: ${committedDays} of ${days.length} day(s) loaded, ${committedRecords} ` +
      `record(s) newly billed this run (plus ${result.recordsThatDay} sampled by the dry ` +
      `run above, ` +
      (isPartialDay(result.sampleResult!)
        ? `whose day was re-fetched in full rather than committed as a fragment`
        : `reused for the sampled day rather than billed twice`) +
      `).`,
  );

  /* ⚖️ TRUNCATION IS A SEPARATE FACT FROM A PARTIAL WINDOW, and this summary
   * is what makes it visible for the WHOLE run rather than only the one day
   * the dry run happened to sample. Before this, a 90-day window could
   * truncate up to 91 times and this command would only ever have mentioned
   * ONE of them (the `result.samplePages` check above, about the sampled day
   * alone) -- the artifacts recorded every other truncation faithfully
   * (adapters/highergov.ts:139) and nothing ever read it back or printed it.
   * A partially-captured archive that LOOKS complete is exactly the failure
   * this exists to prevent, so the count is made loud (⚠️, its own paragraph)
   * precisely when it is nonzero, not folded quietly into the "Done" line
   * above. This says nothing about whether the run itself finished or
   * stopped early -- that is the `committedDays < days.length` check right
   * below, and the two must stay readable as different questions: this run
   * can finish EVERY requested day and still have captured some of them
   * incompletely, which is exactly the case a mid-walk stop message alone
   * would never surface. */
  if (truncatedDays.length > 0) {
    console.log(
      `\n⚠️  TRUNCATED ARCHIVE: ${truncatedDays.length} of ${committedDays} loaded day(s) ` +
        `were bought only in part, with more pages existing for that day: ` +
        `${truncatedDays.join(", ")}. The archive for those days is INCOMPLETE -- ` +
        "coverage/highergov-client.ts's fetchDay DOES walk pages, so this is a BUDGET " +
        "outcome, not a design limit: the walk stopped on what was left of the monthly " +
        "ceiling, on --max-records, or on the hard MAX_PAGES_PER_DAY backstop. Re-run " +
        "those days with more allowance (still billed per record returned, CLAUDE.md §5.1) " +
        "to complete them.",
    );
  } else {
    console.log(
      `\nNo loaded day was truncated: every day was bought whole, every page the vendor ` +
        `reported.`,
    );
  }

  /* A mid-walk stop is a SUCCESSFUL refusal, not a crash -- it does not
   * throw. But exiting 0 regardless would make a partially loaded window
   * indistinguishable from a complete one to any wrapper or cron (review
   * round 3, item 6). Set, not thrown: the summary above is exactly the
   * information an operator needs, and a thrown Error here would bury it
   * under a stack trace for what is a legitimate, actionable outcome. */
  if (committedDays < days.length) {
    process.exitCode = 1;
    /* 🔴 A CAP STOP IS A THIRD STATE, worded apart from both "completed" and
     * the ceiling's own "PARTIAL" -- the run neither failed nor finished the
     * requested window, and it stopped at a boundary the OPERATOR chose for
     * review, not one the vendor or the ceiling imposed. Reading it as an
     * error (an unexplained non-zero exit) or as a completed window (silence
     * about the difference) would both be wrong. This reuses the exact same
     * gate and the same non-zero exit code as every other early stop (review
     * round 3, item 6) -- only the reported reason differs, never the
     * mechanism. */
    if (stopReason === "cap") {
      console.log(
        `⚠️  STOPPED AT RUN CAP: ${committedDays} of ${days.length} requested day(s) loaded, ` +
          `deliberately incomplete for review (--max-records=${maxRecords}, not the monthly ` +
          `ceiling). Resume the next chunk with --from=${stoppedAtDay}. Exiting non-zero.`,
      );
    } else {
      console.log(
        `⚠️  PARTIAL: ${committedDays} of ${days.length} requested day(s) loaded. ` +
          `Exiting non-zero.`,
      );
    }
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
