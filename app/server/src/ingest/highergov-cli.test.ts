import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useTestSchema, resetSchema } from "../db/testdb.js";
import type { HigherGovClient } from "../coverage/highergov-client.js";
import type { WindowedAdapter, WindowedItem } from "../scrape/adapter.js";

process.env.HIGHERGOV_API_KEY = "TESTKEYTESTKEYTESTKEYTESTKEY0000";
process.env.HIGHERGOV_SEARCH_ID = "TESTSEARCHID";

/* dryRun()'s own `remainingThisMonth` is measured against the REAL
 * MONTHLY_RECORD_CEILING (extract/api-spend.ts), and that module statically
 * imports db/index.ts, which THROWS at import time with no DATABASE_URL
 * (run.test.ts and api-spend.test.ts hit the same constant the same way).
 * main() also genuinely needs a database now (source lookup, recordSpend,
 * the day-walk's resolveSource/importArtifact) -- useTestSchema() + a real
 * migrate() give every test below a clean, isolated schema. */
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
  await run(`UPDATE source SET enabled = false WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
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

/* Proves the sample is never spent when there is nothing left to spend it
 * against: fetchDay throws if it is ever called. */
function clientThatMustNotBeCalled(): HigherGovClient {
  return {
    async fetchDay() {
      throw new Error("fetchDay must not be called -- no allowance remained");
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
 * per captured_date, no network, mirrors adapters/highergov.ts's own
 * fetchListing contract (since === until, nextCursor always null). */
function fakeAdapter(itemsByDay: Record<string, WindowedItem[]>): WindowedAdapter {
  return {
    shape: "windowed",
    name: HIGHERGOV_SOURCE_NAME,
    async fetchListing(since, until) {
      if (since !== until) {
        throw new Error(`test fakeAdapter expects since===until, got ${since}/${until}`);
      }
      const items = itemsByDay[since] ?? [];
      return {
        items,
        undatedSkipped: 0,
        nextCursor: null,
        requestUrl: `fake:/opportunity/?captured_date=${since}`,
        httpStatus: 200,
        payload: JSON.stringify({ capturedDate: since, records: items.length }),
      };
    },
  };
}

function tempRunsDir(): string {
  return mkdtempSync(join(tmpdir(), "tf-highergov-cli-"));
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

/* Review round 2, item 3 (first bullet): with zero or negative allowance
 * left, dryRun() must refuse BEFORE spending even the sample -- sampling to
 * prove there is no budget left would itself spend against a budget that is
 * already gone. clientThatMustNotBeCalled() proves the network call never
 * happens: if it did, the test would throw from inside fetchDay. */
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

/* Review round 2, item 3 (second bullet): `remainingThisMonth` used to be
 * computed from `spent` BEFORE the sample billed, overstating headroom by
 * exactly the sample's own cost. With alreadySpent set so that
 * `MONTHLY_RECORD_CEILING - alreadySpent` equals exactly the sample's own
 * rate, the TRUE remaining after the sample is 0 -- proving the sample's
 * cost is actually subtracted, not merely implied by the projection, and
 * that a single-day window projecting exactly the sample's own cost is
 * correctly judged unaffordable against zero remaining headroom. */
test("remainingThisMonth accounts for the sample's own just-incurred cost", async () => {
  const sampleRate = 5;
  const alreadySpent = MONTHLY_RECORD_CEILING - sampleRate;
  const r = await dryRun("2026-09-01", "2026-09-01", clientReturning(sampleRate), alreadySpent);
  expect(r.remainingThisMonth).toBe(0);
  expect(r.projectedRecords).toBe(5);
  expect(r.affordable).toBe(false);
});

/* The dry run pays for `pages` and used to discard it. >1 means the SAMPLE
 * itself was truncated -- the measured rate is a floor, not the true rate. */
test("a truncated sample day carries its page count forward", async () => {
  const r = await dryRun("2026-09-01", "2026-09-05", clientReturning(5, 3), 0);
  expect(r.samplePages).toBe(3);
});

test("an untruncated sample day carries pages: 1", async () => {
  const r = await dryRun("2026-09-01", "2026-09-05", clientReturning(5, 1), 0);
  expect(r.samplePages).toBe(1);
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

/* Review round 2, item 4: main() is exported with zero coverage. This test
 * proves the ordering self-review claimed: the dry run's own spend is
 * recorded even on the path that ends in refusal, because the vendor
 * billed the moment the sample's fetchDay() returned -- nothing downstream
 * un-bills it, including a thrown refusal. */
test("recordSpend fires before the refusal, not only on the affordable path", async () => {
  await expect(
    main(
      ["--from=2026-01-01", "--to=2026-12-31"],
      clientReturning(15), // 15/day * 365 days is nowhere near affordable
      fakeAdapter({}),
    ),
  ).rejects.toThrow(/Refusing/);

  const spend = await one<{ total: string | null }>(
    `SELECT sum(sp.records)::text AS total FROM api_spend sp
       JOIN source s ON s.id = sp.source_id WHERE s.name = $1`,
    [HIGHERGOV_SOURCE_NAME],
  );
  expect(Number(spend!.total)).toBe(15);
});

/* --dry-run must stop BEFORE committing: the day-walk's own adapter must
 * never be reached. Proven two ways -- the adapter throws if ever called,
 * and api_spend ends up with only the one sample, not multiple days'
 * worth. Uses a multi-day window specifically so a day-walk that ran
 * anyway would be visible in either signal. */
test("--dry-run stops before committing -- the day-walk is never reached", async () => {
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

  const spend = await one<{ total: string | null }>(
    `SELECT sum(sp.records)::text AS total FROM api_spend sp
       JOIN source s ON s.id = sp.source_id WHERE s.name = $1`,
    [HIGHERGOV_SOURCE_NAME],
  );
  expect(Number(spend!.total)).toBe(5); // the sample only -- no day-walk spend
  const ingestRuns = await all(`SELECT id FROM ingest_run`);
  expect(ingestRuns.length).toBe(0); // nothing was ever imported
});

/* THE DAY-WALK ITSELF. Proves committing the window (a) resolves and uses
 * the source registry (so a disabled source is still refused -- enabled is
 * flipped true here deliberately, the one test that needs it), (b) walks
 * every day in the window with since===until, (c) tallies real per-day
 * spend on top of the sample, and (d) actually imports sightings -- the
 * thing ruling ②'s 90-day backfill has no other executor for anywhere in
 * this slice. */
test("committing an affordable window walks every day and imports what it finds", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  const dir = tempRunsDir();
  try {
    const adapter = fakeAdapter({
      "2026-09-01": [{ externalId: "HG-1", modifiedAt: "2026-09-01", raw: { a: 1 } }],
      "2026-09-02": [
        { externalId: "HG-2", modifiedAt: "2026-09-02", raw: { a: 2 } },
        { externalId: "HG-3", modifiedAt: "2026-09-02", raw: { a: 3 } },
      ],
    });

    await main(
      ["--from=2026-09-01", "--to=2026-09-02"],
      clientReturning(1),
      adapter,
      dir,
    );

    const spend = await one<{ total: string | null }>(
      `SELECT sum(sp.records)::text AS total FROM api_spend sp
         JOIN source s ON s.id = sp.source_id WHERE s.name = $1`,
      [HIGHERGOV_SOURCE_NAME],
    );
    /* 1 (the sample) + 1 (day one) + 2 (day two) = 4. */
    expect(Number(spend!.total)).toBe(4);

    const sightings = await all<{ external_id: string }>(
      `SELECT sg.external_id FROM sighting sg
         JOIN source s ON s.id = sg.source_id WHERE s.name = $1 ORDER BY sg.external_id`,
      [HIGHERGOV_SOURCE_NAME],
    );
    expect(sightings.map((s) => s.external_id)).toEqual(["HG-1", "HG-2", "HG-3"]);

    const ingestRuns = await all(`SELECT id FROM ingest_run`);
    expect(ingestRuns.length).toBe(2); // one artifact imported per day
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* Stopping BEFORE the call that would cross the ceiling, mid-walk -- not
 * merely before the whole window starts, and not the top-level "is the
 * WHOLE window affordable" gate (that one is deliberately made to pass).
 * The realistic case the per-day check exists for: day one's REAL cost
 * (15, from the fake adapter) runs far ahead of the sampled rate (5/day)
 * that made the window look affordable in the first place -- exactly R5's
 * "one observation on one day" risk. alreadySpent is seeded so the window
 * total (sample + 3 days at the sampled rate = 20) is EXACTLY affordable,
 * but day one alone spends three times its estimated share, leaving nothing
 * for day two. */
test("the day-walk stops before the call that would cross the ceiling", async () => {
  await run(`UPDATE source SET enabled = true WHERE name = $1`, [HIGHERGOV_SOURCE_NAME]);
  const dir = tempRunsDir();
  try {
    const day1Items = Array.from({ length: 15 }, (_, i) => ({
      externalId: `HG-10-${i}`,
      modifiedAt: "2026-09-01",
      raw: {},
    }));
    const adapter = fakeAdapter({
      "2026-09-01": day1Items,
      "2026-09-02": [{ externalId: "HG-11", modifiedAt: "2026-09-02", raw: {} }],
      "2026-09-03": [{ externalId: "HG-12", modifiedAt: "2026-09-03", raw: {} }],
    });
    const sampleRate = 5;
    const windowDays = 3;
    /* Exactly enough for the sample plus the WHOLE window at the sampled
     * rate (5 + 5*3 = 20) -- the top-level affordability check passes. */
    const alreadySpent = MONTHLY_RECORD_CEILING - sampleRate * (windowDays + 1);

    /* Seed alreadySpent as real rows -- main() reads spentThisMonth() live,
     * not an injected parameter (unlike dryRun in isolation). */
    const src = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
      HIGHERGOV_SOURCE_NAME,
    ]);
    await run(
      `INSERT INTO api_spend (source_id, endpoint, records) VALUES ($1, 'opportunity', $2)`,
      [src!.id, alreadySpent],
    );

    await main(
      ["--from=2026-09-01", "--to=2026-09-03"],
      clientReturning(sampleRate),
      adapter,
      dir,
    );

    const ingestRuns = await all(`SELECT id FROM ingest_run`);
    /* Exactly one day committed (2026-09-01, which alone spent all the
     * headroom the sample's rate implied for the whole window); the walk
     * must stop before attempting 2026-09-02 or 2026-09-03. */
    expect(ingestRuns.length).toBe(1);

    const sightings = await all<{ external_id: string }>(`SELECT external_id FROM sighting`);
    /* All 15 of day one's items, none of day two's or three's. */
    expect(sightings.length).toBe(15);
    expect(sightings.every((s) => s.external_id.startsWith("HG-10-"))).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
