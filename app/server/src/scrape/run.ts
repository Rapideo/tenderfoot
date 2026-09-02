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
 * CORRECTED 2026-08-15, final review (FIX 5): "inclusive costs a duplicate
 * row" UNDERSTATES the real cost -- it is true only when the tied block is
 * small. SAM's modifiedDate is second-precision, and a bulk re-index can
 * tie MANY records to the exact same timestamp -- the captured fixture has
 * 3 of 5 sharing one value. Because the boundary is inclusive, the NEXT
 * invocation's `until` re-admits the ENTIRE tie block, not just one
 * boundary record. If a single invocation's budget cannot walk past that
 * whole block, `lowWater` computes to the SAME value again -- this run's
 * own `nextUntil` never lands strictly below the `until` it was handed --
 * and every subsequent invocation re-fetches and RE-WRITES the identical
 * prefix forever, reporting `done: false` with an unchanged marker. That is
 * a SILENT LIVELOCK, not a slow-but-working resume, and it looks exactly
 * like ordinary checkpoint-and-resume progress to a caller that only checks
 * `done`. Inclusive can cost NON-TERMINATION, not merely a duplicate row.
 *
 * This fix does not attempt a secondary tiebreak (e.g. an `id`-based
 * cursor within the tied second) -- that is design work, not a fix-wave
 * patch, and the spec (§5, over-ask) never specified one. What this DOES
 * do is refuse to let the symptom pass as success: `noProgress` below is
 * true exactly when a partial run's own `nextUntil` failed to move
 * strictly below the `until` it was given, so the caller (cli.ts,
 * routes/admin.ts) can say so loudly instead of quietly recommending a
 * resume that will not resume anything.
 *
 * This module opens no database connection. It receives a resolved request
 * and an adapter, and returns a file path.
 */
import type { RunRequest } from "./contract.js";
import { isSnapshot, type Adapter, type SnapshotAdapter, type WindowedAdapter } from "./adapter.js";
import { openArtifact } from "./artifact.js";

export const SCRAPER_VER = "1";

export interface RunResult {
  done: boolean;
  nextUntil: string | null;
  rows: number;
  artifactPath: string;
  /* FIX 4 (final review, 2026-08-15): the sum of `page.undatedSkipped`
   * across every page fetched this run. adapter.ts promises this count is
   * "visible rather than silent" (§5.4); before this fix it was read from
   * no page at all -- counted by the adapter, then dropped on the floor. */
  undatedSkipped: number;
  /* FIX 5 (Critical, final review 2026-08-15): true when this run made NO
   * forward progress -- i.e. `done` is false and `nextUntil` did not land
   * strictly below the `until` this run was given. See the corrected
   * inclusive-boundary note in the module header above for the mechanism
   * (a tie block wider than one invocation's budget). Re-invoking with
   * `until: nextUntil` when this is true will re-fetch and re-write the
   * exact same records rather than advancing -- the caller must widen the
   * window or raise the budget instead of blindly resuming. */
  noProgress: boolean;
}

export async function runScrape(
  req: RunRequest,
  adapter: Adapter,
  outPath: string,
  now: () => number = Date.now,
): Promise<RunResult> {
  /* Task 4 (spec §4, §4.1): dispatch on shape instead of refusing every
   * snapshot adapter outright. The artifact is opened once, here, for
   * either shape it turns out to be.
   *
   * RunMeta.since/until (artifact.ts) are non-optional strings, but a
   * snapshot RunRequest never carries a window at all -- contract.ts's
   * snapshot branch of validateRun refuses `since`/`until` outright, it
   * does not merely leave them undefined. "" stands in for "no window"
   * rather than inventing a date: it can never be mistaken for a real
   * boundary (contract.ts's isValidDate rejects it, and it sorts before
   * every real ISO string a windowed run would ever produce). */
  const started = now();
  const art = openArtifact(outPath, {
    /* FIX 1: the CANONICAL name, not the CLI's short key -- see the
     * `sourceName` field comment on RunRequest (contract.ts). Falling back
     * to `req.source` covers `fake` (no registry row to resolve) and any
     * caller that builds a RunRequest directly, bypassing the entry
     * points' resolveSource() call (e.g. this module's own tests). */
    sourceName: req.sourceName ?? req.source,
    since: req.since ?? "",
    until: req.until ?? "",
    depth: req.depth,
    scraperVer: SCRAPER_VER,
  });

  if (isSnapshot(adapter)) return runSnapshot(req, adapter, art, now, started);
  return runWindowed(req, adapter, art, now, started);
}

async function runWindowed(
  req: RunRequest,
  adapter: WindowedAdapter,
  art: ReturnType<typeof openArtifact>,
  now: () => number,
  started: number,
): Promise<RunResult> {
  /* Task 3 (spec §4) made `since`/`until` optional on RunRequest so a
   * snapshot request never has to carry a window it does not have.
   * Narrowing that away is this function's job: runScrape's dispatch above
   * already sends every snapshot adapter to runSnapshot instead, and
   * validateRun's windowed branch (contract.ts) still fails closed on a
   * missing window -- so both are guaranteed non-null by the time a
   * validated request reaches here. A guard rather than a bare assertion,
   * so a RunRequest built by hand (bypassing validateRun -- this module's
   * own tests do) fails loud instead of sending `undefined` into
   * `adapter.fetchListing`. */
  if (req.since === undefined || req.until === undefined) {
    throw new Error("runScrape: a windowed adapter requires since and until on the request");
  }

  let cursor: string | null = null;
  let rows = 0;
  let lowWater: string | null = null;
  let done = false;
  /* FIX 4: accumulated across every page. `page.undatedSkipped` is
   * OPTIONAL on ListingPage (adapter.ts) -- most adapters never produce it
   * -- so each page's contribution defaults to 0 rather than poisoning the
   * running total with `undefined + number`. */
  let undatedSkippedTotal = 0;

  try {
    for (;;) {
      const page = await adapter.fetchListing(req.since, req.until, cursor);
      undatedSkippedTotal += page.undatedSkipped ?? 0;
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
    art.finish(done ? "complete" : "partial", done ? null : lowWater, undatedSkippedTotal);
    art.close();
  }

  const nextUntil = done ? null : lowWater;
  /* FIX 5: see the corrected inclusive-boundary note in the module header.
   * Only meaningful for a partial run with a real marker -- a `done` run
   * has no `nextUntil` to fail to advance, and a partial run that wrote
   * NOTHING at all (lowWater still null) is a different, pre-existing edge
   * case (an adapter returning only empty or fully out-of-window pages),
   * not the tie-block livelock this fix targets. */
  const noProgress = !done && nextUntil !== null && !(nextUntil < req.until);

  return {
    done,
    nextUntil,
    rows,
    artifactPath: art.path,
    undatedSkipped: undatedSkippedTotal,
    noProgress,
  };
}

/* THE SNAPSHOT LOOP. Deliberately much smaller than the windowed one: there
 * is no window to narrow, so there is no lowWater, no nextUntil, and no
 * cross-invocation resume.
 *
 * A snapshot of "what is currently open" SHIFTS between runs, so a cursor
 * saved from a previous invocation may skip rows or duplicate them, and
 * neither failure is visible in the result. So a run that exhausts its
 * budget reports partial and starts over next time. At IDOA's ~50 rows that
 * costs nothing; if a snapshot source ever grows big enough for it to hurt,
 * repeated partial runs say so loudly instead of miscounting quietly. */
async function runSnapshot(
  req: RunRequest,
  adapter: SnapshotAdapter,
  art: ReturnType<typeof openArtifact>,
  now: () => number,
  started: number,
): Promise<RunResult> {
  let cursor: string | null = null;
  let rows = 0;
  let done = false;

  try {
    for (;;) {
      const page = await adapter.fetchSnapshot(cursor);
      const capId = art.writeCapture({
        hop: "listing",
        url: page.requestUrl,
        httpStatus: page.httpStatus,
        payload: page.payload,
      });

      for (const item of page.items) {
        if (req.limit !== undefined && rows >= req.limit) break;
        /* artifact.ts has no `writeRecord` and no separate "record" table --
         * a SnapshotItem's fields map onto the same `sighting` table a
         * windowed run writes, via writeSighting's real SightingRow shape.
         * `modifiedAt` has no snapshot equivalent (that is the whole point
         * of SnapshotItem, adapter.ts), so `seenAt` -- the only date this
         * row can honestly carry -- is when it was FETCHED, same as the
         * windowed loop. `mode: "mechanical"` mirrors the windowed loop for
         * the same reason: the column exists so a smart path can be
         * COMPARED later, not a live toggle (spec §3.4). */
        art.writeSighting({
          externalId: item.externalId,
          seenAt: new Date().toISOString(),
          raw: item.raw,
          captureId: capId,
          extractorVer: SCRAPER_VER,
          mode: "mechanical",
        });
        rows++;
      }
      if (req.limit !== undefined && rows >= req.limit) {
        done = true;
        break;
      }

      cursor = page.nextCursor;
      if (cursor === null) {
        done = true;
        break;
      }
      if (now() - started >= req.budgetMs) break;
    }
  } finally {
    /* Mirrors the windowed loop's try/finally: the artifact must stay
     * self-describing and its SQLite handle must not leak, whether the loop
     * finished, broke on budget, or threw. `undatedSkipped` is always 0 here
     * -- SnapshotPage has no such counter at all (there is no date to be
     * missing, adapter.ts), so there is nothing to sum. */
    art.finish(done ? "complete" : "partial", null, 0);
    art.close();
  }

  return {
    done,
    /* There is no window to narrow, so there is nothing to resume FROM. A
     * date here would be an invented one -- the point of this whole slice. */
    nextUntil: null,
    rows,
    artifactPath: art.path,
    undatedSkipped: 0,
    noProgress: false,
  };
}
