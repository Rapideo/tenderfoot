/* Migrate PRODUCTION, deliberately.
 *
 * §4 repointed `DATABASE_URL` at the `test` branch on 2026-08-28, which made
 * every local command safe by default and made migrating production an
 * explicit act with no ergonomics at all -- the incantation is a shell
 * variable override that is easy to get subtly wrong, and getting it wrong is
 * silent: it migrates `test` again and prints success.
 *
 * So this file exists to make the deliberate act SAY WHICH DATABASE IT IS
 * ABOUT TO TOUCH, and to refuse if that is not production. It adds no
 * capability -- everything here was already reachable by hand.
 *
 *   node --env-file-if-exists=.env scripts/migrate-production.mjs
 *
 * The connection string is never printed. The HOST is, because the host is
 * how §4 says to tell the two branches apart, and it carries no secret.
 */
import { spawn } from "node:child_process";

const url = process.env.DATABASE_URL_PRODUCTION;
if (!url) {
  console.error(
    "DATABASE_URL_PRODUCTION is not set.\n" +
      "It lives in .env (§4 preserved the production string under that explicit\n" +
      "name). Run this with --env-file-if-exists=.env.",
  );
  process.exit(1);
}

const host = new URL(url).host;

/* The production endpoint, recorded in STATUS §4 alongside test's. Checked
 * rather than assumed: the whole point of this file is that "I meant to
 * migrate production" and "I migrated production" should not be two different
 * facts. */
const PRODUCTION_ENDPOINT = "ep-super-bonus-auoe43hj";
const TEST_ENDPOINT = "ep-withered-base-au6l4cjf";

console.log(`DATABASE_URL_PRODUCTION host : ${host}`);

if (host.startsWith(TEST_ENDPOINT)) {
  console.error(
    `\nREFUSING: that is the TEST endpoint (${TEST_ENDPOINT}).\n` +
      "DATABASE_URL_PRODUCTION has been repointed at test at some point. Fix\n" +
      ".env before running this -- migrating test through the production door\n" +
      "would print success and prove nothing.",
  );
  process.exit(1);
}

if (!host.startsWith(PRODUCTION_ENDPOINT)) {
  console.error(
    `\nREFUSING: expected the production endpoint ${PRODUCTION_ENDPOINT}\n` +
      `(STATUS §4), got ${host}.\n` +
      "If production has legitimately moved, update this file and STATUS §4 in\n" +
      "the same commit -- a stale guard that is edited away in a hurry is worse\n" +
      "than no guard.",
  );
  process.exit(1);
}

console.log(`confirmed production (${PRODUCTION_ENDPOINT}). Running migrations…\n`);

/* Spawned rather than imported so migrate.ts reads DATABASE_URL from its own
 * process env and needs no knowledge of this wrapper. */
const child = spawn(
  process.execPath,
  ["--import", "tsx", "app/server/src/db/migrate.ts"],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } },
);
child.on("exit", (code) => process.exit(code ?? 0));
