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

/* ─── HIGHERGOV'S TITLES ARRIVE WITH SOMEONE ELSE'S ANCHOR TEXT ON THEM ───
 *
 * Added 2026-09-07. `docs/2026-09-03-highergov-field-mapping.md:51` records
 * the artifact from real captured responses: *"carries a scraping artifact --
 * anchor text glued on, e.g. `"…WW RemovalBid Documents"`"*. HigherGov
 * scrapes state portals the way we scrape IDOA, and their parser takes a
 * cell's whole text where ours takes one anchor -- so the "Bid Documents"
 * link that sits beside the event name on Indiana's page arrives welded to
 * the end of the title, with NO SEPARATOR.
 *
 * ⚠️ THE SPEC SAID THIS WAS ALREADY HANDLED, AND BOTH HALVES WERE FALSE.
 * §8 read: *"`parseIdoaPage` already handles this correctly and the mapper
 * repairs it the same way."* It does not repair anything -- `idoa.ts:207-211`
 * takes the FIRST anchor's text as the event name, so a later "Bid Documents"
 * anchor never enters the title at all. It avoids the problem structurally,
 * and there is no repair function anywhere to reuse. The HigherGov adapter,
 * meanwhile, had no title handling whatever: the vendor's string flowed
 * straight through. The spec has been corrected to describe what shipped.
 *
 * WHY THE REPAIR LIVES HERE AND NOT IN THE ADAPTER. `sighting.raw` is
 * specified as "the payload as received, unmodified"
 * (002_entity_graph.sql:191), and the adapter's items go verbatim into the
 * hashed artifact and then into Postgres. org-chain.ts's header records the
 * same choice being made for the same reason: normalising at scrape time
 * writes a derived value into the record of what the source actually said.
 * Deriving at merge time keeps the sighting faithful AND lets this rule be
 * corrected later without a re-scrape -- which matters more for this source
 * than any other, because re-scraping it costs metered records (CLAUDE.md
 * §5.1) and a HigherGov title cannot be re-fetched for free.
 *
 * DELIBERATELY NOT A GENERAL-PURPOSE TITLE CLEANER. It strips ONE known
 * string, "Bid Documents", and only where it is glued to a non-space
 * character at the very end -- which is a shape no title written by a human
 * has. `"Removal Bid Documents"`, with a space, is left exactly alone: that
 * is a phrase a buyer could legitimately have typed, and there is no
 * evidence to tell it apart from the artifact. Under-repairing leaves an
 * ugly title; over-repairing silently deletes words a buyer wrote. */
const GLUED_ANCHOR = /([^\s])Bid Documents$/;

function repairGluedAnchor(text: string): string {
  return text.replace(GLUED_ANCHOR, "$1").trim();
}

/** The title in force, or the literal fallback when the source's payload
 * carries no usable string at the path this reads for it. */
export function title(sourceName: string, raw: unknown): string {
  const r = raw as Record<string, unknown> | null | undefined;
  /* IDOA is the one source whose title does not live at `.title` -- its
   * parser names the field `eventName` and does not also duplicate it under
   * `title` (adapters/idoa.ts must not be changed to do so; see the merge
   * task's own constraint against editorialising a source's raw shape). */
  const value = sourceName === "Indiana IDOA solicitations" ? r?.eventName : r?.title;
  const text = String(value ?? "").trim();
  /* Source-scoped, like every other rule in the merge's field modules. The
   * artifact is HigherGov's parser's, not a property of titles in general,
   * and a source that has never been seen to carry it is not put through a
   * rule written for someone else's bug. */
  const repaired = sourceName === "HigherGov" ? repairGluedAnchor(text) : text;
  return repaired || "(untitled)";
}
