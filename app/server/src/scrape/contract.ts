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

export const DEFAULT_BUDGET_MS = 15 * 60 * 1000;

export interface RunRequest {
  source: string;
  since: string;
  until: string;
  depth: Depth;
  budgetMs: number;
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
  if (typeof o.depth !== "string" || !DEPTHS.includes(o.depth)) {
    throw new Error(`depth must be one of ${DEPTHS.join(" | ")}`);
  }

  return {
    source: o.source,
    since: o.since,
    until: typeof o.until === "string" && o.until ? o.until : new Date().toISOString(),
    depth: o.depth as Depth,
    budgetMs: typeof o.budgetMs === "number" && o.budgetMs > 0 ? o.budgetMs : DEFAULT_BUDGET_MS,
  };
}
