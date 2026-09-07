/* A FROZEN CENSUS FROM A FREE SOURCE.
 *
 * The asymmetry this whole design rests on (spec §3.1): everything needed to
 * know WHAT SHOULD HAVE BEEN FOUND is published free. Only the comparison
 * costs records.
 *
 * A census, not a sample: idoaKeyFrom enumerates every row on the page. That
 * is what makes a later diff valid -- an Event ID absent from an earlier
 * census is genuinely new, rather than merely unsampled.
 *
 * ⚠️ ONE BLIND SPOT, DISCLOSED RATHER THAN DISCOVERED LATER. The page lists
 * OPEN notices. A notice posted AND closed between two censuses appears in
 * neither and is invisible to the test. That biases the measurement TOWARD
 * FLATTERING HIGHERGOV -- such a notice could have been missed entirely and
 * would never be counted as a miss. Short-fuse notices are exactly the ones a
 * bidder most needs carried promptly, so the bias runs against the property
 * that matters most. Observing more often reduces it; nothing removes it. */
import { parseIdoaPage } from "../scrape/adapters/idoa.js";
import { closesAt } from "../merge/closes-at.js";

export type Segment = "state_agency" | "sub_state";

export interface KeyEntry {
  externalId: string;
  segment: Segment;
  /** Where the key came from. For IDOA this is its registry name; for a
   * sub-state buyer it is the page, because those have no registry row
   * (migration 031's own comment explains why they must not get one). */
  keyOrigin: string;
  /** YYYY-MM-DD, or null when the source published nothing parseable. */
  deadline: string | null;
}

/* The canonical registry name, matching scrape/adapters/registry.ts's `idoa`
 * entry and migration 003's seeded row. closesAt() DISPATCHES ON THIS STRING
 * -- pass anything else and it silently returns null for every row, which
 * would read as "IDOA publishes no deadlines" rather than as an error. */
export const IDOA_SOURCE_NAME = "Indiana IDOA solicitations";

export function idoaKeyFrom(html: string): KeyEntry[] {
  return parseIdoaPage(html).items.map((item) => ({
    externalId: item.externalId,
    segment: "state_agency" as const,
    keyOrigin: IDOA_SOURCE_NAME,
    /* Reused, not reimplemented. closes-at.ts already knows IDOA's
     * "10/05/2026 3:00:00PM EST" shape, already refuses to guess at a
     * partial match, and already explains why the bare date is the right
     * answer for this source. */
    deadline: closesAt(IDOA_SOURCE_NAME, item.raw),
  }));
}
