/* THE POSTING DATE, READ OUT OF A SOURCE'S OWN PAYLOAD.
 *
 * Sibling of closes-at.ts, and it exists for the same reason that file does --
 * which is worth stating plainly, because this is the SECOND time this exact
 * defect has been found in this codebase.
 *
 * WHY THIS FILE EXISTS. `merge.ts` wrote exactly four solicitation columns:
 * external_id, title, source_id and closes_at. Nothing anywhere set
 * `posted_at` except `ingest/corpus.ts`, so **no row arriving via live
 * ingestion had a posting date, on any branch, from any source** -- 1,724 of
 * 1,724 SAM.gov solicitations, measured. closes-at.ts's own header records the
 * identical finding about closes_at ("the data was never missing; it was
 * sitting unread in sighting.raw") and the same sentence applies here without
 * a word changed.
 *
 * WHAT IT COST. Plan of Action §6 requires SP6's gate to produce TWO numbers:
 * Interested-per-hundred per source, and **volume per source per week**. The
 * second is computed on `solicitation.posted_at` -- deliberately, because
 * `sighting.seen_at` records when WE scraped rather than when the market
 * published, and nothing ingests here unless a human asks it to. With
 * posted_at null on every live-ingested row, that half of the gate's required
 * output could not be computed at all. It was recorded as a SAM.gov data gap
 * and parked; it was neither.
 *
 * WHICH FIELD, AND WHY -- MEASURED, NOT ASSUMED. The SAM payload carries two
 * candidates, and closes-at.ts's precedent is to measure the disagreement
 * before choosing rather than pick the obvious-looking one:
 *
 *   publishDate          present on 1,724 of 1,724   (100%)
 *   originalPublishDate  present on   450 of 1,724   (26%)
 *   of those 450: 409 differ by DAY, 371 differ by WEEK
 *
 * `publishDate` wins on two grounds. It is present on every row, and a weekly
 * series built on a field carried by a quarter of them is not a series. And it
 * is the right MEANING: a volume-per-week number asks how much a reader would
 * have had to look at in that week, so a notice re-posted this week belongs to
 * this week. `originalPublishDate` would attribute it to its first appearance
 * -- in one measured case a full year earlier -- understating precisely the
 * current volume the GO/NO-GO gate exists to measure.
 *
 * The fallback to originalPublishDate is defensive only: publishDate was
 * present on every row measured, and if that ever stops being true a stale
 * date beats no date for a series that already reports its own exclusions.
 */

/** Bare YYYY-MM-DD, matching `solicitation.posted_at`'s existing shape. */
function isoDate(v: unknown): string | null {
  if (typeof v !== "string" || v.length < 10) return null;
  const d = v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export function postedAt(sourceName: string, raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;

  switch (sourceName) {
    case "SAM.gov":
      return isoDate(r.publishDate) ?? isoDate(r.originalPublishDate);

    case "USASpending":
      /* Awards, not notices. `action_date` is when the award was made, which
       * is not a posting date and must not be dressed as one -- a volume
       * series that silently mixed the two would be measuring two different
       * things under one label. */
      return null;

    default:
      /* An unknown source yields nothing rather than guessing at a field name
       * that happens to exist. Corpus imports set posted_at at ingest and
       * never reach this path. */
      return null;
  }
}
