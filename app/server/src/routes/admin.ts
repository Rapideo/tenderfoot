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

    /* FIX ROUND 1 (2026-08-15, after review): the `try` below MUST start
     * here, wrapping `mkdtempSync` AND `runScrape`, not just the streaming
     * step further down -- that is the non-obvious part, and it is exactly
     * what a future "tidy this up" pass could undo by narrowing the try
     * back to only the pipeline call. `runScrape` is not inert setup: for
     * the `sam` and `usaspending` adapters it makes real network calls via
     * `adapter.fetchListing`, and any failure there -- a timeout, a 5xx, a
     * parse error -- throws straight out of `runScrape` (its own `finally`
     * only closes the SQLite artifact; it has no idea a temp directory
     * exists, because it was never given one, only a file path inside it).
     * A try that started after this line would let that throw reach
     * `asyncHandler`'s `next(err)` with the temp directory still on disk.
     * On a serverless filesystem those accumulate across every failed
     * scrape, invisibly -- nothing surfaces it until disk pressure or a
     * cold-start cleanup sweep, if either ever happens.
     *
     * What this block actually guarantees, now that the guard encloses
     * directory creation: `rmSync` runs exactly once, on every exit path --
     * a clean finish, a `runScrape` failure (network or adapter error), a
     * genuine streaming failure, AND a dropped client connection (see the
     * pipeline note below). `rmSync` keeps `force: true` so it cannot
     * itself throw past this handler even if the directory was already
     * gone or never fully populated. */
    const dir = mkdtempSync(join(tmpdir(), "tf-scrape-"));
    try {
      const out = join(dir, `run-${request.source}.db`);
      const result = await runScrape(request, make(), out);

      res.setHeader("Content-Type", "application/vnd.sqlite3");
      res.setHeader("Content-Disposition", `attachment; filename="${request.source}.db"`);
      res.setHeader("X-Scrape-Done", String(result.done));
      res.setHeader("X-Scrape-Rows", String(result.rows));
      /* Resume lowers the ceiling: the caller re-invokes with the same
       * `since` and this value as `until`. Corrected 2026-08-15 after review. */
      if (result.nextUntil) res.setHeader("X-Scrape-Next-Until", result.nextUntil);

      /* `stream.pipe(res)` plus a `close` listener on the source -- an
       * earlier shape of this handler -- does NOT clean up when the CLIENT
       * disconnects mid-transfer: `.pipe()` does not propagate a
       * destination failure back to destroy the source, so when `res`'s
       * underlying socket dies, `res` emits `close` but the read stream
       * sits there un-destroyed and never emits its own `close` or `error`
       * (verified directly against both a bare `http.createServer` and
       * this route). A dropped connection is not a corner case for a
       * hand-invoked, potentially large, streamed download; it's a normal
       * way this request ends.
       *
       * `stream.pipeline()` is the fix: it wires source and destination
       * together so a failure or premature close on EITHER side destroys
       * the other and reaches one completion point. An aborted client
       * request makes the awaited pipeline reject with
       * `ERR_STREAM_PREMATURE_CLOSE`, which is caught immediately below and
       * swallowed rather than re-thrown -- there is no client left to
       * answer, so routing it into `asyncHandler`'s `next(err)` would just
       * have the global error handler try to write a 500 onto a dead
       * connection. It still reaches the outer `finally` above, which is
       * what actually removes the directory. Any OTHER error (a genuine
       * disk or stream fault) is re-thrown and reaches that handler and
       * gets logged, same as before. */
      const stream = createReadStream(out);
      try {
        await pipeline(stream, res);
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code !== "ERR_STREAM_PREMATURE_CLOSE") throw err;
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }),
);
