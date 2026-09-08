/* The tally is the only instrument we have. CLAUDE.md §5.1: consumption
 * cannot be read from the API at all, so a wrong number here is not a
 * cosmetic bug -- it is the difference between knowing and guessing what a
 * metered source has cost. */
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_api_spend");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run, tx } = await import("../db/index.js");
const { recordSpend, spentThisMonth, MONTHLY_RECORD_CEILING, CEILING_RATIFIED } =
  await import("./api-spend.js");

let sourceId: number;

beforeAll(async () => {
  await migrate(false);
}, 120000);

beforeEach(async () => {
  await run(`DELETE FROM api_spend`);
  await run(`DELETE FROM source WHERE name = 'spend fixture'`);
  sourceId = await insert(`INSERT INTO source (name) VALUES ('spend fixture') RETURNING id`);
});

afterAll(async () => {
  await close();
});

test("a recorded call is counted in this month's spend", async () => {
  await tx((q) => recordSpend(q, { sourceId, endpoint: "document", records: 11 }));
  expect(await spentThisMonth("spend fixture")).toBe(11);
});

test("spend sums across calls", async () => {
  await tx(async (q) => {
    await recordSpend(q, { sourceId, endpoint: "document", records: 11 });
    await recordSpend(q, { sourceId, endpoint: "opportunity", records: 1 });
  });
  expect(await spentThisMonth("spend fixture")).toBe(12);
});

/* 🔴 THE ASSERTION THE CEILING DEPENDS ON. A ceiling computed from a total
 * that silently includes last month's spend refuses work it should allow,
 * on the first of the month, every month -- and the symptom is a screen
 * that stops fetching for no visible reason. */
test("last month's spend does not count against this month", async () => {
  await tx((q) => recordSpend(q, { sourceId, endpoint: "document", records: 11 }));
  await run(
    `UPDATE api_spend SET called_at = date_trunc('month', now()) - interval '1 day'`,
  );
  expect(await spentThisMonth("spend fixture")).toBe(0);
});

test("a free source still writes a row, with zero records", async () => {
  await tx((q) => recordSpend(q, { sourceId, endpoint: "document", records: 0 }));
  /* The row proves the call happened; the 0 proves it was free. Both matter:
   * this is what lets the whole path be exercised against SAM before it is
   * trusted with money. */
  expect(await spentThisMonth("spend fixture")).toBe(0);
  const rows = await (await import("../db/index.js")).all(`SELECT * FROM api_spend`);
  expect(rows).toHaveLength(1);
});

test("a source that has never spent reads zero, not null", async () => {
  expect(await spentThisMonth("spend fixture")).toBe(0);
});

/* FINAL-REVIEW FIX: this used to assert only `toBeGreaterThan(0)` while its
 * own name claimed the ceiling was "marked unratified in source" -- a claim
 * a comment alone cannot make a test fail on, so deleting the word UNRATIFIED
 * from api-spend.ts would have left this green. `CEILING_RATIFIED` is the
 * flag that actually pins it, in the same style rubric.test.ts pins
 * `R7_RATIFIED` and `THRESHOLDS_RATIFIED`. */
test("the ceiling is a positive number and its ratification is pinned in source", () => {
  expect(MONTHLY_RECORD_CEILING).toBeGreaterThan(0);
  /* ⚖️ Ratified 2026-09-07 (D10). Asserts the RULING, not a permanent
   * property: if it is ever withdrawn, this test changes with it. */
  expect(CEILING_RATIFIED).toBe(true);
});

/* ⚖️ SAME DAY, LATER RULING: 1,000 -> 9,000, so the ~9,000 unspent trial
 * records are not simply lost before the trial ends (Matt ruled we spend
 * them on a complete Indiana archive). A literal number sitting only in a
 * comment is exactly what this file's own final-review finding says pins
 * nothing -- deleting "1,000" from the comment above left every test green,
 * so the number itself is asserted here too, not merely described near it. */
test("the ceiling was raised to 9,000 by the same-day ruling on top of D10", () => {
  expect(MONTHLY_RECORD_CEILING).toBe(9000);
});
