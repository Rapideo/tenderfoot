/* Schema-per-test-file isolation.
 *
 * The SQLite suite gave each file its own DATABASE FILE, set through an env
 * var read at import time, then dynamically imported the module that reads
 * it. That shape is preserved deliberately -- it is the smallest change that
 * keeps every test file recognisable -- but the unit of isolation is now a
 * SCHEMA inside one local database.
 *
 * Why not a database per file: creating a database cannot run inside a
 * transaction and is slow enough to be noticed on a gate run dozens of times
 * a day. A schema is instant.
 */
import pg from "pg";

/* Ruling 3 (binding, added on top of this task's brief): a bare logical name
 * like "test_migrate" would be shared by every RUN that uses this file --
 * every CI run and every developer's local run alike -- and resetSchema()
 * below does `DROP SCHEMA ... CASCADE` before recreating it. Two runs
 * sharing a name would drop each other's tables mid-run: not a clean
 * failure, an invisible corruption, since neither run errors, one just
 * quietly loses (or races against) the other's data. Per-file distinctness
 * is already handled by each test file passing its own logical name; this
 * closes the remaining, run-level gap by folding in something unique to the
 * RUN the schema name doesn't otherwise carry. Callers are unaffected: they
 * keep passing the plain logical name, and the suffixing happens here. */
export function runSuffix(): string {
  /* FIXED (SP6 final review): this used to read GITHUB_RUN_ID ?? "local" --
   * so EVERY local run fell back to the literal string "local", and two
   * concurrent local `npm run check` invocations resolved to the SAME schema
   * name, letting one's resetSchema() DROP SCHEMA ... CASCADE the other's
   * tables mid-run. Ruling 3's own comment above only ever closed this for
   * CI, where GITHUB_RUN_ID is distinct per run; it did nothing locally.
   * scripts/check.mjs now mints a TENDERFOOT_RUN_ID (randomUUID()) once per
   * invocation and sets it on the environment every child process inherits --
   * the local equivalent of GITHUB_RUN_ID. GITHUB_RUN_ID still wins when
   * both are set (CI never sets TENDERFOOT_RUN_ID, so this is never a real
   * conflict), and "local" remains the fallback only for a test file run
   * completely outside npm run check (e.g. `npx vitest run some.test.ts`
   * directly), which was never this bug's failure mode. */
  const raw = process.env.GITHUB_RUN_ID ?? process.env.TENDERFOOT_RUN_ID ?? "local";
  // Interpolated directly into DDL below (CREATE/DROP SCHEMA takes no
  // parameters), so anything outside [a-z0-9_] is replaced rather than
  // trusted -- this must stay a legal, unquoted Postgres identifier.
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

/** Call BEFORE importing anything that opens a pool. Returns the schema name. */
export function useTestSchema(name: string): string {
  const conn = process.env.DATABASE_URL_TEST;
  if (!conn) {
    throw new Error(
      "DATABASE_URL_TEST is not set. Copy .env.example to .env and paste the Neon `test` branch string.",
    );
  }
  const schema = `${name}_${runSuffix()}`;
  process.env.DATABASE_URL = conn;
  process.env.TENDERFOOT_SCHEMA = schema;
  return schema;
}

/** Thrown by resetSchema() when TENDERFOOT_SCHEMA isn't set yet -- see the
 * comment on resetSchema for why that function takes no name parameter. */
export class TestSchemaNotSetError extends Error {
  constructor() {
    super(
      "TENDERFOOT_SCHEMA is not set. Call useTestSchema() before resetSchema() -- " +
        "resetSchema takes no name argument precisely so it cannot be called with the wrong one.",
    );
    this.name = "TestSchemaNotSetError";
  }
}

/* Drop and recreate the schema this process is using. Runs on its own
 * connection, outside the pool.
 *
 * Ruling 6 (review round 1, on top of Ruling 3): takes NO argument, on
 * purpose. The first version took `name` and interpolated whatever it was
 * handed, so nothing stopped a test file from calling
 * resetSchema("test_migrate") with the bare logical name instead of the
 * suffixed value useTestSchema() returns -- silently reopening the exact
 * cross-run collision Ruling 3 exists to close (a CI run and a local run
 * both naming the plain string would DROP SCHEMA ... CASCADE each other's
 * tables). A doc comment saying "pass the suffixed value" is a precondition
 * with nothing behind it, not a guard -- this project already paid for that
 * lesson once (staged lesson 2.13). Reading TENDERFOOT_SCHEMA directly,
 * which only useTestSchema() sets, makes the wrong call unrepresentable
 * instead of merely discouraged: there is no parameter left to get wrong.
 * Do not add one back, even as an optional override. */
export async function resetSchema(): Promise<void> {
  const name = process.env.TENDERFOOT_SCHEMA;
  if (!name) throw new TestSchemaNotSetError();
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
  await admin.connect();
  try {
    await admin.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
    await admin.query(`CREATE SCHEMA ${name}`);
    await registerSchema(admin, name);
  } finally {
    await admin.end();
  }
}

/* WHY THIS SCHEMA WRITES DOWN ITS OWN BIRTHDAY.
 *
 * Postgres records no creation time for a schema -- `pg_namespace` has an oid
 * and a name and nothing else -- so clean-test-schemas.mjs could not tell a
 * schema abandoned last Tuesday from one a CI run created ninety seconds ago
 * and is actively using. That is the whole reason its `--stale` mode carries
 * the warning "NOT SAFE TO RUN CONCURRENTLY WITH ANOTHER SUITE", which in turn
 * is why nothing ran it automatically, which is why the backlog came back.
 *
 * IT CAME BACK. The 106-schema leak that header describes was fixed on
 * 2026-08-16 by running cleanup after every gate. Measured 2026-09-01: 87
 * schemas and 11,052 rows in pg_class, and the gate had started failing
 * differently on every run -- 71/71 green, then 11 failures across 5 files,
 * then 1 failure somewhere else. Dropping the backlog took the suite from
 * 174s to 107s and three consecutive runs went green. Same defect, same
 * symptom, second time.
 *
 * The leak has two sources the default cleanup cannot reach. A gate run that
 * dies before its cleanup step -- interrupted, crashed, `git stash` in another
 * window -- orphans its twenty schemas permanently, and two such runs were
 * found. And `npx vitest run one.test.ts` outside the gate resolves the suffix
 * to "local", which nothing ever cleans.
 *
 * A timestamp makes age-based reaping possible, and age is the property that
 * is actually safe to act on: a suite in flight has schemas seconds old, and
 * an orphan has schemas hours old. See clean-test-schemas.mjs `--reap`.
 *
 * BEST EFFORT ON PURPOSE. The registry lives in its own schema so it can never
 * collide with an app table, and every failure here is swallowed: a developer
 * running one test file against a branch where the registry has not been
 * created must not have their test fail over bookkeeping. The cost of a missed
 * registration is that one schema is reaped by `--stale` by hand later, not
 * that anything breaks. */
async function registerSchema(admin: pg.Client, name: string): Promise<void> {
  try {
    await admin.query(
      `INSERT INTO tenderfoot_meta.test_schema_registry (schema_name, created_at)
       VALUES ($1, now())
       ON CONFLICT (schema_name) DO UPDATE SET created_at = now()`,
      [name],
    );
  } catch {
    /* The registry is created by clean-test-schemas.mjs, which the gate runs.
     * Its absence means "not running under the gate", which is fine. */
  }
}
