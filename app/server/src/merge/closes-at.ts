/* THE DEADLINE, READ OUT OF A SOURCE'S OWN PAYLOAD.
 *
 * Same shape and same reason as org-chain.ts: merge turns sightings into the
 * canonical record, payload field names differ per source, and the rule for
 * reading one belongs in a pure function with the source named explicitly
 * rather than in a JSON path buried in SQL. A `default` that returns null is
 * deliberate -- an unknown source yields nothing rather than guessing at a
 * field name that happens to exist.
 *
 * WHY THIS FILE EXISTS AT ALL. Until now `merge.ts` read exactly one thing
 * out of `latest_raw`: the title. Nothing anywhere set solicitation.closes_at
 * except ingest/corpus.ts, which is why the 201 corpus-import rows carry
 * deadlines and all 9,682 SAM.gov rows carry none. SP4's whole premise is
 * that the portal listing is ground truth for document extraction, and with
 * closes_at null on every SAM row there was no ground truth at all -- the
 * accuracy query returns nothing, because it requires a non-null listing
 * value. The data was never missing; it was sitting unread in sighting.raw.
 *
 * WHICH FIELD, AND WHY IT IS NOT THE OBVIOUS ONE. The SAM payload carries
 * three candidates. `originalResponseDate` is the pre-amendment deadline --
 * historical, not in force. The other two are THE SAME INSTANT written two
 * ways: `responseDate` in UTC, `responseDateActual` in the notice's own
 * timezone (`responseTimeZone`).
 *
 *   responseDate       2026-09-02T03:59:00+00:00
 *   responseDateActual 2026-09-01T23:59:00-04:00   America/New_York
 *
 * closes_at is a bare YYYY-MM-DD (measured: all 201 existing rows are
 * length 10), so choosing between them is choosing which DAY to record --
 * and on 39 of 1,338 SAM deadlines, 2.9%, they disagree. Every one of those
 * is an evening deadline that rolls past midnight in UTC, so reading
 * responseDate would record the deadline ONE DAY LATE. Late is the worst
 * direction of error this product has: it tells a bidder they have another
 * day when they do not. responseDateActual is also marginally more
 * available (1,338 rows against 1,337), so there is no tradeoff to make --
 * it wins on both counts, and responseDate is kept only as a fallback for
 * the row shape where it is the only one present. */

/** The leading calendar date of an ISO-8601 timestamp, or null if the value
 * is not one. Deliberately textual: the string already carries the offset
 * that makes it correct, so parsing it into a Date and formatting it back
 * would re-introduce the local-vs-UTC question this function exists to
 * settle. */
function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1]! : null;
}

/** The deadline in force, as YYYY-MM-DD. Null when the source is unknown or
 * the payload carries no usable date. */
export function closesAt(sourceName: string, raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;

  switch (sourceName) {
    case "SAM.gov":
      return isoDate(r.responseDateActual) ?? isoDate(r.responseDate);

    default:
      /* USASpending included: it reports awards, which have no response
       * deadline to read. Corpus imports set closes_at at ingest and never
       * reach this path. */
      return null;
  }
}
