import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_decide");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, insert } = await import("../db/index.js");
const { recordDecision, ReasonRequiredError, DiscoveryChannelRequiredError } =
  await import("./decide.js");

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
    discoveryChannel: "nowhere",
    decidedBy: "matt",
  });
  expect(latest.state).toBe("Interested");
  expect(latest.decided_by).toBe("matt");
});

/* THE APPEND-ONLY PROPERTY. This is the test that fails the moment somebody
 * "optimises" this into an UPDATE. */
test("changing a decision leaves the earlier one intact", async () => {
  const id = await sol("changed my mind");
  await recordDecision({ solicitationId: id, state: "Interested", discoveryChannel: "nowhere" });
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
  const latest = await recordDecision({ solicitationId: id, state: "Interested", discoveryChannel: "nowhere" });
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

/* ─── DISCOVERY CHANNEL: §8.5's whole measure, ruled by Matt 2026-09-01 ───
 *
 * "Discovery -- qualified opportunities surfaced that would not have been
 * seen" is the gate's only measure, and nothing recorded it until migration
 * 013. These tests pin the rule that makes the number countable at all: an
 * Interested decision cannot be written without a channel. */

test("Interested requires a discovery channel", async () => {
  const id = await sol("Needs a channel");
  await expect(recordDecision({ solicitationId: id, state: "Interested" })).rejects.toBeInstanceOf(
    DiscoveryChannelRequiredError,
  );
});

test("Pass does not require one, and never stores one", async () => {
  const id = await sol("A pass");
  /* §8.5 asks about QUALIFIED opportunities, so a channel on a rejected item
   * would enter the denominator of a rate it is not part of. */
  await recordDecision({ solicitationId: id, state: "Not Interested", reason: "too small" });
  const [row] = await all<{ discovery_channel: string | null }>(
    `SELECT discovery_channel FROM pursuit WHERE solicitation_id = $1`,
    [id],
  );
  expect(row?.discovery_channel).toBeNull();
});

test("the channel is stored with the decision that produced it", async () => {
  const id = await sol("Discovered here");
  await recordDecision({ solicitationId: id, state: "Interested", discoveryChannel: "nowhere" });
  const [row] = await all<{ discovery_channel: string }>(
    `SELECT discovery_channel FROM pursuit WHERE solicitation_id = $1`,
    [id],
  );
  expect(row?.discovery_channel).toBe("nowhere");
});

/* `not_sure` is a REAL answer, not a skip. The whole reason the prompt can be
 * required without ever blocking a decision is that this value exists -- so it
 * must be storable, and it must not be treated as absence. */
test("not_sure is a storable answer, not a missing one", async () => {
  const id = await sol("Honestly unsure");
  await recordDecision({ solicitationId: id, state: "Interested", discoveryChannel: "not_sure" });
  const [row] = await all<{ discovery_channel: string }>(
    `SELECT discovery_channel FROM pursuit WHERE solicitation_id = $1`,
    [id],
  );
  expect(row?.discovery_channel).toBe("not_sure");
});

/* ⚠️ VALIDITY IS THE DATABASE'S JOB, deliberately (migration 013's CHECK).
 * recordDecision only enforces PRESENCE, so a value outside the vocabulary
 * fails loudly here rather than being silently coerced into something the
 * metric would then count. If this ever stops throwing, the CHECK is gone and
 * the discovery rate is being computed over strings nobody recognises. */
test("a channel outside the vocabulary is rejected by the schema", async () => {
  const id = await sol("Bad vocabulary");
  await expect(
    recordDecision({
      solicitationId: id,
      state: "Interested",
      discoveryChannel: "carrier_pigeon" as never,
    }),
  ).rejects.toThrow();
});
