/* THE GUARD THAT DECIDES WHETHER A COMMAND MAY TOUCH PRODUCTION.
 *
 * Extracted from migrate-production.mjs on 2026-09-05 so that a SECOND
 * production door -- contracts:ingest -- cannot be built with a second,
 * subtly different copy of the same check. That file's own comment is the
 * argument for this test existing: "a stale guard that is edited away in a
 * hurry is worse than no guard." Two copies double the chance of exactly
 * that, and nothing would have caught the drift.
 *
 * Pure over an env OBJECT rather than reading process.env, so every branch is
 * reachable from a test without setting a real connection string anywhere. */
import { expect, test } from "vitest";
import { resolveProductionTarget, PRODUCTION_ENDPOINT, TEST_ENDPOINT } from "./production-target.mjs";

/* Structurally valid and entirely fake. No real credential appears in this
 * file, and none needs to -- the guard only ever reads the host. */
const prodUrl = `postgresql://u:sekrit-not-real@${PRODUCTION_ENDPOINT}.us-east-2.aws.neon.tech/db?sslmode=require`;
const testUrl = `postgresql://u:sekrit-not-real@${TEST_ENDPOINT}.us-east-2.aws.neon.tech/db?sslmode=require`;

test("the production endpoint is accepted, and the host comes back for printing", () => {
  const t = resolveProductionTarget({ DATABASE_URL_PRODUCTION: prodUrl });
  expect(t.url).toBe(prodUrl);
  expect(t.host).toContain(PRODUCTION_ENDPOINT);
});

test("an unset DATABASE_URL_PRODUCTION refuses and names the variable", () => {
  expect(() => resolveProductionTarget({})).toThrow(/DATABASE_URL_PRODUCTION/);
});

/* 🔴 THE FAILURE THIS GUARD EXISTS FOR. §4 repointed DATABASE_URL at test so
 * that every local command is safe by default. The consequence is that
 * migrating or ingesting the WRONG database prints success and proves
 * nothing -- the refusal has to be explicit and it has to say which database
 * it found. */
test("the test endpoint is refused by name, not merely rejected", () => {
  expect(() => resolveProductionTarget({ DATABASE_URL_PRODUCTION: testUrl })).toThrow(
    new RegExp(TEST_ENDPOINT),
  );
});

test("an endpoint that is neither refuses and reports what it expected", () => {
  const strayUrl = "postgresql://u:sekrit-not-real@ep-somewhere-else-99.aws.neon.tech/db";
  expect(() => resolveProductionTarget({ DATABASE_URL_PRODUCTION: strayUrl })).toThrow(
    new RegExp(PRODUCTION_ENDPOINT),
  );
});

/* 🔴 CLAUDE.md §5.3, and this project has leaked a live secret twice. A
 * refusal is the most likely place for a connection string to escape,
 * because the natural way to write "I refused this URL" is to print the URL.
 * The host carries no secret; the password does. */
test("no refusal and no success ever carries the password", () => {
  const secret = "sekrit-not-real";

  for (const url of [testUrl, "postgresql://u:sekrit-not-real@ep-nope-1.aws.neon.tech/db"]) {
    let message = "";
    try {
      resolveProductionTarget({ DATABASE_URL_PRODUCTION: url });
    } catch (e) {
      message = e.message;
    }
    expect(message, `refusal for ${url.slice(0, 24)}…`).not.toContain(secret);
  }

  /* And the accepted path's printable host must be clean too -- it is the one
   * value both wrappers echo to the terminal. */
  expect(resolveProductionTarget({ DATABASE_URL_PRODUCTION: prodUrl }).host).not.toContain(secret);
});
