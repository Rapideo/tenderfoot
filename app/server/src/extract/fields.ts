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
  /* inquir(e|es|y|ies|ing) -- the earlier (e|es)-less form dropped "inquire"
   * and "inquiring", which the pre-boundary substring match used to catch.
   * No common English word carries "inquir" as a non-initial stem, so this
   * widening adds no new collision. */
  { field: "qa_closes_at", re: /\bquestions?\b|\binquir(e|es|y|ies|ing)\b|\bclarification/i },
  { field: "prebid_at", re: /\bpre-?bid\b|\bpre-?proposal\b|\bsite visit\b/i },
  { field: "closes_at", re: /\bdue\b|\bdeadline\b|\bclosing\b|\bsubmitted by\b|\breceived by\b/i },
];

/* HTML block boundaries -- ROW only, not paragraph or cell.
 *
 * mammoth.convertToHtml -- the DOCX path -- emits ZERO newlines: 52/52
 * corpus DOCX measured zero "\n" in their converted text, so a plain "\n"
 * clamp is a no-op on most of the corpus. A schedule table survives
 * conversion as <tr><td><p>label</p></td><td><p>value</p></td></tr> --
 * mammoth wraps EVERY cell's content in its own <p>, so the label and its
 * value, though they belong to one logical row, sit in sibling <p>s and
 * sibling <td>s. `</p>` and `</td>` therefore cut FINER than the meaning:
 * clamping on either one walls a date off from the very cue that names it,
 * and a real schedule table yields nothing (confirmed against the real
 * mammoth HTML for corpus/indiana/005030000087847/RFP26-87847 Addendum
 * 1.docx). `</tr>` is the boundary that means "a different fact starts
 * here" for a table. Kept `\n` for the plain-text path (PDF, XLSX) and
 * `<br>` (all spellings) since neither of those introduces this problem.
 *
 * Accepted cost: DOCX prose paragraphs no longer clamp at all, since
 * mammoth's only paragraph marker is the `</p>` this drops -- a section
 * heading can still bleed into the next paragraph's date on that path.
 * That is the same failure class as the hard-wrap and cover-page cases
 * already deferred to the accuracy-instrument work; extracting nothing
 * from a table is strictly worse, and tables are the layout this slice
 * exists to read. */
const BLOCK = /\n|<\/tr>|<br\s*\/?>/gi;

/* The end of the nearest BLOCK match starting before `at`, or 0 if none.
 * A fresh RegExp per call avoids sharing lastIndex state across dates. */
function lastBlockBoundaryEnd(text: string, at: number): number {
  const re = new RegExp(BLOCK.source, BLOCK.flags);
  let end = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && m.index < at) {
    end = m.index + m[0].length;
  }
  return end;
}

/* The start of the nearest BLOCK match at or after `from`, or text.length
 * if none -- the forward-facing twin of lastBlockBoundaryEnd, used to keep
 * a quote from running past its row/paragraph into the next one. */
function nextBlockBoundaryStart(text: string, from: number): number {
  const re = new RegExp(BLOCK.source, BLOCK.flags);
  re.lastIndex = from;
  const m = re.exec(text);
  return m ? m.index : text.length;
}

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
    /* Clamp the lookback to the current block (line OR HTML row/paragraph),
     * in addition to the 120-char cap. Without this, a padded
     * schedule-of-events table puts three or four rows inside 120 raw
     * characters, so every row's date sees its neighbours' cue words -- and
     * a section heading many characters back can fall inside the window and
     * outrank the date's own row. */
    const start = Math.max(0, at - 120, lastBlockBoundaryEnd(text, at));
    const before = text.slice(start, at);
    const value = iso(m as RegExpExecArray);
    let classified = false;
    const dateEnd = at + m[0].length;
    /* Same clamp, forward: a quote must not run past its own row/paragraph
     * into a DIFFERENT date sitting just beyond it. */
    const quoteEnd = Math.min(dateEnd + 20, nextBlockBoundaryStart(text, dateEnd));

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
        quote: text.slice(start, quoteEnd).replace(/\s+/g, " ").trim(),
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
