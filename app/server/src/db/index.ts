import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* ONE SQLITE FILE, LOCAL-FIRST (workflow spec §1).
 *
 * OPEN DECISION, do not settle it here: one file per FIRM, or one shared
 * database (workflow spec §9.3). The path is read from an env var precisely
 * so that decision stays open -- switching to per-firm files means varying
 * this value, not rewriting callers. */
/* Anchored to the repository root, NOT to cwd. npm sets cwd to the workspace
 * directory, so a cwd-relative default put the database at
 * app/server/tenderfoot.db when invoked one way and elsewhere when invoked
 * another -- which is how data quietly goes missing. Found by SP0's own
 * verification. Depth is identical from src/db and dist/db. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DB_PATH = process.env.TENDERFOOT_DB
  ? resolve(process.env.TENDERFOOT_DB)
  : resolve(REPO_ROOT, "tenderfoot.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

/* Explicitly typed. `composite: true` requires declaration emit, and an
 * inferred type here names BetterSqlite3.Database from a namespace the
 * emitted .d.ts cannot reference (TS4023). InstanceType<typeof Database>
 * names it without a second import. */
export const db: InstanceType<typeof Database> = new Database(DB_PATH);

/* WAL: concurrent reads while a long ingest writes. Ingestion runs for
 * minutes at a time (§5.3), and without this the UI blocks behind it. */
db.pragma("journal_mode = WAL");
/* Foreign keys are OFF by default in SQLite. Design spec §2.2 makes entity
 * FKs present from the first migration the expensive-mistake-to-avoid, and
 * they are worth nothing unenforced. */
db.pragma("foreign_keys = ON");

export { DB_PATH };
