/* WHAT A METERED SOURCE HAS COST US, AND THE ONLY PLACE THAT KNOWS.
 *
 * CLAUDE.md §5.1: HigherGov's consumption "cannot be measured from the API"
 * -- no quota field, no usage endpoint, no header. A person reading the
 * account dashboard is the sole instrument. This table is the second one,
 * and unlike the dashboard it can be queried by the code that is about to
 * spend.
 *
 * ⚠️ WRITES TAKE A `Querier`, NOT THE POOL. Every caller records spend
 * inside the same transaction that writes the documents and the stamp. A
 * tally written outside that transaction can survive a rollback that
 * discarded the work it was counting, and then over-reports forever. */
import { all, type Querier } from "../db/index.js";

/* ⚖️ UNRATIFIED. Matt sets this number; it ships as a proposal in exactly
 * the style of fitness/thresholds.ts's R7 block (D5, 2026-09-04).
 *
 * The proposal is 1,000 -- 10% of the 10,000/month allowance, about 90
 * document fetches. The reasoning, which is what he is actually ruling on:
 * the standing 500-record budget governs what an AGENT may spend unasked,
 * while this governs what the APPLICATION spends while somebody browses.
 * Different actors. Since consumption cannot be read back from the vendor,
 * an unbounded browsing session's first symptom would be a dashboard read
 * days later. */
export const MONTHLY_RECORD_CEILING = 1000;

export interface Spend {
  sourceId: number;
  endpoint: "opportunity" | "document";
  /** What the VENDOR billed, not rows kept. Free sources pass 0. */
  records: number;
  solicitationId?: number;
}

export async function recordSpend(q: Querier, s: Spend): Promise<void> {
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
