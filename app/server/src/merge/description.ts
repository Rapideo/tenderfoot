/* THE POSTING'S OWN WORDS, READ OUT OF A SOURCE'S PAYLOAD.
 *
 * Sibling of closes-at.ts, posted-at.ts and listing-facts.ts, and the FOURTH
 * time this codebase has found the same defect: the data was never missing, it
 * was sitting unread in `sighting.raw`.
 *
 * Measured on production 2026-09-02: 298 of 300 sampled SAM.gov sightings
 * (99.3%) carry `descriptions[0].content`, median 511 characters of prose.
 * `solicitation` had no column for it. See migration 015 for what that cost.
 *
 * WHICH FIELD, PER SOURCE -- read from the payload, not assumed:
 *
 *   SAM.gov   `descriptions[]`, an ARRAY of `{ content }`. HTML, not text.
 *   IDOA      `description`, the Event Description column, already plain text.
 *
 * A source with nothing to read returns null and never enters the update map,
 * so USASpending and the corpus imports are untouched -- the same shape the
 * three sibling modules use.
 */

/** The longest entry wins when a source ships several. */
function pickLongest(items: unknown): string | null {
  if (!Array.isArray(items)) return null;
  let best: string | null = null;
  for (const item of items) {
    const content = (item as Record<string, unknown> | null)?.content;
    if (typeof content !== "string") continue;
    if (best === null || content.length > best.length) best = content;
  }
  return best;
}

/* Entities SAM actually emits, plus the numeric forms. Deliberately NOT a
 * general HTML parser: this runs over stored payloads at merge time, the input
 * is one vendor's editor output, and a dependency for six replacements would be
 * a dependency to audit forever. */
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&mdash;": "—",
  "&ndash;": "–",
};

/** HTML → readable text, preserving paragraph breaks and nothing else. */
export function stripHtml(html: string): string {
  return (
    html
      /* Script and style bodies are content to a tag-stripper and noise to a
       * reader. Remove them wholesale before anything else. */
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      /* Block boundaries become newlines BEFORE tags are stripped, or every
       * paragraph runs into the next and a 500-character description becomes
       * one unreadable line. */
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
      .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
      /* Collapse runs of spaces/tabs, but NOT newlines -- the paragraph breaks
       * created above are the only structure that survives, and they are what
       * makes the record view readable. */
      .replace(/[^\S\n]+/g, " ")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export function description(sourceName: string, raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;

  let text: string | null = null;
  switch (sourceName) {
    case "SAM.gov":
      text = pickLongest(r.descriptions);
      break;
    case "Indiana IDOA solicitations":
      text = typeof r.description === "string" ? r.description : null;
      break;
    default:
      return null;
  }
  if (text === null) return null;

  const stripped = stripHtml(text);
  /* An empty or whitespace-only description is NOT a description. Returning ""
   * would overwrite a real value with a blank on a later re-merge, and would
   * render as an empty panel that looks like a rendering bug rather than an
   * absent fact. */
  return stripped.length > 0 ? stripped : null;
}

/* THE CARD'S TRUNCATION, and it lives here rather than in the client because
 * "200 words" is a content decision, not a layout one.
 *
 * Ruled by Matt 2026-09-02: the triage card carries roughly 200 words. Cutting
 * on a WORD boundary rather than a character count keeps the last word whole;
 * cutting on a SENTENCE boundary when one is close keeps it readable. The
 * ellipsis is the signal that the record view has more -- without it a truncated
 * description reads as a complete one that simply stops. */
export function truncateWords(text: string, maxWords = 200): { text: string; truncated: boolean } {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return { text, truncated: false };
  const cut = words.slice(0, maxWords).join(" ");
  /* Prefer the last sentence end inside the final quarter of the cut, so a
   * near-boundary sentence finishes instead of being clipped mid-clause. */
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
  if (lastStop > cut.length * 0.75) {
    return { text: cut.slice(0, lastStop + 1), truncated: true };
  }
  return { text: `${cut}…`, truncated: true };
}
