import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useTestSchema, resetSchema } from "../db/testdb.js";
import type { FeedNotice, HigherGovClient } from "../coverage/highergov-client.js";
import type { WindowedAdapter, WindowedItem } from "../scrape/adapter.js";

process.env.HIGHERGOV_API_KEY = "TESTKEYTESTKEYTESTKEYTESTKEY0000";
process.env.HIGHERGOV_SEARCH_ID = "TESTSEARCHID";

/* dryRun()'s own `remainingThisMonth` is measured against the REAL
 * MONTHLY_RECORD_CEILING (extract/api-spend.ts), and that module statically
 * imports db/index.ts, which THROWS at import time with no DATABASE_URL
 * (run.test.ts and api-spend.test.ts hit the same constant the same way).
 * main() also genuinely needs a database now (source lookup, resolveSource,
 * recordSpend, importArtifact), so this file uses a real (isolated) test
 * schema throughout, matching coverage/run.test.ts's and
 * extract/api-spend.test.ts's established pattern. */
useTestSchema("test_highergov_cli");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, one, run } = await import("../db/index.js");
const { dryRun, projectWindow, assertValidDate, assertValidPageSize, MAX_PAGE_SIZE, main } =
  await import("./highergov-cli.js");
const { MONTHLY_RECORD_CEILING } = await import("../extract/api-spend.js");
const { HIGHERGOV_SOURCE_NAME } = await import("../coverage/highergov-client.js");
/* The conservative "what could this call have cost when we cannot read its
 * response" bound, imported rather than retyped as 40 -- the same constant
 * coverage/run.ts and extract/fetch-documents-for.ts tally at their own
 * metered call sites, and the one this file now tallies at its two. */
const { COVERAGE } = await import("../coverage/thresholds.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);

beforeEach(async () => {
  await run(`DELETE FROM sighting`);
  await run(`DELETE FROM ingest_run`);
  await run(`DELETE FROM api_spend`);
  /* HigherGov is seeded enabled = false (migration 019) -- the same
   * disabled-by-default state production starts from. Tests that need the
   * day-walk to actually run flip it true themselves; every other test
   * exercises (or deliberately relies on) the real default. */
  await run(`UPDATE source SET enabled = false WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
});

afterEach(() => {
  /* main() sets process.exitCode = 1 on a partial (mid-walk-stop) run
   * (review round 3, item 6) -- a global Node property, not scoped to a
   * test. Left uncleared, a single test exercising that path would poison
   * vitest's own final exit code for the whole file (or worse, the whole
   * `npm run check` run) regardless of whether every assertion passed. */
  process.exitCode = undefined;
});

afterAll(async () => {
  await close();
});

/* HigherGovClient (coverage/highergov-client.ts) has a THIRD method,
 * fetchDocuments, that the brief's sketch omitted -- TypeScript would refuse
 * to structurally type this object as HigherGovClient without it. Added
 * here rather than loosening the annotation: dryRun's signature takes the
 * real interface, so the fake must satisfy the real interface. */
function clientReturning(records: number, pages = 1): HigherGovClient {
  return {
    async fetchDay() {
      return { notices: [], records, feedCount: records, pages };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchDocuments() {
      return { docs: [], records: 0 };
    },
  };
}

/* Unlike clientReturning, carries real notices -- needed once the day-walk
 * reuses the sample's OWN data for the sampled day (review round 3, item 4)
 * rather than re-fetching it: a test that wants to see the sampled day's
 * data actually imported needs the sample to carry something to import.
 * `recordsOverride` defaults to notices.length but can diverge from it, the
 * same way a real vendor response can (a row billed but dropped for a
 * missing source_id, highergov-client.ts's own documented gap). */
function clientWithNotices(notices: FeedNotice[], recordsOverride?: number, pages = 1): HigherGovClient {
  return {
    async fetchDay() {
      return { notices, records: recordsOverride ?? notices.length, feedCount: notices.length, pages };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchDocuments() {
      return { docs: [], records: 0 };
    },
  };
}

/* Records the exact arguments client.fetchDay was called with, so a test can
 * assert pageSize actually reached the call -- rather than merely trusting
 * the parsed FeedResult, which would stay identical either way. */
function clientCapturingFetchDayArgs(records: number): {
  client: HigherGovClient;
  calls: Array<[string, typeof fetch | undefined, number | undefined]>;
} {
  const calls: Array<[string, typeof fetch | undefined, number | undefined]> = [];
  const client: HigherGovClient = {
    async fetchDay(capturedDate, fetchImpl, pageSize) {
      calls.push([capturedDate, fetchImpl, pageSize]);
      return { notices: [], records, feedCount: records, pages: 1 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchDocuments() {
      return { docs: [], records: 0 };
    },
  };
  return { client, calls };
}

/* Proves the sample is never spent when there is nothing left to spend it
 * against, or when a free check upstream should have refused first:
 * fetchDay throws if it is ever called. */
function clientThatMustNotBeCalled(): HigherGovClient {
  return {
    async fetchDay() {
      throw new Error("fetchDay must not be called");
    },
    async fetchBySourceId() {
      throw new Error("fetchBySourceId must not be called");
    },
    async fetchDocuments() {
      throw new Error("fetchDocuments must not be called");
    },
  };
}

/* A client whose fetchDay throws the way highergov-client.ts's own two
 * guards do -- AFTER the vendor has already billed the response it could not
 * parse. Neither guard makes the call free, and that client's own comment
 * says so explicitly. */
function clientThatThrowsAfterBilling(): HigherGovClient {
  return {
    async fetchDay() {
      throw new Error('HigherGov returned a non-array "results" field (got object)');
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchDocuments() {
      return { docs: [], records: 0 };
    },
  };
}

/* A minimal WindowedAdapter for the day-walk tests -- deterministic items
 * (and an explicit vendor-billed count, independent of item count) per
 * captured_date, no network. `billedRecords` defaults to items.length but
 * can diverge from it -- adapters/highergov.ts's own comment: a row dropped
 * for a missing source_id is billed but excluded from both rows and
 * undatedSkipped, which is exactly what review round 3 item 5 exists to
 * stop this file from mis-tallying.
 *
 * `throws` makes a given day fail the way the real adapter can: HigherGov's
 * client throws on a truncated 200 or a non-array `results` AFTER the vendor
 * has billed. `omitBilledRecords` writes an envelope with no `records` field
 * at all -- the shape billedRecordsFromArtifact's fallback path exists for. */
function fakeAdapter(
  byDay: Record<
    string,
    {
      items: WindowedItem[];
      billedRecords?: number;
      throws?: boolean;
      omitBilledRecords?: boolean;
    }
  >,
): WindowedAdapter {
  return {
    shape: "windowed",
    name: HIGHERGOV_SOURCE_NAME,
    async fetchListing(since, until) {
      if (since !== until) {
        throw new Error(`test fakeAdapter expects since===until, got ${since}/${until}`);
      }
      const entry = byDay[since] ?? { items: [] };
      if (entry.throws) {
        throw new Error('HigherGov returned a non-array "results" field (got object)');
      }
      const billed = entry.billedRecords ?? entry.items.length;
      return {
        items: entry.items,
        undatedSkipped: 0,
        nextCursor: null,
        requestUrl: `fake:/opportunity/?captured_date=${since}`,
        httpStatus: 200,
        payload: entry.omitBilledRecords
          ? JSON.stringify({ capturedDate: since })
          : JSON.stringify({ capturedDate: since, records: billed }),
      };
    },
  };
}

function tempRunsDir(): string {
  return mkdtempSync(join(tmpdir(), "tf-highergov-cli-"));
}

async function totalSpend(): Promise<number> {
  const row = await one<{ total: string | null }>(
    `SELECT sum(sp.records)::text AS total FROM api_spend sp
       JOIN source s ON s.id = sp.source_id WHERE s.name = $1`,
    [HIGHERGOV_SOURCE_NAME],
  );
  return Number(row!.total ?? 0);
}

/* 🔴 R5's "5 records for one day" is ONE OBSERVATION ON ONE DAY
 * (Proto2PRD-Lessons §2.15). At 15/day a 90-day backfill is 1,350 records
 * and the ceiling refuses partway, leaving a half-loaded window. The dry
 * run costs ~5 records and turns the guess into a measurement. */
test("the projection is the sampled day's rate times the window", () => {
  expect(projectWindow(5, 90)).toBe(450);
  expect(projectWindow(15, 90)).toBe(1350);
});

test("a window that fits is affordable", async () => {
  const r = await dryRun("2026-09-01", "2026-09-30", clientReturning(5), 0);
  expect(r.windowDays).toBe(30);
  expect(r.projectedRecords).toBe(150);
  expect(r.affordable).toBe(true);
  expect(r.sampled).toBe(true);
});

/* 🔴 REFUSING IS THE POINT. Discovering mid-run that the ceiling is
 * exhausted leaves a half-loaded window and a spend nobody planned. */
test("a window that would cross the ceiling is refused before spending", async () => {
  const r = await dryRun("2026-01-01", "2026-12-31", clientReturning(15), 0);
  expect(r.affordable).toBe(false);
  expect(r.projectedRecords).toBeGreaterThan(r.remainingThisMonth);
});

test("spend already made this month reduces what is affordable", async () => {
  const generous = await dryRun("2026-09-01", "2026-09-30", clientReturning(5), 0);
  const tight = await dryRun("2026-09-01", "2026-09-30", clientReturning(5), 900);
  expect(generous.affordable).toBe(true);
  expect(tight.affordable).toBe(false);
});

test("no allowance remains at all -- refuses before even sampling", async () => {
  const atCeiling = await dryRun(
    "2026-09-01",
    "2026-09-30",
    clientThatMustNotBeCalled(),
    MONTHLY_RECORD_CEILING,
  );
  expect(atCeiling.sampled).toBe(false);
  expect(atCeiling.recordsThatDay).toBe(0);
  expect(atCeiling.affordable).toBe(false);

  const overCeiling = await dryRun(
    "2026-09-01",
    "2026-09-30",
    clientThatMustNotBeCalled(),
    MONTHLY_RECORD_CEILING + 50,
  );
  expect(overCeiling.sampled).toBe(false);
  expect(overCeiling.affordable).toBe(false);
});

test("remainingThisMonth accounts for the sample's own just-incurred cost", async () => {
  const sampleRate = 5;
  const alreadySpent = MONTHLY_RECORD_CEILING - sampleRate;
  const r = await dryRun("2026-09-01", "2026-09-01", clientReturning(sampleRate), alreadySpent);
  expect(r.remainingThisMonth).toBe(0);
  expect(r.projectedRecords).toBe(5);
  expect(r.affordable).toBe(false);
});

test("a truncated sample day carries its page count forward", async () => {
  const r = await dryRun("2026-09-01", "2026-09-05", clientReturning(5, 3), 0);
  expect(r.samplePages).toBe(3);
});

test("an untruncated sample day carries pages: 1", async () => {
  const r = await dryRun("2026-09-01", "2026-09-05", clientReturning(5, 1), 0);
  expect(r.samplePages).toBe(1);
});

/* Review round 3, item 2: a zero-record sample must not look "free forever".
 * projectWindow(0, N) is 0 for any N, so the naive `projected <= remaining`
 * check would call ANY window length affordable. dryRun() must refuse to
 * extrapolate a rate from an unmeasured (zero) day instead. */
test("a zero-record sample refuses to project, rather than looking free forever", async () => {
  const r = await dryRun("2026-01-01", "2026-12-31", clientReturning(0), 0);
  expect(r.sampled).toBe(true);
  expect(r.recordsThatDay).toBe(0);
  expect(r.projectedRecords).toBe(0);
  expect(r.affordable).toBe(false);
});

/* Both calendar traps spec §7/coverage-cli.ts's own header name BY NAME.
 * Pinned here rather than held in place only by pasted terminal output that
 * no future change re-runs. */
test("a shape-invalid date is rejected -- the regex-only trap", () => {
  expect(() => assertValidDate("from", "2026-13-01")).toThrow(/not a real .* calendar date/);
});

test("a shape-valid but nonexistent date is rejected -- the Date.parse rollover trap", () => {
  /* Date.parse alone rolls "2026-02-30" forward to March 2nd rather than
   * rejecting it -- exactly the case the round-trip check exists for. */
  expect(() => assertValidDate("from", "2026-02-30")).toThrow(/not a real .* calendar date/);
});

/* Change 1: page_size is an explicit, opt-in knob. Every one of these must
 * be refused BEFORE any call is made -- assertValidPageSize is a pure
 * function, so "before any call" is true by construction here, and main()'s
 * own tests below prove it holds at the command level too. */
test("a non-integer page size is rejected", () => {
  expect(() => assertValidPageSize("abc")).toThrow(/positive integer/);
});

test("a decimal page size is rejected -- it must be a whole number", () => {
  expect(() => assertValidPageSize("3.5")).toThrow(/positive integer/);
});

test("a zero page size is rejected", () => {
  expect(() => assertValidPageSize("0")).toThrow(/positive integer/);
});

test("a negative page size is rejected", () => {
  expect(() => assertValidPageSize("-5")).toThrow(/positive integer/);
});

/* The message must name the COST consequence, not just say "invalid" --
 * billing is per record returned, and this is the guard that keeps an
 * absurd value from turning into an absurd bill. */
test("an absurdly large page size is rejected, naming the cost consequence", () => {
  expect(() => assertValidPageSize(String(MAX_PAGE_SIZE + 1))).toThrow(/does NOT reduce spend/);
});

test("a page size at or under the cap is accepted and parsed", () => {
  expect(assertValidPageSize("10")).toBe(10);
  expect(assertValidPageSize(String(MAX_PAGE_SIZE))).toBe(MAX_PAGE_SIZE);
});

/* 🔴 THE TEST THAT STOPS page_size FROM SILENTLY TRIPLING SPEND, at the
 * dryRun() level: an explicit pageSize must actually reach client.fetchDay,
 * and OMITTING it must leave the call exactly as it was before this
 * parameter existed (`undefined`, not some default the client would then
 * have to special-case). coverage/highergov-client.test.ts proves the same
 * thing one layer down, on the wire itself. */
test("dryRun threads an explicit pageSize through to client.fetchDay", async () => {
  const { client, calls } = clientCapturingFetchDayArgs(5);
  await dryRun("2026-09-01", "2026-09-01", client, 0, 42);
  expect(calls).toHaveLength(1);
  expect(calls[0]![2]).toBe(42);
});

test("dryRun sends no pageSize when none is given -- Change 1's default is inert", async () => {
  const { client, calls } = clientCapturingFetchDayArgs(5);
  await dryRun("2026-09-01", "2026-09-01", client, 0);
  expect(calls).toHaveLength(1);
  expect(calls[0]![2]).toBeUndefined();
});

/* main()-LEVEL PROOF that an invalid --page-size never reaches even the
 * source lookup, let alone the sample -- HigherGov is disabled by default
 * here too (beforeEach), same as the test right below, and
 * clientThatMustNotBeCalled() proves fetchDay is never invoked. If page-size
 * validation ran any later than it does, this would fail with a "disabled"
 * message instead of the page-size one. */
test("main() refuses a non-integer --page-size before any call is made", async () => {
  await expect(
    main(
      ["--from=2026-09-01", "--to=2026-09-02", "--page-size=abc"],
      clientThatMustNotBeCalled(),
      fakeAdapter({}),
    ),
  ).rejects.toThrow(/positive integer/);
  expect(await totalSpend()).toBe(0);
});

test("main() refuses an absurdly large --page-size before any call is made", async () => {
  await expect(
    main(
      ["--from=2026-09-01", "--to=2026-09-02", `--page-size=${MAX_PAGE_SIZE + 1}`],
      clientThatMustNotBeCalled(),
      fakeAdapter({}),
    ),
  ).rejects.toThrow(/does NOT reduce spend/);
  expect(await totalSpend()).toBe(0);
});

/* Review round 3, item 3 (CRITICAL regression from round 1): resolveSource()
 * used to run only in the committing branch, AFTER the sample billed.
 * HigherGov is disabled by default (beforeEach, matching the real seed) --
 * this is the test that does NOT flip it true first, which is exactly what
 * the review named as missing. clientThatMustNotBeCalled() proves the free
 * check fires before the one call that is not free: if the sample had run
 * first, this would throw from inside fetchDay instead of from
 * resolveSource, and the spend total below would be nonzero instead of 0. */
test("a disabled source is refused before the sample spends anything", async () => {
  await expect(
    main(["--from=2026-09-01", "--to=2026-09-30"], clientThatMustNotBeCalled(), fakeAdapter({})),
  ).rejects.toThrow(/disabled/i);
  expect(await totalSpend()).toBe(0);
});

/* Review round 3, item 1 (CRITICAL): the metered refusal itself now lives in
 * resolve-source.ts, not here -- but this file is the one caller that opts
 * in, and this test proves an ENABLED, otherwise-affordable run still
 * reaches the sample and the walk (i.e. meteredAllowed: true actually took
 * effect, this is not accidentally refused for the wrong reason). */
test("recordSpend fires before the refusal, not only on the affordable path", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  await expect(
    main(
      ["--from=2026-01-01", "--to=2026-12-31"],
      clientReturning(15), // 15/day * 365 days is nowhere near affordable
      fakeAdapter({}),
    ),
  ).rejects.toThrow(/Refusing/);
  expect(await totalSpend()).toBe(15);
});

/* Review round 3, item 2, at the main() level: a zero-record sample must
 * refuse before the day-walk, not merely inside dryRun() in isolation. The
 * adapter throws if the walk ever reaches it. */
test("main() refuses a zero-record sample rather than silently loading a huge window", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  /* Deliberately NOT phrased like the refusal main() itself throws (no
   * "zero-record"/"0 records" wording) -- a mutation test caught an earlier
   * version of this fixture accidentally satisfying its own assertion via
   * this message, which would have passed even with the guard removed. */
  const throwingAdapter: WindowedAdapter = {
    shape: "windowed",
    name: HIGHERGOV_SOURCE_NAME,
    async fetchListing() {
      throw new Error("TEST FAILURE: the day-walk reached the adapter at all");
    },
  };
  await expect(
    main(["--from=2026-01-01", "--to=2026-12-31"], clientReturning(0), throwingAdapter),
  ).rejects.toThrow(/zero-record sample|0 records/i);
  expect(await totalSpend()).toBe(0);
});

/* --dry-run must stop BEFORE committing: the day-walk's own adapter must
 * never be reached. Proven two ways -- the adapter throws if ever called,
 * and api_spend ends up with only the one sample, not multiple days'
 * worth. Uses a multi-day window specifically so a day-walk that ran
 * anyway would be visible in either signal. */
test("--dry-run stops before committing -- the day-walk is never reached", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  const throwingAdapter: WindowedAdapter = {
    shape: "windowed",
    name: HIGHERGOV_SOURCE_NAME,
    async fetchListing() {
      throw new Error("the day-walk must not run under --dry-run");
    },
  };

  await main(
    ["--from=2026-09-01", "--to=2026-09-05", "--dry-run"],
    clientReturning(5),
    throwingAdapter,
  );

  expect(await totalSpend()).toBe(5); // the sample only -- no day-walk spend
  const ingestRuns = await all(`SELECT id FROM ingest_run`);
  expect(ingestRuns.length).toBe(0); // nothing was ever imported
  expect(process.exitCode).toBeUndefined(); // a clean stop, not a partial run
});

/* THE DAY-WALK ITSELF, including review round 3, item 4: the sampled day
 * (2026-09-01) is loaded from the SAMPLE's own data (clientWithNotices),
 * never re-fetched through the adapter -- fakeAdapter below carries only
 * day two's items, and if the walk tried to re-fetch day one through it,
 * that day would come back empty and HG-1 would never land in `sighting`.
 * The spend total (3, not 4) is the other half of the same proof: one
 * sample + one real day two, not two full days plus a redundant sample. */
test("committing an affordable window walks every day and imports what it finds", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  const dir = tempRunsDir();
  try {
    const client = clientWithNotices(
      [{ externalId: "HG-1", capturedDate: "2026-09-01", versionKey: null, title: null, raw: { a: 1 } }],
      1,
    );
    const adapter = fakeAdapter({
      "2026-09-02": {
        items: [
          { externalId: "HG-2", modifiedAt: "2026-09-02", raw: { a: 2 } },
          { externalId: "HG-3", modifiedAt: "2026-09-02", raw: { a: 3 } },
        ],
      },
    });

    await main(["--from=2026-09-01", "--to=2026-09-02"], client, adapter, dir);

    /* 1 (the sample, reused for day one -- NOT billed again) + 2 (day two,
     * fetched for real) = 3. Round 2's shape would have made this 4. */
    expect(await totalSpend()).toBe(3);

    const sightings = await all<{ external_id: string }>(
      `SELECT sg.external_id FROM sighting sg
         JOIN source s ON s.id = sg.source_id WHERE s.name = $1 ORDER BY sg.external_id`,
      [HIGHERGOV_SOURCE_NAME],
    );
    expect(sightings.map((s) => s.external_id)).toEqual(["HG-1", "HG-2", "HG-3"]);

    const ingestRuns = await all(`SELECT id FROM ingest_run`);
    expect(ingestRuns.length).toBe(2); // one artifact per day, including the reused day
    expect(process.exitCode).toBeUndefined(); // complete, not partial
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* Review round 3, item 5: the per-day spend must come from the artifact's
 * own billed count, not rows + undatedSkipped. Day two's fakeAdapter entry
 * bills 7 despite carrying only 1 item -- the exact shape
 * adapters/highergov.ts's own comment names (a row dropped for a missing
 * source_id is billed but excluded from both counters). If this file fell
 * back to rows + undatedSkipped, day two would tally 1, not 7. */
test("per-day spend is read from the artifact's billed count, not rows + undatedSkipped", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  const dir = tempRunsDir();
  try {
    const client = clientWithNotices(
      [{ externalId: "HG-S", capturedDate: "2026-09-01", versionKey: null, title: null, raw: {} }],
      1,
    );
    const adapter = fakeAdapter({
      "2026-09-02": {
        items: [{ externalId: "HG-D2", modifiedAt: "2026-09-02", raw: {} }],
        billedRecords: 7,
      },
    });

    await main(["--from=2026-09-01", "--to=2026-09-02"], client, adapter, dir);

    /* 1 (sample) + 7 (day two's BILLED count, not its 1 item) = 8. */
    expect(await totalSpend()).toBe(8);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* Stopping BEFORE the call that would cross the ceiling, mid-walk. Day one
 * (the sample, reused, 5 records) cannot itself run ahead of its own
 * estimate by construction -- so the realistic R5 risk (a day's REAL cost
 * exceeding the sampled rate) is exercised on day TWO, whose fakeAdapter
 * entry bills far more than the 5/day the sample measured. alreadySpent is
 * seeded so the window total (sample + 3 days at the sampled rate = 20) is
 * EXACTLY affordable up front, but day two alone spends three times its
 * estimated share, leaving nothing for day three. */
test("the day-walk stops before the call that would cross the ceiling", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  const dir = tempRunsDir();
  try {
    const sampleRate = 5;
    const windowDays = 3;
    const client = clientWithNotices(
      Array.from({ length: sampleRate }, (_, i) => ({
        externalId: `HG-S-${i}`,
        capturedDate: "2026-09-01",
        versionKey: null,
        title: null,
        raw: {},
      })),
      sampleRate,
    );
    const day2Items = Array.from({ length: 15 }, (_, i) => ({
      externalId: `HG-D2-${i}`,
      modifiedAt: "2026-09-02",
      raw: {},
    }));
    const adapter = fakeAdapter({
      "2026-09-02": { items: day2Items },
      "2026-09-03": { items: [{ externalId: "HG-D3", modifiedAt: "2026-09-03", raw: {} }] },
    });
    /* Exactly enough for the sample plus the WHOLE window at the sampled
     * rate (5 + 5*3 = 20) -- the top-level affordability check passes. */
    const alreadySpent = MONTHLY_RECORD_CEILING - sampleRate * (windowDays + 1);

    const src = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
      HIGHERGOV_SOURCE_NAME,
    ]);
    await run(
      `INSERT INTO api_spend (source_id, endpoint, records) VALUES ($1, 'opportunity', $2)`,
      [src!.id, alreadySpent],
    );

    await main(["--from=2026-09-01", "--to=2026-09-03"], client, adapter, dir);

    const ingestRuns = await all(`SELECT id FROM ingest_run`);
    /* Day one (reused sample) and day two (real, over-budget) both commit;
     * the walk must stop before attempting day three. */
    expect(ingestRuns.length).toBe(2);

    const sightings = await all<{ external_id: string }>(`SELECT external_id FROM sighting`);
    expect(sightings.length).toBe(sampleRate + 15); // day one's 5 + day two's 15
    expect(sightings.some((s) => s.external_id === "HG-D3")).toBe(false);

    /* A partial window must not exit 0 -- review round 3, item 6. */
    expect(process.exitCode).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* 🔴 FINAL REVIEW, FIX 1 (CRITICAL) -- THE MANDATORY SPEND THAT COULD VANISH.
 *
 * The dry run's sample is the one unavoidable call this command makes: it
 * runs on every invocation, --dry-run included, and its cost is recorded in
 * main() AFTER dryRun returns. `client.fetchDay` had no try/catch, so a throw
 * that happened AFTER the vendor billed -- highergov-client.ts guards two
 * such cases by name, a truncated 200 and a non-array `results`, and its own
 * comment says neither "makes the call free" -- skipped that recordSpend
 * entirely. ~5 records billed, no api_spend row, and a remaining-allowance
 * figure wrong in the reassuring direction, which is the one direction
 * CLAUDE.md §5.1 calls dangerous.
 *
 * The error must still propagate unchanged: a malformed response fails the
 * run loudly, it just fails having recorded that it spent something. */
test("a sample that throws after the vendor billed still writes a conservative spend row", async () => {
  await expect(
    dryRun("2026-09-01", "2026-09-30", clientThatThrowsAfterBilling(), 0),
  ).rejects.toThrow(/non-array "results"/);

  const rows = await all<{ records: number; endpoint: string }>(
    `SELECT sp.records, sp.endpoint FROM api_spend sp
       JOIN source s ON s.id = sp.source_id WHERE s.name = $1`,
    [HIGHERGOV_SOURCE_NAME],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]!.endpoint).toBe("opportunity");
  /* We cannot know what an unparseable response cost, so the conservative
   * upper bound is tallied -- the same figure, from the same constant, that
   * coverage/run.ts and extract/fetch-documents-for.ts use for exactly this
   * question at their own metered call sites. */
  expect(rows[0]!.records).toBe(COVERAGE.unparseableResponseRecords);
});

/* The same fix reached through main(), which is the path that actually runs
 * in production: the sample throws before main() ever gets to its own
 * recordSpend, and the tally must already be there. */
test("main() leaves a spend row behind when the dry run's own sample throws", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  await expect(
    main(
      ["--from=2026-09-01", "--to=2026-09-02"],
      clientThatThrowsAfterBilling(),
      fakeAdapter({}),
    ),
  ).rejects.toThrow(/non-array "results"/);
  expect(await totalSpend()).toBe(COVERAGE.unparseableResponseRecords);
});

/* 🔴 FINAL REVIEW, FIX 1 -- THE SAME CLASS AT THE DAY LOOP. runScrape does
 * not catch what the adapter throws (its loop is try/finally, no catch), so a
 * malformed response on day two propagated straight past recordSpend and took
 * the run down having recorded nothing for a day the vendor already billed.
 *
 * The total is the discriminator: 1 (the sample, recorded normally) + the
 * conservative bound for the failed day. Without the fix it is 1. */
test("a day-walk call that throws still writes a conservative spend row before failing", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  const dir = tempRunsDir();
  try {
    const client = clientWithNotices(
      [{ externalId: "HG-S", capturedDate: "2026-09-01", versionKey: null, title: null, raw: {} }],
      1,
    );
    const adapter = fakeAdapter({ "2026-09-02": { items: [], throws: true } });

    await expect(
      main(["--from=2026-09-01", "--to=2026-09-02"], client, adapter, dir),
    ).rejects.toThrow(/non-array "results"/);

    expect(await totalSpend()).toBe(1 + COVERAGE.unparseableResponseRecords);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* 🔴 FINAL REVIEW, FIX 2 -- THE FALLBACK NOW POINTS THE WAY ITS OWN COMMENT
 * ARGUES. billedRecordsFromArtifact reads the vendor's billed count out of
 * the artifact envelope; when the envelope carries no `records` field it used
 * to fall back to `rows + undatedSkipped`, which is a FLOOR on what was
 * billed, not an estimate of it -- the under-counting direction the very
 * comment above it calls "worse". It now falls back UP, to the same
 * conservative bound the two throw paths use.
 *
 * Day two carries one item and an envelope with no `records`. Old behaviour:
 * 1 (sample) + 1 = 2. Fixed: 1 + max(1, 40) = 41. */
test("an artifact with no billed count falls back UP to the conservative bound, never down", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  const dir = tempRunsDir();
  try {
    const client = clientWithNotices(
      [{ externalId: "HG-S", capturedDate: "2026-09-01", versionKey: null, title: null, raw: {} }],
      1,
    );
    const adapter = fakeAdapter({
      "2026-09-02": {
        items: [{ externalId: "HG-D2", modifiedAt: "2026-09-02", raw: {} }],
        omitBilledRecords: true,
      },
    });

    await main(["--from=2026-09-01", "--to=2026-09-02"], client, adapter, dir);

    expect(await totalSpend()).toBe(1 + COVERAGE.unparseableResponseRecords);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* 🔴 THIS REVIEW, FIX 2 -- THE TALLY ITSELF MUST NOT REPLACE THE ERROR IT
 * EXISTS TO RECORD. Both catches above tally a conservative spend before
 * rethrowing the vendor's own error -- but `one()` and `recordSpend` are
 * themselves a database round trip, and can throw too (a degraded compute,
 * per CLAUDE.md §4's own "Connection terminated unexpectedly"). Unguarded,
 * that second throw would silently replace the vendor's "non-array results"
 * with a database error before `throw err` ever ran -- the ledger is
 * unaffected either way (no row is written in either case), but the
 * operator loses the one diagnostic that explains why records were billed
 * for nothing.
 *
 * A trigger that fails ONLY on the conservative-bound value (not on an
 * ordinary spend) simulates the tally itself failing without disturbing the
 * legitimate recordSpend calls this file also makes on the success path --
 * a blunt "rename the table away" would have broken those too and proven
 * nothing about this specific guard. */
async function withFailingSpendTally<T>(fn: () => Promise<T>): Promise<T> {
  await run(`
    CREATE OR REPLACE FUNCTION test_fail_conservative_spend() RETURNS trigger AS $BODY$
    BEGIN
      IF NEW.records = ${COVERAGE.unparseableResponseRecords} THEN
        RAISE EXCEPTION 'simulated spend-tally failure for test';
      END IF;
      RETURN NEW;
    END;
    $BODY$ LANGUAGE plpgsql;
  `);
  await run(`
    CREATE TRIGGER test_fail_conservative_spend_trigger
    BEFORE INSERT ON api_spend
    FOR EACH ROW EXECUTE FUNCTION test_fail_conservative_spend();
  `);
  try {
    return await fn();
  } finally {
    await run(`DROP TRIGGER IF EXISTS test_fail_conservative_spend_trigger ON api_spend`);
    await run(`DROP FUNCTION IF EXISTS test_fail_conservative_spend()`);
  }
}

test("the sample's own vendor error survives even when the spend tally itself throws", async () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await withFailingSpendTally(async () => {
      await expect(
        dryRun("2026-09-01", "2026-09-30", clientThatThrowsAfterBilling(), 0),
      ).rejects.toThrow(/non-array "results"/);
    });

    /* No row: the simulated tally failure rolled its own INSERT back, exactly
     * as a real one would. */
    const rows = await all<{ records: number }>(
      `SELECT sp.records FROM api_spend sp JOIN source s ON s.id = sp.source_id WHERE s.name = $1`,
      [HIGHERGOV_SOURCE_NAME],
    );
    expect(rows).toHaveLength(0);

    /* The tally's own failure must still be surfaced somewhere -- silently
     * dropping it entirely would just be a quieter version of the same
     * defect. */
    expect(errorSpy).toHaveBeenCalled();
  } finally {
    errorSpy.mockRestore();
  }
});

test("a day-walk's vendor error survives even when its own spend tally throws", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  const dir = tempRunsDir();
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const client = clientWithNotices(
      [{ externalId: "HG-S", capturedDate: "2026-09-01", versionKey: null, title: null, raw: {} }],
      1,
    );
    const adapter = fakeAdapter({ "2026-09-02": { items: [], throws: true } });

    await withFailingSpendTally(async () => {
      await expect(
        main(["--from=2026-09-01", "--to=2026-09-02"], client, adapter, dir),
      ).rejects.toThrow(/non-array "results"/);
    });

    /* The sample's own (non-conservative) spend still committed normally --
     * only the day-walk's conservative tally for day two hit the trigger. */
    expect(await totalSpend()).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
  } finally {
    errorSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  }
});
