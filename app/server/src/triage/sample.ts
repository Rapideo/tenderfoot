import { all, one, tx } from "../db/index.js";
import { ELIGIBLE } from "./eligibility.js";
import { LATEST_PURSUIT } from "./latest.js";

export interface SampleHeader {
  id: number;
  source_id: number;
  source_name: string;
  drawn_at: string;
  seed: string;
  n_requested: number;
  /** Eligible rows AT DRAW TIME. The denominator. */
  population_size: number;
  /** How many were actually drawn -- differs from n_requested on a small source. */
  drawn: number;
  /** How many of them now carry a decision. */
  decided: number;
  note: string | null;
}

const HEADER_SQL = `
  SELECT ts.id, ts.source_id, src.name AS source_name, ts.drawn_at, ts.seed,
         ts.n_requested, ts.population_size, ts.note,
         (SELECT count(*)::int FROM triage_sample_item i WHERE i.sample_id = ts.id) AS drawn,
         (SELECT count(*)::int
            FROM triage_sample_item i
            JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = i.solicitation_id
           WHERE i.sample_id = ts.id AND lp.state <> 'New') AS decided
    FROM triage_sample ts
    JOIN source src ON src.id = ts.source_id`;

const TODAY = () => new Date().toISOString().slice(0, 10);

/* Drawing is an EXPLICIT operator action that records its own population.
 *
 * Sampling is a MEASUREMENT PROTOCOL, not a filter: it selects what a human
 * reads in order to measure, never what the product returns. The queue's own
 * membership and order are untouched by it (spec §2.1).
 *
 * md5(id || seed) is a deterministic permutation -- not cryptographic, and
 * it does not need to be. What it needs is to be reproducible and unrelated
 * to any property of the row, so the draw is not accidentally ordered by
 * deadline, value, or insertion. */
export async function drawSample(opts: {
  sourceId: number;
  n: number;
  seed?: string;
  note?: string;
}): Promise<SampleHeader> {
  const seed = opts.seed ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const n = Math.max(1, Math.min(opts.n, 1000));
  const today = TODAY();

  const id = await tx(async (q) => {
    const pop = await q.one<{ total: number }>(
      `SELECT count(*) AS total
         FROM solicitation s
         LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
        WHERE s.source_id = $2 AND ${ELIGIBLE}`,
      [today, opts.sourceId],
    );
    const populationSize = Number(pop?.total ?? 0);

    const header = await q.one<{ id: number }>(
      `INSERT INTO triage_sample (source_id, seed, n_requested, population_size, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [opts.sourceId, seed, opts.n, populationSize, opts.note ?? null],
    );
    const sampleId = header!.id;

    const picked = await q.all<{ id: number }>(
      `SELECT s.id
         FROM solicitation s
         LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
        WHERE s.source_id = $2 AND ${ELIGIBLE}
        ORDER BY md5(s.id::text || $3)
        LIMIT ${n}`,
      [today, opts.sourceId, seed],
    );

    /* UNNEST, not a row per INSERT and not a VALUES list -- the established
     * pattern from the SP3.5 ingestion fix. It collapses the round trips AND
     * the bind parameters, so the statement count does not scale with n. */
    if (picked.length > 0) {
      await q.run(
        `INSERT INTO triage_sample_item (sample_id, solicitation_id, position)
         SELECT $1, sol_id, pos
           FROM UNNEST($2::int[], $3::int[]) AS t(sol_id, pos)`,
        [sampleId, picked.map((p) => p.id), picked.map((_, i) => i)],
      );
    }
    return sampleId;
  });

  const header = await getSample(id);
  if (!header) throw new Error(`Sample ${id} did not persist.`);
  return header;
}

export async function getSample(id: number): Promise<SampleHeader | null> {
  /* one<T>() returns T | undefined (db/index.ts's Querier.one) -- this
   * function's own contract is T | null, so undefined is normalised here
   * rather than left to leak past the boundary as a third falsy state
   * every caller would have to separately guard against. */
  return (await one<SampleHeader>(`${HEADER_SQL} WHERE ts.id = $1`, [id])) ?? null;
}

export async function listSamples(): Promise<SampleHeader[]> {
  return all<SampleHeader>(`${HEADER_SQL} ORDER BY ts.drawn_at DESC`);
}
