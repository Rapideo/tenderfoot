import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_floor");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run } = await import("../db/index.js");
const {
  measureF1, measureF2, measureF3, measureF4,
  measureF5, measureF6, measureF7, measureFloor,
} = await import("./floor.js");

/* The seed ships twelve sources and a firm profile. This suite reasons about
 * ingest_run rows and solicitation contents, so it clears what it asserts on
 * and builds exactly what each test needs. firm_profile is LEFT ALONE except
 * where a test deliberately rewrites it -- F2 reads its geography, and that
 * reading is the thing under test. */
beforeAll(async () => {
  await migrate(false);
  await reset();
}, 120000);
afterAll(async () => {
  await close();
});

async function reset(): Promise<void> {
  await run(`DELETE FROM pursuit`);
  await run(`DELETE FROM document`);
  await run(`DELETE FROM ingest_run`);
  await run(`DELETE FROM sighting`);
  await run(`DELETE FROM solicitation`);
  await run(`DELETE FROM source`);
}

async function source(name: string, jurisdiction: string | null): Promise<number> {
  return insert(`INSERT INTO source (name, jurisdiction) VALUES ($1, $2) RETURNING id`, [
    name,
    jurisdiction,
  ]);
}

let sha = 0;
async function ingested(sourceId: number, importedAt?: string): Promise<void> {
  sha += 1;
  await run(
    `INSERT INTO ingest_run (source_id, artifact_sha256, rows_imported, imported_at)
     VALUES ($1, $2, 1, coalesce($3::timestamptz, now()))`,
    [sourceId, `sha-${sourceId}-${sha}`, importedAt ?? null],
  );
}

async function sol(
  sourceId: number,
  posted: string | null,
  closes: string | null,
  kind: string | null,
  description?: string | null,
): Promise<number> {
  /* posted_at_origin is derived from posted_at rather than passed: migration
   * 016's CHECK forbids a date with no provenance, and a fixture that had to
   * remember to set it would drift out of step with the constraint. */
  return insert(
    `INSERT INTO solicitation
       (title, source_id, posted_at, posted_at_origin, closes_at, kind, description)
     VALUES ('floor fixture', $1, $2, $3, $4, $5, $6) RETURNING id`,
    [sourceId, posted, posted === null ? null : "published", closes, kind, description ?? null],
  );
}

/* ---------------------------------------------------------------- F1, F2 -- */

test("F1 counts sources that COMPLETED an ingest, not ones merely enabled", async () => {
  await reset();
  const fed = await source("F1 federal", "US");
  /* enabled=true and a stamped last_run_at, but NO ingest_run row: intent and
   * outcome diverge, which is D27's whole finding. */
  await run(
    `INSERT INTO source (name, jurisdiction, enabled, last_run_at)
     VALUES ('F1 looks busy', 'IN', true, '2026-09-01T00:00:00Z')`,
  );
  await ingested(fed);

  const r = await measureF1();
  expect(r.id).toBe("F1");
  expect(r.measured).toBe(1);
  expect(r.verdict).toBe("fail");
  expect(r.detail).toContain("F1 federal");
});

test("F1 passes at two ingested sources", async () => {
  const second = await source("F1 second", "IN");
  await ingested(second);

  const r = await measureF1();
  expect(r.measured).toBe(2);
  expect(r.verdict).toBe("pass");
  expect(r.detail).toBeUndefined();
});

test("F2 fails while no ingested source sits in the primary geography", async () => {
  await reset();
  const fed = await source("F2 federal only", "US");
  await ingested(fed);

  const r = await measureF2();
  expect(r.id).toBe("F2");
  expect(r.measured).toBe(0);
  expect(r.verdict).toBe("fail");
  expect(r.detail).toContain("IN");
});

test("F2 passes once an Indiana source has ingested", async () => {
  const indiana = await source("F2 indiana", "IN");
  await ingested(indiana);

  const r = await measureF2();
  expect(r.measured).toBe(1);
  expect(r.verdict).toBe("pass");
});

/* §1A: scope is a Profile setting, not code. A hard-coded "IN" would make this
 * predicate lie for a second customer -- and a second customer is a second row,
 * which is the whole portability claim (§4.2). */
test("F2 reads the primary geography from firm_profile rather than a constant", async () => {
  await run(`UPDATE firm_profile SET geography = $1`, [
    JSON.stringify({ primary: ["OH"], secondary: [], federal: true }),
  ]);

  const r = await measureF2();
  expect(r.measured).toBe(0);
  expect(r.detail).toContain("OH");

  await run(`UPDATE firm_profile SET geography = $1`, [
    JSON.stringify({ primary: ["IN"], secondary: ["IL", "OH", "KY"], federal: true }),
  ]);
});

/* ---------------------------------------------------------------- F3, F4 -- */

test("F3 passes when an impossible-dated biddable row is still reachable", async () => {
  await reset();
  const src = await source("F3 source", "US");
  /* The real production shape: posted 2026-08-25, closes 2006-09-24. */
  await sol(src, "2026-08-25", "2006-09-24", "Solicitation");

  const r = await measureF3();
  expect(r.id).toBe("F3");
  expect(r.measured).toBe(0);
  expect(r.verdict).toBe("pass");
});

/* An Award Notice is NOT_BIDDABLE, so it is unreachable for a DIFFERENT and
 * legitimate reason. F3 must not count it, or the predicate fires on a correct
 * exclusion and cries wolf for ever. */
test("F3 ignores an impossible date on a row excluded for being unbiddable", async () => {
  const src = await source("F3 award", "US");
  await sol(src, "2026-08-25", "2006-09-24", "Award Notice");

  const r = await measureF3();
  expect(r.measured).toBe(0);
  expect(r.verdict).toBe("pass");
});

test("F4 reports the longest run of weeks with no ingest", async () => {
  await reset();
  const src = await source("F4 source", "US");
  await ingested(src, "2026-08-03T00:00:00Z");
  await ingested(src, "2026-08-24T00:00:00Z");

  const r = await measureF4();
  expect(r.id).toBe("F4");
  /* Three ISO weeks apart, so two weeks in between saw no ingest at all. */
  expect(r.measured).toBe(2);
  expect(r.verdict).toBe("fail");
  expect(r.detail).toContain("outage");
});

test("F4 passes when ingests are weekly", async () => {
  await run(`DELETE FROM ingest_run`);
  const src = await source("F4 weekly", "US");
  await ingested(src, "2026-08-03T00:00:00Z");
  await ingested(src, "2026-08-10T00:00:00Z");

  const r = await measureF4();
  expect(r.measured).toBe(0);
  expect(r.verdict).toBe("pass");
});

test("F4 is unknown rather than passing when nothing has ever ingested", async () => {
  await run(`DELETE FROM ingest_run`);

  const r = await measureF4();
  expect(r.verdict).toBe("unknown");
  expect(r.measured).toBe("unknown");
});

/* ------------------------------------------------------------ F5, F6, F7 -- */

test("F5 counts real decisions and ignores the 'New' placeholder", async () => {
  await reset();
  const src = await source("F5 source", "US");
  const a = await sol(src, "2026-08-01", "2026-12-01", "Solicitation");
  const b = await sol(src, "2026-08-01", "2026-12-01", "Solicitation");
  await run(`INSERT INTO pursuit (solicitation_id, state) VALUES ($1, 'New')`, [a]);
  await run(`INSERT INTO pursuit (solicitation_id, state) VALUES ($1, 'Interested')`, [b]);

  const r = await measureF5();
  expect(r.id).toBe("F5");
  expect(r.measured).toBe(1);
  expect(r.verdict).toBe("fail");
});

/* p10 rather than the median, because a median hides the tail and the tail is
 * where a triage decision becomes impossible. */
test("F6 reports p10 over biddable rows only", async () => {
  await reset();
  const src = await source("F6 source", "US");
  /* TWO short rows, not one. percentile_cont INTERPOLATES: with a single short
   * row in ten, p10 lands between values[0] and values[1] at 815 -- which is
   * correct behaviour and made the first version of this test wrong. Two short
   * rows put both interpolation endpoints at 50. */
  for (let i = 0; i < 8; i++) await sol(src, null, null, "Solicitation", "x".repeat(900));
  await sol(src, null, null, "Solicitation", "x".repeat(50));
  await sol(src, null, null, "Solicitation", "x".repeat(50));
  /* An award notice with an empty description is not a defect -- there is
   * nothing to decide -- and it must not drag p10 down. */
  await sol(src, null, null, "Award Notice", "");

  const r = await measureF6();
  expect(r.id).toBe("F6");
  expect(Number(r.measured)).toBeLessThan(200);
  expect(r.verdict).toBe("fail");
  expect(r.detail).toContain("over 10 biddable rows");
});

test("F6 passes when even the tail is readable", async () => {
  await reset();
  const src = await source("F6 healthy", "US");
  for (let i = 0; i < 10; i++) await sol(src, null, null, "Solicitation", "x".repeat(900));

  const r = await measureF6();
  expect(Number(r.measured)).toBeGreaterThanOrEqual(200);
  expect(r.verdict).toBe("pass");
});

test("F7 measures reachability only over rows that defer to a document", async () => {
  await reset();
  const src = await source("F7 source", "US");
  const withDoc = await sol(
    src, null, null, "Solicitation",
    "Base + four years - see SOW and additional items list",
  );
  await sol(src, null, null, "Solicitation", "Refer to the attached solicitation document.");
  /* Self-contained: must not enter the denominator at all. */
  await sol(src, null, null, "Solicitation", "A complete scope of work is described here in full.");
  await run(`INSERT INTO document (solicitation_id, filename) VALUES ($1, 'sow.pdf')`, [withDoc]);

  const r = await measureF7();
  expect(r.id).toBe("F7");
  expect(r.detail).toContain("1 of 2");
  expect(Number(r.measured)).toBeCloseTo(0.5, 2);
  expect(r.verdict).toBe("fail");
});

test("F7 is unknown, not passing, when nothing defers to a document", async () => {
  await reset();
  const src = await source("F7 empty", "US");
  await sol(src, null, null, "Solicitation", "Fully described inline.");

  const r = await measureF7();
  expect(r.verdict).toBe("unknown");
});

/* ------------------------------------------------------------ the report -- */

test("measureFloor returns all seven predicates in order and blocks on a failure", async () => {
  await reset();
  const src = await source("floor lonely", "US");
  await ingested(src);

  const report = await measureFloor();
  expect(report.predicates).toHaveLength(7);
  expect(report.predicates.map((p) => p.id)).toEqual(["F1", "F2", "F3", "F4", "F5", "F6", "F7"]);
  expect(report.blocksAdjudication).toBe(true);
  expect(report.summary).toContain("F1");
});

/* The point of keeping `unknown` and `fail` apart everywhere else is that they
 * mean different things to a READER and the same thing to the GATE. "We have
 * not measured it" is not permission to proceed.
 *
 * ⚠️ THE FIRST VERSION OF THIS TEST WAS VACUOUS, and a mutation caught it.
 * It asserted `blocksAdjudication` while a FAILING predicate was also present,
 * so removing `unknown` from the blocking filter changed nothing and the test
 * still passed. Proving the claim requires a state where EVERY predicate is
 * `pass` except one `unknown` -- so blocking can only be attributable to it. */
test("an UNKNOWN predicate blocks adjudication with no FAIL anywhere to explain it", async () => {
  await reset();
  /* F1 + F2: two ingested sources, one of them in the primary geography. */
  const fed = await source("all-pass federal", "US");
  const ind = await source("all-pass indiana", "IN");
  /* F4: consecutive weeks, no gap. */
  await ingested(fed, "2026-08-03T00:00:00Z");
  await ingested(ind, "2026-08-10T00:00:00Z");

  /* F5: a hundred real decisions. F6: descriptions long enough that even p10
   * clears the threshold. F7: no deferral marker anywhere, so it is UNKNOWN --
   * the one predicate that is not `pass`. */
  await run(
    `INSERT INTO solicitation (title, source_id, kind, description)
     SELECT 'bulk fixture', $1, 'Solicitation', repeat('x', 900)
       FROM generate_series(1, 100)`,
    [fed],
  );
  await run(
    `INSERT INTO pursuit (solicitation_id, state)
     SELECT id, 'Interested' FROM solicitation`,
  );

  const report = await measureFloor();
  const byId = Object.fromEntries(report.predicates.map((p) => [p.id, p.verdict]));

  /* The load-bearing assertion: nothing FAILS. */
  expect(report.predicates.filter((p) => p.verdict === "fail")).toEqual([]);
  expect(byId.F7).toBe("unknown");
  expect(report.blocksAdjudication).toBe(true);
});

test("the report says out loud that the thresholds are unratified", async () => {
  const report = await measureFloor();
  expect(report.thresholdsRatified).toBe(false);
  expect(report.summary).toContain("UNRATIFIED");
});
