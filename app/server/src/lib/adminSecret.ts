import type { NextFunction, Request, Response } from "express";

/* The shared-secret gate on every ADMIN WRITE.
 *
 * EXTRACTED HERE 2026-08-18. It lived privately inside `routes/admin.ts`,
 * which was fine while `/api/admin/*` was the only thing gated -- and stopped
 * being fine the moment a second router needed it. The alternative was a
 * second copy in `routes/index.ts`, and this repo has already paid for that
 * shape twice: `scrape/adapters/registry.ts`'s header records two adapter
 * maps drifting apart, and a duplicated auth check is the version of that
 * bug where the thing that drifts is a refusal.
 *
 * ⚠️ THIS IS NOT AUTHENTICATION, and the design spec says so in as many
 * words (§7): it is "a shared bearer secret typed into a browser tab". It
 * proves possession of one string that every operator shares. It has no
 * identity, no sessions, no revocation, and no audit -- two people using it
 * are indistinguishable. "Auth in V1" remains open and this does not close
 * it; what this closes is the far smaller gap of some writes being gated
 * and others not.
 *
 * ⚠️ THE NAME IS NOW NARROWER THAN THE JOB. `ADMIN_SCRAPE_SECRET` was named
 * when it gated one scrape route; it now gates every admin write, scraping
 * or not. Deliberately NOT renamed here: the variable is set in Vercel's
 * project settings for production and preview, and renaming it in code
 * without changing it there would fail closed on the next deploy -- every
 * admin write answering 503 until someone noticed. The rename is a
 * deployment task, not a code edit, and it is recorded in STATUS rather than
 * half-done here.
 */

/* Read fresh on every request rather than cached at module load, so a test
 * suite -- or an operator fixing a misconfigured deploy -- can change it
 * without restarting the process. */
export function requireAdminSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.ADMIN_SCRAPE_SECRET;
  /* FAILS CLOSED: no environment variable means no admin write, period.
   * This is deliberate and must never be "fixed" into failing open --
   * an unset variable is indistinguishable from a misconfigured deploy,
   * and the safe reading of that ambiguity is refusal. */
  if (!secret) {
    res.status(503).json({
      error: "ADMIN_SCRAPE_SECRET is not set. Refusing to serve an unauthenticated admin write.",
    });
    return;
  }
  if (req.header("X-Admin-Secret") !== secret) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  next();
}
