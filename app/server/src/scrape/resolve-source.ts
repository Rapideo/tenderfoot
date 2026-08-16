/* Shared source resolution for the scrape entry points (cli.ts,
 * routes/admin.ts) -- and ONLY the entry points. This file opens a database
 * connection (via db/index.ts), which is exactly why scrape/run.ts (the
 * design's "scrape/core") must never import it: the library takes a
 * resolved configuration object and returns results, and a scraper that
 * reaches into the application's database to find out what to do is
 * coupled to it whatever directory it lives in (spec §4).
 *
 * db/index.ts IS IMPORTED DYNAMICALLY, inside resolveSource() below, not
 * statically at the top of this file. db/index.ts throws synchronously at
 * MODULE EVALUATION if DATABASE_URL is unset (deliberate there: fail loud
 * rather than silently reach production, see its own comment) -- but that
 * means a static import here would make merely IMPORTING this module (and
 * therefore cli.ts, which imports it) require a database connection just
 * to load. scripts/check.mjs deliberately strips DATABASE_URL from the
 * test child's environment as a safety net (any test file that skips
 * useTestSchema() must die loud instead of silently reaching production),
 * and cli.test.ts tests parseArgv(), a pure function, with no
 * useTestSchema() call anywhere in it. A static import here broke that
 * gate the moment this file existed; the dynamic import below is the fix,
 * mirroring the exact pattern ingest/import-cli.ts already uses for its
 * own entry-point guard (`const { close } = await import("../db/index.js")`).
 *
 * FIX 1 (Critical, final review 2026-08-15): registry.ts keys adapters by
 * a short CLI ergonomic ('sam', 'usaspending'). That key used to become
 * `run.source_name` in the artifact directly, but the seed data
 * (migrations/003_seed_source_registry.sql) names the rows 'SAM.gov' and
 * 'USASpending' -- so import-artifact.ts threw `No source row named sam`,
 * discovered only at IMPORT time, after a real scrape had already spent
 * its entire budget fetching from a live federal source. This function
 * resolves the registry key against the `source` table UP FRONT, before a
 * single fetch happens, so the failure is immediate and cheap instead of
 * hidden behind a full run.
 *
 * FIX 2 (Critical, same review): folded into the same up-front check
 * because the spec's contract already names *enabled* sources (§7: "one or
 * more enabled sources"), and nothing anywhere read `source.enabled` --
 * every one of the 13 seeded rows is `enabled = false`
 * (003_seed_source_registry.sql's own header comment says so). A disabled
 * source is refused here, fail-closed, naming the source and telling the
 * operator what to do about it. This is what makes the registry's on/off
 * switch mean something rather than being purely decorative.
 */
import { ADAPTERS } from "./adapters/registry.js";

export interface ResolvedSource {
  /** The canonical `source.name` row -- what the artifact's
   * `run.source_name` and the importer's `SELECT id FROM source WHERE name
   * = $1` must agree on. */
  sourceName: string;
}

export async function resolveSource(key: string): Promise<ResolvedSource> {
  const entry = ADAPTERS[key];
  if (!entry) {
    throw new Error(`No adapter named ${key}. Known: ${Object.keys(ADAPTERS).join(", ")}`);
  }

  /* `fake` carries sourceName: null -- a dev fixture with no registry row.
   * There is no source row to check, disabled or otherwise, and there is
   * never meant to be one: exempt it from resolution entirely rather than
   * inventing a row to satisfy this check. No database import needed on
   * this path either -- another reason the import below is deferred. */
  if (entry.sourceName === null) {
    return { sourceName: key };
  }

  const { one } = await import("../db/index.js");
  const row = await one<{ id: number; enabled: boolean }>(
    `SELECT id, enabled FROM source WHERE name = $1`,
    [entry.sourceName],
  );
  if (!row) {
    throw new Error(
      `No source row named '${entry.sourceName}' (registry key '${key}'). ` +
        `Check migrations/003_seed_source_registry.sql -- the registry key and the ` +
        `seeded source.name must agree.`,
    );
  }
  if (!row.enabled) {
    throw new Error(
      `Source '${entry.sourceName}' is disabled (source.enabled = false). ` +
        `Enable it in the source registry before scraping it -- a disabled source ` +
        `is refused, not silently skipped.`,
    );
  }

  return { sourceName: entry.sourceName };
}
