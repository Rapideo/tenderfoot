/* THE ONE PLACE THAT DECIDES "IS THIS PRODUCTION?".
 *
 * Extracted from migrate-production.mjs on 2026-09-05, when D6 needed a
 * second production door and copying the guard was the obvious move. That
 * file's own comment is the reason not to:
 *
 *     "a stale guard that is edited away in a hurry is worse than no guard"
 *
 * Two copies of a guard that must agree is a drift waiting to happen, and the
 * drift would be silent -- the wrong door would print success. So both
 * wrappers now import this, and production-target.test.mjs covers every
 * branch.
 *
 * ⚠️ IT RETURNS THE URL BUT NEVER PRINTS IT, AND NEITHER MAY ITS CALLERS.
 * §4 says the HOST is how the two branches are told apart, and the host
 * carries no secret. The password does, and CLAUDE.md §5.3 exists because
 * this project has leaked a live credential twice. The refusals below name
 * endpoints, never URLs.
 *
 * PURE OVER AN ENV OBJECT rather than reading process.env directly, so every
 * branch is reachable from a test without a real connection string existing
 * anywhere near it. */

/* The endpoints, recorded in STATUS §4. Checked rather than assumed: the whole
 * point is that "I meant to touch production" and "I touched production"
 * should not be two different facts. */
export const PRODUCTION_ENDPOINT = "ep-super-bonus-auoe43hj";
export const TEST_ENDPOINT = "ep-withered-base-au6l4cjf";

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ url: string, host: string }} the connection string and the
 *   printable host. THROWS with an operator-readable reason otherwise.
 */
export function resolveProductionTarget(env) {
  const url = env.DATABASE_URL_PRODUCTION;
  if (!url) {
    throw new Error(
      "DATABASE_URL_PRODUCTION is not set.\n" +
        "It lives in .env (§4 preserved the production string under that explicit\n" +
        "name). Run this with --env-file-if-exists=.env.",
    );
  }

  /* A malformed URL must not surface as a stack trace containing the string. */
  let host;
  try {
    host = new URL(url).host;
  } catch {
    throw new Error(
      "DATABASE_URL_PRODUCTION is not a parseable URL. Its value is deliberately\n" +
        "not printed here -- check .env by hand.",
    );
  }

  if (host.startsWith(TEST_ENDPOINT)) {
    throw new Error(
      `REFUSING: that is the TEST endpoint (${TEST_ENDPOINT}).\n` +
        "DATABASE_URL_PRODUCTION has been repointed at test at some point. Fix\n" +
        ".env before running this -- acting on test through the production door\n" +
        "would print success and prove nothing.",
    );
  }

  if (!host.startsWith(PRODUCTION_ENDPOINT)) {
    throw new Error(
      `REFUSING: expected the production endpoint ${PRODUCTION_ENDPOINT}\n` +
        `(STATUS §4), got ${host}.\n` +
        "If production has legitimately moved, update this file and STATUS §4 in\n" +
        "the same commit -- a stale guard that is edited away in a hurry is worse\n" +
        "than no guard.",
    );
  }

  return { url, host };
}
