/* WHICH KEY OPENS THIS NOTICE'S DOCUMENTS, read out of a source's own payload.
 *
 * The sixth sibling of closes-at.ts, posted-at.ts, description.ts, title.ts,
 * org-chain.ts and place.ts, built source-aware from the first line for the
 * reason place.ts gives (D27).
 *
 * WHY THIS EXISTS AT ALL. HigherGov's /document/ endpoint takes one
 * identifier, `related_key`, and the vendor delivers it only inside the
 * opportunity's `document_path` -- a URL that also carries the api_key.
 * highergov-client.ts reads the one parameter out of that URL before
 * dropping it (CLAUDE.md §5.3) and puts it in `raw` as `document_key`. This
 * is the step that moves it from the payload onto the row
 * fetch-documents-for.ts reads. Without it the key is captured and unused,
 * which is only marginally better than not captured.
 *
 * ⚠️ HigherGov ONLY. No other source has such a concept: SAM.gov's documents
 * are listed by notice id, IDOA's by scraping. A `document_key` field on any
 * other source's payload is not ours to read -- the name is ours, and a
 * coincidence elsewhere would be exactly the kind of accidental cross-source
 * read D27 exists to prevent. */

export function documentKey(sourceName: string, raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;

  switch (sourceName) {
    case "HigherGov": {
      const v = r.document_key;
      return typeof v === "string" && v.length > 0 ? v : null;
    }
    default:
      return null;
  }
}
