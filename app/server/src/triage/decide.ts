import { run } from "../db/index.js";
import { latestPursuitFor, type LatestPursuit, type PursuitState } from "./latest.js";

const STATES: readonly PursuitState[] = ["New", "Triaged", "Interested", "Not Interested"];

/* Distinct from a generic Error so the route can answer 400 rather than 500:
 * a missing reason is the caller's to fix, not a fault. */
export class ReasonRequiredError extends Error {
  constructor() {
    super(
      "A reason is required on Pass. This is a default, not a law -- " +
        "requireReasonOnPass may be switched off, and what that gives up is " +
        "the corpus a reason vocabulary would later be derived from.",
    );
    this.name = "ReasonRequiredError";
  }
}

export interface DecisionInput {
  solicitationId: number;
  state: PursuitState;
  reason?: string | null;
  decidedBy?: string | null;
  /** SVRC Region 1.1.4, ratified 2026-08-12: default on, switchable. */
  requireReasonOnPass?: boolean;
}

/* APPEND-ONLY. Never UPDATE, never DELETE (spec §5.1).
 *
 * It is the rule the rest of the system already runs on -- precedence.ts
 * keeps rejected values, conflicts are rows rather than a flag, gated items
 * are filed rather than deleted. A decision that silently overwrote its
 * predecessor would be the one place this project discards evidence, and it
 * would do it to the data the GO/NO-GO number is computed from. */
export async function recordDecision(input: DecisionInput): Promise<LatestPursuit> {
  const { solicitationId, state, decidedBy = null, requireReasonOnPass = true } = input;

  if (!STATES.includes(state)) {
    throw new Error(`Unknown pursuit state "${state}". One of: ${STATES.join(", ")}.`);
  }

  const reason = input.reason?.trim() ? input.reason.trim() : null;
  if (state === "Not Interested" && requireReasonOnPass && !reason) {
    throw new ReasonRequiredError();
  }

  await run(
    `INSERT INTO pursuit (solicitation_id, state, reason, decided_by, decided_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [solicitationId, state, reason, decidedBy, new Date().toISOString()],
  );

  const [latest] = await latestPursuitFor([solicitationId]);
  if (!latest) throw new Error(`Decision on ${solicitationId} did not persist.`);
  return latest;
}
