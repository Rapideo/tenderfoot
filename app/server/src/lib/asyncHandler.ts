import type { NextFunction, Request, Response } from "express";

/* Express 4 does not catch a rejected promise returned from a route handler
 * -- that arrives in Express 5. Under better-sqlite3 every query was
 * synchronous, so a throw became a same-tick 500 for free; now a Neon
 * cold-start timeout (measured 1087ms cold), a malformed-payload 22P02, or a
 * dropped connection rejects a promise nothing is listening for, and the
 * request hangs rather than answering -- and can bring down the process
 * under Node 22's default unhandled-rejection behaviour.
 *
 * Wrapping every async handler in this forwards the rejection to next(err),
 * which the error-handling middleware in src/index.ts turns into a safe,
 * generic response instead of a hang or a crash. */
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
