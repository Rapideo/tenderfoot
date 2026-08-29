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
import { orgChain } from "./org-chain.js";

export interface MergeResult {
  created: number;
  updated: number;
  linked: number;
  /** Solicitations that gained an `org_id` on this run, including ones
   * merged earlier while nothing read the organisation out of the payload. */
  orgsAttached: number;
}

interface Group {
  external_id: string;
  latest_raw: any;
  latest_source_id: number;
  solicitation_id: number | null;
  unlinked: number;
  org_id: number | null;
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
    `SELECT t.*, (SELECT sol.org_id FROM solicitation sol WHERE sol.id = t.solicitation_id) AS org_id
       FROM (
        SELECT g.external_id,
               (SELECT raw FROM sighting s2
                 WHERE s2.external_id = g.external_id
                 ORDER BY s2.seen_at DESC, s2.id DESC LIMIT 1) AS latest_raw,
               /* The source of that same latest sighting, so the org chain is
                * read with the reader that matches the payload in hand. Same
                * ORDER BY as latest_raw, deliberately -- reading level names
                * out of one source's payload with another's paths yields
                * nothing, silently. */
               (SELECT s5.source_id FROM sighting s5
                 WHERE s5.external_id = g.external_id
                 ORDER BY s5.seen_at DESC, s5.id DESC LIMIT 1) AS latest_source_id,
               (SELECT s3.solicitation_id FROM sighting s3
                 WHERE s3.external_id = g.external_id AND s3.solicitation_id IS NOT NULL
                 LIMIT 1) AS solicitation_id,
               (SELECT count(*) FROM sighting s4
                 WHERE s4.external_id = g.external_id AND s4.solicitation_id IS NULL) AS unlinked
          FROM sighting g
         WHERE g.external_id IS NOT NULL
           AND ($1::int IS NULL OR g.source_id = $1)
         GROUP BY g.external_id
       ) t`,
    [sourceId ?? null],
  );

  /* Source id -> name, one round trip, so org-chain reading stays keyed by
   * the canonical registry name rather than an adapter's short CLI key. */
  const sources = await all<{ id: number; name: string; jurisdiction: string | null }>(
    `SELECT id, name, jurisdiction FROM source`,
  );
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  /* THE WORK IS SORTED IN MEMORY FIRST, THEN APPLIED IN THREE STATEMENTS.
   *
   * This used to be a loop with a TRANSACTION PER GROUP -- BEGIN, one or two
   * writes, COMMIT -- run for every group the query above returned. Measured
   * on the first live run (2026-08-16): 530 solicitations in 3m36s, ~2.4/sec,
   * roughly four round trips per group.
   *
   * The waste was worse than "one trip per group". `groups` returns every
   * external_id ever seen, not just the ones needing work, and the old loop
   * opened a transaction for each of them -- including fully-merged groups
   * whose link UPDATE then matched zero rows. Cost tracked the size of the
   * WHOLE CORPUS on every run rather than the size of the new batch, so a
   * merge got slower forever, even on a quiet day with nothing to do.
   *
   * Titles are still computed in JS rather than as `raw->>'title'` in SQL.
   * That is deliberate: the two are not equivalent for a non-string title
   * (`->>` renders an object as JSON text where String() gives
   * "[object Object]"), and this rewrite is about round trips, not about
   * quietly changing what a title is. */
  const inserts: { external_id: string; title: string; source_id: number }[] = [];
  /* Keyed by solicitation id so a later group wins, exactly as sequential
   * UPDATEs did. Two distinct external_ids CAN resolve to one solicitation
   * -- a sighting linked via a different external_id -- and `UPDATE ... FROM
   * unnest` would otherwise pick among duplicate keys arbitrarily, turning
   * "last wins" into "whichever the planner reached first". */
  const titleUpdates = new Map<number, string>();
  const links: { external_id: string; solId: number }[] = [];
  /* external_id -> the chain for it. Collected for new groups and for any
   * existing solicitation still missing an organisation, so a re-run repairs
   * rows merged before anything read the agency out of the payload. */
  const chains = new Map<string, string[]>();
  /* Organisation name -> the jurisdiction of the source that produced it.
   * Recorded PER NAME as chains are collected, not read off some arbitrary
   * group later: SP1's execution record, defect 4, is a hard-coded
   * jurisdiction default that tagged 62 federal agencies 'IN' with nothing
   * downstream to contradict it. First writer wins, so a name already
   * carrying a jurisdiction is not reassigned by a later source. */
  const jurisdictionByName = new Map<string, string | null>();
  /* Existing solicitations needing only an organisation, by id. */
  const orgOnly: { solId: number; external_id: string }[] = [];

  for (const g of groups) {
    const raw = typeof g.latest_raw === "string" ? JSON.parse(g.latest_raw) : g.latest_raw;
    const title = String(raw?.title ?? "").trim() || "(untitled)";
    const src = sourceById.get(g.latest_source_id);
    const chain = orgChain(src?.name ?? "", raw);
    for (const name of chain) {
      if (!jurisdictionByName.has(name)) jurisdictionByName.set(name, src?.jurisdiction ?? null);
    }

    if (g.solicitation_id === null) {
      /* Migration 010: the solicitation records the source whose payload it
       * reflects, and `latest_source_id` IS that source -- the same one `raw`
       * and therefore `title` above were read from. Passing anything else
       * here would make the column disagree with the row it describes. */
      inserts.push({ external_id: g.external_id, title, source_id: g.latest_source_id });
      if (chain.length) chains.set(g.external_id, chain);
    } else if (Number(g.unlinked) > 0) {
      titleUpdates.set(g.solicitation_id, title);
      links.push({ external_id: g.external_id, solId: g.solicitation_id });
      if (chain.length && g.org_id === null) chains.set(g.external_id, chain);
    } else if (g.org_id === null && chain.length) {
      /* MISSING AN ORGANISATION IS ITS OWN REASON TO DO WORK. Every other
       * branch keys off unlinked sightings, and these rows have none -- they
       * were merged before this code existed and would otherwise stay
       * orphaned forever, because nothing would ever look at them again. */
      chains.set(g.external_id, chain);
      orgOnly.push({ solId: g.solicitation_id, external_id: g.external_id });
    }
    /* An existing group with nothing unlinked AND an organisation already
     * attached is skipped entirely. The old loop still opened a transaction
     * and ran a link UPDATE that matched nothing -- that is the O(corpus)
     * cost above, and dropping it changes no observable result. */
  }

  /* ONE transaction for the whole merge, where there used to be one per
   * group. A partial failure now rolls the entire merge back instead of
   * leaving some groups committed and others not, which is the behaviour a
   * re-runnable batch step should have had from the start -- but it IS a
   * change: the old shape could leave a half-merged database behind and
   * this one cannot. */
  return tx(async (q) => {
    let linked = 0;

    /* Insert first: linking the new groups needs the ids this produces, and
     * `external_id` comes back with them so the mapping does not depend on
     * unnest preserving row order. */
    const inserted = inserts.length
      ? await q.all<{ id: number; external_id: string }>(
          `INSERT INTO solicitation (external_id, title, source_id)
           SELECT u.external_id, u.title, u.source_id
             FROM unnest($1::text[], $2::text[], $3::int[])
               AS u(external_id, title, source_id)
           RETURNING id, external_id`,
          [
            inserts.map((i) => i.external_id),
            inserts.map((i) => i.title),
            inserts.map((i) => i.source_id),
          ],
        )
      : [];
    for (const row of inserted) links.push({ external_id: row.external_id, solId: row.id });

    const updated = titleUpdates.size
      ? await q.run(
          `UPDATE solicitation s SET title = u.title
             FROM unnest($1::int[], $2::text[]) AS u(id, title)
            WHERE s.id = u.id AND s.title <> u.title`,
          [[...titleUpdates.keys()], [...titleUpdates.values()]],
        )
      : 0;

    if (links.length) {
      linked = await q.run(
        `UPDATE sighting s SET solicitation_id = u.sol_id
           FROM unnest($1::text[], $2::int[]) AS u(external_id, sol_id)
          WHERE s.external_id = u.external_id AND s.solicitation_id IS NULL`,
        [links.map((l) => l.external_id), links.map((l) => l.solId)],
      );
    }

    /* ORGANISATIONS, RESOLVED BY DEPTH RATHER THAN BY ROW.
     *
     * Identity is the NAME ALONE, matching ingest/corpus.ts's upsertOrg --
     * two sources spelling an agency identically mean one row, which is the
     * whole point of the organisation table. Depth drives the loop only
     * because a child cannot be inserted before its parent has an id.
     *
     * Cost is O(depth), not O(rows): at most five iterations for SAM's
     * five-level hierarchy, whatever the batch size. That is what keeps the
     * constancy test honest. */
    let orgsAttached = 0;
    if (chains.size) {
      const byName = new Map<string, number>();
      const distinct = [...new Set([...chains.values()].flat())];

      const existing = await q.all<{ id: number; name: string }>(
        `SELECT id, name FROM organization WHERE name = ANY($1::text[])`,
        [distinct],
      );
      for (const o of existing) byName.set(o.name, o.id);

      const maxDepth = Math.max(...[...chains.values()].map((c) => c.length));
      for (let depth = 0; depth < maxDepth; depth++) {
        const pending = new Map<string, string | null>(); // name -> parent name
        for (const chain of chains.values()) {
          const name = chain[depth];
          if (name === undefined || byName.has(name)) continue;
          pending.set(name, chain[depth - 1] ?? null);
        }
        if (!pending.size) continue;

        const names = [...pending.keys()];
        const parents = names.map((n) => {
          const p = pending.get(n);
          return p === null || p === undefined ? null : (byName.get(p) ?? null);
        });
        /* Jurisdiction comes from the registry entry of the source that
         * actually produced THIS name -- see jurisdictionByName above. */
        const jurisdictions = names.map((n) => jurisdictionByName.get(n) ?? null);

        const made = await q.all<{ id: number; name: string }>(
          `INSERT INTO organization (name, parent_id, jurisdiction, source_note)
           SELECT u.name, u.parent_id, u.jurisdiction, 'Resolved from a sighting payload by the merge.'
             FROM unnest($1::text[], $2::int[], $3::text[]) AS u(name, parent_id, jurisdiction)
           RETURNING id, name`,
          [names, parents, jurisdictions],
        );
        for (const o of made) byName.set(o.name, o.id);
      }

      /* Deepest node wins: the buying office, not the department. */
      const targets: { solId: number; orgId: number }[] = [];
      for (const row of [...inserted, ...orgOnly.map((o) => ({ id: o.solId, external_id: o.external_id }))]) {
        const chain = chains.get(row.external_id);
        if (!chain?.length) continue;
        const orgId = byName.get(chain[chain.length - 1]!);
        if (orgId !== undefined) targets.push({ solId: row.id, orgId });
      }
      for (const l of links) {
        const chain = chains.get(l.external_id);
        if (!chain?.length) continue;
        const orgId = byName.get(chain[chain.length - 1]!);
        if (orgId !== undefined) targets.push({ solId: l.solId, orgId });
      }

      if (targets.length) {
        orgsAttached = await q.run(
          `UPDATE solicitation s SET org_id = u.org_id
             FROM unnest($1::int[], $2::int[]) AS u(sol_id, org_id)
            WHERE s.id = u.sol_id AND s.org_id IS DISTINCT FROM u.org_id`,
          [targets.map((t) => t.solId), targets.map((t) => t.orgId)],
        );
      }
    }

    return { created: inserted.length, updated, linked, orgsAttached };
  });
}
