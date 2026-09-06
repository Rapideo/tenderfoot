/* 🛑 NO LIVE CALLS ANYWHERE IN THIS FILE. Every case injects a fake client. */
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";
import type { HigherGovClient, FeedResult } from "./highergov-client.js";
import type { KeyEntry } from "./answer-key.js";

useTestSchema("test_coverage_run");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, one, run } = await import("../db/index.js");
const { runCoverage } = await import("./run.js");
const { COVERAGE } = await import("./thresholds.js");

function fakeClient(byDay: Record<string, FeedResult>): HigherGovClient {
  return {
    async fetchDay(capturedDate) {
      return byDay[capturedDate] ?? { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
  };
}

beforeAll(async () => {
  await migrate(false);
}, 120000);

beforeEach(async () => {
  await run(`DELETE FROM coverage_item`);
  await run(`DELETE FROM coverage_run`);
  await run(`DELETE FROM api_spend`);
});

afterAll(async () => {
  await close();
});

test("a run records what the vendor billed in api_spend", async () => {
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    client: fakeClient({
      "2026-09-03": {
        notices: [
          { externalId: "A", capturedDate: "2026-09-03", versionKey: "v1", title: "t" },
        ],
        records: 5,
        feedCount: 5,
        pages: 1,
      },
    }),
  });
  expect(out.recordsSpent).toBe(5);
  const spend = await one<{ total: string }>(
    `SELECT sum(records)::text AS total FROM api_spend WHERE endpoint = 'opportunity'`,
  );
  expect(Number(spend!.total)).toBe(5);
});

/* 🔴 THE TALLY MUST SURVIVE A FAILED WRITE. api-spend.ts's final review
 * settled this: by the time the fetch returns, the VENDOR HAS BILLED. A
 * rolled-back write must not erase a spend that really happened -- against a
 * ceiling that cannot be read back, under-reporting is the dangerous
 * direction. */
test("the spend is recorded even when the item write fails", async () => {
  const client: HigherGovClient = {
    async fetchDay() {
      return {
        notices: [{ externalId: "A", capturedDate: "2026-09-03", versionKey: null, title: null }],
        records: 7,
        feedCount: 7,
        pages: 1,
      };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
  };
  /* Force the item write to fail by dropping the check constraint's target
   * value into an impossible state: a run row that does not exist. */
  /* `failItemWriteForTest` is a declared field on RunOptions, not a cast:
   * a test-only escape hatch is named for what it is rather than smuggled
   * past the type system. */
  await expect(
    runCoverage({ from: "2026-09-03", to: "2026-09-03", client, failItemWriteForTest: true }),
  ).rejects.toThrow();
  const spend = await one<{ total: string }>(
    `SELECT coalesce(sum(records),0)::text AS total FROM api_spend`,
  );
  expect(Number(spend!.total)).toBe(7);
});

/* 🔴 THE HARD STOP. The cost model is a projection from ONE observation
 * (R5, 5 records for one day). A run must abort rather than overspend. */
test("a run aborts at maxRecordsPerRun rather than continuing", async () => {
  const heavy: FeedResult = {
    notices: [],
    records: COVERAGE.maxRecordsPerRun + 1,
    feedCount: 9999,
    pages: 1,
  };
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-05",
    client: fakeClient({ "2026-09-03": heavy }),
  });
  expect(out.aborted).toBe(true);
  expect(out.abortReason).toContain("maxRecordsPerRun");
  const row = await one<{ aborted: boolean }>(`SELECT aborted FROM coverage_run LIMIT 1`);
  expect(row!.aborted).toBe(true);
});

const keyOf = (...ids: string[]): KeyEntry[] =>
  ids.map((externalId) => ({
    externalId,
    segment: "state_agency" as const,
    keyOrigin: "Indiana IDOA solicitations",
    deadline: "2026-09-30",
  }));

test("an aborted run's unqueried days leave no misses behind", async () => {
  const heavy: FeedResult = { notices: [], records: COVERAGE.maxRecordsPerRun + 1, feedCount: 1, pages: 1 };
  await runCoverage({
    from: "2026-09-03",
    to: "2026-09-05",
    key: keyOf("A", "B", "C"),
    client: fakeClient({ "2026-09-03": heavy }),
  });
  /* Three notices we never resolved. Every one must be `unchecked`; a single
   * `missing` here is coverage decay manufactured out of our own budget cap.
   * The key is non-empty ON PURPOSE -- with no key the assertion holds even
   * if the abort logic were deleted, and would prove nothing. */
  const misses = await all(`SELECT 1 FROM coverage_item WHERE carried = 'missing'`);
  expect(misses).toHaveLength(0);
  const unchecked = await all(`SELECT 1 FROM coverage_item WHERE carried = 'unchecked'`);
  expect(unchecked).toHaveLength(3);
});

/* 🔴 THE FALSE-MISS GUARD. fetchDay answers "what did you capture in this
 * window", not "do you carry this notice" -- and most of the answer key was
 * captured before the window opens. */
test("a notice absent from the window is looked up by id before being called missing", async () => {
  const client: HigherGovClient = {
    async fetchDay() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchBySourceId(sourceId) {
      return {
        notices: [
          { externalId: sourceId, capturedDate: "2026-08-01", versionKey: null, title: null },
        ],
        records: 1,
        feedCount: 1,
        pages: 1,
      };
    },
  };
  await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    key: keyOf("003000000088067"),
    client,
  });
  /* Captured 2026-08-01 -- BEFORE the window. Window-absence is not absence. */
  const row = await one<{ carried: string }>(`SELECT carried FROM coverage_item`);
  expect(row!.carried).toBe("carried");
});

test("a notice in neither the window nor the id lookup is a real miss, and cost nothing", async () => {
  const client: HigherGovClient = {
    async fetchDay() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
  };
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    key: keyOf("003000000088067"),
    client,
  });
  const row = await one<{ carried: string }>(`SELECT carried FROM coverage_item`);
  expect(row!.carried).toBe("missing");
  /* The zero is the point: a miss is free to establish and free to re-check,
   * because the meter counts records RETURNED. */
  expect(out.recordsSpent).toBe(0);
});

/* 🔴 A day the client could only half-read must not be graded. Page one of
 * three means two pages of notices we never saw, and every one of them would
 * read downstream as a notice HigherGov does not carry. */
test("a day whose feed spans more than one page aborts rather than grading a truncation", async () => {
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    key: keyOf("003000000088067"),
    client: fakeClient({
      "2026-09-03": { notices: [], records: 5, feedCount: 500, pages: 3 },
    }),
  });
  expect(out.aborted).toBe(true);
  expect(out.abortReason).toContain("page 1 of 3");
  /* Unchecked, NOT missing -- we did not establish anything about this notice. */
  const row = await one<{ carried: string }>(`SELECT carried FROM coverage_item`);
  expect(row!.carried).toBe("unchecked");
});

/* 🔴 THE SAVED-SEARCH DETECTOR. R1: state filtering exists ONLY through a
 * saved search living in HigherGov's account, not our code. feed_count is
 * how a silent edit becomes visible. */
test("the run records the feed count for the saved-search detector", async () => {
  await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    client: fakeClient({
      "2026-09-03": { notices: [], records: 0, feedCount: 4242, pages: 1 },
    }),
  });
  const row = await one<{ feed_count: number }>(`SELECT feed_count FROM coverage_run LIMIT 1`);
  expect(row!.feed_count).toBe(4242);
});

test("the monthly ceiling refuses a run before it spends", async () => {
  const sourceId = await one<{ id: number }>(
    `SELECT id FROM source WHERE name = 'HigherGov'`,
  );
  const { MONTHLY_RECORD_CEILING } = await import("../extract/api-spend.js");
  await run(
    `INSERT INTO api_spend (source_id, endpoint, records) VALUES ($1, 'opportunity', $2)`,
    [sourceId!.id, MONTHLY_RECORD_CEILING],
  );
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    client: fakeClient({}),
  });
  expect(out.aborted).toBe(true);
  expect(out.abortReason).toContain("ceiling");
  expect(out.recordsSpent).toBe(0);
});
