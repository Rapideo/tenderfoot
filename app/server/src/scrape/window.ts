/* Which window does a run cover?
 *
 * THE RULE IS 003_seed_source_registry.sql's, quoted verbatim:
 *   "since_default is an ISO-8601 duration and is only a SEED. The rule is
 *    `since = last successful run`; a fixed lookback loses a day permanently
 *    when a run fails."
 *
 * Nothing implemented that rule until 2026-08-18. `Admin.tsx`'s Run control
 * sent `since_default` itself as `since` -- a DURATION where `validateRun`
 * requires a DATE -- so every click answered 400 and `last_run_at` never
 * moved. See window.test.ts for the full account.
 *
 * WHY THIS LIVES ON THE SERVER, not in the client that has the same two
 * columns on the row it already rendered: `routes/admin.ts`'s own task-12
 * ruling puts identity resolution here so the client never holds a second
 * copy of registry knowledge ("two registries drift -- add a source to one
 * and the other silently falls behind"). A window derived from `last_run_at`
 * and `since_default` is exactly that kind of knowledge, and the client
 * computing it would be the same mistake in a second place.
 *
 * Pure, and `now` is a parameter rather than a call to `Date.now()`, so the
 * arithmetic is testable without freezing a clock.
 */

/* `P7D`, `PT12H`, `P1M`... The registry only uses `P7D` today, but a seed
 * column typed `text` will eventually hold the others, and a parser that
 * silently mis-reads one is how a run quietly covers the wrong window. */
const DURATION =
  /^P(?!$)(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?!$)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export interface WindowSubject {
  /** `timestamptz`, which pg returns as a Date -- or null if never run. */
  last_run_at: string | Date | null;
  /** The ISO-8601 duration seed. Null only on rows that cannot be enabled. */
  since_default: string | null;
}

function subtractDuration(now: Date, duration: string): Date {
  const m = DURATION.exec(duration);
  if (!m) {
    throw new Error(
      `since_default must be an ISO-8601 duration (e.g. P7D), got: ${duration}`,
    );
  }
  const [, y, mo, w, d, h, mi, s] = m.map((v) => (v === undefined ? 0 : Number(v)));

  /* Years and months are CALENDAR units -- a month is not 30 days -- so they
   * go through the date parts rather than through milliseconds. */
  const out = new Date(now.getTime());
  if (y) out.setUTCFullYear(out.getUTCFullYear() - (y as number));
  if (mo) out.setUTCMonth(out.getUTCMonth() - (mo as number));

  /* Everything below a month is a fixed quantity of time. The arithmetic is
   * in UTC throughout, so there is no DST edge to get wrong. */
  const ms =
    ((w as number) * 7 + (d as number)) * 86_400_000 +
    (h as number) * 3_600_000 +
    (mi as number) * 60_000 +
    (s as number) * 1_000;
  return new Date(out.getTime() - ms);
}

/**
 * The ISO-8601 timestamp a run should start from.
 *
 * Throws rather than defaulting when neither value is usable -- the same
 * fail-closed posture `validateRun` takes on a missing `since` ("a run with
 * no window refuses to start"). In practice this cannot fire for a source
 * `/run` would accept: `PATCH /api/sources/:id` refuses to enable a source
 * with no `since_default` (routes/index.ts), and `/run` refuses a disabled
 * source (resolve-source.ts). The guard is here for the day one of those
 * two invariants moves.
 */
export function resolveSince(s: WindowSubject, now: Date = new Date()): string {
  if (s.last_run_at !== null && s.last_run_at !== undefined) {
    return new Date(s.last_run_at).toISOString();
  }
  if (!s.since_default) {
    throw new Error(
      "Cannot run a source with no ingestion window: it has never run and has no " +
        "since_default. A missing window that quietly means 'everything' is how a " +
        "first run pulls two years of data.",
    );
  }
  return subtractDuration(now, s.since_default).toISOString();
}
