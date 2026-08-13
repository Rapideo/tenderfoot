import pg from "pg";

/* MANAGED POSTGRES ON NEON (workflow spec §1, revised 2026-08-13).
 *
 * This file used to open one local SQLite file. It cannot: Vercel has no
 * writable persistent filesystem, so a SQLite file does not survive a
 * request there. The hosting choice decided the database.
 *
 * OPEN DECISION, do not settle it here: one database per FIRM, or one
 * shared (workflow spec §9.3). The connection string is read from the
 * environment precisely so that stays open -- per-firm means varying this
 * value, not rewriting callers. Unchanged in intent from the SQLite version.
 */

/* `pg` returns bigint as a STRING to avoid silent precision loss, which is
 * correct and useless to us: value_cents is bigint and every consumer wants
 * a number. JS integers are exact to 2^53, and a contract of nine thousand
 * trillion dollars is not a case we need. Parsed here, once, rather than at
 * fourteen call sites. */
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const CONN = process.env.DATABASE_URL;
if (!CONN) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env, or run `vercel env pull`.",
  );
}

/* Confines every connection in this pool to one schema. Used by the test
 * harness so each test file gets an isolated namespace in the same database
 * -- search_path is per CONNECTION, so it is set on the pool rather than
 * issued per query, which a pooled client would lose. */
const SCHEMA = process.env.TENDERFOOT_SCHEMA;

export const pool = new pg.Pool({
  connectionString: CONN,
  ...(SCHEMA ? { options: `-c search_path=${SCHEMA}` } : {}),
  /* Small on purpose. One user, and serverless concurrency against a
   * connection ceiling is the documented failure mode. Neon's POOLED
   * endpoint does the real multiplexing. */
  max: Number(process.env.PGPOOL_MAX ?? 5),
});

export interface Querier {
  all<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = any>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<number>;
  insert(sql: string, params?: unknown[]): Promise<number>;
}

function querier(exec: (sql: string, params: unknown[]) => Promise<pg.QueryResult<any>>): Querier {
  return {
    async all<T>(sql: string, params: unknown[] = []) {
      return (await exec(sql, params)).rows as T[];
    },
    async one<T>(sql: string, params: unknown[] = []) {
      return (await exec(sql, params)).rows[0] as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      return (await exec(sql, params)).rowCount ?? 0;
    },
    /* Replaces better-sqlite3's lastInsertRowid. The SQL must end in
     * `RETURNING id` -- asserted rather than assumed, because a silent
     * undefined here becomes a null foreign key three lines later. */
    async insert(sql: string, params: unknown[] = []) {
      const row = (await exec(sql, params)).rows[0];
      if (!row || row.id === undefined) {
        throw new Error(`insert() requires a RETURNING id clause: ${sql.slice(0, 80)}`);
      }
      return Number(row.id);
    },
  };
}

/* An empty params array must not be passed to pg.query at all. Passing any
 * non-undefined `values` argument -- even [] -- selects the extended query
 * protocol, which cannot execute multi-statement SQL. Task 3 runs whole
 * .sql migration files (several statements each) through run(), so this is
 * not a style preference: with params always forwarded, every migration
 * breaks. */
const base = querier((sql, params) => (params.length ? pool.query(sql, params as any[]) : pool.query(sql)));
export const { all, one, run, insert } = base;

/* One transaction, one client. better-sqlite3's db.transaction(fn)() was
 * synchronous and could not have been doing this wrong; a pool can, because
 * BEGIN on one client and INSERT on another is two connections and no
 * transaction. The callback receives a client-bound Querier so that mistake
 * is not available. */
export async function tx<T>(fn: (q: Querier) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(
      querier((sql, params) => (params.length ? client.query(sql, params as any[]) : client.query(sql))),
    );
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function close(): Promise<void> {
  await pool.end();
}
