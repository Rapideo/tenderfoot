import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_sample");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, insert, run } = await import("../db/index.js");
const { drawSample, getSample } = await import("./sample.js");
const { queuePage } = await import("./queue.js");

const FUTURE = "2027-06-01";
let source: number;

beforeAll(async () => {
  await migrate(false);
  source = await insert(`INSERT INTO source (name) VALUES ('sampling source') RETURNING id`);
}, 120000);
afterAll(async () => {
  await close();
});

async function sol(title: string, sourceId = source): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id, closes_at) VALUES ($1, $2, $3) RETURNING id`,
    [title, sourceId, FUTURE],
  );
}

test("the draw records the population it drew from", async () => {
  for (let i = 0; i < 20; i++) await sol(`pop ${i}`);
  const sample = await drawSample({ sourceId: source, n: 5, seed: "alpha" });

  expect(sample.n_requested).toBe(5);
  expect(sample.drawn).toBe(5);
  /* The denominator is what was ELIGIBLE, not what was drawn. */
  expect(sample.population_size).toBeGreaterThanOrEqual(20);
});

test("asking for more than exists draws all of it, and says so", async () => {
  const lonely = await insert(`INSERT INTO source (name) VALUES ('one row only') RETURNING id`);
  await sol("the only one", lonely);
  const sample = await drawSample({ sourceId: lonely, n: 100, seed: "beta" });

  expect(sample.n_requested).toBe(100);
  expect(sample.drawn).toBe(1);
  expect(sample.population_size).toBe(1);
});

test("the same seed draws the same rows", async () => {
  const a = await drawSample({ sourceId: source, n: 5, seed: "same-seed" });
  const b = await drawSample({ sourceId: source, n: 5, seed: "same-seed" });

  const ids = async (id: number) =>
    (
      await all<{ solicitation_id: number }>(
        `SELECT solicitation_id FROM triage_sample_item WHERE sample_id = $1 ORDER BY position`,
        [id],
      )
    ).map((r) => r.solicitation_id);

  expect(await ids(a.id)).toEqual(await ids(b.id));
});

test("different seeds draw different rows", async () => {
  const a = await drawSample({ sourceId: source, n: 5, seed: "seed-one" });
  const b = await drawSample({ sourceId: source, n: 5, seed: "seed-two" });

  const ids = async (id: number) =>
    (
      await all<{ solicitation_id: number }>(
        `SELECT solicitation_id FROM triage_sample_item WHERE sample_id = $1 ORDER BY position`,
        [id],
      )
    ).map((r) => r.solicitation_id);

  expect(await ids(a.id)).not.toEqual(await ids(b.id));
});

/* THE PROPERTY THE WHOLE MIGRATION EXISTS FOR. A seeded ORDER BY over the
 * live eligible set would silently reshuffle here, and the denominator the
 * session started with would not be the one it ended with. */
test("a sample does not change when new solicitations arrive", async () => {
  const sample = await drawSample({ sourceId: source, n: 5, seed: "stability" });
  const before = await all<{ solicitation_id: number }>(
    `SELECT solicitation_id FROM triage_sample_item WHERE sample_id = $1 ORDER BY position`,
    [sample.id],
  );

  for (let i = 0; i < 40; i++) await sol(`arrived later ${i}`);

  const after = await all<{ solicitation_id: number }>(
    `SELECT solicitation_id FROM triage_sample_item WHERE sample_id = $1 ORDER BY position`,
    [sample.id],
  );
  expect(after).toEqual(before);

  const reread = await getSample(sample.id);
  expect(reread?.population_size).toBe(sample.population_size);
});

/* Removing it would MOVE THE DENOMINATOR, which is the exact failure the
 * materialised draw exists to prevent. */
test("an item whose deadline passes stays in the sample", async () => {
  const doomed = await sol("closes during the session");
  const sample = await drawSample({ sourceId: source, n: 200, seed: "closing" });

  await run(`UPDATE solicitation SET closes_at = '2020-01-01' WHERE id = $1`, [doomed]);

  const items = await all<{ solicitation_id: number }>(
    `SELECT solicitation_id FROM triage_sample_item WHERE sample_id = $1`,
    [sample.id],
  );
  expect(items.map((i) => i.solicitation_id)).toContain(doomed);
});

/* IMPORTANT fix. Before this fix, queue.ts applied ELIGIBLE (which excludes
 * closed rows) INSIDE sample-mode membership too -- so a drawn item whose
 * deadline passed became unreachable even though its triage_sample_item row
 * (asserted above) survived. Spec §10: "An item's deadline passes mid-
 * session -> Stays in the sample, marked closed." This proves the item
 * itself, not just its sample row, stays reachable -- and that an item
 * still open in the SAME sample is not wrongly marked closed too. */
test("a drawn item whose deadline passed still appears in sample mode, marked closed", async () => {
  const doomed = await sol("closes mid-session, still in the sample");
  const stillOpen = await sol("stays open, same sample");
  const sample = await drawSample({ sourceId: source, n: 200, seed: "closed-in-sample" });

  await run(`UPDATE solicitation SET closes_at = '2020-01-01' WHERE id = $1`, [doomed]);

  const page = await queuePage({ sampleId: sample.id, limit: 200 });
  const doomedItem = page.items.find((i) => i.id === doomed);
  const openItem = page.items.find((i) => i.id === stillOpen);

  expect(doomedItem, "closed item must still be reachable in sample mode").toBeDefined();
  expect(doomedItem!.closed).toBe(true);
  expect(openItem, "the still-open item must also be reachable").toBeDefined();
  expect(openItem!.closed).toBe(false);
});

/* The other half of the same fix: ordinary (non-sample) queue membership is
 * UNCHANGED -- a closed item, drawn or not, must still not appear there. */
test("a drawn item whose deadline passed still does not appear in the ordinary (non-sample) queue", async () => {
  const doomed = await sol("closes mid-session, ordinary queue");
  await drawSample({ sourceId: source, n: 200, seed: "closed-ordinary" });

  await run(`UPDATE solicitation SET closes_at = '2020-01-01' WHERE id = $1`, [doomed]);

  const page = await queuePage({ limit: 200 });
  expect(page.items.map((i) => i.id)).not.toContain(doomed);
});

test("the queue in sample mode says so, and carries the denominator", async () => {
  const sample = await drawSample({ sourceId: source, n: 5, seed: "mode" });
  const page = await queuePage({ sampleId: sample.id });

  expect(page.mode).toBe("sample");
  expect(page.sample?.population_size).toBe(sample.population_size);
  expect(page.items.length).toBeLessThanOrEqual(5);
});

test("a second draw for the same source is a new sample, never an edit", async () => {
  const first = await drawSample({ sourceId: source, n: 3, seed: "first" });
  const second = await drawSample({ sourceId: source, n: 3, seed: "second" });
  expect(second.id).not.toBe(first.id);

  const stillThere = await getSample(first.id);
  expect(stillThere?.population_size).toBe(first.population_size);
});
