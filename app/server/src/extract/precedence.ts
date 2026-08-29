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
 * ground truth ONLY for the fields where it actually STATES a value -- Task
 * 9 writes a 'listing' row with value_text NULL for qa_closes_at and
 * prebid_at precisely to record "the portal does not carry this" as a fact,
 * and that fact is not ground truth to score a document extraction against.
 * `l.value_text IS NOT NULL` below excludes those rows from the join
 * entirely, so a field the listing never carries drops out of the result
 * instead of scoring every correct document extraction as 100% wrong
 * (fix round 1, Critical: caught only because Task 9's brief -- which
 * writes those NULL rows -- was read alongside this query, not from this
 * file in isolation).
 *
 * PRECISION, NOT RECALL. The WHERE clause also requires `d.value_text IS
 * NOT NULL` -- a document row that states nothing is dropped, not scored as
 * a miss. That means a document that DOES carry a real deadline the
 * extractor failed to classify (fields.ts's "date present, no cue placed
 * it" case) is invisible to this number: it never enters the numerator or
 * the denominator. This query answers "of the values the extractor stated,
 * how many were right" -- not "of the values that were there to find, how
 * many did it find." A missed deadline is the failure this slice cares
 * about most, and this measurement does not see it.
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
        AND l.value_text     IS NOT NULL
      WHERE d.origin = 'document' AND d.value_text IS NOT NULL
      GROUP BY d.field_name
      ORDER BY d.field_name`,
  );
}
