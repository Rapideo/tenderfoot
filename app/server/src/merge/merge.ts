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
 *
 * CROSS-SOURCE IDENTITY ASSUMPTION (Fix round 1, Finding 2 -- record, don't
 * fix): grouping is by `external_id` ALONE. That is only correct if
 * external_ids are unique across every source that ever writes a sighting,
 * not merely within one source. There is no guard for this anywhere --
 * no UNIQUE constraint, no per-source namespacing, no normalisation.
 *
 * It holds today for the two wired sources: SAM's opaque `_id` and
 * USASpending's `generated_internal_id` are both effectively globally
 * unique, and "same external_id => same opportunity" is the ruled demo
 * criterion this module exists to satisfy. Do NOT change the grouping key
 * to work around this -- that would break the demo criterion, not protect
 * it.
 *
 * But the next sources in line are STATE PORTALS, which commonly emit
 * human-assigned identifiers like "RFP-2024-001". Two different states
 * reusing that exact string is plausible, not exotic -- unlike two
 * federal platforms colliding by accident. If it happens, this code fuses
 * two UNRELATED opportunities into one canonical row, and nothing errors
 * or logs: the merge reports one solicitation with two sightings, which
 * *reads as corroboration* ("two sources independently saw this"), not as
 * corruption. That is the dangerous part -- it looks like the system
 * working.
 *
 * Resolving this (source-qualified identity, or a namespaced key, or
 * something else entirely) is a PREREQUISITE for onboarding the first
 * source that emits human-assigned ids, not a someday-cleanup. Do not wire
 * up a state portal against this grouping key unchanged.
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
  /* One row per external_id: the newest sighting's payload (across ALL
   * sources), whether a canonical row already exists, and how many
   * sightings -- again across ALL sources -- still need linking.
   *
   * THE NON-OBVIOUS INVARIANT (Fix round 1, Finding 1 -- CRITICAL, hard-won):
   * `sourceId` scopes the outer `g` and thereby selects WHICH external_ids
   * this call processes. It must NOT also scope `latest_raw`,
   * `solicitation_id`, or `unlinked` -- those three are deliberately
   * UNSCOPED correlated subqueries against the full `sighting` table for
   * that external_id. Within a group, sightings from every source
   * participate, regardless of which source triggered this call.
   *
   * Get this wrong and it fails SILENTLY, not loudly. The original version
   * of this query computed `unlinked` with `count(*) FILTER (...)` over the
   * already-source-filtered `g` -- so a scoped call whose OWN source had
   * nothing new saw `unlinked = 0` even when a DIFFERENT source had just
   * added a newer, still-unlinked sighting for the same external_id. The
   * title-update branch below was skipped on that basis. But the final link
   * UPDATE at the bottom of this function has no source filter and linked
   * that stray sighting anyway -- so once linked, no future call, scoped or
   * unscoped, would ever see it as unlinked again. The canonical title never
   * caught up. Permanent, not delayed. Regression test:
   * "a scoped merge still catches a later cross-source amendment".
   *
   * Separately: latest_raw orders by seen_at -- WHEN WE SAW IT, not when the source
   * amended it (Fix round 1, Finding 3). "Latest sighting wins" is correct
   * only while sightings land in true chronological order; a backfill or a
   * replayed artifact that inserts old sightings after new ones would
   * invert this silently. Nothing in this slice performs a backfill yet,
   * so this is recorded here, not fixed.
   *
   * unlinked is UNSCOPED by source, unlike the outer query's g -- see the
   * invariant above. It must count every still-unlinked sighting for the
   * external_id, from any source, not just the ones that passed g's WHERE
   * clause. */
  const groups = await all<Group>(
    `SELECT g.external_id,
            (SELECT raw FROM sighting s2
              WHERE s2.external_id = g.external_id
              ORDER BY s2.seen_at DESC, s2.id DESC LIMIT 1) AS latest_raw,
            (SELECT s3.solicitation_id FROM sighting s3
              WHERE s3.external_id = g.external_id AND s3.solicitation_id IS NOT NULL
              LIMIT 1) AS solicitation_id,
            (SELECT count(*) FROM sighting s4
              WHERE s4.external_id = g.external_id AND s4.solicitation_id IS NULL) AS unlinked
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
