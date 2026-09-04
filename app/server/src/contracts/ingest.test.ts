import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_contract_ingest");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, one, all, run } = await import("../db/index.js");
const { ingestContracts } = await import("./ingest.js");

beforeAll(async () => {
  await migrate(false);
  await run(`INSERT INTO source (name) VALUES ('EDS ingest fixture')`);
}, 120000);
afterAll(async () => {
  await close();
});

const mkRow = (id: string, year: number) => ({
  id, vendorName: "V", agencyName: "A", businessUnit: "00110",
  startDate: `${year}-05-01T00:00:00.0000000`,
  endDate: `${year}-06-01T00:00:00.0000000`,
  amount: 100, actionType: "New", amendment: 0, zipCode: "1", pdfUrl: "u",
});

/* Replaces the brief's "an ingest walks the years" test. There is no year
 * loop (Ruling 3) -- fetchAll() is called exactly once and the whole result
 * lands in one ingest_run row, not one per window. */
test("a single fetch writes the rows and records one ingest_run", async () => {
  const report = await ingestContracts({
    sourceName: "EDS ingest fixture",
    fetchAll: async () => [mkRow("C-2020-1", 2020), mkRow("C-2020-2", 2020), mkRow("C-2021-1", 2021)],
  });

  expect(report.fetched).toBe(3);
  expect(report.written).toBe(3);
  expect(report.skipped).toBe(0);

  const n = await one<{ c: string }>(`SELECT count(*) c FROM contract`);
  expect(Number(n!.c)).toBe(3);

  const runs = await all<{ rows_imported: number }>(
    `SELECT rows_imported FROM ingest_run ORDER BY id`);
  expect(runs).toHaveLength(1);
  expect(runs[0]!.rows_imported).toBe(3);
});

test("re-running the same fetch writes nothing new and still records a run", async () => {
  const before = await one<{ c: string }>(`SELECT count(*) c FROM contract`);
  const report = await ingestContracts({
    sourceName: "EDS ingest fixture",
    fetchAll: async () => [mkRow("C-2020-1", 2020), mkRow("C-2020-2", 2020), mkRow("C-2021-1", 2021)],
  });
  const after = await one<{ c: string }>(`SELECT count(*) c FROM contract`);

  expect(report.written).toBe(0);
  expect(report.skipped).toBe(3);
  expect(after!.c).toBe(before!.c);

  /* Still recorded: the run happened and imported 0 new rows, which is
   * different from the run never having happened at all. */
  const runCount = await one<{ n: string }>(`SELECT count(*) n FROM ingest_run`);
  expect(Number(runCount!.n)).toBe(2);
});

test("an unknown source name fails loudly rather than writing nowhere", async () => {
  await expect(
    ingestContracts({
      sourceName: "no such source",
      fetchAll: async () => [],
    }),
  ).rejects.toThrow(/no such source/i);
});

/* Replaces the brief's "a window that cannot be split aborts the ingest" --
 * there are no windows to split. What is left is the completeness assertion
 * itself: a short fetch (fetchRegister's assertComplete, in production) must
 * abort the WHOLE ingest, not quietly import whatever partial set arrived.
 * The failure this design exists to prevent is a corpus that LOOKS complete. */
test("a short fetch aborts the ingest", async () => {
  const before = await one<{ c: string; r: string }>(
    `SELECT (SELECT count(*) FROM contract) c, (SELECT count(*) FROM ingest_run) r`);

  await expect(
    ingestContracts({
      sourceName: "EDS ingest fixture",
      fetchAll: async () => {
        throw new Error(
          "Incomplete register fetch: the API reports 99 contracts but returned 1.",
        );
      },
    }),
  ).rejects.toThrow(/Incomplete register/);

  const after = await one<{ c: string; r: string }>(
    `SELECT (SELECT count(*) FROM contract) c, (SELECT count(*) FROM ingest_run) r`);
  expect(after).toEqual(before);
});
