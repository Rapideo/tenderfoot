/* The scrape loop. Runs an adapter against a time budget and checkpoints.
 *
 * WHY A BUDGET RATHER THAN A ROW LIMIT (spec §5): the ceiling that matters
 * is Vercel's 300s function duration, which is time, not rows. Expressing
 * it as a budget makes the ceiling a PARAMETER instead of a special case —
 * the CLI passes a generous one, the HTTP handler passes one below 300s,
 * and the same code serves both.
 *
 * RESUME MARKER (corrected 2026-08-15 after review -- see task-4-report.md):
 * SAM.gov pages DESCENDING, newest `modifiedAt` first (verified in
 * corpus/calibration/pull-naics.py, which sorts `-modifiedDate`). Page 1
 * therefore holds the newest records in the window and the LAST page holds
 * the oldest. A marker that tracks the MAXIMUM `modifiedAt` seen reaches
 * its final value on page 1 and never moves again: a run that exhausts its
 * budget would checkpoint the newest record's date, and resuming with
 * `since = that date` sends the adapter back to the TOP of the window --
 * re-fetching the same early pages forever. The older tail of the window is
 * never reached.
 *
 * The correct resume mechanic for descending paging is the opposite: lower
 * the CEILING, not raise the floor. This loop tracks `lowWater`, the
 * MINIMUM `modifiedAt` among items actually written, and emits it as
 * `nextUntil` -- not `nextSince`. Resuming means: same `since`,
 * `until = nextUntil`. `nextUntil` is the resume marker AND the ingestion
 * window rail; they are the same mechanism, which is why Proposal 3 needed
 * no separate design.
 *
 * `nextUntil` is INCLUSIVE ON PURPOSE. This looks like an off-by-one bug to
 * a future reader -- it is not. Re-fetching the boundary record is
 * harmless: sightings are append-only and de-duplication happens at merge
 * (spec §6). An EXCLUSIVE bound, by contrast, would silently SKIP any
 * record that shares the boundary timestamp with the last-written row --
 * a real gap, not a redundant fetch. Inclusive costs a duplicate row;
 * exclusive costs data.
 *
 * This module opens no database connection. It receives a resolved request
 * and an adapter, and returns a file path.
 */
import type { RunRequest } from "./contract.js";
import type { Adapter } from "./adapter.js";
import { openArtifact } from "./artifact.js";

export const SCRAPER_VER = "1";

export interface RunResult {
  done: boolean;
  nextUntil: string | null;
  rows: number;
  artifactPath: string;
}

export async function runScrape(
  req: RunRequest,
  adapter: Adapter,
  outPath: string,
  now: () => number = Date.now,
): Promise<RunResult> {
  const started = now();
  const art = openArtifact(outPath, {
    sourceName: req.source,
    since: req.since,
    until: req.until,
    depth: req.depth,
    scraperVer: SCRAPER_VER,
  });

  let cursor: string | null = null;
  let rows = 0;
  let lowWater: string | null = null;
  let done = false;

  try {
    for (;;) {
      const page = await adapter.fetchListing(req.since, req.until, cursor);
      const capId = art.writeCapture({
        hop: "listing",
        url: page.requestUrl,
        httpStatus: page.httpStatus,
        payload: page.payload,
      });

      for (const item of page.items) {
        art.writeSighting({
          externalId: item.externalId,
          seenAt: new Date().toISOString(),
          raw: item.raw,
          captureId: capId,
          extractorVer: SCRAPER_VER,
          /* Everything is mechanical. The column exists so a smart path can
           * be COMPARED later; it is not a toggle (spec §3.4). */
          mode: "mechanical",
        });
        rows++;
        /* Track the MINIMUM, not the maximum -- see the module header. */
        if (!lowWater || item.modifiedAt < lowWater) lowWater = item.modifiedAt;
      }

      cursor = page.nextCursor;
      if (cursor === null) {
        done = true;
        break;
      }
      /* Checked AFTER a whole page is committed, never mid-page: pages
       * arrive newest-first, so the unwritten tail of a partial page holds
       * OLDER records than any already written on it. Committing a partial
       * page would leave `lowWater` higher than the true minimum, and
       * `nextUntil` would then exclude records that were never written. */
      if (now() - started >= req.budgetMs) break;
    }
  } finally {
    art.finish(done ? "complete" : "partial", done ? null : lowWater);
    art.close();
  }

  return { done, nextUntil: done ? null : lowWater, rows, artifactPath: outPath };
}
