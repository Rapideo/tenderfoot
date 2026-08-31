import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_latest");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run, all, pool } = await import("../db/index.js");
const { latestPursuitFor } = await import("./latest.js");

/* Counts every statement that reaches Postgres, by wrapping each client the
 * pool opens. A spy, not a stub: the real query still runs. Attached at
 * module level because `pool.on("connect")` fires at client CREATION and
 * beforeAll's migrate() creates the first one -- a listener registered
 * inside a test would observe nothing and count zero, which is
 * indistinguishable from a passing fix. */
const statements: string[] = [];
pool.on("connect", (client) => {
  const c = client as unknown as { query: (...a: any[]) => any };
  const orig = c.query.bind(c);
  c.query = (...a: any[]) => {
    statements.push(typeof a[0] === "string" ? a[0] : (a[0]?.text ?? ""));
    return orig(...a);
  };
});

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

  // Verify append-only invariant: both rows still exist in the database
  const allStates = await all<{ state: string }>(
    `SELECT state FROM pursuit WHERE solicitation_id = $1 ORDER BY id`,
    [sol],
  );
  expect(allStates.map((r) => r.state)).toEqual(["Interested", "Not Interested"]);
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
  const statementsBefore = statements.length;
  const result = await latestPursuitFor([]);
  const statementsAfter = statements.length;

  expect(result).toEqual([]);
  // Assert zero statements were issued -- the guard prevents the query entirely
  expect(statementsAfter - statementsBefore).toBe(0);
});
