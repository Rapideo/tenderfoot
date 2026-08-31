/* UNDECIDED. No pursuit row at all, OR a latest row still in 'New'.
 * 'New' is migration 002's default and means untouched -- treating any
 * pursuit row as a decision would empty the queue for anything the system
 * had merely written a placeholder for.
 *
 * Split out from ELIGIBLE below (SP6 final review fix wave) so SAMPLE MODE
 * queue membership can use "undecided" alone, without the closed check --
 * spec §10: "An item's deadline passes mid-session -> Stays in the sample,
 * marked closed." Ordinary (non-sample) queue membership keeps using the
 * full ELIGIBLE predicate unchanged; a closed item must still not appear
 * there. Expects the caller to have joined the latest-pursuit view as `lp`. */
export const UNDECIDED = `(lp.state IS NULL OR lp.state = 'New')`;

/* MEMBERSHIP. Undecided, and not closed.
 *
 * closes_at is `text` holding ISO dates, so a string comparison against a
 * bound ISO date is the correct ordering. NULL is included deliberately:
 * a missing deadline is not a reason to hide an opportunity.
 *
 * IT LIVES IN ITS OWN MODULE so queue.ts and sample.ts can both use it
 * without importing each other -- queue.ts needs sample.ts's getSample, and
 * a mutual import is a cycle waiting to bite.
 *
 * Expects the caller to bind today's ISO date as $1, and to have joined
 * the latest-pursuit view as `lp` and the solicitation as `s`. */
export const ELIGIBLE = `
      ${UNDECIDED}
  AND (s.closes_at IS NULL OR s.closes_at >= $1)`;
