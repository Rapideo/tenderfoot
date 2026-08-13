import { afterAll, expect, test } from "vitest";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/* Point at a scratch database BEFORE importing anything that opens one --
 * the module reads the env var at import time. */
process.env.TENDERFOOT_DB = "tmp-test.db";
const { migrate, appliedMigrations } = await import("./migrate.js");
const { db } = await import("./index.js");

afterAll(() => {
  db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`tmp-test.db${suffix}`, { force: true });
  }
});

/* Asserts BEHAVIOUR, not a list of filenames. The first version of this
 * test hard-coded ["001_app_meta.sql"] and broke the moment SP1 added a
 * second migration -- a failure that told us nothing except that the suite
 * was coupled to a list that is supposed to grow. */
test("migrations apply, and applying twice is a no-op", () => {
  const onDisk = readdirSync(join(import.meta.dirname, "../../migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(onDisk.length).toBeGreaterThan(0);

  const first = migrate(false);
  expect(first).toEqual(onDisk);

  const second = migrate(false);
  expect(second).toEqual([]);
  expect(appliedMigrations()).toEqual(onDisk);
});

test("foreign keys are enforced", () => {
  expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
});
