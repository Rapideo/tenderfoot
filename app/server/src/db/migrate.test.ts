import { afterAll, expect, test } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { useTestSchema, resetSchema } from "./testdb.js";

/* Point at a scratch SCHEMA before importing anything that opens a pool --
 * the module reads the env vars at import time. */
useTestSchema("test_migrate");
await resetSchema();

const { migrate, appliedMigrations } = await import("./migrate.js");
const { run, close } = await import("./index.js");

afterAll(async () => {
  await close();
});

/* Asserts BEHAVIOUR, not a list of filenames. The first version of this
 * test hard-coded ["001_app_meta.sql"] and broke the moment SP1 added a
 * second migration -- a failure that told us nothing except that the suite
 * was coupled to a list that is supposed to grow. */
test("migrations apply, and applying twice is a no-op", async () => {
  const onDisk = readdirSync(join(import.meta.dirname, "../../migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(onDisk.length).toBeGreaterThan(0);

  const first = await migrate(false);
  expect(first).toEqual(onDisk);

  const second = await migrate(false);
  expect(second).toEqual([]);
  expect(await appliedMigrations()).toEqual(onDisk);
});

/* Was: expect(db.pragma("foreign_keys")).toBe(1) -- an assertion about a
 * SETTING that any second connection could have lost. Postgres enforces FKs
 * unconditionally, so the correct test is that a violation is REFUSED.
 * 23503 is foreign_key_violation; asserted by SQLSTATE rather than by
 * message text, which is localised and version-dependent. */
test("foreign keys are enforced", async () => {
  await migrate(false);
  await expect(
    run("INSERT INTO sighting (source_id) VALUES (99999)"),
  ).rejects.toMatchObject({ code: "23503" });
});
