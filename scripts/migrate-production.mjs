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
 *
 * ⚠️ THE GUARD MOVED OUT ON 2026-09-05 and now lives in production-target.mjs,
 * because D6 added a second production door and this file's own warning --
 * "a stale guard that is edited away in a hurry is worse than no guard" --
 * argues against a second copy of it. Behaviour here is unchanged; it is
 * covered by production-target.test.mjs, which it never was inline.
 */
import { spawn } from "node:child_process";
import { resolveProductionTarget, PRODUCTION_ENDPOINT } from "./production-target.mjs";

let target;
try {
  target = resolveProductionTarget(process.env);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

console.log(`DATABASE_URL_PRODUCTION host : ${target.host}`);
console.log(`confirmed production (${PRODUCTION_ENDPOINT}). Running migrations…\n`);

/* Spawned rather than imported so migrate.ts reads DATABASE_URL from its own
 * process env and needs no knowledge of this wrapper. */
const child = spawn(
  process.execPath,
  ["--import", "tsx", "app/server/src/db/migrate.ts"],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: target.url } },
);
child.on("exit", (code) => process.exit(code ?? 0));
