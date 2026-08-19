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
 * RENAMED TO `ADMIN_SECRET` 2026-08-19, and the timing is the whole point.
 * It was `ADMIN_SCRAPE_SECRET`, named when it gated one scrape route, and it
 * now gates every admin write. The rename normally costs a broken deploy
 * window -- code reading a new name while the environment still holds the
 * old one fails closed, every admin write answering 503 until someone
 * notices. It cost nothing here because `vercel env ls` showed the variable
 * had **never been set in any environment**, so there was no value to
 * migrate and no deploy to break. A week of it being set would have made
 * this a migration; today it was a find-and-replace.
 *
 * NO FALLBACK to the old name, deliberately (Matt's ruling). A
 * `ADMIN_SECRET ?? ADMIN_SCRAPE_SECRET` shim would make the push safe in any
 * order, and would then be a second name nobody removes -- the compatibility
 * layer that quietly becomes permanent. The ordering constraint is real
 * instead: **the variable must exist in Vercel before this code deploys.**
 */

/* Read fresh on every request rather than cached at module load, so a test
 * suite -- or an operator fixing a misconfigured deploy -- can change it
 * without restarting the process. */
export function requireAdminSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.ADMIN_SECRET;
  /* FAILS CLOSED: no environment variable means no admin write, period.
   * This is deliberate and must never be "fixed" into failing open --
   * an unset variable is indistinguishable from a misconfigured deploy,
   * and the safe reading of that ambiguity is refusal. */
  if (!secret) {
    res.status(503).json({
      error: "ADMIN_SECRET is not set. Refusing to serve an unauthenticated admin write.",
    });
    return;
  }
  if (req.header("X-Admin-Secret") !== secret) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  next();
}
