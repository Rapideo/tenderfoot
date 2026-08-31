import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_metrics");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run } = await import("../db/index.js");
const { volumePerSourcePerWeek, interestedPerHundred } = await import("./metrics.js");
const { drawSample } = await import("./sample.js");
const { recordDecision } = await import("./decide.js");

let source: number;

beforeAll(async () => {
  await migrate(false);
  source = await insert(`INSERT INTO source (name) VALUES ('metrics source') RETURNING id`);
}, 120000);
afterAll(async () => {
  await close();
});

async function sol(title: string, postedAt: string | null): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id, posted_at, closes_at)
     VALUES ($1, $2, $3, '2027-06-01') RETURNING id`,
    [title, source, postedAt],
  );
}

/* THE DEFINITION THAT MATTERS. sighting.seen_at is when WE saw a row, and
 * nothing ingests unless a human asks it to -- so a seen_at series measures
 * who was at the laptop, not what the market produced. This test makes the
 * two disagree on purpose: two solicitations posted in DIFFERENT weeks, both
 * sighted in the SAME week, which is exactly what a bulk backfill looks
 * like. A seen_at implementation collapses them into one bucket.
 *
 * Strengthened past the brief's `toBeGreaterThanOrEqual(2)`: that assertion
 * passes on accumulated fixture noise from later tests in this file (they
 * insert into the SAME source) even if the implementation buckets on
 * seen_at -- both June and August rows would then land in whatever bucket
 * contains 2026-08-28, and a later test's rows landing in a THIRD bucket
 * would still make length >= 2 true. Asserting the two SPECIFIC week
 * buckets, each holding exactly the one row posted in it, is what actually
 * fails when the implementation buckets on seen_at: a seen_at bucketing
 * puts both of these rows in the week of 2026-08-28 (Monday 2026-08-24),
 * which is neither of the buckets asserted below, so both `find()` calls
 * come back undefined and `.solicitations` throws. */
test("volume is bucketed by when the buyer posted, not by when we scraped", async () => {
  const early = await sol("posted in June", "2026-06-03");
  const late = await sol("posted in August", "2026-08-19");
  for (const id of [early, late]) {
    await run(
      `INSERT INTO sighting (source_id, solicitation_id, seen_at)
       VALUES ($1, $2, '2026-08-28T00:00:00Z')`,
      [source, id],
    );
  }

  const report = await volumePerSourcePerWeek();
  const mine = report.weeks.filter((w) => w.source_id === source);

  // Monday-of-week for 2026-06-03 (a Wednesday) is 2026-06-01.
  const juneWeek = mine.find((w) => w.week === "2026-06-01");
  // Monday-of-week for 2026-08-19 (a Wednesday) is 2026-08-17.
  const augustWeek = mine.find((w) => w.week === "2026-08-17");

  expect(juneWeek).toBeDefined();
  expect(juneWeek!.solicitations).toBe(1);
  expect(augustWeek).toBeDefined();
  expect(augustWeek!.solicitations).toBe(1);

  // The week of the SHARED seen_at (Monday 2026-08-24) must NOT hold both
  // rows -- that bucket is what a seen_at implementation would produce.
  const seenAtWeek = mine.find((w) => w.week === "2026-08-24");
  expect(seenAtWeek).toBeUndefined();
});

test("rows with no posted_at are excluded, and the exclusion is reported", async () => {
  await sol("no posting date", null);
  const report = await volumePerSourcePerWeek();
  expect(report.excluded_no_posted_at).toBeGreaterThanOrEqual(1);
  expect(report.total_rows).toBeGreaterThan(report.excluded_no_posted_at);
});

/* REAL DEFECT FOUND IN THE BRIEF (not transcribed): its exclusion regex,
 * ^\d{4}-\d{2}-\d{2}, checks digit SHAPE only. "9999-99-99" matches that
 * shape -- it is not NULL and not shape-rejected -- so the brief's version
 * of this query does not exclude it; it reaches `::date` and Postgres
 * throws "date/time field value out of range", which fails the WHOLE
 * report for every source, not just this one row. That is worse than the
 * silent-drop this predicate exists to prevent: a silent drop under-counts
 * one bucket, a crash reports nothing at all. Confirmed against Postgres
 * directly before writing this test (same error message).
 *
 * This test would throw (not merely fail an expect) against the brief's
 * unmodified regex -- proof the exclusion predicate must guarantee
 * parseability, not merely digit shape. */
test("a posted_at that looks like a date but is not a valid one is excluded, not a crash", async () => {
  const before = await volumePerSourcePerWeek();
  await sol("bogus date", "9999-99-99");
  const after = await volumePerSourcePerWeek();

  expect(after.total_rows).toBe(before.total_rows + 1);
  expect(after.excluded_no_posted_at).toBe(before.excluded_no_posted_at + 1);
});

test("Interested-per-hundred reports what it was measured over", async () => {
  const ids: number[] = [];
  for (let i = 0; i < 10; i++) ids.push(await sol(`rate ${i}`, "2026-08-01"));
  const sample = await drawSample({ sourceId: source, n: 10, seed: "rate-seed" });

  await recordDecision({ solicitationId: ids[0]!, state: "Interested" });
  await recordDecision({
    solicitationId: ids[1]!,
    state: "Not Interested",
    reason: "parts order",
  });

  const rates = await interestedPerHundred();
  const mine = rates.find((r) => r.sample_id === sample.id);
  expect(mine).toBeDefined();
  expect(mine!.population_size).toBeGreaterThanOrEqual(10);
  expect(mine!.decided).toBe(2);
  expect(mine!.interested).toBe(1);
  expect(mine!.interested_per_hundred).toBe(50);
});

/* A reversal counts ONCE, at its latest state. Counting rows rather than
 * solicitations would report 100 Interested out of 50 decisions. */
test("a reversed decision counts once, as what it became", async () => {
  const id = await sol("changed my mind", "2026-08-01");
  const sample = await drawSample({ sourceId: source, n: 200, seed: "reversal-seed" });

  await recordDecision({ solicitationId: id, state: "Interested" });
  await recordDecision({ solicitationId: id, state: "Not Interested", reason: "on reflection" });

  const mine = (await interestedPerHundred()).find((r) => r.sample_id === sample.id)!;
  expect(mine.interested).toBe(0);
  expect(mine.decided).toBe(1);
});

/* A rate over zero decisions is UNKNOWN, not zero. Reporting 0 would read
 * as "nothing here interests us" when it means "nobody has looked". */
test("a sample nobody has triaged reports no rate at all", async () => {
  const virgin = await insert(`INSERT INTO source (name) VALUES ('untouched source') RETURNING id`);
  await insert(
    `INSERT INTO solicitation (title, source_id, posted_at, closes_at)
     VALUES ('never triaged', $1, '2026-08-01', '2027-06-01') RETURNING id`,
    [virgin],
  );
  const sample = await drawSample({ sourceId: virgin, n: 5, seed: "virgin" });

  const mine = (await interestedPerHundred()).find((r) => r.sample_id === sample.id)!;
  expect(mine.decided).toBe(0);
  expect(mine.interested_per_hundred).toBeNull();
});
