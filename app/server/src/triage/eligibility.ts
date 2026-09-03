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
/* 🔴 A DEADLINE EARLIER THAN ITS OWN POSTING DATE IS NOT A DEADLINE.
 *
 * Measured on production 2026-09-01: 106 solicitations close BEFORE they were
 * posted, the worst by 7,275 days -- `posted 2026-08-25, closes 2006-09-24`, a
 * year typo in SAM's own payload. closesAt() records what the source states,
 * which is correct; the defect is upstream and not ours to fix.
 *
 * WHAT WAS OURS. The predicate below used to read `s.closes_at >= $1`
 * directly, so a notice claiming 2006 was filed as CLOSED and never entered the
 * queue. 75 of the 106 were a biddable kind and 62 had been posted within the
 * month -- roughly 1.4% of a week's biddable volume, dropped in silence. The
 * gate exists to measure DISCOVERY (design spec §8.5), so a discovery hole is
 * the most expensive kind of bug this system can have.
 *
 * THE ASYMMETRY THAT CAUSED IT is worth naming, because the reasoning was
 * half-done rather than absent. This module already treats a MISSING deadline
 * with care -- "a missing deadline is not a reason to hide an opportunity" --
 * and then hid opportunities for a WRONG one. Null was thought about;
 * impossible was not.
 *
 * SO IMPOSSIBLE IS TREATED AS UNKNOWN, which is what it is: a date that cannot
 * be true tells us nothing about when the thing closes, and "we do not know
 * when this closes" is a state this file already has a considered answer for.
 * That reuses existing reasoning rather than inventing a fourth state.
 *
 * ⚠️ THE STORED VALUE IS NOT REWRITTEN. `solicitation.closes_at` keeps exactly
 * what the source said. This is a DERIVED reading of it, in the same spirit as
 * precedence.ts keeping rejected values and decisions being append-only: the
 * one thing this project does not do is quietly discard what a source claimed.
 * The raw value still travels to the client so the screen can show that the
 * date is untrustworthy rather than pretending there is none.
 *
 * ⚠️ THIS CHECK ONLY WORKS BECAUSE posted_at EXISTS. It was null on 9,743 of
 * 9,883 production rows until the 2026-09-01 backfill, so written a day earlier
 * this expression would have been a no-op that looked fine. Anything that
 * empties posted_at silently disables it -- which is why the tests assert the
 * behaviour and not merely the SQL.
 *
 * Expects the solicitation aliased as `s`, exactly as the predicates here do. */
export const EFFECTIVE_CLOSES_AT = `
  (CASE WHEN s.closes_at IS NOT NULL
         AND s.posted_at IS NOT NULL
         AND s.closes_at < s.posted_at
        THEN NULL ELSE s.closes_at END)`;

/** True when the stored deadline is the impossible kind above. Used to tell the
 *  client, so a screen can decline to render `2006-09-24` as a live deadline. */
export const DEADLINE_UNRELIABLE = `
  (s.closes_at IS NOT NULL AND s.posted_at IS NOT NULL AND s.closes_at < s.posted_at)`;

/* 🔴 A NOTICE NOBODY CAN BID ON IS NOT AN OPPORTUNITY.
 *
 * FOUND 2026-09-02, by Matt triaging sample 1 and reporting it unworkable.
 * Measured on that sample: **38 of 100 items could not be bid on** — 31 Award
 * Notices, 6 Special Notices, 1 Justification. One of them, opened on
 * sam.gov to be sure, reads "Contract Opportunity Type: Award Notice
 * (Original)", awarded to CASEPOINT LLC on 2026-08-11 for $3,828,000. There
 * was never anything to decide.
 *
 * ⚠️ AND THE PROBLEM COMPOUNDS, which is why this is not merely annoying.
 * An award notice carries NO deadline, so `EFFECTIVE_CLOSES_AT IS NULL`
 * admits it forever: **1,841 of 1,875 award notices on production count as
 * "live"** — 98%. Biddable kinds expire and leave; these never do. Left
 * unfiltered, the queue's composition drifts toward things nobody can bid on,
 * and the drift is invisible because every individual row looks fine.
 *
 * ⚠️ THE 26% FIGURE WAS ALREADY WRITTEN DOWN. `docs/2026-09-01-gate-
 * measurements.md` recorded "Not biddable — 26% — award notices, special
 * notices, justifications" the day before. It was measured, published, and
 * never connected to the predicate that decides what a person is shown. A
 * measurement nobody wires to a filter is a fact the product does not have.
 *
 * WHAT STAYS, and why the line is drawn here rather than at "can I bid today":
 * `Presolicitation` and `Sources Sought` are NOT yet biddable, and they are
 * kept deliberately — they are the earliest signal a requirement exists, and
 * lead time is worth more to a small firm than to a large one. Excluding them
 * would optimise the queue for today at the cost of the pipeline.
 *
 * WHAT GOES: an award (already won), a justification (an explanation of a
 * decision already taken), a special notice (an announcement, not a
 * solicitation), a surplus sale (not services), and a bundling notice (a
 * consolidation announcement). None is a thing to bid on.
 *
 * NULL kind is ADMITTED. Corpus-imported rows carry no kind at all, and a
 * missing classification is not evidence of unbiddability — excluding it
 * would silently drop every row from a source that does not publish one,
 * which is exactly the SAM-shaped assumption that cost four defects today
 * (D27). Fail open on absence; exclude only what is positively identified. */
export const NOT_BIDDABLE = [
  "Award Notice",
  "Justification",
  "Special Notice",
  "Sale of Surplus Property",
  "Consolidate/(Substantially) Bundle",
] as const;

/* INLINED rather than bound as a parameter, and that is deliberate.
 *
 * A fixed placeholder index cannot live in a shared SQL fragment: queue.ts
 * binds $1 = today and would need $2, while sample.ts already binds $2 =
 * source_id and would need $3. The fragment would have to know its caller,
 * which is exactly the coupling putting it in its own module avoids.
 *
 * Safe to inline because the values are OUR OWN compile-time constants, never
 * user input. The quote-escape is belt and braces for the day someone adds a
 * kind containing an apostrophe -- SAM publishes vendor-authored strings, and
 * this list is edited by hand. */
export const NOT_BIDDABLE_SQL =
  `(s.kind IS NULL OR s.kind NOT IN (${NOT_BIDDABLE.map((k) => `'${k.replace(/'/g, "''")}'`).join(", ")}))`;

export const ELIGIBLE = `
      ${UNDECIDED}
  AND ${NOT_BIDDABLE_SQL}
  AND (${EFFECTIVE_CLOSES_AT} IS NULL OR ${EFFECTIVE_CLOSES_AT} >= $1)`;
