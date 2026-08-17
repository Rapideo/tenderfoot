/* The pure half of the corpus import -- no database, no I/O.
 *
 * Split out of corpus.ts when that file was rewritten from row-at-a-time to
 * batched (2026-08-17). The split is not tidiness: it is a response to these
 * functions becoming load-bearing in a way they were not before.
 *
 * In the row-at-a-time version, SQL decided organisation identity. Each buyer
 * string went to the database, which looked in organization_alias, then in
 * organization, and only then inserted. Getting cleanBuyer() slightly wrong
 * cost one extra lookup and the database still resolved it.
 *
 * The batched version resolves the entire distinct set of buyers in memory
 * FIRST and then issues one INSERT. Nothing downstream re-checks. So a bug
 * here now creates duplicate organisations directly, which is precisely what
 * organization_alias exists to prevent -- the same defect, moved one layer up
 * where the database can no longer catch it.
 *
 * Kept free of ../db/index.js so it can be tested without a live Neon branch:
 * that module throws at import time when DATABASE_URL is unset.
 */

/* Buyers whose name in the source data does not identify the jurisdiction
 * that actually buys. Kept explicit and small -- this is a seed for entity
 * resolution, not a substitute for it (§4.2, still unaddressed as a
 * mechanism). Moved here verbatim from corpus.ts. */
export const KNOWN_ORGS: Record<
  string,
  { jurisdiction: string; kind: string; aliases: string[] }
> = {
  "New York State Office of General Services": {
    jurisdiction: "NY",
    kind: "agency",
    aliases: ["NY OGS", "New York State OGS", "NYS OGS", "NY OGS (co-op)"],
  },
  "FSSA Medicaid Policy & Planning": {
    jurisdiction: "IN",
    kind: "agency",
    aliases: ["FSSA", "Indiana Family and Social Services Administration", "IN-FSSA"],
  },
};

/* Reverse index: every alias points at its canonical name. Without this the
 * KNOWN_ORGS lookup only matches when the source already used the canonical
 * spelling -- which is exactly when you do not need it. "NY OGS" resolved to
 * a new Indiana organisation until this existed. */
const CANONICAL = new Map<string, string>();
for (const [canon, def] of Object.entries(KNOWN_ORGS)) {
  CANONICAL.set(canon, canon);
  for (const a of def.aliases) CANONICAL.set(a, canon);
}

/* Buyer strings in the manifest carry markdown and qualifiers:
 * "**NY OGS** (co-op)". Normalise before resolving, or the alias never
 * matches and a second organisation is created for the same buyer. */
export function cleanBuyer(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

/** The canonical organisation name for a buyer string, or the string itself. */
export function canonicalName(raw: string): string {
  return CANONICAL.get(raw) ?? raw;
}

export class DuplicateKeyError extends Error {
  constructor(what: string, duplicates: string[]) {
    super(
      `${what}: the batch contains repeated keys, which cannot be inserted as one ` +
        `statement -- the insert maps its RETURNING rows back onto the input by this ` +
        `key, and a repeat would link the wrong rows to each other rather than fail. ` +
        `Repeated: ${duplicates.join(", ")}.`,
    );
    this.name = "DuplicateKeyError";
  }
}

/* The batched insert correlates `RETURNING id, external_id` with its input by
 * external_id. That is only sound while external_id is unique within the
 * batch. The corpus satisfies it today -- 61 Indiana and 140 calibration rows,
 * every id distinct, measured 2026-08-17 -- but nothing enforces it, and the
 * failure would be silent: two rows sharing a key collapse to one map entry
 * and one solicitation quietly receives the other's sighting.
 *
 * So it is checked rather than assumed. This project has already paid three
 * times for a silent version of exactly this shape (a migration CLI exiting 0
 * while doing nothing; an import reporting success while dropping a row; a
 * scraper reporting done: true against the wrong five million records). */
export function requireUniqueKeys(keys: readonly (string | null)[], what: string): void {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const key of keys) {
    const k = key ?? "";
    if (seen.has(k)) duplicated.add(k);
    seen.add(k);
  }
  if (duplicated.size > 0) throw new DuplicateKeyError(what, [...duplicated].sort());
}
