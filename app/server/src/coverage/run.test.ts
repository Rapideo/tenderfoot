/* 🛑 NO LIVE CALLS ANYWHERE IN THIS FILE. Every case injects a fake client. */
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";
import type { HigherGovClient, FeedResult } from "./highergov-client.js";
import type { KeyEntry } from "./answer-key.js";

useTestSchema("test_coverage_run");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, insert, one, run } = await import("../db/index.js");
const { runCoverage, gradedItems } = await import("./run.js");
const { COVERAGE } = await import("./thresholds.js");

/* Task 7 added fetchDocuments to HigherGovClient. Nothing in run.ts calls it
 * (that is fetch-documents-for.ts's job, a separate on-demand path) -- every
 * fake client below carries this trivial stub purely to keep the type
 * honest, never to be exercised. */
async function noDocuments() {
  return { docs: [], records: 0 };
}

function fakeClient(byDay: Record<string, FeedResult>): HigherGovClient {
  return {
    async fetchDay(capturedDate) {
      return byDay[capturedDate] ?? { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    fetchDocuments: noDocuments,
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
          { externalId: "A", capturedDate: "2026-09-03", postedDate: null, versionKey: "v1", title: "t", raw: {} },
        ],
        records: 5,
        feedCount: 5,
        pages: 1,

        pagesFetched: 1,
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
        notices: [{ externalId: "A", capturedDate: "2026-09-03", postedDate: null, versionKey: null, title: null, raw: {} }],
        records: 7,
        feedCount: 7,
        pages: 1,

        pagesFetched: 1,
      };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    fetchDocuments: noDocuments,
  };
  /* Force the item write to fail. `failItemWriteForTest` makes runCoverage
   * throw a plain Error immediately after observations are computed and
   * before any coverage_item row is written -- there is no constraint
   * trick here, just a deliberate throw at the point where the item loop
   * would otherwise begin. `failItemWriteForTest` is a declared field on
   * RunOptions, not a cast: a test-only escape hatch is named for what it
   * is rather than smuggled past the type system. */
  await expect(
    runCoverage({ from: "2026-09-03", to: "2026-09-03", client, failItemWriteForTest: true }),
  ).rejects.toThrow();
  const spend = await one<{ total: string }>(
    `SELECT coalesce(sum(records),0)::text AS total FROM api_spend`,
  );
  expect(Number(spend!.total)).toBe(7);
});

/* 🔴 THE OPEN FINDING THIS BRANCH CLOSES: a call the vendor already billed
 * must not reach zero records in api_spend just because this client could
 * not make sense of what came back. A malformed 200 or a non-array
 * "results" (highergov-client.ts's guards) throws AFTER the vendor billed
 * and BEFORE recordSpend would otherwise run -- byte-for-byte the same
 * under-report as the bare TypeError those guards replaced. run.ts now
 * tallies a conservative estimate (thresholds.ts's
 * `unparseableResponseRecords`) before letting the error propagate. The
 * error must still propagate: a malformed response should fail the run
 * loudly, having recorded that it spent something. */
test("a fetchDay throw still tallies a conservative spend before the error propagates", async () => {
  const client: HigherGovClient = {
    async fetchDay() {
      throw new Error('HigherGov returned a non-array "results" field (test double)');
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    fetchDocuments: noDocuments,
  };
  await expect(
    runCoverage({ from: "2026-09-03", to: "2026-09-03", client }),
  ).rejects.toThrow(/non-array/);
  const spend = await one<{ total: string }>(
    `SELECT coalesce(sum(records),0)::text AS total FROM api_spend`,
  );
  expect(Number(spend!.total)).toBe(COVERAGE.unparseableResponseRecords);
});

/* Same finding, the OTHER call site: the per-key id-lookup loop calls
 * fetchBySourceId for any notice the day loop did not already find (and
 * that no earlier run already settled). It needs its own try/catch because
 * it is a second, independent call to a second client method. */
test("a fetchBySourceId throw still tallies a conservative spend before the error propagates", async () => {
  const client: HigherGovClient = {
    async fetchDay() {
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    async fetchBySourceId() {
      throw new Error("HigherGov returned a malformed JSON body (test double)");
    },
    fetchDocuments: noDocuments,
  };
  await expect(
    runCoverage({
      from: "2026-09-03",
      to: "2026-09-03",
      key: [
        {
          externalId: "003000000088067",
          segment: "state_agency",
          keyOrigin: "Indiana IDOA solicitations",
          deadline: "2026-09-30",
        },
      ],
      client,
    }),
  ).rejects.toThrow(/malformed JSON/);
  const spend = await one<{ total: string }>(
    `SELECT coalesce(sum(records),0)::text AS total FROM api_spend`,
  );
  expect(Number(spend!.total)).toBe(COVERAGE.unparseableResponseRecords);
});

/* 🔴 THE HARD STOP. The cost model is a projection from ONE observation
 * (R5, 5 records for one day). A run must abort rather than overspend. */
test("a run aborts at maxRecordsPerRun rather than continuing", async () => {
  const heavy: FeedResult = {
    notices: [],
    records: COVERAGE.maxRecordsPerRun + 1,
    feedCount: 9999,
    pages: 1,

    pagesFetched: 1,
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
  const heavy: FeedResult = { notices: [], records: COVERAGE.maxRecordsPerRun + 1, feedCount: 1, pages: 1, pagesFetched: 1 };
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
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    async fetchBySourceId(sourceId) {
      return {
        notices: [
          { externalId: sourceId, capturedDate: "2026-08-01", postedDate: null, versionKey: null, title: null, raw: {} },
        ],
        records: 1,
        feedCount: 1,
        pages: 1,

        pagesFetched: 1,
      };
    },
    fetchDocuments: noDocuments,
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
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    fetchDocuments: noDocuments,
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

/* 🔴 A day the client could only half-buy must not be graded. One page of
 * three means two pages of notices we never saw, and every one of them would
 * read downstream as a notice HigherGov does not carry.
 *
 * ⚖️ THE FAKE NOW HAS TO SAY `pagesFetched: 1` EXPLICITLY, and that is the
 * change 2026-09-08's paging made to this test. `pages: 3` alone used to BE
 * the truncation, because the client could only ever read the first one.
 * Now it is only half the fact, and the day below is short because it was
 * stopped -- by the per-day budget, the page ceiling, or an empty page --
 * not because a third page merely exists. */
test("a day the client came back short on aborts rather than grading a truncation", async () => {
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    key: keyOf("003000000088067"),
    client: fakeClient({
      "2026-09-03": { notices: [], records: 5, feedCount: 500, pages: 3, pagesFetched: 1 },
    }),
  });
  expect(out.aborted).toBe(true);
  expect(out.abortReason).toContain("PARTIAL");
  expect(out.abortReason).toContain("1 of 3 page(s)");
  /* Unchecked, NOT missing -- we did not establish anything about this notice. */
  const row = await one<{ carried: string }>(`SELECT carried FROM coverage_item`);
  expect(row!.carried).toBe("unchecked");
});

/* 🔴 THE OTHER HALF, AND WITHOUT IT THE TEST ABOVE WOULD STILL PASS WITH THE
 * OLD `pages > 1` GUARD IN PLACE. A three-page day the client bought WHOLE is
 * complete evidence: every row HigherGov had for that day is in hand, so
 * grading it is not merely allowed, it is the entire point of building paging.
 * A guard that still refused it would leave the feature unreachable. */
test("a multi-page day bought WHOLE is graded, not refused", async () => {
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    key: keyOf("003000000088067"),
    client: fakeClient({
      "2026-09-03": {
        notices: [
          {
            externalId: "003000000088067",
            capturedDate: "2026-09-03",
            postedDate: null,
            versionKey: null,
            title: null,
            raw: {},
          },
        ],
        records: 3,
        feedCount: 3,
        pages: 3,
        pagesFetched: 3,
      },
    }),
  });
  expect(out.aborted).toBe(false);
  const row = await one<{ carried: string }>(`SELECT carried FROM coverage_item`);
  expect(row!.carried).toBe("carried");
});

/* 🛑 THE PER-DAY BUDGET IS ACTUALLY HANDED TO THE CLIENT, not merely intended.
 * One paged day can bill up to MAX_PAGES_PER_DAY * 100 records -- twenty-five
 * times this whole run's cap -- so a run that called fetchDay with no budget
 * would blow maxRecordsPerRun on its FIRST day and only discover it
 * afterwards. Asserted on the argument itself, because a FeedResult looks
 * identical either way. */
test("the day loop tells fetchDay what is left of maxRecordsPerRun", async () => {
  const budgets: Array<number | undefined> = [];
  const client: HigherGovClient = {
    async fetchDay(_day, _fetchImpl, _pageSize, _axis, maxRecords) {
      budgets.push(maxRecords);
      return { notices: [], records: 6, feedCount: 6, pages: 1, pagesFetched: 1 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    fetchDocuments: noDocuments,
  };
  await runCoverage({ from: "2026-09-03", to: "2026-09-05", client });
  /* Day one may spend the whole cap; each later day only what is left after
   * the days before it -- a budget that ignored `spent` would repeat 40. */
  expect(budgets).toEqual([
    COVERAGE.maxRecordsPerRun,
    COVERAGE.maxRecordsPerRun - 6,
    COVERAGE.maxRecordsPerRun - 12,
  ]);
});

/* 🔴 GUARD 4 AT THIS TALLY SITE. A day is several calls now, so a throw can
 * arrive with pages already billed. This site charges the conservative bound
 * for the call that failed and must ADD what the earlier pages cost --
 * charging 40 flat for a day the vendor billed 140 for is exactly the
 * under-report api-spend.ts's header calls the dangerous direction. */
test("a mid-day throw tallies the conservative bound PLUS the pages already billed", async () => {
  const client: HigherGovClient = {
    async fetchDay() {
      const err = new Error('HigherGov answered 500 -- 100 record(s) across 2 page(s) were ALREADY BILLED');
      (err as Error & { recordsBilled?: number }).recordsBilled = 100;
      throw err;
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    fetchDocuments: noDocuments,
  };
  await expect(runCoverage({ from: "2026-09-03", to: "2026-09-03", client })).rejects.toThrow(
    /ALREADY BILLED/,
  );
  const spend = await one<{ total: string }>(
    `SELECT coalesce(sum(records),0)::text AS total FROM api_spend`,
  );
  expect(Number(spend!.total)).toBe(COVERAGE.unparseableResponseRecords + 100);
});

/* 🔴 THE CALL COUNTER COUNTS HTTP REQUESTS, NOT DAYS. maxCallsPerRun is a cap
 * on live requests against a metered API (its own comment in thresholds.ts
 * says so), and one day is now up to MAX_PAGES_PER_DAY of them. Counting a
 * ten-page day as one call would leave the ratified 500 bounding something
 * ten times smaller than what it names. The window here is one day and the
 * client reports four pages fetched. */
test("a paged day counts every page against maxCallsPerRun, not one call per day", async () => {
  const budgets: Array<number | undefined> = [];
  const client: HigherGovClient = {
    async fetchDay(_day, _fetchImpl, _pageSize, _axis, maxRecords) {
      budgets.push(maxRecords);
      /* Zero records on purpose: the RECORD cap must never be what stops
       * this run, or the assertion below would be about the wrong guard --
       * the same reasoning the zero-every-day maxCallsPerRun test above
       * already rests on. */
      return { notices: [], records: 0, feedCount: 0, pages: 4, pagesFetched: 4 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    fetchDocuments: noDocuments,
  };
  /* A key entry the day did not carry forces the per-key probe loop, which is
   * where `calls` is next read -- and the probe is skipped when the counter
   * has already reached the cap. Rather than run 500 days to observe that,
   * this asserts the counter's effect where it is cheap: the abort reason
   * names the call count. */
  const out = await runCoverage({
    from: "2026-01-01",
    to: "2028-01-01",
    client,
  });
  expect(out.aborted).toBe(true);
  expect(out.abortReason).toContain("maxCallsPerRun");
  /* 4 pages a day, so the cap is reached in a quarter of the days it would
   * have taken at one call per day -- and `budgets` is the witness: 125
   * days, not 500. */
  expect(budgets.length).toBe(Math.ceil(COVERAGE.maxCallsPerRun / 4));
}, 90000);

/* 🔴 THE SAVED-SEARCH DETECTOR. R1: state filtering exists ONLY through a
 * saved search living in HigherGov's account, not our code. feed_count is
 * how a silent edit becomes visible. */
test("the run records the feed count for the saved-search detector", async () => {
  await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    client: fakeClient({
      "2026-09-03": { notices: [], records: 0, feedCount: 4242, pages: 1, pagesFetched: 1 },
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

/* 🔴 FINAL REVIEW, item 6. `alreadySpent >= MONTHLY_RECORD_CEILING` permits
 * a run one record short of the ceiling to spend a full maxRecordsPerRun
 * more -- refusing only once the ceiling is ALREADY crossed, never a run
 * that WOULD cross it. One record short of the ceiling is exactly the case
 * the old `>=` let through. */
test("the ceiling refuses a run that WOULD cross it, not only one that already has", async () => {
  const sourceId = await one<{ id: number }>(`SELECT id FROM source WHERE name = 'HigherGov'`);
  const { MONTHLY_RECORD_CEILING } = await import("../extract/api-spend.js");
  await run(
    `INSERT INTO api_spend (source_id, endpoint, records) VALUES ($1, 'opportunity', $2)`,
    [sourceId!.id, MONTHLY_RECORD_CEILING - 1],
  );
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    client: fakeClient({}),
  });
  expect(out.aborted).toBe(true);
  expect(out.abortReason).toContain("would be crossed");
  expect(out.recordsSpent).toBe(0);
});

/* The boundary's OTHER side: a run that would land EXACTLY on the ceiling
 * has not crossed it, and must still be allowed to proceed. */
test("the ceiling allows a run that would land exactly on it", async () => {
  const sourceId = await one<{ id: number }>(`SELECT id FROM source WHERE name = 'HigherGov'`);
  const { MONTHLY_RECORD_CEILING } = await import("../extract/api-spend.js");
  await run(
    `INSERT INTO api_spend (source_id, endpoint, records) VALUES ($1, 'opportunity', $2)`,
    [sourceId!.id, MONTHLY_RECORD_CEILING - COVERAGE.maxRecordsPerRun],
  );
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    client: fakeClient({
      "2026-09-03": { notices: [], records: 1, feedCount: 0, pages: 1, pagesFetched: 1 },
    }),
  });
  expect(out.aborted).toBe(false);
});

/* 🔴 FINAL REVIEW, item 7. days() will happily build a wide, mostly-empty
 * window, and `spent` only advances by records RETURNED -- a zero-result day
 * bills nothing (CLAUDE.md §5.1), so the record cap alone never trips. This
 * client returns ZERO records on every single day, across a window far wider
 * than maxCallsPerRun, and proves the run stops anyway -- on CALL COUNT, not
 * on spend.
 *
 * ⚖️ WINDOW WIDENED 2026-09-07 when maxCallsPerRun was ratified and raised
 * 100 -> 500 (thresholds.ts): the old window, 2026-01-01 to 2026-06-01, was
 * 152 days -- "far wider than 100" but no longer far wider than 500, so this
 * test would stop asserting anything real (the loop would exhaust every day
 * in the window with calls still under the new cap, and `aborted` would go
 * false). 2026-01-01 to 2028-01-01 is 731 days, comfortably past 500 again.
 * Runtime is unaffected by how much wider than the cap this is -- the loop
 * still breaks at exactly maxCallsPerRun calls, so the padding costs
 * nothing. */
test(
  "a run aborts at maxCallsPerRun even when every call returns zero records",
  async () => {
    const zeroEveryDay: HigherGovClient = {
      async fetchDay() {
        return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
      },
      async fetchBySourceId() {
        return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
      },
      fetchDocuments: noDocuments,
    };
    const out = await runCoverage({
      from: "2026-01-01",
      to: "2028-01-01",
      client: zeroEveryDay,
    });
    expect(out.aborted).toBe(true);
    expect(out.abortReason).toContain("maxCallsPerRun");
    expect(out.recordsSpent).toBe(0);
  },
  /* maxCallsPerRun (500, raised 2026-09-07 from 100) real committed
   * api_spend INSERTs, sequential, over the network -- 5x the prior count,
   * so the timeout is raised well past the old 30000ms rather than tuned to
   * the exact new figure. Not a flaky test; just a genuinely larger one. */
  90000,
);

/* 🔴 CRITICAL REGRESSION (review 2026-09-06, ruled by the controller).
 *
 * run.ts used to fold the settled branch into the found branch:
 *   if (found.has(id) || settledIds.has(id)) { checkedIds.add(id); continue; }
 * That added a settled id to `checkedIds` WITHOUT ever adding it to `found`.
 * `found` holds only THIS run's feed and THIS run's probes, and observe()
 * grades "not in feed AND in checked" as `missing`. So every notice an
 * earlier run had already settled as `carried` -- exactly the notices this
 * guard exists to avoid re-asking -- got written into coverage_item as a
 * MISS for a record this run deliberately did not query, and it compounded:
 * every later run still saw the original `carried` row in settledIds and
 * wrote another spurious miss.
 *
 * This is the ONLY test in the file that does not delete coverage_item
 * between two `runCoverage` calls -- every other test starts from an empty
 * table via `beforeEach`, so `settledIds` is always empty there and this
 * path gets zero coverage from them. Two consecutive calls, no delete
 * between them, is the only way to exercise it. */
test("a notice settled as carried by an earlier run is not re-asked, and does not become a miss", async () => {
  const key = keyOf("X");

  const carryingClient: HigherGovClient = {
    async fetchDay(capturedDate) {
      if (capturedDate === "2026-09-03") {
        return {
          notices: [{ externalId: "X", capturedDate: "2026-09-03", postedDate: null, versionKey: null, title: null, raw: {} }],
          records: 1,
          feedCount: 1,
          pages: 1,

          pagesFetched: 1,
        };
      }
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    fetchDocuments: noDocuments,
  };
  const first = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    key,
    client: carryingClient,
  });
  const firstRow = await one<{ carried: string }>(
    `SELECT carried FROM coverage_item WHERE run_id = $1 AND external_id = 'X'`,
    [first.runId],
  );
  expect(firstRow!.carried).toBe("carried");

  const mustNotAskAgain: HigherGovClient = {
    async fetchDay() {
      return { notices: [], records: 0, feedCount: 0, pages: 1, pagesFetched: 1 };
    },
    async fetchBySourceId() {
      /* X is already settled as carried -- reaching this at all is the bug. */
      throw new Error("must not be called: X is already settled as carried");
    },
    fetchDocuments: noDocuments,
  };
  const second = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    key,
    client: mustNotAskAgain,
  });
  const secondRow = await one<{ carried: string }>(
    `SELECT carried FROM coverage_item WHERE run_id = $1 AND external_id = 'X'`,
    [second.runId],
  );
  /* NOT 'missing' -- this run deliberately did not ask about X again. */
  expect(secondRow!.carried).toBe("unchecked");
  const misses = await all(
    `SELECT 1 FROM coverage_item WHERE external_id = 'X' AND carried = 'missing'`,
  );
  expect(misses).toHaveLength(0);
  expect(second.recordsSpent).toBe(0);
});

/* 🔴 gradedItems() had no test at all -- its backtick fix (review
 * 2026-09-06) was verified only by "the file now parses", never by the
 * query actually running against Postgres, and its stated ordering
 * constraint (informativeness before recency) was unpinned. This inserts
 * directly rather than through two runCoverage calls so the OLDER row can be
 * `carried` and the NEWER row can be `unchecked` -- the one arrangement a
 * recency-only ORDER BY would get wrong. */
test("gradedItems() takes an older carried over a newer unchecked for the same notice", async () => {
  const sourceId = await one<{ id: number }>(`SELECT id FROM source WHERE name = 'HigherGov'`);
  const olderRun = await insert(
    `INSERT INTO coverage_run (source_id, cohort_from, cohort_to, run_at)
     VALUES ($1, '2026-09-01', '2026-09-01', now() - interval '1 day') RETURNING id`,
    [sourceId!.id],
  );
  const newerRun = await insert(
    `INSERT INTO coverage_run (source_id, cohort_from, cohort_to, run_at)
     VALUES ($1, '2026-09-03', '2026-09-03', now()) RETURNING id`,
    [sourceId!.id],
  );
  await run(
    `INSERT INTO coverage_item (run_id, external_id, segment, key_origin, key_seen_at, deadline, carried)
     VALUES ($1, 'Z', 'state_agency', 'Indiana IDOA solicitations', now(), '2026-09-30', 'carried')`,
    [olderRun],
  );
  await run(
    `INSERT INTO coverage_item (run_id, external_id, segment, key_origin, key_seen_at, deadline, carried)
     VALUES ($1, 'Z', 'state_agency', 'Indiana IDOA solicitations', now(), '2026-09-30', 'unchecked')`,
    [newerRun],
  );
  const graded = await gradedItems();
  const z = graded.find((g) => g.externalId === "Z");
  /* Ordering by recency alone would return the newer 'unchecked' row and
   * erase the settled 'carried' finding underneath it. */
  expect(z).toBeDefined();
  expect(z!.carried).toBe("carried");
});
