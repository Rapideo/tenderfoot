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

/* Cue words decide WHICH date a match is. Nearest preceding cue within 120
 * characters wins; no cue means no field. Deliberately conservative -- a
 * wrong deadline is a missed bid (Plan of Action §6.2). */
const CUES: { field: FieldDraft["field_name"]; re: RegExp }[] = [
  { field: "qa_closes_at", re: /question|inquir|clarification/i },
  { field: "prebid_at", re: /pre-?bid|pre-?proposal|site visit/i },
  { field: "closes_at", re: /due|deadline|closing|submitted by|received by/i },
];

function iso(m: RegExpExecArray): string {
  return `${m[3]}-${MONTHS[m[1]!.toLowerCase()]}-${String(m[2]).padStart(2, "0")}`;
}

export function extractFields(text: string): FieldDraft[] {
  const found = new Map<string, FieldDraft>();

  for (const m of text.matchAll(DATE)) {
    const at = m.index ?? 0;
    const before = text.slice(Math.max(0, at - 120), at);
    for (const { field, re } of CUES) {
      if (!re.test(before)) continue;
      /* This cue's field is already claimed by an earlier (leftward) date --
       * try the NEXT cue for this date rather than abandoning it. A `break`
       * here would silently drop dates whose window matches more than one
       * cue word, e.g. a closing line that echoes "Questions" from an
       * earlier sentence still within the 120-char lookback. */
      if (found.has(field)) continue;
      found.set(field, {
        field_name: field,
        value_text: iso(m as RegExpExecArray),
        quote: text.slice(Math.max(0, at - 80), at + m[0].length + 20).replace(/\s+/g, " ").trim(),
        confidence: 0.6,
      });
      break;
    }
  }

  /* Every field in scope gets a row. A missing one is ABSENT, not omitted. */
  const ALL: FieldDraft["field_name"][] = [
    "closes_at", "qa_closes_at", "prebid_at", "prebid_required", "set_aside", "value_cents",
  ];
  return ALL.map(
    (f) => found.get(f) ?? { field_name: f, value_text: null, quote: null, confidence: 0 },
  );
}
