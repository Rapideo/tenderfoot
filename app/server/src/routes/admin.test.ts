import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
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

/* FIX 3 (Critical, security, final review 2026-08-15): the route was
 * mounted with no auth of any kind -- deployed, an internet-facing
 * 240-second outbound-fetch amplifier that scrapes federal sources from
 * the app's IP for anyone who finds the URL. Every test below now runs
 * against a real secret; the three tests immediately following exercise
 * the gate itself (unset -> 503, wrong -> 401, correct -> unchanged
 * behaviour). `beforeEach` sets a valid secret so the pre-existing tests
 * (behaviour unrelated to auth) don't have to care about it individually;
 * the auth tests below override it locally, per test, exactly where it
 * matters. */
const ADMIN_SECRET = "test-shared-secret-do-not-use-in-prod";
beforeEach(() => {
  process.env.ADMIN_SCRAPE_SECRET = ADMIN_SECRET;
});

/* `Response.json()` resolves to `unknown` under these lib types, so
 * `.error` on it fails typecheck while vitest passes -- the same split
 * routes.test.ts already documents and fixes. Cast at the call site rather
 * than typing the whole response; nothing else here needs the shape. */
async function post(body: unknown, headers: Record<string, string> = { "X-Admin-Secret": ADMIN_SECRET }) {
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    return await fetch(`http://127.0.0.1:${port}/api/admin/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } finally {
    server.close();
  }
}

/* FAIL CLOSED, not merely unauthenticated-by-default: an environment that
 * simply forgot to set the secret must refuse outright, never silently run
 * as if auth were satisfied. */
test("ADMIN_SCRAPE_SECRET unset refuses every request with 503", async () => {
  delete process.env.ADMIN_SCRAPE_SECRET;
  const res = await post({ source: "fake", since: "2026-08-01", depth: "listing" }, {});
  expect(res.status).toBe(503);
});

test("a set secret rejects a request with no header at all, with 401", async () => {
  const res = await post({ source: "fake", since: "2026-08-01", depth: "listing" }, {});
  expect(res.status).toBe(401);
});

test("a set secret rejects a mismatched header, with 401", async () => {
  const res = await post(
    { source: "fake", since: "2026-08-01", depth: "listing" },
    { "X-Admin-Secret": "wrong-secret" },
  );
  expect(res.status).toBe(401);
});

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
  /* FIX 4: header present and zero on an ordinary run -- the companion
   * end-to-end test below proves it is nonzero when the adapter actually
   * reports undated records. */
  expect(res.headers.get("x-scrape-undated-skipped")).toBe("0");
});

/* FIX 4 (final review, 2026-08-15), END TO END: adapter -> run.ts -> the
 * artifact -> the HTTP response header, the full path the pre-fix defect
 * spanned. Registers a throwaway adapter on the shared registry (same
 * pattern as the pre-stream-failure test below) that always reports a
 * nonzero `undatedSkipped`, and checks the header a real caller would
 * actually read. */
test("a page reporting undated records surfaces a nonzero X-Scrape-Undated-Skipped header", async () => {
  const { ADAPTERS } = await import("../scrape/adapters/registry.js");
  ADAPTERS["undated-fixture"] = {
    sourceName: null,
    make: () => ({
      name: "undated-fixture",
      async fetchListing() {
        return {
          items: [{ externalId: "u-1", modifiedAt: "2026-08-10T00:00:00.000Z", raw: {} }],
          nextCursor: null,
          requestUrl: "fake://undated",
          httpStatus: 200,
          payload: "{}",
          undatedSkipped: 4,
        };
      },
    }),
  };
  try {
    const res = await post({ source: "undated-fixture", since: "2026-08-01", depth: "listing" });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-scrape-undated-skipped")).toBe("4");
    await res.arrayBuffer(); // drain the response body
  } finally {
    delete ADAPTERS["undated-fixture"];
  }
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
  /* FIX 1: registry entries are now { sourceName, make }, not a bare
   * factory -- sourceName: null exempts this throwaway adapter from
   * resolve-source.ts's DB lookup, same as `fake`. */
  ADAPTERS.breaks = {
    sourceName: null,
    make: () => ({
      name: "breaks",
      fetchListing: () => Promise.reject(new Error("simulated adapter network failure")),
    }),
  };

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
