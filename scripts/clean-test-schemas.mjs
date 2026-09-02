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
/* `--reap` is the SAFE half of `--stale`, and the difference is age.
 *
 * --stale drops every other run's schemas outright, which is why its own
 * header says NOT SAFE TO RUN CONCURRENTLY: a CI run in flight owns schemas
 * it would delete. Because it was unsafe, nothing ran it automatically;
 * because nothing ran it automatically, the 106-schema backlog it was written
 * for came back -- 87 schemas and 11,052 pg_class rows on 2026-09-01, with the
 * gate failing a different test on every run and taking 174s instead of 107s.
 *
 * --reap drops only schemas the registry says are OLDER THAN THE THRESHOLD.
 * A suite in flight has schemas seconds old and is untouched; an orphan from a
 * gate run that died before its cleanup is hours old and goes. That makes it
 * safe to run unattended, which is the property the backlog needed and never
 * had. Unregistered schemas are LEFT ALONE -- an unknown age is not an old
 * one, and `--stale` remains the by-hand sledgehammer for those. */
const reap = process.argv.includes("--reap");
/* Three hours: comfortably longer than any suite run (the gate is ~2 minutes,
 * and the slowest CI run on record is well under an hour), and short enough
 * that a day's orphans never accumulate into a second backlog. */
const REAP_AFTER = "3 hours";
const suffix = runSuffix();

/* Prefixes the harness and its strays have used. `bench_` and `verify_` are
 * not harness names -- they are leftovers from a benchmark and a by-hand
 * check -- but they leaked the same way and are cleaned up the same way. */
const PREFIXES = ["test\\_%", "bench\\_%", "verify\\_%"];

const client = new pg.Client({ connectionString: CONN });
await client.connect();
try {
  /* Created HERE rather than in testdb.ts, and that is deliberate. resetSchema()
   * runs once per test FILE, in ~71 parallel processes; concurrent
   * CREATE SCHEMA / CREATE TABLE IF NOT EXISTS from that many workers races on
   * the system catalogs and can raise "tuple concurrently updated". This script
   * is single-threaded and runs before and after the suite, so the DDL happens
   * exactly once and resetSchema() only ever INSERTs. */
  await client.query(`CREATE SCHEMA IF NOT EXISTS tenderfoot_meta`);
  await client.query(
    `CREATE TABLE IF NOT EXISTS tenderfoot_meta.test_schema_registry (
       schema_name text PRIMARY KEY,
       created_at  timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const { rows } = await client.query(
    `SELECT nspname FROM pg_namespace
      WHERE (${PREFIXES.map((_, i) => `nspname LIKE $${i + 1}`).join(" OR ")})
      ORDER BY nspname`,
    PREFIXES,
  );

  const mine = (n) => n.endsWith(`_${suffix}`);
  const all = rows.map((r) => r.nspname);

  /* Registered-and-old, computed by the DATABASE's clock rather than this
   * process's -- a laptop with a skewed clock must not be able to reap a
   * live CI run's schemas. */
  let reapable = new Set();
  if (reap) {
    const { rows: old } = await client.query(
      `SELECT schema_name FROM tenderfoot_meta.test_schema_registry
        WHERE created_at < now() - $1::interval`,
      [REAP_AFTER],
    );
    reapable = new Set(old.map((r) => r.schema_name));
  }

  const targets = all.filter((n) => {
    if (reap) return !mine(n) && reapable.has(n);
    return stale ? !mine(n) : mine(n);
  });

  const mode = reap ? "reap" : stale ? "stale" : "own";
  if (!targets.length) {
    console.log(
      `Nothing to drop (mode=${mode}${reap ? `, nothing registered older than ${REAP_AFTER}` : ""}).`,
    );
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
    /* The registry row goes with the schema. A row for a schema that no longer
     * exists would make the table grow without bound -- the same class of leak
     * this script exists to stop, one level up. */
    await client.query(
      `DELETE FROM tenderfoot_meta.test_schema_registry WHERE schema_name = ANY($1::text[])`,
      [targets],
    );
    console.log(
      `Dropped ${targets.length} schema(s) [mode=${mode}] ` +
        (reap
          ? `registered before now() - ${REAP_AFTER}.`
          : stale
            ? `from other runs (kept run '${suffix}').`
            : `for run '${suffix}'.`),
    );
  }
} finally {
  await client.end();
}
