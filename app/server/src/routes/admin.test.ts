import { afterAll, beforeAll, expect, test } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

/* Fix round 1 (2026-08-15, after review): pins the PRE-STREAM failure
 * path -- `runScrape` throwing before a single response byte has gone out
 * -- which is exactly the path `sam`/`usaspending` adapters can hit via a
 * real network error from `adapter.fetchListing`. Registers a throwaway
 * adapter directly on the shared registry (mutating the same object
 * `routes/admin.ts` looks sources up in -- `ADAPTERS` is a plain object,
 * not frozen) rather than guessing at a temp-dir name: the assertion looks
 * at whatever `tf-scrape-*` entries actually exist before and after,
 * whatever name mkdtempSync happened to generate.
 *
 * WHY `existsSync` GATES THE COMPARISON rather than a bare `readdirSync`
 * diff: verified directly, repeatedly, in this exact suite that Windows'
 * `readdirSync` on the OS temp dir is NOT immediately consistent with a
 * directory that was just removed in the SAME process a few milliseconds
 * earlier -- an already-deleted directory (confirmed gone via `existsSync`,
 * a direct stat, taken immediately after its own `rmSync` call succeeded)
 * intermittently still showed up in a subsequent `readdirSync` snapshot of
 * the parent, non-deterministically landing in either the "before" or the
 * "after" listing across otherwise-identical runs. `existsSync` never
 * exhibited that lag in any observed run, so it is the authoritative check
 * here: an entry the listing reports as newly present after this test's
 * own request is only treated as a real leak if a direct stat also confirms
 * it still exists. A genuine leak (this test failing against the pre-fix
 * handler) reliably passes that stat check, since the leaked directory is
 * never removed at all, not merely removed-but-not-yet-reflected. */
test("a pre-stream failure (adapter throws) does not leak the temp directory", async () => {
  const { ADAPTERS } = await import("../scrape/adapters/registry.js");
  ADAPTERS.breaks = () => ({
    name: "breaks",
    fetchListing: () => Promise.reject(new Error("simulated adapter network failure")),
  });

  const before = new Set(readdirSync(tmpdir()).filter((n) => n.startsWith("tf-scrape-")));
  try {
    const res = await post({ source: "breaks", since: "2026-08-01", depth: "listing" });
    expect(res.status).toBe(500);
    const after = readdirSync(tmpdir()).filter((n) => n.startsWith("tf-scrape-"));
    const leaked = after.filter((n) => !before.has(n) && existsSync(join(tmpdir(), n)));
    expect(leaked).toEqual([]);
  } finally {
    delete ADAPTERS.breaks;
  }
});
