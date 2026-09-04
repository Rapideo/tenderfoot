/* Orchestration: fetch -> import -> ingest_run.
 *
 * Ruling 3 (binding, 2026-09-03, .superpowers/sdd/2026-09-03-indiana-contract-
 * register/progress.md): there is no year loop. `startDate`/`endDate` filters
 * fully-contained-within, so date windows cannot tile the register -- year
 * windows recovered 24,933 of 204,991. The only correct fetch is "everything
 * at once", which `fetchRegister()` (eds-client.ts) already performs and
 * asserts complete via `assertComplete()` (completeness.ts). This file's job
 * is reduced to: call that fetch once, hand the rows to `importContracts`,
 * and record that ONE run happened. */
import { one, insert } from "../db/index.js";
import { importContracts } from "./import.js";
import type { EdsRow } from "./eds-client.js";

export interface IngestReport {
  fetched: number;
  written: number;
  skipped: number;
}

export async function ingestContracts(opts: {
  sourceName: string;
  fetchAll: () => Promise<EdsRow[]>;
}): Promise<IngestReport> {
  /* Checked BEFORE fetching, so an unrecognised source name fails loudly and
   * cheaply rather than spending the 47s/78MB register fetch first only to
   * discover there is nowhere to write it. */
  const src = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
    opts.sourceName,
  ]);
  if (!src) throw new Error(`No source row named ${opts.sourceName}`);

  /* No try/catch here on purpose. `fetchAll` (in production, `fetchRegister`)
   * is where `assertComplete` lives, and a short register rejects rather than
   * returning a partial array. Letting that rejection propagate unmodified,
   * before `importContracts` or the `ingest_run` insert below ever runs, is
   * what makes a truncated fetch write NEITHER `contract` rows NOR an
   * `ingest_run` row that would make the truncation look like a completed
   * import. */
  const rows = await opts.fetchAll();

  const res = await importContracts(src.id, rows);

  /* artifact_sha256 is NOT NULL UNIQUE on ingest_run and this path produces
   * no artifact file to hash -- there is exactly one fetch call, not a
   * per-window file, so a synthetic identity stands in: unique per run
   * (Date.now()) and, read cold, says what it is rather than looking like a
   * hash of something that does not exist.
   *
   * ingested_through stays NULL. That column is a windowed-scrape watermark
   * (see ingest/import-artifact.ts) recording how far a run advanced a
   * boundary that can move forward on the NEXT run; a whole-register snapshot
   * has no such boundary -- fetchAll() returns everything that exists, not
   * "everything through some date" -- so there is nothing honest to put
   * there. */
  await insert(
    `INSERT INTO ingest_run (source_id, ingested_through, artifact_sha256, rows_imported)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [src.id, null, `eds-register:whole-fetch:${Date.now()}`, rows.length],
  );

  return { fetched: rows.length, written: res.written, skipped: res.skipped };
}
