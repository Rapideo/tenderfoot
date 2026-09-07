/* WHAT A METERED SOURCE HAS COST US, AND THE ONLY PLACE THAT KNOWS.
 *
 * CLAUDE.md §5.1: HigherGov's consumption "cannot be measured from the API"
 * -- no quota field, no usage endpoint, no header. A person reading the
 * account dashboard is the sole instrument. This table is the second one,
 * and unlike the dashboard it can be queried by the code that is about to
 * spend.
 *
 * ⚖️ FINAL-REVIEW CORRECTION: this comment used to say writes belong INSIDE
 * the same transaction that writes the documents and the stamp, "because a
 * tally written outside that transaction can survive a rollback that
 * discarded the work it was counting, and then over-reports forever." That
 * reasoning was backwards. By the time `fetchFor` returns, the VENDOR has
 * already billed the call -- nothing that happens afterward, including a
 * failed document write, un-bills it. Migration 030's own header says the
 * same thing about this table: "records IS WHAT THE VENDOR BILLED, NOT WHAT
 * WE KEPT." Tallying inside the transaction meant a rolled-back write erased
 * a spend that genuinely happened, which is UNDER-reporting -- and against a
 * ceiling whose true consumption cannot be read back from the vendor at all
 * (CLAUDE.md §5.1), under-reporting is the dangerous direction: it is what
 * lets an operator believe there is budget left when there is not. A tally
 * that outlives a rolled-back document write is over-reporting, which is
 * merely conservative, not wrong. fetch-documents-for.ts now records the
 * spend in its own committed write, before its transaction opens. */
import { all, type Querier } from "../db/index.js";

/* ⚖️ ~~UNRATIFIED.~~ RATIFIED 2026-09-07 (D10, option A) -- see
 * `CEILING_RATIFIED` below. It shipped as a proposal in exactly the style of
 * fitness/thresholds.ts's R7 block (D5, 2026-09-04), and the argument it was
 * approved on is kept verbatim below rather than deleted, because it is what
 * he actually agreed to.
 *
 * The proposal was 1,000 -- 10% of the 10,000/month allowance, about 90
 * document fetches. The reasoning, which is what he is actually ruling on:
 * the standing 500-record budget governs what an AGENT may spend unasked,
 * while this governs what the APPLICATION spends while somebody browses.
 * Different actors. Since consumption cannot be read back from the vendor,
 * an unbounded browsing session's first symptom would be a dashboard read
 * days later. */
export const MONTHLY_RECORD_CEILING = 1000;

/* ⚠️ FINAL-REVIEW FIX: "exactly the style of ... R7's block" was a claim, not
 * yet a fact. R7's style is `R7_RATIFIED`, an EXPORTED BOOLEAN that changes
 * runtime output (rubric.ts's caveat) and is PINNED BY A TEST
 * (rubric.test.ts). What stood here before this flag was only the word
 * UNRATIFIED inside a comment, and the test named "the ceiling is a positive
 * number and is marked unratified in source" asserted `toBeGreaterThan(0)`
 * and nothing else -- delete the word from the comment above and that test
 * stayed green, which means nothing was actually pinning the claim. This is
 * the one number in the branch that governs money, so it gets the real
 * mechanism rather than a comment that a paraphrase can quietly drop.
 * ~~`false` until Matt rules on 1,000 (or any other value) the way he ruled
 * D4 for the floor's thresholds.~~ He ruled it 2026-09-07 -- see below. */
/* ⚖️ RATIFIED 2026-09-07 BY MATT -- ruling sheet D10, option A, "ratify
 * 1,000 as it stands". The number above is no longer a proposal.
 *
 * ⚠️ HE WAS SHOWN, AND DECLINED, THE ALTERNATIVE THAT WOULD HAVE SPLIT IT.
 * One ceiling now governs TWO spenders: the application fetching documents
 * while somebody browses (D2's original framing) and `npm run recall`
 * measuring coverage. They compete -- a heavy browsing month can starve a
 * measurement run and vice versa, and neither is warned, because
 * consumption cannot be read back from the vendor at all. Option C offered
 * one ceiling per actor; he took A. Recorded here because the next person
 * to hit an unexplained refusal deserves to know it was a choice. */
export const CEILING_RATIFIED = true;

export interface Spend {
  sourceId: number;
  endpoint: "opportunity" | "document";
  /** What the VENDOR billed, not rows kept. Free sources pass 0. */
  records: number;
  solicitationId?: number;
}

/* `Pick<Querier, "run">`, not the full `Querier`: `run` is the only method
 * this ever calls, and narrowing to it is what lets a caller outside any
 * transaction -- fetch-documents-for.ts's committed spend write, see its own
 * comment -- pass the pool-level `run` directly (`{ run }`) rather than
 * assembling `all`/`one`/`insert` it will never use just to satisfy the
 * type. A full `Querier`, such as a `tx()` callback's `q`, still satisfies
 * this narrower type without change. */
export async function recordSpend(q: Pick<Querier, "run">, s: Spend): Promise<void> {
  await q.run(
    `INSERT INTO api_spend (source_id, endpoint, records, solicitation_id)
     VALUES ($1, $2, $3, $4)`,
    [s.sourceId, s.endpoint, s.records, s.solicitationId ?? null],
  );
}

/* Calendar month, not a rolling 30 days, because that is how the allowance
 * itself resets. A rolling window would refuse work on the 1st that the
 * vendor has already forgiven. */
export async function spentThisMonth(sourceName: string): Promise<number> {
  const rows = await all<{ total: string | null }>(
    `SELECT sum(sp.records) AS total
       FROM api_spend sp
       JOIN source s ON s.id = sp.source_id
      WHERE s.name = $1
        AND sp.called_at >= date_trunc('month', now())`,
    [sourceName],
  );
  return Number(rows[0]?.total ?? 0);
}
