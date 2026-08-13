import { afterAll, expect, test } from "vitest";
import { rmSync } from "node:fs";

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

test("migrations apply, and applying twice is a no-op", () => {
  const first = migrate(false);
  expect(first).toContain("001_app_meta.sql");
  const second = migrate(false);
  expect(second).toEqual([]);
  expect(appliedMigrations()).toEqual(["001_app_meta.sql"]);
});

test("foreign keys are enforced", () => {
  expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
});
