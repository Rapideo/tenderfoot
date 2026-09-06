/* The tables exist so that a MISS -- a notice we do not hold -- can be
 * recorded at all. triage_sample_item and assessment both FK to
 * solicitation_id NOT NULL and structurally cannot (spec §5.3). */
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_coverage_schema");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, insert, run } = await import("../db/index.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);

afterAll(async () => {
  await close();
});

test("coverage_item can record a notice we do not hold", async () => {
  const sourceId = await insert(
    `INSERT INTO source (name) VALUES ('coverage fixture') RETURNING id`,
  );
  const runId = await insert(
    `INSERT INTO coverage_run (source_id, cohort_from, cohort_to)
     VALUES ($1, '2026-09-02', '2026-09-06') RETURNING id`,
    [sourceId],
  );
  /* No solicitation_id anywhere. That is the point. */
  await run(
    `INSERT INTO coverage_item
       (run_id, external_id, segment, key_origin, key_seen_at, deadline, carried)
     VALUES ($1, '003000000088067', 'state_agency', 'Indiana IDOA solicitations',
             now(), '2026-09-03', 'missing')`,
    [runId],
  );
  const rows = await all(`SELECT carried FROM coverage_item WHERE run_id = $1`, [runId]);
  expect(rows).toHaveLength(1);
  expect(rows[0].carried).toBe("missing");
});

test("key_source_id is nullable, because a sub-state buyer has no registry row", async () => {
  const sourceId = await insert(
    `INSERT INTO source (name) VALUES ('coverage fixture 2') RETURNING id`,
  );
  const runId = await insert(
    `INSERT INTO coverage_run (source_id, cohort_from, cohort_to)
     VALUES ($1, '2026-09-02', '2026-09-06') RETURNING id`,
    [sourceId],
  );
  await run(
    `INSERT INTO coverage_item
       (run_id, external_id, segment, key_origin, key_seen_at, carried)
     VALUES ($1, '132', 'sub_state', 'fortwayne.gov/bids', now(), 'missing')`,
    [runId],
  );
  const rows = await all(
    `SELECT key_source_id, key_origin FROM coverage_item WHERE run_id = $1`,
    [runId],
  );
  expect(rows[0].key_source_id).toBeNull();
  expect(rows[0].key_origin).toBe("fortwayne.gov/bids");
});

test("carried is constrained to the three states, so a typo cannot become a fourth", async () => {
  const sourceId = await insert(
    `INSERT INTO source (name) VALUES ('coverage fixture 3') RETURNING id`,
  );
  const runId = await insert(
    `INSERT INTO coverage_run (source_id, cohort_from, cohort_to)
     VALUES ($1, '2026-09-02', '2026-09-06') RETURNING id`,
    [sourceId],
  );
  await expect(
    run(
      `INSERT INTO coverage_item
         (run_id, external_id, segment, key_origin, key_seen_at, carried)
       VALUES ($1, 'x', 'state_agency', 'k', now(), 'carrried')`,
      [runId],
    ),
  ).rejects.toThrow();
});
