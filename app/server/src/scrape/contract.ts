/* The run contract. What an operator may ask for, and nothing else.
 *
 * WHY UNKNOWN KEYS THROW RATHER THAN BEING IGNORED (§1.1): the plan
 * (Tenderfoot-Plan-of-Action.md:264) warns that volume pressure will tempt
 * someone to reintroduce a filter quietly, and an options object that
 * silently swallows `minValue` is exactly that door. Scope bounds what we
 * reach for; a filter judges a record. Rejecting the key makes the attempt
 * a visible failure instead of a silent no-op.
 */
import type { SourceShape } from "./adapter.js";

export type Depth = "listing" | "detail" | "documents";

const DEPTHS: readonly string[] = ["listing", "detail", "documents"];
const ALLOWED = new Set(["source", "since", "until", "depth", "budgetMs", "limit"]);

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
  /* Optional as of the snapshot split (§4): a windowed source still
   * requires both (validateRun fails closed on their absence below), but a
   * snapshot source has no window at all -- there is nothing to put here,
   * and validateRun refuses to let one be supplied (§5.4, see the
   * snapshot branch below). */
  since?: string;
  until?: string;
  depth: Depth;
  budgetMs: number;
  /* Operator row cap (§4/§5). Bounds how much a single run reads, not what
   * it reads -- distinct from the filter §1.1 already refuses (`minValue`
   * judges a record; `limit` only stops counting). Optional: absent means
   * uncapped, unchanged from today's behaviour. ENFORCING it is Task 5's
   * job, not this one's -- validateRun only makes it a validated part of
   * the request. */
  limit?: number;
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

/* `shape` defaults to "windowed" so every existing call site (this repo's
 * own tests included) that predates the snapshot split keeps compiling and
 * keeps its exact behaviour -- only a caller that explicitly resolves a
 * snapshot adapter (cli.ts, routes/admin.ts, after resolveSource()) passes
 * "snapshot" and takes the new branch below. */
export function validateRun(input: unknown, shape: SourceShape = "windowed"): RunRequest {
  const o = (input ?? {}) as Record<string, unknown>;

  for (const k of Object.keys(o)) {
    if (!ALLOWED.has(k)) {
      throw new Error(`Unknown run option: ${k}. The contract bounds scope only (§1.1).`);
    }
  }
  if (typeof o.source !== "string" || !o.source) throw new Error("source is required");
  if (typeof o.depth !== "string" || !DEPTHS.includes(o.depth)) {
    throw new Error(`depth must be one of ${DEPTHS.join(" | ")}`);
  }

  if (o.limit !== undefined) {
    if (typeof o.limit !== "number" || !Number.isInteger(o.limit) || o.limit < 1) {
      throw new Error(`limit must be a positive integer, got: ${String(o.limit)}`);
    }
  }

  if (shape === "snapshot") {
    /* §5.4: a source handed a parameter it cannot honour must throw, not
     * silently ignore it -- the same failure mode source.verified_facets
     * exists to catch on SAM.gov's sort parameter. A snapshot source has
     * no dates at all, so `since`/`until` are refused outright rather than
     * accepted and dropped. */
    if (o.since !== undefined || o.until !== undefined) {
      throw new Error(
        "A snapshot source does not accept a date window. It returns what is currently open; " +
          "there is no past to ask for. See the IDOA design §4.",
      );
    }

    return {
      source: o.source,
      depth: o.depth as Depth,
      budgetMs: typeof o.budgetMs === "number" && o.budgetMs > 0 ? o.budgetMs : DEFAULT_BUDGET_MS,
      limit: o.limit as number | undefined,
    };
  }

  /* Unchanged, and still fail-closed: a missing window must never mean
   * "everything". */
  if (typeof o.since !== "string" || !o.since) {
    throw new Error("since is required — a run with no window refuses to start");
  }
  if (!isValidDate(o.since)) {
    throw new Error(`since must be an ISO-8601 date (YYYY-MM-DD[T...]), got: ${o.since}`);
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
    limit: o.limit as number | undefined,
  };
}
