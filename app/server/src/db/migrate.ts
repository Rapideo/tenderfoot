import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { db, DB_PATH } from "./index.js";

/* Hand-rolled rather than a library (SP0 plan, decision 2): ~40 lines, no
 * dependency, fully inspectable. The first migration is the project's most
 * expensive early commitment (§2.2), so the thing applying it should be
 * readable in one sitting. */

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");

export function migrate(verbose = true): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const applied = new Set(
    db.prepare("SELECT name FROM schema_migrations").all().map((r: any) => r.name as string),
  );
  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];

  const record = db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(DIR, file), "utf8");
    /* Each migration is one transaction. A half-applied migration is worse
     * than an unapplied one, because it looks like it worked. */
    db.transaction(() => {
      db.exec(sql);
      record.run(file, new Date().toISOString());
    })();
    ran.push(file);
    if (verbose) console.log(`applied ${file}`);
  }
  if (verbose && ran.length === 0) console.log("no pending migrations");
  return ran;
}

export function appliedMigrations(): string[] {
  return db
    .prepare("SELECT name FROM schema_migrations ORDER BY name")
    .all()
    .map((r: any) => r.name as string);
}

/* Entry-point guard. `file://${process.argv[1]}` is WRONG on Windows: argv[1]
 * is a backslashed path (C:\...) while import.meta.url is a file:///C:/...
 * URL, so the comparison silently never matches and the CLI does nothing.
 * pathToFileURL normalises both sides. Found by SP0's own verification. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`database: ${DB_PATH}`);
  migrate();
}
