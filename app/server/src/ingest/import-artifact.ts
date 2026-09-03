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
   * where it was. Ruled 2026-08-15 after review.
   *
   * BLOCKING PRECONDITION (task-8, found in task-4, deferred until a
   * snapshot source existed to trigger it): a snapshot run has no window at
   * all, but `RunMeta.since`/`until` (artifact.ts) are non-optional
   * strings -- scrape/run.ts substitutes `""` rather than inventing a date
   * (`req.since ?? ""` / `req.until ?? ""`). `""` is not a real boundary
   * (contract.ts's `isValidDate` rejects it, and it sorts before every
   * genuine ISO string a windowed run would ever produce), so it must never
   * be written into `ingested_through` as if it were one -- doing so would
   * claim a window boundary that was never fetched, exactly the silent-gap
   * failure this whole design exists to prevent, just reached from a
   * different direction than the partial-run case above.
   *
   * Fixed at the WRITE side, not the read side (`ingestedThrough()`'s `IS
   * NOT NULL` filter): the ledger itself must never hold a false watermark,
   * not merely have every reader remember to filter it back out. A read-side
   * fix would need every current and future caller of `ingest_run` to know
   * about the `""` idiom; a write-side fix means the column is simply never
   * wrong. `art.run.until` is checked for truthiness (empty string is the
   * only falsy string) rather than `!== ""`, for the same reason `!since`
   * is used above -- there is no other falsy value this column can hold. */
  const advanceTo = art.run.outcome === "complete" && art.run.until ? art.run.until : null;

  return tx(async (q) => {
    const runId = await q.insert(
      `INSERT INTO ingest_run (source_id, ingested_through, artifact_sha256, rows_imported)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [src.id, advanceTo, sha, art.sightings.length],
    );

    /* ONE STATEMENT, WHATEVER THE ROW COUNT -- and UNNEST rather than a
     * multi-row VALUES list, which is the part worth explaining.
     *
     * Both collapse N round trips to one; only this one collapses N*7 bind
     * parameters to 7. Postgres caps a statement at 65535 parameters, so a
     * VALUES list of seven-column rows dies at ~9,362 sightings -- a limit
     * that would sit quietly below every test fixture and appear for the
     * first time on a real register. Five arrays and two scalars have no
     * such ceiling.
     *
     * The casts are explicit because the artifact stores everything as
     * SQLite TEXT: `raw` is a JSON string bound for a jsonb column and
     * `seen_at` an ISO string bound for timestamptz. The per-row version
     * got those conversions for free from the target column's type; a
     * SELECT list has to ask.
     *
     * The five arrays are all mapped from `art.sightings`, so they cannot
     * differ in length. That matters: unnest NULL-PADS to the longest array
     * rather than erroring, so ragged inputs would land rows with a NULL
     * external_id instead of failing. */
    if (art.sightings.length) {
      await q.run(
        `INSERT INTO sighting (source_id, external_id, seen_at, raw, extractor_ver, mode, ingest_run_id)
         SELECT $1::int, s.external_id, s.seen_at::timestamptz, s.raw::jsonb,
                s.extractor_ver, s.mode, $2::int
           FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
             AS s(external_id, seen_at, raw, extractor_ver, mode)`,
        [
          src.id,
          runId,
          art.sightings.map((s) => s.external_id),
          art.sightings.map((s) => s.seen_at),
          art.sightings.map((s) => s.raw),
          art.sightings.map((s) => s.extractor_ver),
          art.sightings.map((s) => s.mode),
        ],
      );
    }

    return {
      imported: art.sightings.length,
      skipped: false,
      ingestedThrough: advanceTo,
    };
  });
}
