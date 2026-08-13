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
function runSuffix(): string {
  const raw = process.env.GITHUB_RUN_ID ?? "local";
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

/** Drop and recreate the schema. Runs on its own connection, outside the pool. */
export async function resetSchema(name: string): Promise<void> {
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
  await admin.connect();
  try {
    await admin.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
    await admin.query(`CREATE SCHEMA ${name}`);
  } finally {
    await admin.end();
  }
}
