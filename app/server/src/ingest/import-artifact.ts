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
  /* Order by `ingested_through` itself, NOT by `imported_at`. `imported_at`
   * is when the row was COMMITTED, and an operator is free to backfill an
   * older window after a newer one has already landed -- the last-committed
   * complete run is not necessarily the one that reached furthest. Sorting
   * on commit time would let that backfill silently regress the authority
   * backwards. (This failed safe -- a regressed mark only causes the next
   * run to re-fetch data it already has, harmless because sightings are
   * append-only -- but it was still the wrong answer.)
   *
   * `id DESC` is the second key, not `imported_at`: `imported_at` is
   * `now()` at transaction start, not a monotonic sequence, so two rows can
   * tie on it. `id` is assigned in commit order and never ties. */
  const row = await one<{ ingested_through: string | null }>(
    `SELECT ingested_through FROM ingest_run
      WHERE source_id = $1 AND ingested_through IS NOT NULL
      ORDER BY ingested_through DESC, id DESC LIMIT 1`,
    [sourceId],
  );
  return row?.ingested_through ?? null;
}

export async function importArtifact(path: string): Promise<ImportResult> {
  const sha = createHash("sha256").update(readFileSync(path)).digest("hex");
  const art = readArtifact(path);

  const src = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
    art.run.source_name,
  ]);
  if (!src) throw new Error(`No source row named ${art.run.source_name}`);

  /* No `force` option, on purpose. A forced re-import would have to decide
   * what happens to the FIRST import's sightings -- leave them (a real
   * duplicate, since sightings are append-only and nothing removes the
   * earlier rows) or delete them (which needs a decision about what
   * "replace" means for an immutable, merged-from ledger) -- and that is a
   * design question nobody has asked yet. An operator who genuinely needs
   * to re-import the same file deletes its `ingest_run` row by hand; the
   * UNIQUE constraint on `artifact_sha256` then simply stops objecting. */
  const seen = await one(`SELECT id FROM ingest_run WHERE artifact_sha256 = $1`, [sha]);
  if (seen) {
    return { imported: 0, skipped: true, ingestedThrough: await ingestedThrough(src.id) };
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
