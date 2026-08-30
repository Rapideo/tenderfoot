import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_queue");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run, pool } = await import("../db/index.js");
const { queuePage } = await import("./queue.js");

/* Statement spy, copied in shape from merge.test.ts: a spy, not a stub, and
 * attached at module level because pool.on("connect") fires at client
 * CREATION -- a listener registered inside a test would count zero, which is
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

const FUTURE = "2027-06-01";
const PAST = "2020-01-01";

beforeAll(async () => {
  await migrate(false);
}, 120000);
afterAll(async () => {
  await close();
});

async function sol(title: string, closesAt: string | null): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id, closes_at) VALUES ($1, 1, $2) RETURNING id`,
    [title, closesAt],
  );
}

test("an undecided, still-open solicitation is in the queue", async () => {
  const id = await sol("open and undecided", FUTURE);
  const page = await queuePage();
  expect(page.items.map((i) => i.id)).toContain(id);
});

test("a decided solicitation leaves the queue", async () => {
  const id = await sol("already judged", FUTURE);
  await run(`INSERT INTO pursuit (solicitation_id, state) VALUES ($1, 'Interested')`, [id]);
  const page = await queuePage();
  expect(page.items.map((i) => i.id)).not.toContain(id);
});

/* 'New' is the schema default and means UNDECIDED. A row carrying it must
 * stay in the queue -- treating any pursuit row as a decision would empty
 * the queue for anything the system had merely touched. */
test("a pursuit row in state New is not a decision", async () => {
  const id = await sol("touched but undecided", FUTURE);
  await run(`INSERT INTO pursuit (solicitation_id, state) VALUES ($1, 'New')`, [id]);
  const page = await queuePage();
  expect(page.items.map((i) => i.id)).toContain(id);
});

test("a reversal back to New returns it to the queue", async () => {
  const id = await sol("reversed to undecided", FUTURE);
  await run(
    `INSERT INTO pursuit (solicitation_id, state, created_at)
     VALUES ($1, 'Interested', '2026-08-30T10:00:00Z')`,
    [id],
  );
  await run(
    `INSERT INTO pursuit (solicitation_id, state, created_at)
     VALUES ($1, 'New', '2026-08-30T11:00:00Z')`,
    [id],
  );
  const page = await queuePage();
  expect(page.items.map((i) => i.id)).toContain(id);
});

test("a closed solicitation is not in the queue", async () => {
  const id = await sol("closed last year", PAST);
  const page = await queuePage();
  expect(page.items.map((i) => i.id)).not.toContain(id);
});

/* A missing deadline is not a reason to hide an opportunity. But sorting
 * unknown-as-urgent is how a null becomes a false alarm, so it goes last. */
test("a solicitation with no deadline is included, and sorted last", async () => {
  const undated = await sol("no deadline at all", null);
  const dated = await sol("closes soon", FUTURE);
  const page = await queuePage();
  const ids = page.items.map((i) => i.id);
  expect(ids).toContain(undated);
  expect(ids.indexOf(dated)).toBeLessThan(ids.indexOf(undated));
});

test("soonest deadline comes first", async () => {
  const later = await sol("closes later", "2027-12-01");
  const sooner = await sol("closes sooner", "2027-01-15");
  const page = await queuePage();
  const ids = page.items.map((i) => i.id);
  expect(ids.indexOf(sooner)).toBeLessThan(ids.indexOf(later));
});

/* THE ASSERTION IS CONSTANCY, NOT SMALLNESS -- the merge.ts precedent. A
 * bound like `<= 5` passes for any implementation whose constant happens to
 * fit, and keeps passing when cost quietly becomes proportional again with a
 * small multiplier. Only a set-based implementation can issue the same
 * number of statements for 5 items and for 25. */
test("queue cost is CONSTANT in the number of items returned", async () => {
  for (let i = 0; i < 5; i++) await sol(`small ${i}`, FUTURE);
  statements.length = 0;
  const small = await queuePage({ limit: 5 });
  const smallStatements = statements.length;

  for (let i = 0; i < 25; i++) await sol(`large ${i}`, FUTURE);
  statements.length = 0;
  const large = await queuePage({ limit: 25 });
  const largeStatements = statements.length;

  /* The page must actually have returned the work -- five times as many
   * items. A queue that returned nothing would be constant too, and
   * worthless. */
  expect(small.items).toHaveLength(5);
  expect(large.items).toHaveLength(25);

  expect(largeStatements).toBe(smallStatements);
}, 120000);
