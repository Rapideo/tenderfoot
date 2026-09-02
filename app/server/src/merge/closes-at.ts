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

/* INDIANA IDOA'S "Response Due By" COLUMN, verbatim from the committed
 * fixture (scrape/adapters/fixtures/idoa-listing.html) and 71-of-71 on the
 * first live run:
 *
 *   "10/05/2026 3:00:00PM EST"
 *   "09/29/2026 11:00:00AM EST"
 *
 * US month/day/year, 12-hour clock with AM/PM glued to the seconds (no
 * space), a trailing named zone. Unlike SAM's responseDate/
 * responseDateActual pair above, there is no UTC-vs-local question to
 * settle here: IDOA states this deadline in its own civil time and
 * closes_at is a bare calendar date, so the date component IS the answer --
 * no timezone math, no Date object, no possibility of a day rolling over
 * the way SAM's UTC rendering does.
 *
 * The regex requires the FULL shape -- date, time, seconds, AM/PM, a zone
 * abbreviation -- not merely a leading date. A string that only partially
 * matches (missing seconds, missing AM/PM, "TBD", a bare ISO date already
 * in some other column) fails the match and returns null rather than
 * guessing at a date parser's leniency. Getting this wrong in the
 * optimistic direction is the one mistake this function cannot make: a
 * wrong deadline sorts and filters the queue on a lie, where a null
 * deadline just sorts last and says nothing. */
function idoaDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) \d{1,2}:\d{2}:\d{2}(?:AM|PM) [A-Z]{2,5}$/.exec(
    value.trim(),
  );
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The deadline in force, as YYYY-MM-DD. Null when the source is unknown or
 * the payload carries no usable date. */
export function closesAt(sourceName: string, raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;

  switch (sourceName) {
    case "SAM.gov":
      return isoDate(r.responseDateActual) ?? isoDate(r.responseDate);

    case "Indiana IDOA solicitations":
      return idoaDate(r.responseDueBy);

    default:
      /* USASpending included: it reports awards, which have no response
       * deadline to read. Corpus imports set closes_at at ingest and never
       * reach this path. */
      return null;
  }
}
