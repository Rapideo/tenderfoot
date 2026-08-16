/* Per-source yield, honestly counted (§4.4).
 *
 * Three different numbers, and the third is the one that matters when
 * deciding whether a source earns its maintenance:
 *
 *   sightings         raw observations this source produced
 *   canonical         distinct solicitations it contributed to
 *   unique_to_source  solicitations NO OTHER source saw
 *
 * Counting only the first two would credit both sources for a solicitation
 * they both carry, which flatters a redundant source.
 */
import { all } from "../db/index.js";

export interface SourceYield {
  source_id: number;
  name: string;
  sightings: number;
  canonical: number;
  unique_to_source: number;
}

export async function perSourceYield(): Promise<SourceYield[]> {
  return all<SourceYield>(
    `SELECT s.id AS source_id,
            s.name,
            count(g.id)::int                        AS sightings,
            count(DISTINCT g.solicitation_id)::int  AS canonical,
            count(DISTINCT g.solicitation_id) FILTER (
              WHERE NOT EXISTS (
                SELECT 1 FROM sighting o
                 WHERE o.solicitation_id = g.solicitation_id
                   AND o.source_id <> g.source_id
              )
            )::int                                  AS unique_to_source
       FROM source s
       LEFT JOIN sighting g ON g.source_id = s.id
      GROUP BY s.id, s.name
      ORDER BY s.name`,
  );
}
