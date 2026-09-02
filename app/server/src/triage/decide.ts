import { run } from "../db/index.js";
import { latestPursuitFor, type LatestPursuit, type PursuitState } from "./latest.js";

const STATES: readonly PursuitState[] = ["New", "Triaged", "Interested", "Not Interested"];

/* WHERE ELSE WOULD THIS HAVE REACHED YOU? The gate's own question, and until
 * 2026-09-01 nothing asked it.
 *
 * Design spec §8.5 calls discovery "the whole measure": qualified
 * opportunities surfaced THAT WOULD NOT HAVE BEEN SEEN. `nowhere` is that
 * count. Every other value names the channel Tenderfoot is duplicating, which
 * is the half a yes/no cannot give and the half that tells KP what they could
 * stop doing.
 *
 * MOVED TO `app/shared` 2026-09-02, when the client half was built. It was
 * declared here first, next to its only consumer, and a second consumer is
 * exactly the moment that stops being right: the client needs the same seven
 * values to render the same seven chips, and a copy-paste of a vocabulary the
 * database CHECKs is how `SourceHealth` nearly went wrong (see shared's own
 * note on it). The database is still the authority; `shared` is its single
 * mirror; this re-export keeps every existing importer of `decide.js`
 * working. */
export { DISCOVERY_CHANNELS, type DiscoveryChannel } from "@tenderfoot/shared";
import { DISCOVERY_CHANNELS, type DiscoveryChannel } from "@tenderfoot/shared";

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
  /** REQUIRED on Interested, ignored otherwise. See recordDecision. */
  discoveryChannel?: DiscoveryChannel | null;
}

/* Same shape and same reason as ReasonRequiredError: the caller can fix it, so
 * the route answers 400. Separate from it because the two are different
 * omissions on opposite branches, and a caller that conflates them cannot tell
 * a user what to do next. */
export class DiscoveryChannelRequiredError extends Error {
  constructor() {
    super(
      "A discovery channel is required on Interested. It is the input to the " +
        "GO/NO-GO gate's only measure (design spec §8.5) -- 'nowhere' is the " +
        `discovery count. One of: ${DISCOVERY_CHANNELS.join(", ")}.`,
    );
    this.name = "DiscoveryChannelRequiredError";
  }
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

  /* REQUIRED ON INTERESTED, AND NOT SWITCHABLE, which is a deliberate contrast
   * with requireReasonOnPass above.
   *
   * That flag exists because a queue of forty items with three obvious junk
   * rows must not stall on a text field (SVRC Region 1.1.4) -- a friction
   * argument about the COMMON branch. Interested is the rare branch, and this
   * is not a text field: `not_sure` is a real option, so the prompt is always
   * answerable in one tap and can never block a decision.
   *
   * The reason it has no off switch is that switching it off would not lose a
   * corpus, as requireReasonOnPass does -- it would lose the gate's only
   * measure, silently, while every screen kept working. A skipped answer and
   * an unanswerable one would then be indistinguishable, which is exactly the
   * defect that made the 12.5% recall figure unusable: a denominator nobody
   * can defend. `not_sure` is recorded FOR that reason, so uncertainty is data
   * rather than a hole.
   *
   * Ruled by Matt 2026-09-01. Validity is enforced by migration 013's CHECK;
   * this only enforces PRESENCE, so a bad value fails loudly at the database
   * rather than being silently coerced here. */
  const discoveryChannel = input.discoveryChannel ?? null;
  if (state === "Interested" && !discoveryChannel) {
    throw new DiscoveryChannelRequiredError();
  }

  await run(
    `INSERT INTO pursuit (solicitation_id, state, reason, decided_by, decided_at, discovery_channel)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      solicitationId,
      state,
      reason,
      decidedBy,
      new Date().toISOString(),
      /* Only ever stored on Interested. A Pass carries NULL rather than a
       * placeholder: §8.5 asks about QUALIFIED opportunities, so a channel on
       * a rejected item would enter the denominator of a rate it is not part
       * of. */
      state === "Interested" ? discoveryChannel : null,
    ],
  );

  const [latest] = await latestPursuitFor([solicitationId]);
  if (!latest) throw new Error(`Decision on ${solicitationId} did not persist.`);
  return latest;
}
