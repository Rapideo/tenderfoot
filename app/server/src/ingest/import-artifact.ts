/* Artifact -> Postgres. Appends sightings; advances the ingest mark.
 *
 * Idempotency is NOT solved here, because the schema already solved it:
 * sightings are immutable and append-only and the canonical record is
 * produced by merging them (002_entity_graph.sql:179). Overlapping windows
 * are therefore safe by construction, and an amended posting arrives as a
 * second sighting -- change detection for free. An upsert on a natural key
 * would have overwritten amendments and destroyed per-source yield.
 *
 * The one duplicate risk left is importing the SAME FILE twice, which is
 * what artifact_sha256 catches.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { one, insert, tx } from "../db/index.js";
import { readArtifact } from "../scrape/artifact.js";

export interface ImportResult {
  imported: number;
  skipped: boolean;
  ingestedThrough: string | null;
}

export async function ingestedThrough(sourceId: number): Promise<string | null> {
  const row = await one<{ ingested_through: string | null }>(
    `SELECT ingested_through FROM ingest_run
      WHERE source_id = $1 AND ingested_through IS NOT NULL
      ORDER BY imported_at DESC LIMIT 1`,
    [sourceId],
  );
  return row?.ingested_through ?? null;
}

export async function importArtifact(
  path: string,
  opts: { force?: boolean } = {},
): Promise<ImportResult> {
  const sha = createHash("sha256").update(readFileSync(path)).digest("hex");
  const art = readArtifact(path);

  const src = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
    art.run.source_name,
  ]);
  if (!src) throw new Error(`No source row named ${art.run.source_name}`);

  if (!opts.force) {
    const seen = await one(`SELECT id FROM ingest_run WHERE artifact_sha256 = $1`, [sha]);
    if (seen) {
      return { imported: 0, skipped: true, ingestedThrough: await ingestedThrough(src.id) };
    }
  }

  /* ONLY A COMPLETE RUN MOVES THE MARK.
   *
   * A partial artifact covered the recent end of its window and never
   * reached the older tail -- the scrape stopped on a time budget, not on
   * exhausting the window. Advancing `ingested_through` on it would record
   * that we hold data nobody ever fetched, which is the silent gap this
   * design exists to prevent, arriving disguised as success.
   *
   * So: complete -> the window's `until`; partial -> NULL, and the window
   * stays open until a later run finishes it. `ingestedThrough()` above
   * ignores NULL rows, so a partial import simply leaves the authority
   * where it was. Ruled 2026-08-15 after review. */
  const advanceTo = art.run.outcome === "complete" ? art.run.until : null;

  return tx(async (q) => {
    const runId = await q.insert(
      `INSERT INTO ingest_run (source_id, ingested_through, artifact_sha256, rows_imported)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [src.id, advanceTo, sha, art.sightings.length],
    );

    for (const s of art.sightings) {
      await q.run(
        `INSERT INTO sighting (source_id, external_id, seen_at, raw, extractor_ver, mode, ingest_run_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [src.id, s.external_id, s.seen_at, s.raw, s.extractor_ver, s.mode, runId],
      );
    }

    return {
      imported: art.sightings.length,
      skipped: false,
      ingestedThrough: advanceTo,
    };
  });
}
