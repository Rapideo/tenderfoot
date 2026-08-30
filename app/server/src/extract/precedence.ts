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
 * PRECISION *AND NOW* RECALL, IN TWO DIFFERENT UNITS. `agreed` and
 * `disagreed` answer "of the values the extractor STATED, how many were
 * right" -- they require `d.value_text IS NOT NULL`, so a document that
 * states nothing cannot lower them. On their own that is a number which
 * IMPROVES as the extractor grows more timid, and it cannot see the failure
 * this slice cares about most: the deadline was in the PDF and we missed
 * it.
 *
 * `missed` and `opportunities` close that hole. An OPPORTUNITY is one
 * (solicitation, field) pair where the listing states a value AND at least
 * one of that solicitation's documents was actually processed -- status
 * 'extracted' or 'absent', the two states that mean the extractor got to
 * read it. 'failed' and 'pending' are excluded deliberately: a document we
 * never managed to read is not a missed extraction, it is a missed FETCH,
 * and conflating them would blame the extractor for the network. A MISS is
 * an opportunity where no document row states a value at all.
 *
 * MIND THE UNITS -- they are not summable. agreed + disagreed counts
 * DOCUMENT STATEMENTS (a bundle of three PDFs all quoting the deadline
 * contributes three). missed and opportunities count SOLICITATIONS (that
 * same bundle contributes one). `missed / opportunities` is a miss rate;
 * `agreed / (agreed + disagreed)` is a precision rate; anything mixing the
 * two is meaningless.
 *
 * EXPECT THREE FIELDS AT 100% MISSED, AND THAT IS NOT A BUG. fields.ts
 * marks prebid_required, set_aside and value_cents as NOT_EXTRACTED -- the
 * extractor never attempts them -- while the listing states all three. So
 * for those fields every opportunity is a miss, which is the honest
 * rendering of "we do not extract this yet." That fact used to live only in
 * a TypeScript constant; it is now visible in the measurement itself,
 * which is where a scope limit belongs.
 *
 * A field can now appear in the result with agreed = 0 AND disagreed = 0.
 * Before these counts existed such a field was simply absent, which read as
 * "nothing to report" when it actually meant "we found nothing, every
 * time."
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
  {
    field_name: string;
    agreed: number;
    disagreed: number;
    missed: number;
    opportunities: number;
  }[]
> {
  const { all } = await import("../db/index.js");
  return all(
    `WITH truth AS (
        SELECT l.solicitation_id, l.field_name, l.value_text
          FROM extracted_field l
         WHERE l.origin = 'listing' AND l.value_text IS NOT NULL
      ),
      processed AS (
        SELECT DISTINCT d.solicitation_id
          FROM document d
         WHERE d.extract_status IN ('extracted', 'absent')
      ),
      stated AS (
        SELECT t.field_name,
               count(*) FILTER (WHERE d.value_text IS NOT DISTINCT FROM t.value_text) AS agreed,
               count(*) FILTER (WHERE d.value_text IS DISTINCT FROM t.value_text)     AS disagreed
          FROM extracted_field d
          JOIN truth t
            ON t.solicitation_id = d.solicitation_id
           AND t.field_name      = d.field_name
         WHERE d.origin = 'document' AND d.value_text IS NOT NULL
         GROUP BY t.field_name
      ),
      coverage AS (
        SELECT t.field_name,
               count(*) AS opportunities,
               count(*) FILTER (
                 WHERE NOT EXISTS (
                   SELECT 1 FROM extracted_field d
                    WHERE d.solicitation_id = t.solicitation_id
                      AND d.field_name      = t.field_name
                      AND d.origin          = 'document'
                      AND d.value_text     IS NOT NULL)) AS missed
          FROM truth t
          JOIN processed p ON p.solicitation_id = t.solicitation_id
         GROUP BY t.field_name
      )
      SELECT COALESCE(s.field_name, c.field_name) AS field_name,
             COALESCE(s.agreed, 0)        AS agreed,
             COALESCE(s.disagreed, 0)     AS disagreed,
             COALESCE(c.missed, 0)        AS missed,
             COALESCE(c.opportunities, 0) AS opportunities
        FROM stated s
        FULL OUTER JOIN coverage c ON c.field_name = s.field_name
       ORDER BY 1`,
  );
}
