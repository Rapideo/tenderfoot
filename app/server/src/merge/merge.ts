/* SP3.5 -- build inventory 2G(b). Sightings into canonical records.
 *
 * "Source X showed us this listing on date Y" is a SIGHTING; the canonical
 * record is produced by MERGING them (002_entity_graph.sql:179, §4.4). This
 * module is that merge, and it is the first point at which the system can
 * tell one opportunity from two.
 *
 * Sightings are never modified here. The canonical row takes its values from
 * the MOST RECENT sighting, so an amendment reads as a change while the
 * earlier observation survives -- which is what makes change detection and
 * honest per-source yield possible at all.
 */
import { all, tx } from "../db/index.js";

export interface MergeResult {
  created: number;
  updated: number;
  linked: number;
}

interface Group {
  external_id: string;
  latest_raw: any;
  solicitation_id: number | null;
  unlinked: number;
}

export async function mergeSightings(sourceId?: number): Promise<MergeResult> {
  /* One row per external_id: the newest sighting's payload, whether a
   * canonical row already exists, and how many sightings still need linking. */
  const groups = await all<Group>(
    `SELECT g.external_id,
            (SELECT raw FROM sighting s2
              WHERE s2.external_id = g.external_id
              ORDER BY s2.seen_at DESC, s2.id DESC LIMIT 1) AS latest_raw,
            (SELECT s3.solicitation_id FROM sighting s3
              WHERE s3.external_id = g.external_id AND s3.solicitation_id IS NOT NULL
              LIMIT 1) AS solicitation_id,
            count(*) FILTER (WHERE g.solicitation_id IS NULL) AS unlinked
       FROM sighting g
      WHERE g.external_id IS NOT NULL
        AND ($1::int IS NULL OR g.source_id = $1)
      GROUP BY g.external_id`,
    [sourceId ?? null],
  );

  let created = 0;
  let updated = 0;
  let linked = 0;

  for (const g of groups) {
    const raw = typeof g.latest_raw === "string" ? JSON.parse(g.latest_raw) : g.latest_raw;
    const title = String(raw?.title ?? "").trim() || "(untitled)";

    await tx(async (q) => {
      let solId = g.solicitation_id;

      if (solId === null) {
        solId = await q.insert(
          `INSERT INTO solicitation (external_id, title) VALUES ($1,$2) RETURNING id`,
          [g.external_id, title],
        );
        created++;
      } else if (Number(g.unlinked) > 0) {
        const n = await q.run(`UPDATE solicitation SET title = $2 WHERE id = $1 AND title <> $2`, [
          solId,
          title,
        ]);
        if (n > 0) updated++;
      }

      linked += await q.run(
        `UPDATE sighting SET solicitation_id = $1
          WHERE external_id = $2 AND solicitation_id IS NULL`,
        [solId, g.external_id],
      );
    });
  }

  return { created, updated, linked };
}
