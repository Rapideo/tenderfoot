import { afterAll, beforeAll, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_import");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { one, run, close, pool } = await import("../db/index.js");
const { importArtifact, ingestedThrough } = await import("./import-artifact.js");
const { openArtifact } = await import("../scrape/artifact.js");

/* Counts the INSERT statements that actually reach Postgres, by wrapping
 * every client this pool opens. A spy, not a stub -- the real query still
 * runs against the real database, and the assertion is on what the server
 * was really asked to do.
 *
 * Attached at module level on purpose: `pool.on("connect")` fires when a
 * client is CREATED, and beforeAll's migrate() creates the first one. A
 * listener registered inside a test would attach after that client already
 * existed and would silently observe nothing -- a spy that counts zero looks
 * identical to a fix that works. */
const sightingInserts: string[] = [];
pool.on("connect", (client) => {
  const c = client as unknown as { query: (...a: any[]) => any };
  const orig = c.query.bind(c);
  c.query = (...a: any[]) => {
    const sql: string = typeof a[0] === "string" ? a[0] : (a[0]?.text ?? "");
    if (/^\s*INSERT INTO sighting/i.test(sql)) sightingInserts.push(sql);
    return orig(...a);
  };
});

/* `until` is a parameter, not a shared constant, and every call site below
 * gives it a distinct value. If it were fixed, the partial-run test's
 * assertion that `ingestedThrough` did not move could pass VACUOUSLY --
 * "unmoved" is indistinguishable from "moved to the same value it already
 * had". Distinct windows make a wrongly-advanced mark visible. */
function makeArtifact(
  externalIds: string[],
  nextUntil: string | null,
  until: string,
  rawFor: (id: string) => unknown = (id) => ({ title: `t-${id}` }),
) {
  const p = join(mkdtempSync(join(tmpdir(), "tf-imp-")), "run.db");
  const a = openArtifact(p, {
    sourceName: "fake",
    since: "2026-08-01",
    until,
    depth: "listing",
    scraperVer: "test",
  });
  const cap = a.writeCapture({ hop: "listing", url: "fake://1", httpStatus: 200, payload: "{}" });
  for (const id of externalIds) {
    a.writeSighting({
      externalId: id,
      seenAt: "2026-08-15T00:00:00.000Z",
      raw: rawFor(id),
      captureId: cap,
      extractorVer: "test",
      mode: "mechanical",
    });
  }
  a.finish(nextUntil ? "partial" : "complete", nextUntil);
  a.close();
  return p;
}

beforeAll(async () => {
  await migrate(false);
  await run(`INSERT INTO source (name, enabled) VALUES ('fake', true)`);
}, 120000);

afterAll(async () => {
  await close();
});

test("a COMPLETE artifact advances ingested_through to the window's end", async () => {
  const p = makeArtifact(["a", "b"], null, "2026-08-10"); // null nextUntil => outcome "complete"
  const res = await importArtifact(p);

  expect(res.imported).toBe(2);
  expect(res.skipped).toBe(false);
  expect((await one(`SELECT count(*) n FROM sighting`)).n).toBe(2);

  const src = await one(`SELECT id FROM source WHERE name = 'fake'`);
  /* The SPECIFIC window end this artifact advanced to, not just any value --
   * see the comment on makeArtifact for why the window varies per test. */
  expect(await ingestedThrough(src.id)).toBe("2026-08-10");
});

/* THE ANTI-GAP PROPERTY, and the reason this test exists at all.
 *
 * A partial run covered the RECENT end of its window and never reached the
 * older tail. Advancing the mark on it would declare we hold data we never
 * fetched -- the silent gap this whole design exists to prevent, arriving
 * through the back door and looking like success. So a partial artifact
 * advances the mark NOT AT ALL: its sightings land, and the window stays
 * open until some later run completes it.
 *
 * Ruled 2026-08-15 after review found the original plan advanced the mark
 * on partial artifacts. */
test("a PARTIAL artifact lands its sightings but advances nothing", async () => {
  const src = await one(`SELECT id FROM source WHERE name = 'fake'`);
  const before = await ingestedThrough(src.id);

  const p = makeArtifact(["p1", "p2"], "2026-08-09T00:00:00.000Z", "2026-08-20");
  const res = await importArtifact(p);

  expect(res.imported).toBe(2);
  expect(res.ingestedThrough).toBeNull();
  expect((await one(`SELECT count(*) n FROM sighting WHERE external_id = 'p1'`)).n).toBe(1);
  /* The authority is unmoved by a partial run. */
  expect(await ingestedThrough(src.id)).toBe(before);
});

/* The one real duplicate risk the sighting model does not already handle.
 * There is no `force` escape hatch (removed after review -- see
 * import-artifact.ts): an operator who genuinely needs to re-import the
 * same file deletes its ingest_run row by hand. */
test("importing the same artifact twice is a no-op", async () => {
  const p = makeArtifact(["c"], null, "2026-08-25");
  await importArtifact(p);
  const again = await importArtifact(p);

  expect(again.skipped).toBe(true);
  expect(again.imported).toBe(0);
});

/* Overlapping windows are SAFE BY CONSTRUCTION: sightings are append-only
 * and the canonical record is produced by merging them (§4.4). An amended
 * posting must arrive as a second sighting, not overwrite the first. */
test("an overlapping window appends rather than overwrites", async () => {
  const before = (await one(`SELECT count(*) n FROM sighting WHERE external_id = 'a'`)).n;
  await importArtifact(makeArtifact(["a"], null, "2026-08-30"));
  const after = (await one(`SELECT count(*) n FROM sighting WHERE external_id = 'a'`)).n;
  expect(after).toBe(before + 1);
});

/* raw is jsonb in Postgres but TEXT (a JSON.stringify'd string) inside the
 * SQLite artifact -- the importer passes that string straight through as a
 * bound parameter with no explicit cast. This proves Postgres parses it
 * into a real jsonb value rather than storing a double-encoded string,
 * which matters because the merge step (§4.4, not yet built) will parse
 * this column and a double-encoding would break there, not here. */
test("raw round-trips as real jsonb, not a double-encoded string", async () => {
  await importArtifact(makeArtifact(["rawcheck"], null, "2026-08-31"));
  const row = await one<{ raw: { title: string } }>(
    `SELECT raw FROM sighting WHERE external_id = 'rawcheck'`,
  );
  expect(row?.raw.title).toBe("t-rawcheck");
});

/* THE COST OF AN IMPORT MUST NOT SCALE WITH ITS SIZE.
 *
 * One awaited INSERT per sighting measured ~7 rows/sec against Neon, which
 * was fatal while a whole register had to fit one 300-second invocation and
 * is merely expensive now that a run is hand-scoped: every round trip saved
 * is depth the operator can afford to ask for.
 *
 * The assertion is STATEMENT COUNT, not elapsed time. A timing threshold
 * would pass or fail on network weather and tell nobody why; the statement
 * count is the property actually being changed, and it is exact. */
test("N sightings cost ONE insert statement, not N", async () => {
  const ids = ["b1", "b2", "b3", "b4", "b5"];
  const p = makeArtifact(ids, null, "2026-09-05");

  sightingInserts.length = 0;
  const res = await importArtifact(p);

  expect(res.imported).toBe(5);
  expect(sightingInserts).toHaveLength(1);
  /* The rows still have to LAND. A single statement that inserted four of
   * five would satisfy the line above and be worse than what it replaced. */
  expect((await one(`SELECT count(*) n FROM sighting WHERE external_id LIKE 'b_'`)).n).toBe(5);
});

/* THE FAILURE MODE THE BATCHED FORM INTRODUCES, and the only one it does.
 *
 * Sending N rows as five text[] parameters means every payload now crosses
 * the wire inside a Postgres ARRAY LITERAL, where `{`, `}`, `"`, `,` and `\`
 * are all structural. JSON is made of exactly those characters. Bad escaping
 * here does not throw -- it delivers a plausible, quietly wrong object, which
 * is this project's recurring shape of defect.
 *
 * Passes against the per-row version too, so it is a guard rather than proof
 * of this change. Its teeth were checked by breaking the cast to `to_jsonb`
 * (which double-encodes) and watching it fail. */
test("array-encoded raw survives braces, quotes, commas and backslashes", async () => {
  const hostile = {
    title: 'Bid {A,B} "quoted", 50% \\ backslash',
    note: "line one\nline two\ttabbed",
    unicode: "café — 東京 — ½",
    nested: { list: ["a,b", "{c}", '"d"', "e\\f"], empty: [] as string[] },
  };
  await importArtifact(makeArtifact(["hostile"], null, "2026-09-06", () => hostile));

  const row = await one<{ raw: typeof hostile }>(
    `SELECT raw FROM sighting WHERE external_id = 'hostile'`,
  );
  /* Deep equality, not a spot-check on one field: mangled escaping tends to
   * damage one member and leave the rest legible. */
  expect(row?.raw).toEqual(hostile);
});

/* A COMPLETE run that found nothing is not a failed run. The window was
 * fetched and was genuinely empty, so the mark advances -- otherwise every
 * quiet window would be re-scraped forever. Guards the `if` that now stands
 * in front of the insert: skipping the statement must not skip the ledger. */
test("an artifact with no sightings records the run and advances the mark", async () => {
  const src = await one(`SELECT id FROM source WHERE name = 'fake'`);
  const p = makeArtifact([], null, "2026-09-10");

  sightingInserts.length = 0;
  const res = await importArtifact(p);

  expect(res.imported).toBe(0);
  expect(res.skipped).toBe(false);
  expect(sightingInserts).toHaveLength(0);
  expect(await ingestedThrough(src.id)).toBe("2026-09-10");
});
