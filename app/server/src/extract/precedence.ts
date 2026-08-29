export interface FieldRow {
  value_text: string | null;
  origin: "listing" | "document";
  quote: string | null;
  document_id: number | null;
}
export interface Resolved {
  value: string | null;
  origin: "listing" | "document" | null;
  conflicts: FieldRow[];
}

/* PRECEDENCE AT READ TIME. corpus/FINDINGS.md §1 establishes that the portal's
 * structured field was right where all three documents were unreliable. Doing
 * this here rather than at write time means the rule can change without
 * re-extraction, and nothing is discarded at ingest. */
export function resolveField(rows: FieldRow[]): Resolved {
  const stated = rows.filter((r) => r.value_text !== null);
  if (stated.length === 0) return { value: null, origin: null, conflicts: [] };

  const listing = stated.find((r) => r.origin === "listing");
  const winner = listing ?? stated[0]!;

  /* A conflict is a STATED value that disagrees. Absence never conflicts --
   * "we looked and it is not there" contradicts nothing. */
  const conflicts = stated.filter((r) => r !== winner && r.value_text !== winner.value_text);
  return { value: winner.value_text, origin: winner.origin, conflicts };
}

/* §8.4's measurement, and it is a query rather than a harness: the listing is
 * ground truth for the fields it carries, so agreement counts itself.
 *
 * db/index.ts IS IMPORTED DYNAMICALLY, here inside the function, not
 * statically at the top of this file -- mirroring scrape/resolve-source.ts.
 * db/index.ts throws synchronously at MODULE EVALUATION if DATABASE_URL is
 * unset, and scripts/check.mjs deliberately strips DATABASE_URL from the
 * test child's environment as a safety net. resolveField() above is pure
 * and its test file never calls useTestSchema(); a static import here would
 * make merely loading this module -- for that pure-function test -- require
 * a database connection, tripping check.mjs's guard the moment this file
 * existed. */
export async function accuracyByField(): Promise<
  { field_name: string; agreed: number; disagreed: number }[]
> {
  const { all } = await import("../db/index.js");
  return all(
    `SELECT d.field_name,
            count(*) FILTER (WHERE d.value_text IS NOT DISTINCT FROM l.value_text) AS agreed,
            count(*) FILTER (WHERE d.value_text IS DISTINCT FROM l.value_text)     AS disagreed
       FROM extracted_field d
       JOIN extracted_field l
         ON l.solicitation_id = d.solicitation_id
        AND l.field_name      = d.field_name
        AND l.origin          = 'listing'
      WHERE d.origin = 'document' AND d.value_text IS NOT NULL
      GROUP BY d.field_name
      ORDER BY d.field_name`,
  );
}
