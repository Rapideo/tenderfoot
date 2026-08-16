/* The scrape loop. Runs an adapter against a time budget and checkpoints.
 *
 * WHY A BUDGET RATHER THAN A ROW LIMIT (spec §5): the ceiling that matters
 * is Vercel's 300s function duration, which is time, not rows. Expressing
 * it as a budget makes the ceiling a PARAMETER instead of a special case —
 * the CLI passes a generous one, the HTTP handler passes one below 300s,
 * and the same code serves both.
 *
 * `next_since` is the resume marker AND the ingestion window rail. They are
 * the same mechanism, which is why Proposal 3 needed no separate design.
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
  nextSince: string | null;
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
  let highWater: string | null = null;
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
        if (!highWater || item.modifiedAt > highWater) highWater = item.modifiedAt;
      }

      cursor = page.nextCursor;
      if (cursor === null) {
        done = true;
        break;
      }
      /* Checked AFTER a whole page is committed, never mid-page: a partial
       * page would advance the marker past records that were not written. */
      if (now() - started >= req.budgetMs) break;
    }
  } finally {
    art.finish(done ? "complete" : "partial", done ? null : highWater);
    art.close();
  }

  return { done, nextSince: done ? null : highWater, rows, artifactPath: outPath };
}
