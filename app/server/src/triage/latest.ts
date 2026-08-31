import { all } from "../db/index.js";

export type PursuitState = "New" | "Triaged" | "Interested" | "Not Interested";

export interface LatestPursuit {
  pursuit_id: number;
  solicitation_id: number;
  state: PursuitState;
  reason: string | null;
  decided_by: string | null;
  created_at: string;
}

/* Decisions are APPEND-ONLY (spec §5.1), so "the decision" is always the
 * newest row rather than the only one. This fragment is exported so the
 * queue and the metrics embed the SAME definition -- two hand-written
 * DISTINCT ONs would be two definitions, and the one that drifted would be
 * the one nobody was looking at.
 *
 * ORDER BY created_at DESC, id DESC: decided_at is `text` in migration 002
 * and unsortable; id breaks a same-millisecond tie deterministically. */
export const LATEST_PURSUIT = `
  SELECT DISTINCT ON (solicitation_id)
         id AS pursuit_id, solicitation_id, state, reason, decided_by, created_at
    FROM pursuit
   ORDER BY solicitation_id, created_at DESC, id DESC`;

export async function latestPursuitFor(ids: number[]): Promise<LatestPursuit[]> {
  if (ids.length === 0) return [];
  return all<LatestPursuit>(
    `SELECT * FROM (${LATEST_PURSUIT}) p WHERE p.solicitation_id = ANY($1)`,
    [ids],
  );
}
