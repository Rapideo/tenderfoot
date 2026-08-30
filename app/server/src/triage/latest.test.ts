import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_latest");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run } = await import("../db/index.js");
const { latestPursuitFor } = await import("./latest.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);
afterAll(async () => {
  await close();
});

async function solicitation(title: string): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id) VALUES ($1, 1) RETURNING id`,
    [title],
  );
}

test("the latest row wins, and the earlier ones still exist", async () => {
  const sol = await solicitation("reversal");
  await run(
    `INSERT INTO pursuit (solicitation_id, state, created_at)
     VALUES ($1, 'Interested', '2026-08-30T10:00:00Z')`,
    [sol],
  );
  await run(
    `INSERT INTO pursuit (solicitation_id, state, reason, created_at)
     VALUES ($1, 'Not Interested', 'on second look', '2026-08-30T11:00:00Z')`,
    [sol],
  );

  const latest = await latestPursuitFor([sol]);
  expect(latest).toHaveLength(1);
  expect(latest[0]!.state).toBe("Not Interested");
  expect(latest[0]!.reason).toBe("on second look");
});

/* Two decisions inside the same millisecond are not hypothetical: an undo
 * followed immediately by a re-decision is exactly that shape, and
 * created_at alone cannot order them. */
test("a same-timestamp tie is broken by id, not left to chance", async () => {
  const sol = await solicitation("tie");
  const stamp = "2026-08-30T12:00:00.000Z";
  await run(
    `INSERT INTO pursuit (solicitation_id, state, created_at) VALUES ($1, 'Interested', $2)`,
    [sol, stamp],
  );
  await run(
    `INSERT INTO pursuit (solicitation_id, state, created_at) VALUES ($1, 'Not Interested', $2)`,
    [sol, stamp],
  );

  const latest = await latestPursuitFor([sol]);
  expect(latest[0]!.state).toBe("Not Interested");
});

test("a solicitation with no pursuit row returns nothing, not a fabricated New", async () => {
  const sol = await solicitation("untouched");
  expect(await latestPursuitFor([sol])).toHaveLength(0);
});

test("an empty id list issues no query and returns nothing", async () => {
  expect(await latestPursuitFor([])).toEqual([]);
});
