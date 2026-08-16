import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_admin");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close } = await import("../db/index.js");
const { app } = await import("../index.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);
afterAll(async () => {
  await close();
});

/* `Response.json()` resolves to `unknown` under these lib types, so
 * `.error` on it fails typecheck while vitest passes -- the same split
 * routes.test.ts already documents and fixes. Cast at the call site rather
 * than typing the whole response; nothing else here needs the shape. */
async function post(body: unknown) {
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    return await fetch(`http://127.0.0.1:${port}/api/admin/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    server.close();
  }
}

test("a run with no window is refused with 400", async () => {
  const res = await post({ source: "fake", depth: "listing" });
  expect(res.status).toBe(400);
  expect(((await res.json()) as any).error).toMatch(/since/i);
});

/* §1.1 -- the contract must refuse a content filter rather than ignore it. */
test("a content filter is refused with 400", async () => {
  const res = await post({ source: "fake", since: "2026-08-01", depth: "listing", minValue: 50000 });
  expect(res.status).toBe(400);
  expect(((await res.json()) as any).error).toMatch(/minValue/);
});

test("a valid run streams a SQLite artifact back", async () => {
  const res = await post({ source: "fake", since: "2026-08-01", depth: "listing" });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/sqlite|octet-stream/);
  const buf = Buffer.from(await res.arrayBuffer());
  /* Every SQLite file begins with this magic string. */
  expect(buf.subarray(0, 15).toString()).toBe("SQLite format 3");
  expect(res.headers.get("x-scrape-done")).toBe("true");
});
