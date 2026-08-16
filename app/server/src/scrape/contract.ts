/* The run contract. What an operator may ask for, and nothing else.
 *
 * WHY UNKNOWN KEYS THROW RATHER THAN BEING IGNORED (§1.1): the plan
 * (Tenderfoot-Plan-of-Action.md:264) warns that volume pressure will tempt
 * someone to reintroduce a filter quietly, and an options object that
 * silently swallows `minValue` is exactly that door. Scope bounds what we
 * reach for; a filter judges a record. Rejecting the key makes the attempt
 * a visible failure instead of a silent no-op.
 */
export type Depth = "listing" | "detail" | "documents";

const DEPTHS: readonly string[] = ["listing", "detail", "documents"];
const ALLOWED = new Set(["source", "since", "until", "depth", "budgetMs"]);

/* Validates ISO-8601 date strings. Why both shape and parse checks: the
 * character `-` (0x2D) sorts lexicographically below every digit, so a
 * malformed window like since="-something" passes every filter and the
 * exhaustion check never trips — the run fetches the entire source, bounded
 * only by time budget. That defeats the fail-closed guarantee. */
function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(?:T.+)?$/.test(v)) return false;
  return !Number.isNaN(Date.parse(v));
}

export const DEFAULT_BUDGET_MS = 15 * 60 * 1000;

export interface RunRequest {
  source: string;
  since: string;
  until: string;
  depth: Depth;
  budgetMs: number;
  /* FIX 1 (final review, 2026-08-15): the CANONICAL source.name row this
   * run resolves to (e.g. 'SAM.gov' for the registry key 'sam'), as
   * resolved by scrape/resolve-source.ts. Deliberately NOT part of the
   * operator's contract (§7) and NEVER accepted from `validateRun`'s input
   * -- `ALLOWED` above has no 'sourceName' key, so a request body that
   * tried to set it directly would be rejected as an unknown option,
   * exactly like any other attempted end-run around the contract. Only an
   * entry point (cli.ts, routes/admin.ts) may set this, after calling
   * resolveSource(), and only run.ts reads it -- to stamp the artifact's
   * run.source_name with something import-artifact.ts can actually
   * resolve, instead of the short CLI key the importer has never heard of.
   * Left undefined, run.ts falls back to `source` itself, which is exactly
   * right for `fake` (no registry row to resolve against) and for every
   * existing caller that builds a RunRequest directly, bypassing the entry
   * points (e.g. this file's own tests, run.test.ts). */
  sourceName?: string;
}

export function validateRun(input: unknown): RunRequest {
  const o = (input ?? {}) as Record<string, unknown>;

  for (const k of Object.keys(o)) {
    if (!ALLOWED.has(k)) {
      throw new Error(`Unknown run option: ${k}. The contract bounds scope only (§1.1).`);
    }
  }
  if (typeof o.source !== "string" || !o.source) throw new Error("source is required");
  /* Fail closed. A missing window must never mean "everything". */
  if (typeof o.since !== "string" || !o.since) {
    throw new Error("since is required — a run with no window refuses to start");
  }
  if (!isValidDate(o.since)) {
    throw new Error(`since must be an ISO-8601 date (YYYY-MM-DD[T...]), got: ${o.since}`);
  }
  if (typeof o.depth !== "string" || !DEPTHS.includes(o.depth)) {
    throw new Error(`depth must be one of ${DEPTHS.join(" | ")}`);
  }

  const until = typeof o.until === "string" && o.until ? o.until : new Date().toISOString();
  if (!isValidDate(until)) {
    throw new Error(`until must be an ISO-8601 date (YYYY-MM-DD[T...]), got: ${until}`);
  }

  return {
    source: o.source,
    since: o.since,
    until,
    depth: o.depth as Depth,
    budgetMs: typeof o.budgetMs === "number" && o.budgetMs > 0 ? o.budgetMs : DEFAULT_BUDGET_MS,
  };
}
