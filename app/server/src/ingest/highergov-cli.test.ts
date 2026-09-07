import { afterAll, expect, test } from "vitest";
import { useTestSchema } from "../db/testdb.js";
import type { HigherGovClient } from "../coverage/highergov-client.js";

process.env.HIGHERGOV_API_KEY = "TESTKEYTESTKEYTESTKEYTESTKEY0000";
process.env.HIGHERGOV_SEARCH_ID = "TESTSEARCHID";

/* Not a database test -- none of the four tests below ever issues a query
 * (every dryRun() call passes `alreadySpent` explicitly). But dryRun()'s own
 * `remainingThisMonth` is measured against the REAL MONTHLY_RECORD_CEILING
 * (extract/api-spend.ts), and that module statically imports db/index.ts,
 * which THROWS at import time with no DATABASE_URL (run.test.ts and
 * api-spend.test.ts hit the same constant the same way). useTestSchema()
 * points DATABASE_URL at the test branch before anything imports that
 * chain -- no resetSchema()/migrate() needed, since no query ever runs. */
useTestSchema("test_highergov_cli");

const { dryRun, projectWindow } = await import("./highergov-cli.js");
const { close } = await import("../db/index.js");

afterAll(async () => {
  await close();
});

/* HigherGovClient (coverage/highergov-client.ts) has a THIRD method,
 * fetchDocuments, that the brief's sketch omitted -- TypeScript would refuse
 * to structurally type this object as HigherGovClient without it. Added
 * here rather than loosening the annotation: dryRun's signature takes the
 * real interface, so the fake must satisfy the real interface. */
function clientReturning(records: number): HigherGovClient {
  return {
    async fetchDay() {
      return { notices: [], records, feedCount: records, pages: 1 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchDocuments() {
      return { docs: [], records: 0 };
    },
  };
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
