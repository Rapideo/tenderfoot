export interface FieldDraft {
  field_name:
    | "closes_at" | "qa_closes_at" | "prebid_at"
    | "prebid_required" | "set_aside" | "value_cents";
  value_text: string | null;
  quote: string | null;
  confidence: number;
  note?: string;
}

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

const DATE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),\s*(\d{4})/gi;

/* Cue words decide WHICH date a match is. Cues are tried in this fixed
 * priority order (qa_closes_at, then prebid_at, then closes_at); the FIRST
 * one that matches somewhere in the lookback window and is not already
 * claimed by an earlier date wins. This is NOT proximity-based -- a
 * lower-priority cue sitting right next to the date still loses to a
 * higher-priority cue sitting farther away, as long as both are inside the
 * window. No cue means no field. Deliberately conservative -- a wrong
 * deadline is a missed bid (Plan of Action §6.2). Nearest-cue selection and
 * a non-flat confidence score are both deferred pending the slice's
 * accuracy instrument -- ruled out for this round, not overlooked. */
const CUES: { field: FieldDraft["field_name"]; re: RegExp }[] = [
  { field: "qa_closes_at", re: /\bquestions?\b|\binquir(y|ies)\b|\bclarification/i },
  { field: "prebid_at", re: /\bpre-?bid\b|\bpre-?proposal\b|\bsite visit\b/i },
  { field: "closes_at", re: /\bdue\b|\bdeadline\b|\bclosing\b|\bsubmitted by\b|\breceived by\b/i },
];

/* Round-trips the match through Date to reject calendar dates that don't
 * exist ("February 31", "September 0"). The DATE regex only checks shape,
 * not validity -- without this check, JS's own date normalization (Feb 31
 * -> Mar 3) would let a fabricated value slide all the way to value_text.
 * A measurable miss (null) beats an invented value nothing downstream would
 * catch. Returns null on failure. */
function iso(m: RegExpExecArray): string | null {
  const month = MONTHS[m[1]!.toLowerCase()]!;
  const day = Number(m[2]);
  const year = Number(m[3]);
  const monthIndex = Number(month) - 1;
  const d = new Date(Date.UTC(year, monthIndex, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex || d.getUTCDate() !== day) {
    return null;
  }
  return `${m[3]}-${month}-${String(day).padStart(2, "0")}`;
}

export function extractFields(text: string): FieldDraft[] {
  const found = new Map<string, FieldDraft>();
  /* True when some date in the text matched NO cue at all. Distinguishes
   * "we found a date and could not place it" (a recall miss) from "there is
   * no date here" (a true negative) -- see the note applied below. */
  let unclassifiedDateSeen = false;

  for (const m of text.matchAll(DATE)) {
    const at = m.index ?? 0;
    /* Clamp the lookback to the current line, in addition to the 120-char
     * cap. Without this, a padded schedule-of-events table puts three or
     * four rows inside 120 raw characters, so every row's date sees its
     * neighbours' cue words -- and a section heading many characters back
     * can fall inside the window and outrank the date's own line. */
    const start = Math.max(0, at - 120, text.lastIndexOf("\n", at) + 1);
    const before = text.slice(start, at);
    const value = iso(m as RegExpExecArray);
    let classified = false;

    for (const { field, re } of CUES) {
      if (!re.test(before)) continue;
      /* This cue's field is already claimed by an earlier (leftward) date --
       * try the NEXT cue for this date rather than abandoning it. A `break`
       * here would silently drop dates whose window matches more than one
       * cue word, e.g. a closing line that echoes "Questions" from an
       * earlier sentence still within the lookback. */
      if (found.has(field)) continue;
      found.set(field, {
        field_name: field,
        value_text: value,
        /* Same `start` as classification, so the quote can never omit the
         * cue that justified it -- the citation IS the evidence. */
        quote: text.slice(start, at + m[0].length + 20).replace(/\s+/g, " ").trim(),
        confidence: value !== null ? 0.6 : 0,
        ...(value === null
          ? { note: "date text does not correspond to a real calendar date" }
          : {}),
      });
      classified = true;
      break;
    }

    if (!classified) unclassifiedDateSeen = true;
  }

  /* Every field in scope gets a row. A missing one is ABSENT, not omitted --
   * but that claim only holds for fields this function actually looked for.
   * Three of the six have no extraction logic at all, and an unclassified
   * date is a genuine recall miss, not a clean "looked and found nothing."
   * `note` marks both, so neither is mistaken for a true negative. */
  const DATE_FIELDS = new Set<FieldDraft["field_name"]>(["closes_at", "qa_closes_at", "prebid_at"]);
  const NOT_EXTRACTED = new Set<FieldDraft["field_name"]>(["prebid_required", "set_aside", "value_cents"]);
  const ALL: FieldDraft["field_name"][] = [
    "closes_at", "qa_closes_at", "prebid_at", "prebid_required", "set_aside", "value_cents",
  ];

  return ALL.map((f) => {
    const existing = found.get(f);
    if (existing) return existing;
    if (NOT_EXTRACTED.has(f)) {
      return { field_name: f, value_text: null, quote: null, confidence: 0, note: "not extracted" };
    }
    if (DATE_FIELDS.has(f) && unclassifiedDateSeen) {
      return {
        field_name: f,
        value_text: null,
        quote: null,
        confidence: 0,
        note: "a date was present in the text but no cue placed it in this field",
      };
    }
    return { field_name: f, value_text: null, quote: null, confidence: 0 };
  });
}
