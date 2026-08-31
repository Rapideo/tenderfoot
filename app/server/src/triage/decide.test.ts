import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_decide");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, insert } = await import("../db/index.js");
const { recordDecision, ReasonRequiredError } = await import("./decide.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);
afterAll(async () => {
  await close();
});

async function sol(title: string): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id) VALUES ($1, 1) RETURNING id`,
    [title],
  );
}

test("a decision appends a row and returns the new latest state", async () => {
  const id = await sol("first decision");
  const latest = await recordDecision({
    solicitationId: id,
    state: "Interested",
    decidedBy: "matt",
  });
  expect(latest.state).toBe("Interested");
  expect(latest.decided_by).toBe("matt");
});

/* THE APPEND-ONLY PROPERTY. This is the test that fails the moment somebody
 * "optimises" this into an UPDATE. */
test("changing a decision leaves the earlier one intact", async () => {
  const id = await sol("changed my mind");
  await recordDecision({ solicitationId: id, state: "Interested" });
  await recordDecision({ solicitationId: id, state: "Not Interested", reason: "too big for us" });

  const rows = await all<{ state: string }>(
    `SELECT state FROM pursuit WHERE solicitation_id = $1 ORDER BY id`,
    [id],
  );
  expect(rows.map((r) => r.state)).toEqual(["Interested", "Not Interested"]);
});

test("undo is an append back to New, not a delete", async () => {
  const id = await sol("mis-tap");
  await recordDecision({ solicitationId: id, state: "Not Interested", reason: "wrong key" });
  const latest = await recordDecision({ solicitationId: id, state: "New" });

  expect(latest.state).toBe("New");
  const rows = await all<{ id: number }>(
    `SELECT id FROM pursuit WHERE solicitation_id = $1`,
    [id],
  );
  expect(rows).toHaveLength(2);
});

/* A rejection with no reason is the one event that teaches nothing (SVRC
 * Region 1.1.4). Mandatory on Pass is the DEFAULT, not a law. */
test("Pass with no reason is refused by default", async () => {
  const id = await sol("silent pass");
  await expect(
    recordDecision({ solicitationId: id, state: "Not Interested" }),
  ).rejects.toBeInstanceOf(ReasonRequiredError);
});

test("whitespace is not a reason", async () => {
  const id = await sol("whitespace pass");
  await expect(
    recordDecision({ solicitationId: id, state: "Not Interested", reason: "   " }),
  ).rejects.toBeInstanceOf(ReasonRequiredError);
});

test("a firm may switch mandatory-on-Pass off", async () => {
  const id = await sol("obvious junk");
  const latest = await recordDecision({
    solicitationId: id,
    state: "Not Interested",
    requireReasonOnPass: false,
  });
  expect(latest.state).toBe("Not Interested");
  expect(latest.reason).toBeNull();
});

test("Interested needs no reason", async () => {
  const id = await sol("clear yes");
  const latest = await recordDecision({ solicitationId: id, state: "Interested" });
  expect(latest.state).toBe("Interested");
});

/* DEVIATION 1 (task-4-report.md): the brief's own /state/i regex also
 * matches Postgres's CHECK-constraint violation text -- "...violates check
 * constraint \"pursuit_state_check\"" -- via the constraint's OWN name, so
 * that assertion passed even with the app-level guard deleted (confirmed by
 * mutation testing). Tightened to the guard's actual message so this test
 * fails when the thing it names -- rejection BEFORE the database is
 * reached -- stops happening. */
test("an unknown state is refused before it reaches the CHECK constraint", async () => {
  const id = await sol("bad state");
  await expect(
    recordDecision({ solicitationId: id, state: "Maybe" as never }),
  ).rejects.toThrow(/unknown pursuit state/i);
});
