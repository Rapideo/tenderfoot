/* WHERE THE WORK IS, read out of a source's own payload.
 *
 * The fifth sibling of closes-at.ts, posted-at.ts, description.ts, title.ts
 * and org-chain.ts — and written knowing what those five taught (D27): this
 * project ingested ONE source for its whole life, so every extractor here
 * knew SAM's payload shape and nothing else, and a second source found four
 * of them at once. This one is built source-aware from the first line rather
 * than acquiring a `switch` later.
 *
 * WHY THE STATE AND NOTHING ELSE. Geography is the first filter a
 * geographically-bounded firm applies, and it applies it in two letters. The
 * payload also carries zip, city, streetAddress and country; none of them
 * changes a triage decision, and a column nobody reads is precisely the
 * defect this file's five siblings exist to record.
 *
 * ⚠️ 36% COVERAGE, measured on production: `placeOfPerformance[0].state` is
 * present on 3,549 of 9,883 rows. Absent is the common case, so null is a
 * first-class answer and the card renders nothing rather than a placeholder.
 */

/** Two-letter US state/territory code, upper-cased. Anything else is null. */
function stateCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  /* SAM's own `city` field holds a NUMERIC code ("56890"), so a loose
   * "non-empty string" test here would happily store a city number as a
   * state. Two letters is the shape, and it is checked. */
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

export function placeOfPerformance(sourceName: string, raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;

  switch (sourceName) {
    case "SAM.gov": {
      /* An ARRAY, and only the first entry is read. A notice with several
       * places of performance is a real thing (multi-site IDIQs), and
       * flattening them into one column would assert a single location the
       * source did not. First-entry-or-nothing is the honest reduction: it
       * matches what SAM's own web page shows in its summary, and the record
       * view can read the whole array from the payload when that matters. */
      const list = r.placeOfPerformance;
      if (!Array.isArray(list) || list.length === 0) return null;
      return stateCode((list[0] as Record<string, unknown> | null)?.state);
    }

    case "Indiana IDOA solicitations":
      /* IDOA publishes no place of performance at all — the listing carries
       * Event Name, Agency, Event ID, Description, Response Due By and
       * Contact, and nothing geographic. Returning a hardcoded "IN" would be
       * inventing a fact the source does not state: a state agency can and
       * does buy services delivered elsewhere. Null is correct. */
      return null;

    default:
      return null;
  }
}
