import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useTestSchema, resetSchema } from "../db/testdb.js";
import { fakeAdapter } from "../scrape/adapters/fake.js";

useTestSchema("test_admin");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, one, run } = await import("../db/index.js");
const { app } = await import("../index.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);
/* TASK 9: importArtifact() requires a `source` row matching the artifact's
 * run.source_name (import-artifact.ts:53 -- "No source row named ..."). The
 * `fake` adapter deliberately has NO seeded row: registry.ts forbids adding
 * one to 003_seed_source_registry.sql, and that prohibition is about the
 * SHIPPED seed, not a test fixture. This suite adds one, in the test schema
 * only, so POST /run's import phase has a row to resolve against when it
 * exercises the fake adapter -- the only adapter this suite can run without
 * a real network call. */
beforeAll(async () => {
  await run(`INSERT INTO source (name) VALUES ('fake')`);
});
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
async function post(
  body: unknown,
  headers: Record<string, string> = { "X-Admin-Secret": ADMIN_SECRET },
  path = "/api/admin/scrape",
) {
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, {
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

/* ---- TASK 8: POST /api/admin/health -------------------------------------
 * Inherits requireAdminSecret from `admin.use` above, same as /scrape --
 * covered once here, not per-route again, since the gate itself is already
 * fully exercised by the three tests near the top of this file. */

test("POST /api/admin/health requires the secret", async () => {
  const res = await post({}, {}, "/api/admin/health");
  expect(res.status).toBe(401);
});

/* DEVIATION from the task brief's own example, which queried `source=
 * SAM.gov`: migration 007 gave SAM.gov (and every other 'in'-posture,
 * probeable source) a REAL probe_url, so calling checkSources() for it here
 * would make a genuine outbound HTTP request from this test -- forbidden.
 * checkSources() is exercised against a fetch spy already, at the
 * orchestrator level, by health/check.test.ts; this route's own job is
 * turning `?source=` into an argument and a missing row into a 404, not
 * re-proving the orchestrator's network behaviour.
 *
 * Kentucky eMARS VSS is the one real source name this suite can query with
 * zero network risk: it is 'in'-posture (so this is NOT the same code path
 * as the exclusion test below), but its platform ('CGI Advantage VSS') has
 * no adapter probe and 007 deliberately leaves its probe_url NULL (see that
 * migration's own comment) -- so check.ts's `probeable` filter drops it
 * before any fetch, and the row comes back in an empty `checked` array. */
test("POST /api/admin/health returns the rows it checked", async () => {
  const res = await post({}, undefined, "/api/admin/health?source=Kentucky%20eMARS%20VSS");
  expect(res.status).toBe(200);
  const body = (await res.json()) as { checked: unknown[] };
  expect(Array.isArray(body.checked)).toBe(true);
});

test("an unknown source name is a 404, not an empty success", async () => {
  const res = await post({}, undefined, "/api/admin/health?source=Nope");
  expect(res.status).toBe(404);
});

/* Task 6's own review left this open: checkSources({ sourceName: 'GovWin
 * IQ' }) was never tested anywhere, and this route's `?source=` is exactly
 * the shape that reaches it with one name.
 *
 * CORRECTION (review, 2026-08-18): an earlier version of this comment
 * claimed the assertions below prove "the four-excluded-sources guard Task
 * 6 built is reachable, unbroken, from the HTTP surface this task adds."
 * They cannot, and no rearrangement of this test fixes that. GovWin IQ is
 * dropped by TWO independent filters in check.ts: the legal_posture guard
 * (the `eligible` filter) and, separately, the generic-url-with-no-
 * probe_url guard (the `probeable` filter) -- its platform has no adapter
 * probe, and migration 007 deliberately leaves its probe_url NULL. Delete
 * the legal_posture filter and this test still passes unchanged: the
 * second filter drops the row anyway, for an unrelated reason. The two
 * guards are confounded here; this test cannot tell an intact
 * legal_posture guard from a deleted one.
 *
 * The fix health/check.test.ts uses for the identical confound -- seed a
 * probe_url on the excluded row so a deleted guard would actually fetch it
 * -- is not available here. That works there because that suite injects a
 * fetch SPY: a broken guard fetches a fake URL that never leaves the
 * process. This route calls checkSources() with the real, uninjected
 * global fetch. Seeding a real probe_url on GovWin IQ here would mean a
 * broken legal_posture guard fires a genuine outbound request to a source
 * whose own terms forbid contact -- the test would misbehave in exactly
 * the way the guard exists to prevent, and only on the failure path. Not
 * an acceptable trade for any amount of discriminating power, so this
 * stays undiscriminated at the route level.
 *
 * WHAT THIS TEST ACTUALLY PROVES: the route is wired to checkSources(),
 * honours `?source=`, and does not probe or stamp this row under the
 * current, intact configuration. It would catch a regression where the
 * route dropped the sourceName filter entirely (checked would come back
 * non-empty, carrying other sources' rows).
 *
 * WHAT IT DOES NOT PROVE: that the legal_posture exclusion itself is
 * intact -- confounded by the null-probe_url second lock above.
 *
 * WHERE THE REAL PROOF LIVES: health/check.test.ts:82-89, "no request is
 * constructed for any of the four excluded sources" -- seeds probe_url on
 * all four excluded rows specifically so a deleted legal_posture guard
 * would fetch them, and checks that against an injected fetch spy, never a
 * real network call. That is the orchestrator-level proof Task 6 owns;
 * this test's narrower job is proving the HTTP surface reaches
 * checkSources() correctly, not re-deriving Task 6's own guarantee. */
test("a check for an excluded source performs no probe, and reports it", async () => {
  const before = await one<{ health: string; health_checked_at: string | null }>(
    `SELECT health, health_checked_at FROM source WHERE name = 'GovWin IQ'`,
  );
  expect(before?.health, "fixture assumption: excluded rows start unstamped").toBe("excluded");
  expect(before?.health_checked_at ?? null).toBeNull();

  const res = await post({}, undefined, "/api/admin/health?source=GovWin%20IQ");
  expect(res.status).toBe(200);
  const body = (await res.json()) as { checked: unknown[] };
  expect(body.checked).toEqual([]);

  const after = await one<{ health: string; health_checked_at: string | null }>(
    `SELECT health, health_checked_at FROM source WHERE name = 'GovWin IQ'`,
  );
  expect(after).toEqual(before);
});

/* ---- TASK 9: POST /api/admin/run ----------------------------------------
 * D5, finally housed. Scrape, import and merge in one request, so a click
 * on "Run" does not hand the operator a SQLite file to import by hand.
 * Inherits requireAdminSecret from `admin.use`, same as /scrape and
 * /health -- covered once here, not per-route again. */

test("POST /api/admin/run requires the secret", async () => {
  const res = await post({}, {}, "/api/admin/run?source=fake&since=2026-08-01");
  expect(res.status).toBe(401);
});

/* Global constraint: an unknown adapter key is a 400 naming the known keys,
 * not a 500 -- the same shape /scrape already gives an unknown body.source,
 * asserted here at the route this task adds. */
test("an unknown adapter key is refused with 400, naming the known keys", async () => {
  const res = await post({}, undefined, "/api/admin/run?source=nope&since=2026-08-01");
  expect(res.status).toBe(400);
  const body = (await res.json()) as { error: string };
  expect(body.error).toMatch(/nope/);
  expect(body.error).toMatch(/fake/);
});

/* CONTROLLER RULING (overrides the task brief): the brief's own version of
 * this test queried `source WHERE name = 'SAM.gov'` while running the
 * `fake` adapter -- two unrelated rows. That would still "pass" (the
 * response's freshly stamped `last_run_at` is never equal to SAM.gov's
 * NULL one), but it would pass for the wrong reason: it proves nothing
 * about whether the row this run actually touches got written. `fake`'s
 * registry entry carries `sourceName: null` on purpose (registry.ts), and
 * the route stamps `entry.sourceName ?? key` -- so the row that must move
 * is 'fake', not 'SAM.gov'. Querying the real target row is what makes this
 * test capable of catching a `WHERE name = NULL` regression (matches zero
 * rows, stamp silently no-ops) instead of passing vacuously either way. */
test("a run scrapes, imports, merges and stamps last_run_at on the resolved row", async () => {
  const before = await one<{ last_run_at: string | null }>(
    `SELECT last_run_at FROM source WHERE name = 'fake'`,
  );

  const res = await post({}, undefined, "/api/admin/run?source=fake&since=2026-08-01");
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    rows: number;
    imported: number;
    merged: number;
    last_run_at: string;
  };
  expect(body.rows).toBeGreaterThan(0);
  expect(body.imported).toBeGreaterThan(0);
  expect(body.last_run_at).not.toBe(before?.last_run_at ?? null);

  /* The proof that matters: re-read the row from the database, independent
   * of whatever the handler chose to put in the response body. */
  const after = await one<{ last_run_at: string | null }>(
    `SELECT last_run_at FROM source WHERE name = 'fake'`,
  );
  expect(after?.last_run_at).toBe(body.last_run_at);
  expect(after?.last_run_at).not.toBe(before?.last_run_at ?? null);
});

/* TASK 12 GAP: the brief has the client call `?source=<key>` (the CLI
 * ergonomic, 'sam'), but the /admin screen only ever has `source.name`
 * ("SAM.gov") -- and per registry.ts's own header, the client must not hold
 * a name->key map ("two registries drift"). CONTROLLER RULING: the route
 * resolves a canonical source.name to its ADAPTERS key itself. This proves
 * that resolution reaches the exact same machinery (scrape, import, merge,
 * the stamp) as the key spelling -- registered directly on the shared
 * ADAPTERS map, same pattern as the 'run-breaks' fixture below, so this
 * needs no real network call. `entry.sourceName` is non-null here (unlike
 * `fake`), so resolveSource() DOES query the `source` table for it -- the
 * inserted row must exist and be enabled for that check to pass. */
test("a run resolves a canonical source name (not just the adapter key) to its adapter", async () => {
  const { ADAPTERS } = await import("../scrape/adapters/registry.js");
  const NAME = "Name Fixture Source";
  ADAPTERS["name-fixture"] = { sourceName: NAME, make: () => fakeAdapter(5, 3) };
  await run(`INSERT INTO source (name, enabled) VALUES ($1, true)`, [NAME]);

  try {
    const before = await one<{ last_run_at: string | null }>(
      `SELECT last_run_at FROM source WHERE name = $1`,
      [NAME],
    );

    const res = await post(
      {},
      undefined,
      `/api/admin/run?source=${encodeURIComponent(NAME)}&since=2026-08-01`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { last_run_at: string };

    /* The proof that matters: the ROW NAMED BY THE QUERY, re-read from the
     * database independent of the response body -- this is what a route
     * that still only accepted the short key ('name-fixture' is not a key
     * ADAPTERS has, so it would 400 instead) cannot pass. */
    const after = await one<{ last_run_at: string | null }>(
      `SELECT last_run_at FROM source WHERE name = $1`,
      [NAME],
    );
    expect(after?.last_run_at).toBe(body.last_run_at);
    expect(after?.last_run_at).not.toBe(before?.last_run_at ?? null);
  } finally {
    delete ADAPTERS["name-fixture"];
    /* The inserted `source` row is deliberately NOT deleted here, same as
     * the shared 'fake' row seeded in beforeAll: importArtifact() just
     * attributed real sighting rows to it (sighting.source_id), so a
     * DELETE would fail on sighting_source_id_fkey (verified directly --
     * removing it makes this test fail with exactly that FK error). Every
     * other test in this file scopes its own SELECTs to a specific name
     * (grep FROM source above), so this row surviving the rest of the
     * suite is harmless, same as 'fake' surviving it already. */
  }
});

/* The artifact is ephemeral by design -- that is what keeps SP4's blob
 * decision parked. If it leaks, the temp directory grows forever. Split
 * into a success case and a failure case (global constraint: cleanup on
 * EVERY path, not just the happy one) rather than one combined test, so a
 * regression that breaks cleanup on only one of the two paths still fails
 * loudly instead of being averaged away by the other passing.
 *
 * `existsSync` gates the leak check rather than a bare `readdirSync` diff,
 * matching the pre-stream-failure test above (line ~166): verified
 * directly, repeatedly, on this exact suite on Windows that `readdirSync`
 * on the OS temp dir is not immediately consistent with a directory removed
 * moments earlier in the same process. A stat-confirmed survivor is a real
 * leak; a listing-only "new" entry that no longer exists on disk is not. */
test("the temp artifact directory is removed after a successful run", async () => {
  const before = new Set(readdirSync(tmpdir()).filter((n) => n.startsWith("tf-run-")));
  const res = await post({}, undefined, "/api/admin/run?source=fake&since=2026-08-01");
  expect(res.status).toBe(200);
  await res.json(); // drain the response body

  const after = readdirSync(tmpdir()).filter((n) => n.startsWith("tf-run-") && !before.has(n));
  const leaked = after.filter((n) => existsSync(join(tmpdir(), n)));
  expect(leaked).toEqual([]);
});

test("the temp artifact directory is removed even when the scrape throws", async () => {
  const { ADAPTERS } = await import("../scrape/adapters/registry.js");
  /* A throwaway adapter, same pattern as the pre-stream-failure test above
   * -- registered directly on the shared ADAPTERS map and removed in
   * `finally`. `sourceName: null` exempts it from resolve-source.ts's DB
   * lookup, same as `fake`, so this run reaches runScrape() (and fails
   * there) rather than being turned away earlier by source resolution. */
  ADAPTERS["run-breaks"] = {
    sourceName: null,
    make: () => ({
      name: "run-breaks",
      fetchListing: () => Promise.reject(new Error("simulated adapter network failure")),
    }),
  };

  const before = new Set(readdirSync(tmpdir()).filter((n) => n.startsWith("tf-run-")));
  try {
    const res = await post({}, undefined, "/api/admin/run?source=run-breaks&since=2026-08-01");
    expect(res.status).toBe(500);

    const after = readdirSync(tmpdir()).filter((n) => n.startsWith("tf-run-") && !before.has(n));
    const leaked = after.filter((n) => existsSync(join(tmpdir(), n)));
    expect(leaked).toEqual([]);
  } finally {
    delete ADAPTERS["run-breaks"];
  }
});
