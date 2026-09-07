/* The adapter registry -- one map, shared by every caller that names an
 * adapter by source string.
 *
 * Controller ruling 1 (task-9): the original task-9 brief had `routes/admin.ts`
 * declare its own `ADAPTERS` map, duplicating the one `scrape/cli.ts` already
 * had. Two registries drift -- add a source to one and the other silently
 * falls behind, and nothing would catch it since each has its own tests.
 * This module is the single source of truth; `cli.ts` and `routes/admin.ts`
 * both import it rather than each declaring their own.
 *
 * FIX 1 (final review, 2026-08-15): the map used to be `Record<string, () =>
 * Adapter>` -- just the factory, keyed by the short CLI ergonomic ('sam').
 * That key became `run.source_name` in the artifact (scrape/run.ts used
 * `req.source` directly), but the seed data
 * (migrations/003_seed_source_registry.sql) names the actual rows 'SAM.gov'
 * and 'USASpending' -- so a real scrape produced an artifact
 * import-artifact.ts could never resolve: `No source row named sam`,
 * discovered only at import time, after the whole scrape had already run.
 *
 * Each entry now also carries `sourceName`: the canonical source.name row
 * the short key maps to. The short key stays -- it is the CLI ergonomics
 * (`--source sam`); `sourceName` is the identity that must reach the
 * artifact and, from there, the importer. `scrape/resolve-source.ts` is
 * what actually looks `sourceName` up against the `source` table (in the
 * entry points, never here -- this module stays a plain synchronous map,
 * no database access, importable by scrape/core's tests without a
 * connection). */
import { fakeAdapter } from "./fake.js";
import { samAdapter } from "./sam.js";
import { usaSpendingAdapter } from "./usaspending.js";
import { idoaAdapter } from "./idoa.js";
import { higherGovAdapter } from "./highergov.js";
import type { Adapter } from "../adapter.js";

export interface AdapterRegistryEntry {
  /** The canonical `source.name` row this registry key maps to. `null`
   * means there is deliberately no row -- see `fake` below. */
  sourceName: string | null;
  make: () => Adapter;
  /** ⚖️ Task 8 review round 3 (CRITICAL): true for a source that bills per
   * record. `resolve-source.ts` refuses ANY caller that reaches a metered
   * entry unless it explicitly opts in (`{ meteredAllowed: true }`) -- the
   * refusal lives on the RESOLVED registry key, which is the one thing every
   * call site (scrape/cli.ts, admin.ts's two routes, and every future one)
   * already agrees on, regardless of which spelling of the source a caller
   * used to get there. A per-entry-point refusal copied into each call site
   * is exactly the shape that already failed once: admin.ts's /run accepts
   * BOTH the registry key ('highergov') and the canonical source.name
   * ('HigherGov') via resolveAdapterKey(), and a check keyed on one spelling
   * would let the other straight through. Undefined/false means "free to
   * run anywhere", unchanged for every other entry. */
  metered?: boolean;
}

export const ADAPTERS: Record<string, AdapterRegistryEntry> = {
  /* `fake` is a dev fixture with no registry row, on purpose: it exists so
   * the scrape loop, CLI, and HTTP handler can be exercised end to end
   * without a network OR a seeded `source` row standing in for one. Do not
   * give it a `sourceName` and do not seed a 'fake' row in
   * 003_seed_source_registry.sql to make one up -- `resolve-source.ts`
   * exempts it from resolution entirely on the strength of this `null`. */
  fake: { sourceName: null, make: () => fakeAdapter(25, 10) },
  sam: { sourceName: "SAM.gov", make: () => samAdapter() },
  usaspending: { sourceName: "USASpending", make: () => usaSpendingAdapter() },
  /* Task 8: the first SNAPSHOT source to be registered. `sourceName` must
   * match the seeded `source.name` row exactly
   * (migrations/003_seed_source_registry.sql) -- resolve-source.ts looks it
   * up by name, same as every windowed entry above. Registering this is
   * what makes `admin.ts`'s /run route actually reach a snapshot adapter
   * for the first time, which is why this task also had to fix two latent
   * bugs that registering it made live (see admin.ts and
   * ingest/import-artifact.ts). `source.enabled` stays false -- turning it
   * on is Task 10's deliberate operator act, not a consequence of this
   * registration. */
  /* ⚠️ 2026-09-03: registered but NOT intended to run. `source.enabled` is
   * false and stays false -- IDOA is retained as the codebase's only second
   * source shape, which is what proves these layers are not SAM-shaped
   * (D27, Proto2PRD 2.26). Its deletion trigger is named in idoa.ts's header:
   * when the HigherGov adapter lands. */
  idoa: { sourceName: "Indiana IDOA solicitations", make: () => idoaAdapter() },
  /* ⚠️ THE FIRST METERED ADAPTER IN THIS MAP. Every other entry is free to
   * run; this one bills per record against an allowance that cannot be read
   * back from the vendor. `metered: true` is what resolve-source.ts refuses
   * by default -- `npm run ingest:highergov` (ingest/highergov-cli.ts) is
   * the one caller that opts in, after it has measured and capped the
   * spend. Every other path (scrape/cli.ts, admin.ts's /scrape and /run) is
   * refused there, not re-taught the rule locally. */
  highergov: { sourceName: "HigherGov", make: () => higherGovAdapter(), metered: true },
};
