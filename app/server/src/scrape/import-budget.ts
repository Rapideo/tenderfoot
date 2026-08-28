/* Will import + merge finish before the platform kills the request?
 *
 * WHY THIS EXISTS. `RUN_HANDLER_BUDGET_MS` bounds only the scrape loop
 * (scrape/run.ts's budget check). `importArtifact` and `mergeSightings` run
 * afterwards, in the same request, unbounded. routes/admin.ts reserved 120s
 * of headroom for them -- explicitly, and sized from real measurements --
 * but a FIXED reservation sized at one scale cannot notice a run that
 * arrives at another, and nothing checked.
 *
 * On 2026-08-28 that gap was reconstructed from a production failure: a run
 * scraped successfully, pushed 9,097 rows into the import, and the whole
 * transaction aborted. `ingest_run` rolled back, every sighting rolled back,
 * and the ONLY surviving trace was a 9,097-wide gap in `sighting_id_seq`
 * between the 2026-08-17 rows and the next good run. Vercel's runtime-log
 * API answers 403 for this project's token, so nothing else recorded it at
 * all. Roughly nine thousand fetched rows were discarded silently.
 *
 * WHAT THIS DOES NOT CLAIM. It does not claim to know why that run died. By
 * the measured rates below it should have fit, and the likeliest
 * explanation -- that merge is superlinear well past its measured scale --
 * is untested. This module makes no diagnosis. It refuses to START work its
 * own arithmetic says cannot finish, and the refusal is the record that was
 * missing. That is worth having whatever killed the original run.
 */

/* Measured, not guessed, and both figures are already in this repo:
 * `npm run import` runs at ~1,038 rows/sec on one UNNEST (0.96 ms/row) and
 * `npm run merge` is set-based at 4.07s for 530 solicitations (7.68 ms/row)
 * -- ingest/corpus.ts's comment carries both, merge.ts:137 records the
 * 3m36s row-at-a-time figure the set-based rewrite replaced. ~8.6 ms/row
 * combined, rounded up. */
export const MS_PER_ROW = 9;

/* The function ceiling for the whole request.
 *
 * THIS MUST EQUAL `vercel.json`'s `functions["api/index.ts"].maxDuration`,
 * and import-budget.test.ts reads that file and asserts it. The assertion is
 * not ceremony: this module shipped on 2026-08-28 with 300_000 taken from
 * routes/admin.ts's comments, which reason throughout about "the platform's
 * ~300s ceiling", while `vercel.json` actually said `maxDuration: 30`. Every
 * budget in the system was then six to ten times larger than the ceiling
 * they were meant to sit under, so none of them could ever fire -- the
 * function simply died first, mid-transaction, rolling back everything it
 * had imported and recording nothing.
 *
 * The root cause was never a wrong number. It was TWO numbers in two files
 * with nothing tying them together. The test is the tie; keep it. */
export const CEILING_MS = 300_000;

/* THE HONEST PART OF THE ESTIMATE. Both rates above come from a 530-row
 * run. The failure that prompted this module was seventeen times that, and
 * whether merge's per-row cost holds at that scale is NOT KNOWN -- it does
 * dedup and linking, which have no reason to be linear. Extrapolating a
 * 530-row measurement to nine thousand rows as though it were is exactly
 * the assumption that left this unguarded in the first place.
 *
 * So the estimate carries a factor of two beyond the measured rate. This
 * makes the guard deliberately pessimistic at large scale: it will
 * sometimes refuse a run that would in fact have completed. That is the
 * correct direction to be wrong in -- a refusal is legible and costs one
 * narrower re-run, while an overrun is a silent rollback that discards
 * every fetched row and tells the operator nothing. */
export const SCALE_FACTOR = 2;

/* Response serialisation and connection teardown after merge returns. */
export const RESERVE_MS = 10_000;

export interface ImportBudgetSubject {
  /** Rows the scrape actually returned. */
  rows: number;
  /** Milliseconds already spent in this request when the scrape finished. */
  elapsedMs: number;
}

export type ImportBudgetVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Whether importing `rows` is worth starting with `elapsedMs` already spent.
 *
 * Pure, and both inputs are parameters rather than clock reads, so the
 * arithmetic is testable without freezing time -- the same posture
 * `resolveSince` takes in window.ts for the same reason.
 */
export function importFitsInBudget(s: ImportBudgetSubject): ImportBudgetVerdict {
  /* A run that found nothing still has to reach its `last_run_at` stamp.
   * Refusing here would strand the stamp and make the NEXT window wider,
   * which is the opposite of what this guard is for -- it would manufacture
   * the very condition (an ever-growing window) that produced the failure
   * this module exists to prevent. */
  if (s.rows <= 0) return { ok: true };

  const estimateMs = s.rows * MS_PER_ROW * SCALE_FACTOR;
  if (s.elapsedMs + estimateMs + RESERVE_MS <= CEILING_MS) return { ok: true };

  const secs = (ms: number) => Math.round(ms / 1000);
  return {
    ok: false,
    reason:
      `Scrape returned ${s.rows} rows after ${secs(s.elapsedMs)}s. Importing and ` +
      `merging them is estimated at up to ~${secs(estimateMs)}s, which does not fit ` +
      `inside this request's ${secs(CEILING_MS)}s ceiling. ` +
      `Refusing to START an import that cannot finish: a request killed mid-import ` +
      `rolls the entire transaction back, so every one of those ${s.rows} rows would ` +
      `be discarded with nothing recorded anywhere. ` +
      `Narrow the window with an explicit ?since= and run again — re-running the ` +
      `same window will fail the same way.`,
  };
}
