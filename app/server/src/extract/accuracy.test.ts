import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

/* accuracyByField() is the ONE database-touching export of precedence.ts.
 * Its own test lives in this SEPARATE file rather than inside
 * precedence.test.ts, on purpose: precedence.ts imports db/index.js
 * DYNAMICALLY, inside accuracyByField() only, specifically so that
 * resolveField() -- a pure function -- and its tests never require a
 * database connection (see the comment on that import in precedence.ts,
 * and scripts/check.mjs, which strips DATABASE_URL from the test child's
 * environment to enforce exactly this). Calling useTestSchema() /
 * resetSchema() at the top of precedence.test.ts would put that
 * requirement right back on resolveField()'s tests -- undoing the fix by
 * reintroducing it one layer up. */
useTestSchema("test_accuracy");
await resetSchema();

/* Ruling 6 (SP2 T2 coordinator review; see db/schema.test.ts and
 * db/migrate.test.ts for the same config). Vitest's default 5000ms
 * testTimeout and 10000ms hookTimeout are too tight for a live round trip
 * against the shared Neon test-branch compute: a cold start alone measures
 * ~1.1s, and several agents can be running the suite concurrently against
 * the same compute (each gets its own SCHEMA -- SP1.5 Ruling 3 -- but they
 * still contend for the one compute's connections). This file's own
 * beforeAll migrate() measured ~3.6s against the 10000ms default
 * hookTimeout -- a 2.8x margin even uncontended, and
 * scripts/clean-test-schemas.mjs records this exact failure already having
 * been paid for once (corpus.test.ts tipping over the default under
 * parallel load and failing a gate that had passed minutes earlier).
 * 30000ms matches every other db-backed test file's margin. */
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const { migrate } = await import("../db/migrate.js");
const { insert, run, close } = await import("../db/index.js");
const { accuracyByField } = await import("./precedence.js");

beforeAll(async () => {
  await migrate(false);
});

afterAll(async () => {
  await close();
});

/* The FSSA bundle, 26-87847 (same real event precedence.test.ts's FSSA
 * fixture encodes) -- one listing row and three document rows for
 * closes_at, two of the three documents carrying the stale date. Fix
 * round 1, Critical: this is also the case the reviewer used to verify the
 * fixed JOIN still scores correctly once `l.value_text IS NOT NULL` was
 * added -- agreed=1, disagreed=2, unchanged by that fix. */
test("the FSSA case: two of three documents disagree with the listing", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title) VALUES ('FSSA 26-87847') RETURNING id`,
  );
  await run(
    `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin)
     VALUES ($1, 'closes_at', '2026-09-17', 'listing')`,
    [sol],
  );
  for (const value of ["2026-08-26", "2026-09-17", "2026-08-26"]) {
    await run(
      `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin, quote)
       VALUES ($1, 'closes_at', $2, 'document', 'due ...')`,
      [sol, value],
    );
  }

  /* accuracyByField() GROUPs by field_name across the WHOLE schema, not
   * scoped to the solicitation this test just inserted -- fix round 2,
   * coordinator nit. This assertion is correct only because no other test
   * in this file writes a 'closes_at' pair; a future test that did would
   * silently change these numbers without touching this test's own rows. */
  const rows = await accuracyByField();
  expect(rows.find((r) => r.field_name === "closes_at")).toMatchObject({
    agreed: 1,
    disagreed: 2,
  });
});

/* Fix round 1, Critical (the finding this test exists to pin down): Task 9
 * writes a 'listing' row with value_text NULL for qa_closes_at and
 * prebid_at, deliberately, to record "the portal does not carry this" as a
 * fact -- not as a ground-truth value of "absent" to score document
 * extractions against. Before the JOIN's `l.value_text IS NOT NULL` guard,
 * a correctly extracted document value here counted as 100% disagreement,
 * permanently, because IS DISTINCT FROM treats NULL against a stated value
 * as distinct. This asserts the field drops out of the result entirely,
 * not merely that it scores well. */
test("a NULL listing value is not ground truth -- the field is absent from the result", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title) VALUES ('listing silent on qa_closes_at') RETURNING id`,
  );
  await run(
    `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin)
     VALUES ($1, 'qa_closes_at', NULL, 'listing')`,
    [sol],
  );
  await run(
    `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin, quote)
     VALUES ($1, 'qa_closes_at', '2026-08-05', 'document', 'questions by August 5')`,
    [sol],
  );

  const rows = await accuracyByField();
  expect(rows.find((r) => r.field_name === "qa_closes_at")).toBeUndefined();
});
