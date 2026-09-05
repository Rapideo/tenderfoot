import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_documents_route");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { one, close, insert, run } = await import("../db/index.js");
const { api } = await import("./index.js");
const express = (await import("express")).default;

let solicitationId: number;
let server: any;
let base: string;

/* ⚖️ RULING (preflight, 2026-09-05): NO `supertest`. It is not a dependency of
 * this repo, and `routes.test.ts` already establishes the house harness --
 * `app.listen(0)` on an ephemeral port, then real `fetch`. Adding a dependency
 * so one new test can differ from every existing route test is the wrong
 * trade. This block mirrors routes.test.ts:18-32 deliberately. */
type Res = [status: number, body: any];
const post = (p: string): Promise<Res> =>
  fetch(base + p, { method: "POST" }).then(async (r) => [r.status, await r.json()] as Res);
const get = (p: string): Promise<Res> =>
  fetch(base + p).then(async (r) => [r.status, await r.json()] as Res);

beforeAll(async () => {
  await migrate(false);
  const app = express();
  app.use(express.json());
  app.use("/api", api);
  await new Promise<void>((r) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}/api`;
      r();
    });
  });
}, 120000);

beforeEach(async () => {
  await run(`DELETE FROM api_spend`);
  await run(`DELETE FROM solicitation WHERE title = 'route doc fixture'`);
  const samId = (await one<{ id: number }>(`SELECT id FROM source WHERE name = 'SAM.gov'`))!.id;
  solicitationId = await insert(
    `INSERT INTO solicitation (title, source_id, external_id, posted_at, posted_at_origin)
     VALUES ('route doc fixture', $1, 'notice-route', '2026-08-01', 'published') RETURNING id`,
    [samId],
  );
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await close();
});

/* The route is exercised against a solicitation that has ALREADY been
 * stamped, so no network call is attempted and the test never touches
 * SAM.gov. The stamp guard is what makes the route testable for free. */
test("an already-checked solicitation returns already-looked and spends nothing", async () => {
  await run(`UPDATE solicitation SET attachments_checked_at = now() WHERE id = $1`, [
    solicitationId,
  ]);
  const [status, body] = await post(`/solicitations/${solicitationId}/documents`);
  expect(status).toBe(200);
  expect(body.reason).toBe("already-looked");
  expect(body.spent).toBe(0);
});

test("an unknown solicitation is a 404, not a 500", async () => {
  const [status] = await post(`/solicitations/999999/documents`);
  expect(status).toBe(404);
});

/* 🔴 GET MUST STAY FREE. This is the reason the fetch is a POST at all:
 * prefetch, retries, double-renders and crawlers all issue GETs, and none
 * of them is a decision anyone made. */
test("GET on the record does not fetch documents or write a tally", async () => {
  const [status] = await get(`/solicitations/${solicitationId}`);
  expect(status).toBe(200);
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).toBeNull();
});
