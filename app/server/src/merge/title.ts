/* THE TITLE, READ OUT OF A SOURCE'S OWN PAYLOAD.
 *
 * Sibling of closes-at.ts, posted-at.ts, description.ts and listing-facts.ts
 * -- and the one field that had NO module until now, because it was the
 * first thing merge.ts ever read (see that file's header) and nobody
 * revisited it once the other four were extracted.
 *
 * THE DEFECT THIS FIXES. merge.ts read `raw.title` unconditionally, for
 * every source. That happens to work for SAM.gov, whose payload carries
 * `title` at the top level -- which is exactly why the bug was invisible
 * until a second source existed. Indiana IDOA's parser emits `eventName`
 * (scrape/adapters/idoa.ts's `IdoaRawItem`), never `title`, so every one of
 * the 71 IDOA rows from the first live run merged as the literal string
 * "(untitled)". Measured: 71 of 71.
 *
 * WHY THE DEFAULT STILL READS `raw.title` RATHER THAN RETURNING NOTHING.
 * Every OTHER sibling module defaults an unrecognised source to null, on the
 * reasoning that guessing a field name that happens to exist is worse than
 * stating nothing. Title is the one exception, on purpose: unlike a
 * deadline or a description, a title is not a fact you can omit -- every
 * row must show SOME string, and "(untitled)" is the honest fallback only
 * once the source has actually been asked and had nothing. Reading
 * `raw.title` as that ask, for any source not named below, is exactly the
 * behaviour this function is replacing merge.ts's inline version with, not
 * a new default invented alongside it -- so a source this project has not
 * characterised yet still gets a title when its payload happens to carry
 * one at that path, and "(untitled)" only when it does not.
 *
 * STILL COMPUTED IN JS, NOT AS A JSON PATH IN SQL (merge.ts's own note on
 * this, preserved because it applies to `eventName` exactly as it always
 * applied to `title`): `raw->>'title'` and `String(raw.title)` are not
 * equivalent for a non-string value -- `->>` renders an object as its JSON
 * text where `String()` gives `"[object Object]"`. Moving this into its own
 * module changes where the rule lives, not what it decides. */

/** The title in force, or the literal fallback when the source's payload
 * carries no usable string at the path this reads for it. */
export function title(sourceName: string, raw: unknown): string {
  const r = raw as Record<string, unknown> | null | undefined;
  /* IDOA is the one source whose title does not live at `.title` -- its
   * parser names the field `eventName` and does not also duplicate it under
   * `title` (adapters/idoa.ts must not be changed to do so; see the merge
   * task's own constraint against editorialising a source's raw shape). */
  const value = sourceName === "Indiana IDOA solicitations" ? r?.eventName : r?.title;
  return String(value ?? "").trim() || "(untitled)";
}
