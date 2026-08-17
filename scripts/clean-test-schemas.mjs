/* Drops the per-run schemas the test harness creates.
 *
 * THE LEAK THIS EXISTS TO STOP, found 2026-08-16. testdb.ts names each
 * schema `<logical>_<runSuffix>` where the suffix is GITHUB_RUN_ID (Ruling 3,
 * so a CI run and a local run cannot DROP each other's tables mid-run).
 * resetSchema() drops and recreates THIS run's schema -- and nothing has ever
 * dropped a previous run's. Every CI run therefore left ~10 schemas behind
 * permanently. By the time it was noticed the `test` branch held 106 of them,
 * back through early August, and the suite had slowed to the point where
 * corpus.test.ts tipped over vitest's 5s default under parallel load and
 * failed a gate that passed minutes earlier.
 *
 * TWO MODES, and the difference is a concurrency hazard rather than a
 * convenience:
 *
 *   (default)  Drop ONLY this run's schemas. Always safe -- we created them
 *              and nobody else can be using them, which is exactly the
 *              guarantee Ruling 3's suffix buys. This is the mode CI runs
 *              after the suite, so the leak cannot restart.
 *
 *   --stale    Drop every OTHER run's schemas. Clears the historical
 *              backlog. NOT SAFE TO RUN CONCURRENTLY WITH ANOTHER SUITE:
 *              a CI run in progress owns schemas this mode would delete,
 *              and it would fail in the confusing way Ruling 3 describes --
 *              not a clean error, tables vanishing mid-run. Run it by hand
 *              when nothing else is running.
 *
 * Schemas are recreated on demand, so dropping any of them costs a rebuild,
 * never data.
 */
import pg from "pg";
import { runSuffix } from "../app/server/src/db/testdb.ts";

const CONN = process.env.DATABASE_URL_TEST;
if (!CONN) {
  console.error("DATABASE_URL_TEST is not set. This script only ever touches the test branch.");
  process.exit(1);
}

const stale = process.argv.includes("--stale");
const suffix = runSuffix();

/* Prefixes the harness and its strays have used. `bench_` and `verify_` are
 * not harness names -- they are leftovers from a benchmark and a by-hand
 * check -- but they leaked the same way and are cleaned up the same way. */
const PREFIXES = ["test\\_%", "bench\\_%", "verify\\_%"];

const client = new pg.Client({ connectionString: CONN });
await client.connect();
try {
  const { rows } = await client.query(
    `SELECT nspname FROM pg_namespace
      WHERE (${PREFIXES.map((_, i) => `nspname LIKE $${i + 1}`).join(" OR ")})
      ORDER BY nspname`,
    PREFIXES,
  );

  const mine = (n) => n.endsWith(`_${suffix}`);
  const targets = rows.map((r) => r.nspname).filter((n) => (stale ? !mine(n) : mine(n)));

  if (!targets.length) {
    console.log(`Nothing to drop (${stale ? "no other runs' schemas" : `no schemas for run '${suffix}'`}).`);
  } else {
    for (const name of targets) {
      /* Interpolated, because CREATE/DROP SCHEMA takes no parameters. Every
       * name came from pg_namespace and is re-checked against the same
       * identifier rule testdb.ts enforces, so nothing unquoted reaches the
       * DDL that did not already exist as a schema. */
      if (!/^[a-z0-9_]+$/.test(name)) {
        console.warn(`skipped ${name} -- not a plain lowercase identifier`);
        continue;
      }
      await client.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
    }
    console.log(
      `Dropped ${targets.length} schema(s) ${stale ? `from other runs (kept run '${suffix}')` : `for run '${suffix}'`}.`,
    );
  }
} finally {
  await client.end();
}
