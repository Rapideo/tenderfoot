/* The hand-invoked scrape trigger (§9.6: ingestion runs on Vercel, invoked
 * by hand, operator sets the scope).
 *
 * WHY IT STREAMS THE FILE BACK rather than storing it: Vercel has no
 * persistent filesystem, and storing it would pull the blob-provider
 * decision forward from SP4. Streaming the artifact as the response body
 * needs no provider at all. The file is written to the OS temp directory
 * for the duration of the request only.
 *
 * The budget is set below the 300s function ceiling so a scope that does not
 * fit checkpoints and reports a resume marker instead of dying mid-write.
 *
 * ADAPTER REGISTRY: this used to declare its own `ADAPTERS` map, duplicating
 * the one `scrape/cli.ts` already had -- two registries drift silently as
 * sources are added. Both now import the single map from
 * `scrape/adapters/registry.ts` (controller ruling 1, task-9).
 */
import express from "express";
import { mkdtempSync, createReadStream, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { asyncHandler } from "../lib/asyncHandler.js";
import { validateRun, type RunRequest } from "../scrape/contract.js";
import { runScrape } from "../scrape/run.js";
import { ADAPTERS } from "../scrape/adapters/registry.js";

/* Below Vercel's 300s ceiling with margin for the response to flush. */
const HANDLER_BUDGET_MS = 240_000;

export const admin = express.Router();

admin.post(
  "/scrape",
  asyncHandler(async (req, res) => {
    let request: RunRequest;
    try {
      /* `budgetMs` is in validateRun's allowed-key set (see contract.ts),
       * so passing it through -- present or not -- never trips the
       * unknown-key guard. The caller-supplied value (if any) is
       * overridden immediately below regardless: the handler's budget is
       * fixed by the platform's function ceiling, not by the request. */
      request = validateRun(req.body ?? {});
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }
    request.budgetMs = HANDLER_BUDGET_MS;

    const make = ADAPTERS[request.source];
    if (!make) {
      res.status(400).json({ error: `No adapter named ${request.source}` });
      return;
    }

    const dir = mkdtempSync(join(tmpdir(), "tf-scrape-"));
    const out = join(dir, `run-${request.source}.db`);
    const result = await runScrape(request, make(), out);

    res.setHeader("Content-Type", "application/vnd.sqlite3");
    res.setHeader("Content-Disposition", `attachment; filename="${request.source}.db"`);
    res.setHeader("X-Scrape-Done", String(result.done));
    res.setHeader("X-Scrape-Rows", String(result.rows));
    /* Resume lowers the ceiling: the caller re-invokes with the same
     * `since` and this value as `until`. Corrected 2026-08-15 after review. */
    if (result.nextUntil) res.setHeader("X-Scrape-Next-Until", result.nextUntil);

    /* FIX (found during this task's own verification, not in the brief):
     * `stream.pipe(res)` plus `stream.on("close", cleanup)` -- the brief's
     * original shape -- does NOT clean up when the CLIENT disconnects
     * mid-transfer. Verified directly: `.pipe()` does not propagate a
     * destination failure back to the source by itself, so when `res`'s
     * underlying socket dies, `res` emits `close` but the read stream sits
     * there un-destroyed and never emits its own `close` -- the rmSync
     * cleanup callback attached to it simply never runs, and both the fd
     * and the temp directory leak for the life of the process. A dropped
     * connection is not a corner case for a hand-invoked long streaming
     * download; it is the second most likely way this request ends.
     *
     * `stream.pipeline()` is the fix, not a defensive extra: it wires
     * source and destination together so a failure or premature close on
     * EITHER side destroys the other and reaches one completion point.
     * Confirmed: an aborted client request makes the awaited pipeline
     * reject with ERR_STREAM_PREMATURE_CLOSE, which the `finally` below
     * turns into a guaranteed cleanup on every exit path -- success, a
     * genuine stream error, and a dropped connection alike. */
    const stream = createReadStream(out);
    try {
      await pipeline(stream, res);
    } catch (err) {
      /* A dropped connection is expected traffic, not a server fault --
       * there is no client left to answer, and the response object's
       * socket is already gone, so routing this into asyncHandler's
       * next(err) would have the global error handler try to write a 500
       * onto a dead connection. Only a genuine failure (disk error, a bug)
       * should still reach that handler and get logged. */
      if ((err as NodeJS.ErrnoException)?.code !== "ERR_STREAM_PREMATURE_CLOSE") throw err;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }),
);
