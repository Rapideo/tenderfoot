import { expect, test, beforeAll, afterAll } from "vitest";
import { useTestSchema, resetSchema } from "./testdb.js";

useTestSchema("test_health_schema");
await resetSchema();

const { migrate } = await import("./migrate.js");
const { one, run, all, close } = await import("./index.js");
const { loadCorpus } = await import("../ingest/corpus.js");

beforeAll(async () => {
  await migrate(false);
  await loadCorpus(false);
}, 120000);
afterAll(async () => { await close(); });

test("the four health columns exist", async () => {
  const cols = await all<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'source' AND table_schema = current_schema()`,
  );
  const names = cols.map((c) => c.column_name);
  for (const c of ["health_checked_at", "health_method", "health_note", "probe_url"]) {
    expect(names, `missing column ${c}`).toContain(c);
  }
});

/* The hole this closes: `legal_posture` has had a CHECK since 002 and
 * `health` never did, so any string at all could be stored. */
test("an invalid health value is refused by the database", async () => {
  await expect(
    run(`UPDATE source SET health = 'banana' WHERE name = 'SAM.gov'`),
  ).rejects.toThrow(/source_health_valid|violates check constraint/);
});

test("every one of the five legal values is accepted", async () => {
  for (const v of ["ok", "failing", "rot", "excluded", "unknown"]) {
    await run(`UPDATE source SET health = $1 WHERE name = 'SAM.gov'`, [v]);
  }
  expect((await one<{ health: string }>(`SELECT health FROM source WHERE name = 'SAM.gov'`))!.health)
    .toBe("unknown");
});

/* Six rows can never be probed: four by their own terms, two because they
 * are fixed snapshots with no endpoint. Compare a JS-sorted array to make
 * the test collation-independent. */
test("the six never-probeable rows are backfilled to excluded", async () => {
  const rows = await all<{ name: string }>(
    `SELECT name FROM source WHERE health = 'excluded'`,
  );
  const names = rows.map((r) => r.name).sort();
  expect(names).toEqual([
    "BidNet Direct",
    "BidPrime",
    "Corpus import — Indiana open (2026-08-04)",
    "Corpus import — federal calibration (2026-08-10)",
    "GovWin IQ",
    "Ohio OhioBuys",
  ]);
});

/* EIGHT since migration 019 added HigherGov (`legal_posture = 'in'`). The
 * count moved because a source was added, not because health behaviour
 * changed -- and it is asserted as a number rather than a set precisely so
 * that adding a source is a deliberate edit here. */
test("the eight probeable rows keep unknown", async () => {
  const n = await one<{ n: number }>(`SELECT count(*) n FROM source WHERE health = 'unknown'`);
  expect(n!.n).toBe(8);
});

/* Task 7. Three of the five generic-probe sources got a hand-verified
 * probe_url (migration 007) -- Illinois BidBuy, Indiana EDS contract
 * register, Indiana IDOA solicitations. Kentucky eMARS VSS and Michigan
 * SIGMA VSS are NOT in this list: both are CGI Advantage VSS, and 003's own
 * research already established that platform's search is a form POST to one
 * endpoint with server-side session state, not a GET with real query
 * parameters -- confirmed again in the 007 research (see its header comment).
 * genericUrlProbe only ever issues a GET, so no URL exists that would
 * measure the thing that actually matters (the solicitation grid) rather
 * than the session-bootstrap landing page. Left NULL on purpose: an
 * unverifiable URL is worse than an honest gap. This exclusion list names
 * the gap rather than weakening the assertion into one that would pass
 * vacuously.
 *
 * 🔴 HIGHERGOV IS EXCLUDED FOR A DIFFERENT AND STRONGER REASON, added with
 * migration 019. It must NEVER carry a probe_url, and this is not a gap to be
 * filled later:
 *
 *   1. A probe_url is a URL the checker GETs. Every authenticated HigherGov
 *      call carries `?api_key=...` in the QUERY STRING, so a working probe_url
 *      would be a CREDENTIAL STORED IN THE DATABASE -- the same mistake as
 *      logging `document_path`, which leaked a live key on 2026-09-03
 *      (CLAUDE.md §5.3).
 *   2. Every call is METERED against 10,000 records/month, and no call may be
 *      made without Matt's explicit approval (CLAUDE.md §5.1). A check-all
 *      that silently probes a paid source is exactly the loaded gun the test
 *      below describes for excluded rows.
 *
 * Its health therefore needs a DEDICATED probe method reading the key from the
 * environment -- the shape `method = 'sam'` already establishes -- and a
 * parameterless call returning 400 would prove liveness at ZERO records. That
 * method does not exist yet. Until it does, HigherGov is correctly reported as
 * SKIPPED rather than probed. */
test("every generic-probe source that CAN be GET-probed has a probe_url", async () => {
  const missing = await all<{ name: string }>(
    `SELECT name FROM source
      WHERE legal_posture = 'in'
        AND platform NOT IN ('Manual import', 'SAM', 'USASpending')
        AND name NOT IN ('Kentucky eMARS VSS', 'Michigan SIGMA VSS', 'HigherGov')
        AND (probe_url IS NULL OR probe_url = '')`,
  );
  expect(missing.map((m) => m.name)).toEqual([]);
});

/* The four excluded rows must not carry a URL at all -- a probe_url sitting
 * on GovWin IQ is a loaded gun for whoever writes the next probe loop. */
test("no excluded source carries a probe_url", async () => {
  const armed = await all<{ name: string }>(
    `SELECT name FROM source WHERE legal_posture <> 'in' AND probe_url IS NOT NULL`,
  );
  expect(armed.map((a) => a.name)).toEqual([]);
});

test("every probe_url is https", async () => {
  const rows = await all<{ name: string; probe_url: string }>(
    `SELECT name, probe_url FROM source WHERE probe_url IS NOT NULL`,
  );
  for (const r of rows) expect(r.probe_url, r.name).toMatch(/^https:\/\//);
});
