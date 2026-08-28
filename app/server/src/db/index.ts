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

/* Side-effect import: raises Node’s happy-eyeballs per-address budget
 * above TCP’s retransmit timer, BEFORE any pool is built. See that file
 * for the failure it exists for and the three hypotheses it ruled out. */
import "./connect-tuning.js";

const CONN = process.env.DATABASE_URL;
if (!CONN) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env, or run `vercel env pull`.",
  );
}

/* Confines every connection in this pool to one schema. Used by the test
 * harness so each test file gets an isolated namespace in the same database
 * -- search_path is per CONNECTION, so it is set on the pool rather than
 * issued per query, which a pooled client would lose.
 *
 * Setting TENDERFOOT_SCHEMA implies CONN is an UNPOOLED connection string
 * (Ruling 5, 2026-08-13). The line below turns it into a Postgres startup
 * parameter (`-c search_path=...`), and Neon's pooled endpoint (PgBouncer)
 * rejects any startup parameter outright -- error 08P01, "unsupported
 * startup parameter in options: search_path" -- so pairing TENDERFOOT_SCHEMA
 * with a pooled CONN fails to open a pool at all, before any query runs.
 * DATABASE_URL_TEST in .env.example is unpooled for exactly this reason;
 * this is a configuration fact, not something this file enforces. */
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

/* Structural, not pg's own type: matched by both Pool and PoolClient, which
 * is what lets execQuery() below serve the pool-backed queries and the
 * transaction-client-backed ones in tx() from one copy of this logic. */
type Queryable = {
  query(sql: string): Promise<pg.QueryResult<any>>;
  query(sql: string, params: any[]): Promise<pg.QueryResult<any>>;
};

/* Omitting the params argument entirely when the list is empty runs the
 * simple query protocol unconditionally -- true regardless of pg's version
 * -- which is what multi-statement migration files need, since each is one
 * call carrying several statements. (pg@8.23.0, the version installed here,
 * happens to treat an empty array the same way, because it tests
 * values.length rather than definedness -- but that's an internal detail of
 * one minor version, not a contract this code relies on.) */
function execQuery(target: Queryable, sql: string, params: unknown[]): Promise<pg.QueryResult<any>> {
  return params.length ? target.query(sql, params as any[]) : target.query(sql);
}

const base = querier((sql, params) => execQuery(pool, sql, params));
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
    const out = await fn(querier((sql, params) => execQuery(client, sql, params)));
    await client.query("COMMIT");
    client.release();
    return out;
  } catch (err) {
    /* release(err) tells the pool to DESTROY this client rather than
     * return it -- correct here regardless of which query inside the
     * transaction failed, because pg cannot guarantee a connection that
     * errored mid-transaction is clean. A bare release() on this path
     * would hand a client of unknown state back to the pool for the next
     * caller.
     *
     * ROLLBACK is best-effort and wrapped on its own: if it throws (the
     * connection may already be gone), that second error must not replace
     * -- and hide -- the original one, which is what the caller actually
     * needs to see. */
    try {
      await client.query("ROLLBACK");
    } catch {
      // client is already broken; err below is what matters.
    }
    client.release(err as Error);
    throw err;
  }
}

export async function close(): Promise<void> {
  await pool.end();
}
