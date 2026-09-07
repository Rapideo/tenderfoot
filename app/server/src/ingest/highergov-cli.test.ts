import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vitest";
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
const { dryRun, projectWindow, assertValidDate, main } = await import("./highergov-cli.js");
const { MONTHLY_RECORD_CEILING } = await import("../extract/api-spend.js");
const { HIGHERGOV_SOURCE_NAME } = await import("../coverage/highergov-client.js");

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

/* A minimal WindowedAdapter for the day-walk tests -- deterministic items
 * (and an explicit vendor-billed count, independent of item count) per
 * captured_date, no network. `billedRecords` defaults to items.length but
 * can diverge from it -- adapters/highergov.ts's own comment: a row dropped
 * for a missing source_id is billed but excluded from both rows and
 * undatedSkipped, which is exactly what review round 3 item 5 exists to
 * stop this file from mis-tallying. */
function fakeAdapter(
  byDay: Record<string, { items: WindowedItem[]; billedRecords?: number }>,
): WindowedAdapter {
  return {
    shape: "windowed",
    name: HIGHERGOV_SOURCE_NAME,
    async fetchListing(since, until) {
      if (since !== until) {
        throw new Error(`test fakeAdapter expects since===until, got ${since}/${until}`);
      }
      const entry = byDay[since] ?? { items: [] };
      const billed = entry.billedRecords ?? entry.items.length;
      return {
        items: entry.items,
        undatedSkipped: 0,
        nextCursor: null,
        requestUrl: `fake:/opportunity/?captured_date=${since}`,
        httpStatus: 200,
        payload: JSON.stringify({ capturedDate: since, records: billed }),
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
