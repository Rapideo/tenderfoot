/* How many rows one operator-triggered batch may touch.
 *
 * WHY THIS IS A MODULE AND NOT AN EXPRESSION IN THE HANDLER. Task 11's brief
 * spelled the clamp inline as `Math.min(Number(req.query.limit ?? 10) || 10,
 * MAX_BATCH)`, and its test asserted only that the endpoint answered 200 to
 * `?limit=99999`. That test passes just as happily with the clamp deleted --
 * it pins nothing. The same shape of test is what let Task 9's wrong SAM.gov
 * host ship: an assertion that is true of the bug as well as the fix.
 *
 * The inline expression is also wrong twice over. `Number(x) || 10` lets a
 * NEGATIVE through, because -5 is truthy, and `Math.min` does not catch it
 * either -- -5 is already below the maximum -- so `?limit=-5` reaches
 * Postgres as `LIMIT -5` and the operator's typo comes back as a 500 naming
 * a SQL fault. And a repeated `?limit=5&limit=6` arrives as an ARRAY, which
 * `Number` turns into NaN for two values but into 5 for one, so the same
 * mistake behaves differently depending on how many times it was made.
 *
 * Pure, and takes the raw value rather than the request, so the arithmetic
 * is testable without booting a server -- the posture window.ts's
 * `resolveSince` and import-budget.ts's `importFitsInBudget` already take,
 * for the same reason. */

/** What an operator gets when they ask for nothing in particular. */
export const DEFAULT_BATCH = 10;

/* THE CEILING IS THE REASON THIS EXISTS. A batch large enough to outrun the
 * function's 300s ceiling is killed mid-work, and what survives is whatever
 * it happened to have written -- 2026-08-27, where ~9,000 imported rows were
 * rolled back and the only trace was a gap in a sequence. runExtract commits
 * per document, so a kill there is far less costly than that import was, but
 * the operator still learns nothing from a request that never answers. Fifty
 * documents at a few seconds each sits comfortably inside the budget the
 * handler passes, and an operator who wants more can click again -- which is
 * the same "narrow it and run again" the import guard offers. */
export const MAX_BATCH = 50;

/**
 * The batch size to actually use, given whatever arrived on the query string.
 *
 * Anything that is not a positive number becomes {@link DEFAULT_BATCH}:
 * absent, empty, non-numeric, zero, negative, or repeated. A limit that
 * cannot do work is far likelier to be a typo than an intent, and the
 * alternatives -- erroring, or passing it through -- turn a typo into either
 * a refusal the operator has to decode or a database fault.
 */
export function batchLimit(raw: unknown): number {
  if (typeof raw !== "string") return DEFAULT_BATCH;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_BATCH;
  return Math.min(n, MAX_BATCH);
}
