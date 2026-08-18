import { expect, test, beforeAll, afterAll } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

/* Point at a scratch SCHEMA before importing anything that opens a pool --
 * the module reads the env vars at import time. Same shape as
 * ../ingest/corpus.test.ts. */
useTestSchema("test_health_check");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, one, run, close } = await import("../db/index.js");
const { checkSources } = await import("./check.js");

beforeAll(async () => {
  await migrate(false);

  /* RULING (controller, 2026-08-17), overriding the plan's own fixture:
   * migration 007 -- the one that populates `probe_url` -- is a LATER,
   * independent task, and this task must not depend on it. Illinois BidBuy
   * has no adapter-backed probe (its platform, "Periscope S2G", falls back
   * to genericUrlProbe), and genericUrlProbe returns 'failing' before ever
   * calling fetch when probe_url is null. Without seeding one here, "a
   * probed source gets a state" below could never pass no matter how the
   * orchestrator is written. Seeded here, in this file's own setup, so
   * Task 6 stays self-sufficient rather than blocking behind Task 7.
   *
   * The same gap would otherwise quietly defeat the exclusion test too: the
   * four legally-excluded rows also have no probe_url yet, and
   * genericUrlProbe's own null-check would already stop a fetch call
   * regardless of whether eligibility filtering ran at all -- so that test
   * could stay green even if the `.filter(eligible)` line in check.ts were
   * deleted outright. Seeding each excluded row a probe_url containing the
   * exact keyword the test greps for turns it into a real guard: it can
   * only pass if checkSources() actually declines to construct the
   * request, not because there was never a URL to construct one from. */
  await run(
    `UPDATE source SET probe_url = CASE name
        WHEN 'Illinois BidBuy' THEN 'https://il-bidbuy.example.test/probe'
        WHEN 'GovWin IQ'       THEN 'https://govwin.example.test/probe'
        WHEN 'BidNet Direct'   THEN 'https://bidnet.example.test/probe'
        WHEN 'BidPrime'        THEN 'https://bidprime.example.test/probe'
        WHEN 'Ohio OhioBuys'   THEN 'https://ohiobuys.example.test/bas/browser_check'
     END
     WHERE name IN ('Illinois BidBuy', 'GovWin IQ', 'BidNet Direct', 'BidPrime', 'Ohio OhioBuys')`,
  );
}, 120000);

afterAll(async () => {
  await close();
});

/* Records every URL anyone tried to fetch, so the assertion below can be
 * about what was ATTEMPTED rather than about what came back. */
function spyFetch() {
  const calls: string[] = [];
  const impl = (async (url: string | URL | Request) => {
    calls.push(String(url));
    /* DEVIATION from the plan's literal fixture: `{ totalRecords,
     * opportunitiesData }` is shaped like SAM's public v2 API, not the
     * sgs/v1 endpoint samProbe actually calls -- see sam.ts's PROBE_URL
     * comment and the 2026-08-18 fix in adapter-probes.test.ts.
     * parseSamPage reads `_embedded.results`, so that body parses to zero
     * rows and reports 'rot', not 'ok', which would make "a probed source
     * gets a state, a method, and a checked-at" fail even with a correct
     * orchestrator. This body carries both `_embedded.results` (what
     * samProbe reads) and `results` (what usaSpendingProbe reads) so every
     * registered adapter probe sees one genuine non-empty answer. */
    return new Response(
      JSON.stringify({
        _embedded: { results: [{ _id: "TEST-1", modifiedDate: "2026-01-01" }] },
        results: [{ "Award ID": "TEST-1" }],
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  return { calls, impl };
}

/* THE TEST THAT MATTERS. A test asserting only the resulting state would
 * pass just as happily if the request had been made and the answer thrown
 * away -- which is exactly the thing the sources' own terms forbid. */
test("no request is constructed for any of the four excluded sources", async () => {
  const { calls, impl } = spyFetch();
  await checkSources({ fetchImpl: impl });
  const forbidden = ["govwin", "bidnet", "bidprime", "ohio", "bas/browser_check"];
  for (const f of forbidden) {
    expect(calls.filter((c) => c.toLowerCase().includes(f)), `probed ${f}`).toEqual([]);
  }
});

test("the excluded rows keep excluded and are never given a timestamp", async () => {
  const { impl } = spyFetch();
  await checkSources({ fetchImpl: impl });
  const rows = await all<{ name: string; health: string; health_checked_at: string | null }>(
    `SELECT name, health, health_checked_at FROM source WHERE legal_posture <> 'in'`,
  );
  for (const r of rows) {
    expect(r.health).toBe("excluded");
    expect(r.health_checked_at, `${r.name} was stamped`).toBeNull();
  }
});

test("a probed source gets a state, a method, and a checked-at", async () => {
  const { impl } = spyFetch();
  await checkSources({ sourceName: "SAM.gov", fetchImpl: impl });
  const row = await one<{ health: string; health_method: string; health_checked_at: string }>(
    `SELECT health, health_method, health_checked_at FROM source WHERE name = 'SAM.gov'`,
  );
  expect(row!.health).toBe("ok");
  expect(row!.health_method).toBe("sam");
  expect(row!.health_checked_at).not.toBeNull();
});

/* Coverage is the reason health is a probe and not a derivation. */
test("all seven probeable rows are checked, disabled ones included", async () => {
  const { impl } = spyFetch();
  const checked = await checkSources({ fetchImpl: impl });
  expect(checked).toHaveLength(7);
});

test("one failing source does not prevent the others being written", async () => {
  const impl = (async (url: string | URL | Request) => {
    if (String(url).includes("sam.gov")) throw new Error("connect ETIMEDOUT");
    return new Response("ok", { status: 200 });
  }) as unknown as typeof fetch;
  await checkSources({ fetchImpl: impl });
  const sam = await one<{ health: string }>(`SELECT health FROM source WHERE name = 'SAM.gov'`);
  const other = await one<{ health: string }>(
    `SELECT health FROM source WHERE name = 'Illinois BidBuy'`,
  );
  expect(sam!.health).toBe("failing");
  expect(other!.health).toBe("ok");
});
