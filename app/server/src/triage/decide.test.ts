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
    /* Required since D30 (2026-09-08), the same as it has always been on
     * Pass. */
    reason: "in our lane and the buyer knows us",
    decidedBy: "matt",
  });
  expect(latest.state).toBe("Interested");
  expect(latest.decided_by).toBe("matt");
});

/* THE APPEND-ONLY PROPERTY. This is the test that fails the moment somebody
 * "optimises" this into an UPDATE. */
test("changing a decision leaves the earlier one intact", async () => {
  const id = await sol("changed my mind");
  await recordDecision({
    solicitationId: id,
    state: "Interested",
    discoveryChannel: "nowhere",
    reason: "looked like a fit",
  });
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

/* ─── THE GOOD-FIT REASON — D30, ruled by Matt 2026-09-08 ────────────────────
 *
 * This test used to read "Interested needs no reason", and that asymmetry is
 * exactly what the ruling reverses: a rejection always carried a written
 * reason, an acceptance never had to, so 150 triaged items would leave 150
 * articulated reasons for "no" and nothing for "yes". A filter trained on that
 * corpus learns only what to exclude. */
test("Interested with no reason is refused", async () => {
  const id = await sol("clear yes, unexplained");
  await expect(
    recordDecision({ solicitationId: id, state: "Interested", discoveryChannel: "nowhere" }),
  ).rejects.toBeInstanceOf(ReasonRequiredError);
});

/* The two guards throw the SAME class, so `instanceof` alone cannot tell them
 * apart -- delete the Interested guard and a channel-less Interested would
 * still satisfy an instanceof-only assertion via the other branch's error.
 * This pins the branch, and the wording the caller is actually shown. */
test("the refusal names the branch it came from, not Pass", async () => {
  const id = await sol("wrong wording");
  await expect(
    recordDecision({ solicitationId: id, state: "Interested", discoveryChannel: "nowhere" }),
  ).rejects.toMatchObject({ branch: "Interested" });
  await expect(
    recordDecision({ solicitationId: id, state: "Interested", discoveryChannel: "nowhere" }),
  ).rejects.toThrow(/required on Interested/i);
});

test("whitespace is not a good-fit reason either", async () => {
  const id = await sol("whitespace yes");
  await expect(
    recordDecision({
      solicitationId: id,
      state: "Interested",
      discoveryChannel: "nowhere",
      reason: "   ",
    }),
  ).rejects.toBeInstanceOf(ReasonRequiredError);
});

test("Interested with a reason and a channel is recorded, and stores both", async () => {
  const id = await sol("explained yes");
  const latest = await recordDecision({
    solicitationId: id,
    state: "Interested",
    discoveryChannel: "portal",
    reason: "care-management work we have delivered twice",
  });
  expect(latest.state).toBe("Interested");
  /* The point of the ruling is the CORPUS, so the text has to survive the
   * write -- a decision that were accepted and then dropped the reason would
   * pass a state assertion and still teach nothing. */
  const [row] = await all<{ reason: string | null; discovery_channel: string | null }>(
    `SELECT reason, discovery_channel FROM pursuit WHERE solicitation_id = $1`,
    [id],
  );
  expect(row?.reason).toBe("care-management work we have delivered twice");
  expect(row?.discovery_channel).toBe("portal");
});

/* The parallel of "a firm may switch mandatory-on-Pass off". The two flags are
 * one policy about free text: a firm that turns off the rejection prompt to
 * keep a queue moving would be surprised to find the acceptance prompt still
 * blocking it. */
test("a firm may switch mandatory-on-Interested off", async () => {
  const id = await sol("obvious yes");
  const latest = await recordDecision({
    solicitationId: id,
    state: "Interested",
    discoveryChannel: "nowhere",
    requireReasonOnInterested: false,
  });
  expect(latest.state).toBe("Interested");
  expect(latest.reason).toBeNull();
});

/* ⚠️ UNDO IS NOT A DECISION. Requiring a justification to take one back would
 * make the correction harder than the mistake, and "New" carries neither a
 * reason nor a channel by design (migration 013 stores NULL for anything that
 * is not Interested). */
test("New requires nothing -- not a reason, not a channel", async () => {
  const id = await sol("back to new");
  const latest = await recordDecision({ solicitationId: id, state: "New" });
  expect(latest.state).toBe("New");
  expect(latest.reason).toBeNull();
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

/* ⚠️ NO REASON EITHER, and that is the point: since D30 an Interested needs
 * both, and the channel -- the rule with no off switch -- is the one named
 * first. If this ever starts throwing ReasonRequiredError, the two guards have
 * swapped order and the screen is being sent to the wrong control. */
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
  await recordDecision({
    solicitationId: id,
    state: "Interested",
    discoveryChannel: "nowhere",
    reason: "worth a look",
  });
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
  await recordDecision({
    solicitationId: id,
    state: "Interested",
    discoveryChannel: "not_sure",
    reason: "worth a look",
  });
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
      /* A REASON IS SUPPLIED ON PURPOSE, since D30. Without one this call
       * would be refused by the app-level reason guard and never reach the
       * database -- the test would still throw, still pass, and would have
       * stopped proving anything about the CHECK constraint it names. */
      reason: "testing the vocabulary, not the prompt",
    }),
  ).rejects.toThrow();
});
