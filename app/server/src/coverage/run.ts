/* ONE RUN: ASK, COMPARE, RECORD, TALLY.
 *
 * The only module here that touches both the network and the database, which
 * is why the spend guard, the abort and the writes all live in this one
 * place rather than being spread across the pure modules.
 *
 * ⚠️ THIS RUN DOES NOT INGEST. Not HigherGov's rows (spec §5.1 -- ingesting a
 * source still under test would move F6 and F7, two of the three predicates
 * blocking GO/NO-GO, using data from a source we have not decided to keep),
 * and not the free source's either (spec §5.2 -- importing IDOA is a separate
 * operator act with its own commands; folding it in would make a measurement
 * run mutate holdings).
 *
 * Net: this writes coverage_run, coverage_item and api_spend. It touches no
 * holdings. That is weaker than "read-only" and is said that way rather than
 * rounded up. */
import { all, insert, one, run as exec } from "../db/index.js";
import {
  MONTHLY_RECORD_CEILING,
  recordSpend,
  spentThisMonth,
} from "../extract/api-spend.js";
import {
  higherGovClient,
  HIGHERGOV_SOURCE_NAME,
  isPartialDay,
  recordsAlreadyBilled,
  type HigherGovClient,
} from "./highergov-client.js";
import { IDOA_SOURCE_NAME, type KeyEntry } from "./answer-key.js";
import { dedupBySourceId, observe, type Observation } from "./compare.js";
import { COVERAGE } from "./thresholds.js";
import type { FeedNotice, FeedResult } from "./highergov-client.js";

export interface RunOutcome {
  runId: number;
  recordsSpent: number;
  itemsObserved: number;
  aborted: boolean;
  abortReason?: string;
}

export interface RunOptions {
  from: string;
  to: string;
  client?: HigherGovClient;
  /** The free answer key. Injected so the run is testable without reaching
   * IDOA's live page -- and so a sub-state key can be supplied without this
   * module knowing how each buyer's page is shaped. */
  key?: KeyEntry[];
  fetchImpl?: typeof fetch;
  /** Test-only: forces the item write to throw, to prove the tally survives
   * it. Named for what it is rather than hidden behind a mock. */
  failItemWriteForTest?: boolean;
}

function days(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export async function runCoverage(opts: RunOptions): Promise<RunOutcome> {
  const client = opts.client ?? higherGovClient;

  const source = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
    HIGHERGOV_SOURCE_NAME,
  ]);
  if (!source) {
    /* Fail LOUD rather than keying api_spend with undefined. Migration 019
     * seeds this row; if it is gone, every tally would silently attach to
     * nothing and the ceiling would never fire. */
    throw new Error(
      `No source row named '${HIGHERGOV_SOURCE_NAME}' (migration 019). ` +
        `Refusing to spend against an unknown source.`,
    );
  }

  const runId = await insert(
    `INSERT INTO coverage_run (source_id, cohort_from, cohort_to) VALUES ($1, $2, $3) RETURNING id`,
    [source.id, opts.from, opts.to],
  );

  /* THE CEILING IS CHECKED BEFORE ANY CALL, not after. Consumption cannot be
   * read back from the vendor at all (CLAUDE.md §5.1), so the only safe
   * moment to refuse is before the money is spent.
   *
   * 🔴 FIXED (review): this used to be `alreadySpent >= MONTHLY_RECORD_CEILING`,
   * which permits a run at, say, 999 of 1000 to spend a full
   * `maxRecordsPerRun` more -- refusing only once the ceiling is ALREADY
   * crossed rather than refusing a run that WOULD cross it. The refusal must
   * account for what this run could still spend. */
  const alreadySpent = await spentThisMonth(HIGHERGOV_SOURCE_NAME);
  if (alreadySpent + COVERAGE.maxRecordsPerRun > MONTHLY_RECORD_CEILING) {
    const reason =
      `Monthly ceiling would be crossed: ${alreadySpent} of ${MONTHLY_RECORD_CEILING} records ` +
      `already spent this month, and this run could spend up to ${COVERAGE.maxRecordsPerRun} ` +
      `more (maxRecordsPerRun). Refusing before it starts.`;
    await exec(`UPDATE coverage_run SET aborted = true, note = $2 WHERE id = $1`, [runId, reason]);
    return { runId, recordsSpent: 0, itemsObserved: 0, aborted: true, abortReason: reason };
  }

  const key = opts.key ?? [];
  const feed: FeedNotice[] = [];
  let spent = 0;
  /* 🔴 THE CALL BUDGET, SEPARATE FROM THE RECORD BUDGET. days() will happily
   * build a wide list, and `spent` only advances by records RETURNED -- a
   * window of mostly-empty days makes many requests without ever tripping
   * maxRecordsPerRun. "Errors and zero-result calls appear not to count"
   * rests on one dashboard reading (CLAUDE.md §5.1); this is the guard for
   * when that reading is wrong. Counted across BOTH loops below -- the day
   * loop and the per-key id-lookup loop -- because both are live HTTP calls
   * against the same metered API.
   *
   * 🔴 IT COUNTS HTTP REQUESTS, NOT fetchDay INVOCATIONS -- and that
   * distinction only came into existence when the client learned to page
   * (2026-09-08). One day is now up to MAX_PAGES_PER_DAY requests, so
   * `calls += 1` per day would have left this cap counting something other
   * than what it says it counts, and quietly made it up to ten times weaker
   * than the figure Matt ratified. The RATIFIED VALUE (500,
   * thresholds.ts's `maxCallsPerRun`) is untouched; what changed is that the
   * counter now measures the thing that value was chosen to bound. See the
   * report accompanying this change: a year-long walk was ~365 one-call days
   * when 500 was ratified, and a paging walk over busy days can exceed that
   * -- which is a question for Matt, not something to settle by inflating
   * the constant here. */
  let calls = 0;

  /* Notices an earlier run already saw carried. Spec §5.5: a notice enters
   * the cohort once and SETTLES when carried -- re-asking would spend a
   * record to learn what we already know. */
  const settledRows = await all<{ external_id: string }>(
    `SELECT DISTINCT external_id FROM coverage_item WHERE carried = 'carried'`,
  );
  const settledIds = new Set(settledRows.map((r) => r.external_id));
  let feedCount: number | null = null;
  let aborted = false;
  let abortReason: string | undefined;

  for (const day of days(opts.from, opts.to)) {
    if (calls >= COVERAGE.maxCallsPerRun) {
      aborted = true;
      abortReason =
        `Stopped at maxCallsPerRun: ${calls} of ${COVERAGE.maxCallsPerRun} calls. ` +
        `Remaining days were not queried, and their notices stay 'unchecked' rather than ` +
        `becoming misses.`;
      break;
    }
    let result: FeedResult;
    try {
      /* 🔴 THE PER-DAY BUDGET, AND IT IS NOT OPTIONAL HERE. Since the client
       * pages, ONE day can cost up to MAX_PAGES_PER_DAY * 100 records --
       * twenty-five times this whole run's record cap. Handing fetchDay the
       * budget that is actually left is what keeps `maxRecordsPerRun` a cap
       * on this run rather than a cap it discovers it has blown. `Math.max`
       * because `spent` can already sit at the cap on the loop's last
       * iteration, and a negative budget is not a smaller budget. */
      result = await client.fetchDay(
        day,
        opts.fetchImpl,
        undefined,
        undefined,
        Math.max(0, COVERAGE.maxRecordsPerRun - spent),
      );
    } catch (err) {
      /* 🔴 THE OPEN FINDING THIS CLOSES: a call that THROWS was still
       * BILLED. highergov-client.ts's two guards (a malformed 200, a
       * non-array "results") turn a leaky TypeError/SyntaxError into a
       * clean, redacted error -- they do not, and structurally cannot,
       * un-bill the call. Reaching this catch with nothing tallied is
       * exactly the under-report api-spend.ts's header (lines 9-24) calls
       * the dangerous direction: it is what lets an operator believe there
       * is budget left when there is not. We cannot know what this response
       * actually cost, so we tally the conservative figure
       * (thresholds.ts's `unparseableResponseRecords`) BEFORE the error
       * propagates, then let it propagate unchanged -- a malformed response
       * must still fail the run loudly, it just fails having recorded that
       * it spent something.
       *
       * 🔴 PLUS WHATEVER THE EARLIER PAGES OF THIS DAY ALREADY COST. A day
       * is several calls now: pages one to three can succeed and bill 300
       * records before page four throws. `unparseableResponseRecords` alone
       * -- a figure chosen when a day WAS exactly one call -- would tally 40
       * for that day, an under-report of 260 against a ceiling that cannot
       * be read back from the vendor. `recordsAlreadyBilled` returns 0 for
       * every error that carries no such figure, so the single-page case is
       * byte-identical to what it was before paging existed. */
      await recordSpend({ run: exec }, {
        sourceId: source.id,
        endpoint: "opportunity",
        records: COVERAGE.unparseableResponseRecords + recordsAlreadyBilled(err),
      });
      throw err;
    }
    calls += result.pagesFetched;

    /* THE TALLY COMMITS ON ITS OWN, BEFORE ANYTHING ELSE. The vendor has
     * already billed by the time fetchDay returns -- nothing after this
     * un-bills it. api-spend.ts's final review reversed the original
     * spec on exactly this point. */
    await recordSpend({ run: exec }, {
      sourceId: source.id,
      endpoint: "opportunity",
      records: result.records,
    });
    spent += result.records;
    if (feedCount === null) feedCount = result.feedCount;

    feed.push(...result.notices);

    /* 🔴 A HALF-BOUGHT DAY MUST NOT BE GRADED. Rows we never received are
     * indistinguishable downstream from rows HigherGov does not carry: they
     * become FALSE MISSES, the same defect the id-lookup guard below exists
     * to prevent. Refusing to grade is the safe direction.
     *
     * ⚖️ THE QUESTION CHANGED WHEN THE CLIENT LEARNED TO PAGE. This used to
     * be `result.pages > 1` -- "more than one page exists" -- because the
     * client could only ever read the first one, so those two facts were the
     * same fact. They are not any more: a three-page day the client bought
     * WHOLE is complete evidence and grades fine. What must still be refused
     * is a day the client came back SHORT on, whatever stopped it -- the
     * per-day record budget above, the hard page ceiling, or an empty page
     * mid-walk. `isPartialDay` is that question, asked in the one place it
     * is defined rather than re-derived here. */
    if (isPartialDay(result)) {
      aborted = true;
      abortReason =
        `Day ${day} came back PARTIAL: ${result.pagesFetched} of ${result.pages} page(s) ` +
        `fetched, so grading would count rows we never received as rows HigherGov does ` +
        `not carry. The per-day budget is what is left of maxRecordsPerRun ` +
        `(${COVERAGE.maxRecordsPerRun}) -- narrow the window, or raise that cap, and re-run.`;
      break;
    }

    /* 🔴 FIXED (post-review): this was `>`, while the per-key loop below uses
     * `>=` for the SAME constant -- at exactly maxRecordsPerRun they
     * disagreed about whether the cap had been reached. `>=` stops AT the
     * cap rather than one record past it, so it is the one kept in both
     * places. */
    if (spent >= COVERAGE.maxRecordsPerRun) {
      aborted = true;
      abortReason =
        `Stopped at maxRecordsPerRun: ${spent} of ${COVERAGE.maxRecordsPerRun} records. ` +
        `Remaining days were not queried, and their notices stay 'unchecked' rather than ` +
        `becoming misses.`;
      break;
    }
  }

  const { notices, collapsed } = dedupBySourceId(feed);

  /* 🔴 THE FALSE-MISS GUARD, AND THE RUN IS WRONG WITHOUT IT.
   *
   * fetchDay answers "what did you CAPTURE in this window", not "do you CARRY
   * this notice". Most of the answer key was captured before the window
   * opens, so treating window-absence as a miss would manufacture coverage
   * decay out of our own choice of dates -- the exact mirror of the
   * `unchecked`-counted-as-miss defect compare.ts guards against, and in the
   * direction that wrongly un-shelves the adapter backlog.
   *
   * Nearly free by construction: the meter counts records RETURNED
   * (CLAUDE.md §5.1), so a lookup for a notice they genuinely do not carry
   * returns nothing and bills nothing. It costs one record precisely when it
   * converts a false miss into a real find -- the case where we learn
   * something. */
  const found = new Map(notices.map((n) => [n.externalId, n]));
  const checkedIds = new Set<string>();

  if (!aborted) {
    for (const entry of key) {
      if (found.has(entry.externalId)) {
        checkedIds.add(entry.externalId);
        continue;
      }
      /* 🔴 FIXED (post-review, ruled by the controller): this used to fold
       * into the branch above -- `checkedIds.add(entry.externalId); continue;`
       * -- which added a settled id to `checkedIds` WITHOUT ever adding it to
       * `found`. `found` holds only THIS run's feed and THIS run's probes, and
       * `observe()` grades "not in feed AND in checked" as `missing`. So every
       * notice an earlier run had already settled as `carried` -- exactly the
       * notices this guard exists to avoid re-asking -- got written into
       * coverage_item as a MISS for a record we deliberately did not query,
       * once per run, forever. That is invariant 3 and invariant 4 violated
       * simultaneously by the same line. `continue` alone leaves the entry
       * `unchecked` for THIS run, which is what actually happened; the
       * earlier `carried` row still exists and gradedItems() still surfaces
       * it (informativeness-before-recency ordering). */
      if (settledIds.has(entry.externalId)) continue;
      if (spent >= COVERAGE.maxRecordsPerRun) {
        /* Out of budget. Everything still unresolved stays `unchecked` and is
         * re-asked next run -- which is what the accumulating cohort is for.
         * The cap is deliberately NOT raised here: it governs money, it ships
         * unratified, and raising it is Matt's ruling to make. */
        aborted = true;
        abortReason =
          `Stopped at maxRecordsPerRun: ${spent} of ${COVERAGE.maxRecordsPerRun} records. ` +
          `Unresolved notices stay 'unchecked' and are re-asked next run.`;
        break;
      }
      if (calls >= COVERAGE.maxCallsPerRun) {
        aborted = true;
        abortReason =
          `Stopped at maxCallsPerRun: ${calls} of ${COVERAGE.maxCallsPerRun} calls. ` +
          `Unresolved notices stay 'unchecked' and are re-asked next run.`;
        break;
      }
      let probe: FeedResult;
      try {
        probe = await client.fetchBySourceId(entry.externalId, opts.fetchImpl);
      } catch (err) {
        /* Same reasoning as the day-loop's try/catch above: this call was
         * billed before it could throw, so the conservative tally must land
         * before the error does, and the error must still propagate.
         *
         * `recordsAlreadyBilled` is here for symmetry only and is always 0
         * today: fetchBySourceId does NOT page (an exact-id lookup is one
         * row by construction -- highergov-client.ts's `get()`), so it can
         * never carry a part-billed figure. Written the same way as the day
         * loop's so that the day someone does page it, this site is already
         * honest rather than quietly 40 short. */
        await recordSpend({ run: exec }, {
          sourceId: source.id,
          endpoint: "opportunity",
          records: COVERAGE.unparseableResponseRecords + recordsAlreadyBilled(err),
        });
        throw err;
      }
      calls += 1;
      await recordSpend({ run: exec }, {
        sourceId: source.id,
        endpoint: "opportunity",
        records: probe.records,
      });
      spent += probe.records;
      checkedIds.add(entry.externalId);
      const hit = dedupBySourceId(probe.notices).notices[0];
      /* The probe is trusted to echo the id we asked for, and only that --
       * checked, not assumed. `observe()` re-keys off `n.externalId`, so an
       * unverified hit for a DIFFERENT id would produce a false `missing` for
       * this entry AND a spurious `carried` for whatever id it actually
       * carried. */
      if (hit && hit.externalId === entry.externalId) found.set(entry.externalId, hit);
    }
  }

  const observations: Observation[] = observe(key, [...found.values()], checkedIds);

  if (opts.failItemWriteForTest) {
    throw new Error("forced item-write failure (test only)");
  }

  const idoaSource = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
    IDOA_SOURCE_NAME,
  ]);

  for (const o of observations) {
    const entry = key.find((k) => k.externalId === o.externalId)!;
    await exec(
      `INSERT INTO coverage_item
         (run_id, external_id, segment, key_source_id, key_origin, key_seen_at,
          deadline, carried, captured_date, lead_days)
       VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9)`,
      [
        runId,
        o.externalId,
        o.segment,
        entry.keyOrigin === IDOA_SOURCE_NAME ? (idoaSource?.id ?? null) : null,
        entry.keyOrigin,
        entry.deadline,
        o.carried,
        o.capturedDate,
        o.leadDays,
      ],
    );
  }

  await exec(
    `UPDATE coverage_run
        SET records_spent = $2, duplicates_collapsed = $3, feed_count = $4,
            search_id = $5, aborted = $6, note = $7
      WHERE id = $1`,
    [
      runId,
      spent,
      collapsed,
      feedCount,
      process.env.HIGHERGOV_SEARCH_ID ?? null,
      aborted,
      abortReason ?? null,
    ],
  );

  return {
    runId,
    recordsSpent: spent,
    itemsObserved: observations.length,
    aborted,
    abortReason,
  };
}

/** Every settled observation ever recorded, for grading. The cohort
 * ACCUMULATES across runs (spec §5.5) and each notice is taken at its LATEST
 * observation -- a notice carried late must stop reading as a permanent miss
 * the moment it is finally carried. */
export async function gradedItems() {
  return all<{
    externalId: string;
    segment: "state_agency" | "sub_state";
    carried: "carried" | "missing" | "unchecked";
    leadDays: number | null;
  }>(
    `SELECT DISTINCT ON (ci.external_id)
            ci.external_id AS "externalId", ci.segment,
            ci.carried, ci.lead_days AS "leadDays"
       FROM coverage_item ci
       JOIN coverage_run cr ON cr.id = ci.run_id
      ORDER BY ci.external_id,
               /* carried beats missing beats unchecked, THEN newest. Once the
                * budget cap can leave a notice \`unchecked\`, ordering by
                * recency alone would let a later run OVERWRITE an earlier
                * \`carried\` with "we didn't look" -- a settled finding erased
                * by a budget stop, biasing C1/C2 toward decay. */
               CASE ci.carried WHEN 'carried' THEN 0 WHEN 'missing' THEN 1 ELSE 2 END,
               cr.run_at DESC`,
  );
}
