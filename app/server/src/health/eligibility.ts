/* May we contact this source at all?
 *
 * THE RULE, ruled by Matt 2026-08-17: `legal_posture` governs CONTACT,
 * `enabled` governs INGESTION. A liveness probe is contact, not ingestion,
 * so it keys off posture and deliberately ignores `enabled`.
 *
 * Consulting `enabled` would be the intuitive choice and it would be wrong:
 * twelve of the thirteen seeded rows are disabled, so it would leave exactly
 * one row (SAM.gov) with a health value and destroy the coverage this design
 * exists for.
 *
 * Pure by design -- no database, no network, no imports. The refusal has to
 * be checkable without standing anything up, because the thing being
 * asserted is that a request is never CONSTRUCTED for an excluded row.
 */
export interface EligibilitySubject {
  name: string;
  legal_posture: string;
  platform: string | null;
}

export type Eligibility = { probeable: true } | { probeable: false; reason: string };

export function probeEligibility(s: EligibilitySubject): Eligibility {
  /* GovWin IQ, BidNet Direct, BidPrime ('out') and Ohio OhioBuys
   * ('manual-only'). The registry's own notes read "Not accessed" and "Bot
   * detection was NOT worked around". */
  if (s.legal_posture !== "in") {
    return { probeable: false, reason: `legal_posture=${s.legal_posture}` };
  }
  /* The two corpus imports: "Fixed -- a snapshot, not a feed." A null
   * platform is refused too rather than defaulted, because an unknown
   * platform is not evidence that contact is permitted. */
  if (s.platform === null || s.platform === "Manual import") {
    return { probeable: false, reason: "no endpoint -- fixed snapshot, not a feed" };
  }
  return { probeable: true };
}
