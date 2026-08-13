import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { all, run, tx } from "./index.js";

/* Hand-rolled rather than a library (SP0 plan, decision 2): ~40 lines, no
 * dependency, fully inspectable. The first migration is the project's most
 * expensive early commitment (§2.2), so the thing applying it should be
 * readable in one sitting. Unchanged reasoning; changed driver. */

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");

export async function migrate(verbose = true): Promise<string[]> {
  await run(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const applied = new Set((await all<{ name: string }>("SELECT name FROM schema_migrations")).map((r) => r.name));
  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(DIR, file), "utf8");
    /* Each migration is one transaction. A half-applied migration is worse
     * than an unapplied one, because it looks like it worked.
     *
     * Postgres also makes DDL transactional, which SQLite did not fully --
     * so this guarantee got stronger rather than weaker. */
    await tx(async (q) => {
      /* Multi-statement SQL goes through the simple query protocol, which
       * requires NO parameters. Every migration file is parameterless; if
       * one ever needs a value, it splits into its own statement. */
      await q.run(sql);
      await q.run("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    ran.push(file);
    if (verbose) console.log(`applied ${file}`);
  }
  if (verbose && ran.length === 0) console.log("no pending migrations");
  return ran;
}

export async function appliedMigrations(): Promise<string[]> {
  return (await all<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name")).map((r) => r.name);
}

/* Entry-point guard. `file://${process.argv[1]}` is WRONG on Windows: argv[1]
 * is a backslashed path (C:\...) while import.meta.url is a file:///C:/...
 * URL, so the comparison silently never matches and the CLI does nothing.
 * pathToFileURL normalises both sides. Found by SP0's own verification. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { close } = await import("./index.js");
  console.log(`database: ${new URL(process.env.DATABASE_URL!).host}`);
  await migrate();
  await close();
}
