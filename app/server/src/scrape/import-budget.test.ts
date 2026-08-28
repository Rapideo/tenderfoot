import { expect, test } from "vitest";
import { importFitsInBudget, MS_PER_ROW, CEILING_MS } from "./import-budget.js";

/* THE FAILURE THIS FILE EXISTS FOR, reconstructed 2026-08-28 from sequence
 * forensics rather than from a log.
 *
 * A Run on production scraped successfully, pushed 9,097 rows into
 * `importArtifact`, and then the whole transaction aborted. Nothing recorded
 * it: `ingest_run` rolled back, every sighting rolled back, and the only
 * surviving trace was a 9,097-wide gap in `sighting_id_seq` sitting between
 * the 2026-08-17 rows and the next good run. Vercel's runtime-log API
 * answers 403 for this project's token, so there was no other evidence at
 * all.
 *
 * `RUN_HANDLER_BUDGET_MS` bounds ONLY the scrape loop (scrape/run.ts's
 * budget check). `importArtifact` and `mergeSightings` run afterwards, in
 * the same request, unbounded. The route reserved 120s of headroom for them
 * -- explicitly, and sized from real figures -- but a FIXED reservation
 * sized for one scale cannot notice when the run arrives at another. 530
 * solicitations was the measured case; 9,097 rows is seventeen times that.
 *
 * WHAT IS AND IS NOT CLAIMED. That the 9,097-row run overran the platform
 * ceiling is plausible and NOT demonstrated -- by the measured rates it
 * should have fit, and merge may simply be superlinear at that scale.
 * What IS certain is that there was no guard: when the phases do not fit,
 * the request is killed mid-transaction and the operator is told nothing.
 * This module is that guard. It does not claim to know why the run died;
 * it refuses to START work that its own arithmetic says cannot finish, and
 * the refusal is the record that was missing. */

test("a small run is allowed to import", () => {
  const fit = importFitsInBudget({ rows: 57, elapsedMs: 4_000 });
  expect(fit.ok).toBe(true);
});

test("a run that cannot finish before the platform ceiling is refused", () => {
  /* The scrape spent its whole budget and came back with far more than the
   * remaining time can import and merge. */
  const fit = importFitsInBudget({ rows: 9_097, elapsedMs: 180_000 });
  expect(fit.ok).toBe(false);
});

test("the refusal names the row count, so the operator knows what was thrown away", () => {
  const fit = importFitsInBudget({ rows: 9_097, elapsedMs: 180_000 });
  expect(fit.ok).toBe(false);
  if (fit.ok) return;
  expect(fit.reason).toContain("9097");
});

test("the refusal names a narrower window as the remedy, not a retry", () => {
  const fit = importFitsInBudget({ rows: 9_097, elapsedMs: 180_000 });
  expect(fit.ok).toBe(false);
  if (fit.ok) return;
  /* Re-running the same window would fail the same way. The only thing the
   * operator can usefully change is the window. */
  expect(fit.reason).toMatch(/since/i);
});

test("the same row count is allowed when the scrape left enough time for it", () => {
  /* Same rows, but the scrape returned almost immediately -- this is the
   * case a fixed reservation gets wrong in the OTHER direction, refusing
   * work that would comfortably have finished. */
  const fit = importFitsInBudget({ rows: 9_097, elapsedMs: 1_000 });
  expect(fit.ok).toBe(true);
});

test("the estimate is the repo's own measured rate, not a guess", () => {
  /* ~1,038 rows/sec import (0.96ms/row) plus 4.07s per 530 merged
   * (7.68ms/row) is ~8.6ms/row; the constant rounds up from that and must
   * never silently drift below it. */
  expect(MS_PER_ROW).toBeGreaterThanOrEqual(9);
  expect(CEILING_MS).toBe(300_000);
});

test("zero rows always fits, however long the scrape took", () => {
  /* A run that found nothing still has to reach its stamp -- refusing here
   * would strand `last_run_at` and make the next window wider, which is the
   * opposite of what this guard is for. */
  const fit = importFitsInBudget({ rows: 0, elapsedMs: 299_000 });
  expect(fit.ok).toBe(true);
});
