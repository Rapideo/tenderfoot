import { afterAll, beforeAll, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_import");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { one, run, close } = await import("../db/index.js");
const { importArtifact, ingestedThrough } = await import("./import-artifact.js");
const { openArtifact } = await import("../scrape/artifact.js");

/* `until` is a parameter, not a shared constant, and every call site below
 * gives it a distinct value. If it were fixed, the partial-run test's
 * assertion that `ingestedThrough` did not move could pass VACUOUSLY --
 * "unmoved" is indistinguishable from "moved to the same value it already
 * had". Distinct windows make a wrongly-advanced mark visible. */
function makeArtifact(externalIds: string[], nextUntil: string | null, until: string) {
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
      raw: { title: `t-${id}` },
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
