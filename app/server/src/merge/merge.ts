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
import { closesAt } from "./closes-at.js";
import { postedAt, type PostedAt } from "./posted-at.js";
import { description } from "./description.js";
import { noticeKind, listingCodes, setAside } from "./listing-facts.js";
import { title as resolveTitle } from "./title.js";

export interface MergeResult {
  created: number;
  updated: number;
  linked: number;
  /** Solicitations that gained an `org_id` on this run, including ones
   * merged earlier while nothing read the organisation out of the payload. */
  orgsAttached: number;
  /** Solicitations whose `closes_at` was written or corrected on this run,
   * including ones merged earlier while nothing read the deadline out of the
   * payload -- which, before closes-at.ts existed, was every one of them. */
  deadlinesSet: number;
  /** Solicitations whose `posted_at` was written or corrected on this run.
   * Same shape and same history as `deadlinesSet`: before posted-at.ts, this
   * was every live-ingested row, because merge never wrote the column at
   * all -- and volume per source per week, half of what Plan of Action §6
   * requires the gate to produce, was uncomputable as a result. */
  postedSet: number;
  /** Solicitations whose `description` was written or corrected on this run.
   * Reported separately because it is the field a HUMAN reads to decide -- if
   * this number is 0 on a run that created rows, the triage card is back to a
   * title and two dates and the gate cannot be run against it. */
  descriptionsSet: number;
  /* The three listing facts (listing-facts.ts). Reported separately rather
   * than folded into one number because they have different availability in
   * the payload -- kind 100%, codes ~98%, set_aside 56% of SAM rows -- so a
   * single total would hide which of the three had stopped arriving. */
  kindsSet: number;
  codesSet: number;
  setAsidesSet: number;
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
   * quietly changing what a title is. The lookup itself now lives in
   * title.ts, extracted after IDOA proved it was source-specific (SAM's
   * `title` at top level is not IDOA's `eventName`) -- but it is still
   * called from JS below, not inlined as a JSON path here. */
  const inserts: {
    external_id: string;
    title: string;
    source_id: number;
    closes_at: string | null;
    posted_at: string | null;
    posted_at_origin: string | null;
    kind: string | null;
    codes: string | null;
    set_aside: string | null;
  }[] = [];
  /* Keyed by solicitation id so a later group wins, exactly as sequential
   * UPDATEs did. Two distinct external_ids CAN resolve to one solicitation
   * -- a sighting linked via a different external_id -- and `UPDATE ... FROM
   * unnest` would otherwise pick among duplicate keys arbitrarily, turning
   * "last wins" into "whichever the planner reached first". */
  const titleUpdates = new Map<number, string>();
  /* Keyed the same way and for the same reason as titleUpdates above: a
   * later group wins, deterministically, rather than the planner choosing
   * among duplicate keys. */
  const deadlineUpdates = new Map<number, string>();
  /* Value carries the origin alongside the date rather than a second parallel
   * map, so the two can never desynchronise -- a date without a matching
   * origin is exactly the state migration 016's CHECK constraint exists to
   * make impossible, and two independently-keyed maps could drift into it. */
  const postedUpdates = new Map<number, PostedAt>();
  const descriptionUpdates = new Map<number, string>();
  /* The three listing facts (listing-facts.ts). Keyed and guarded exactly as
   * the two above: a null never enters the map, so a source that states none
   * of them can never clobber a populated column. */
  const kindUpdates = new Map<number, string>();
  const codesUpdates = new Map<number, string>();
  const setAsideUpdates = new Map<number, string>();
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
    const src = sourceById.get(g.latest_source_id);
    const title = resolveTitle(src?.name ?? "", raw);
    const chain = orgChain(src?.name ?? "", raw);
    for (const name of chain) {
      if (!jurisdictionByName.has(name)) jurisdictionByName.set(name, src?.jurisdiction ?? null);
    }

    /* THE DEADLINE IS ITS OWN REASON TO DO WORK, exactly as a missing
     * organisation is below. Collected for EVERY group that already has a
     * solicitation -- not only those with unlinked sightings -- because the
     * rows that need it most are the ones merged before closes-at.ts
     * existed, and those have nothing unlinked and an organisation already
     * attached, so every branch below skips them. Measured at the time this
     * landed: 9,682 of 9,682 SAM.gov solicitations had a null closes_at
     * while their stored payloads carried the date all along.
     *
     * A null result never enters the map, so a source with no deadline to
     * read (USASpending) and corpus imports (which set closes_at at ingest
     * and would be clobbered by a null) are both left untouched. */
    const closes = closesAt(src?.name ?? "", raw);
    if (g.solicitation_id !== null && closes !== null) {
      deadlineUpdates.set(g.solicitation_id, closes);
    }

    /* THE POSTING DATE, for exactly the reasons the deadline above is
     * collected -- and the rows that need it are, again, the ones merged
     * before this existed: every branch below skips a group that has an
     * organisation and nothing unlinked. Measured when this landed: 1,724 of
     * 1,724 SAM.gov solicitations had a null posted_at while their stored
     * payloads carried the date all along. Volume per source per week, half
     * of what Plan of Action §6 requires this gate to produce, could not be
     * computed for a single live-ingested row. */
    const posted = postedAt(src?.name ?? "", raw);
    if (g.solicitation_id !== null && posted !== null) {
      postedUpdates.set(g.solicitation_id, posted);
    }

    /* THE POSTING'S OWN WORDS -- the fourth instance of this same defect, and
     * the one that stopped the gate rather than degrading it.
     *
     * Found 2026-09-02 by Matt trying to triage sample 1: a card carrying a
     * title, a buyer and two dates asks a person to judge "would KP pursue
     * this" from the title alone. Measured the same day: 298 of 300 sampled
     * SAM.gov sightings (99.3%) carried `descriptions[0].content`, median 511
     * characters, and `solicitation` had no column to put it in.
     *
     * Same null-skips-the-map shape as the three above, so USASpending and the
     * corpus imports are untouched. See description.ts and migration 015. */
    const desc = description(src?.name ?? "", raw);
    if (g.solicitation_id !== null && desc !== null) {
      descriptionUpdates.set(g.solicitation_id, desc);
    }

    /* THE THIRD INSTANCE of the closes_at / posted_at defect, and the largest:
     * five columns null on 1,724 of 1,724 SAM.gov rows while the payload that
     * fills three of them sat unread in `sighting.raw`. Collected for every
     * group with a solicitation, for the same reason the two above are -- the
     * rows that need this most were merged before this file existed, so they
     * have an organisation and nothing unlinked and every branch below skips
     * them. See listing-facts.ts for why `status` and `value_cents` are
     * deliberately still not written. */
    const kind = noticeKind(src?.name ?? "", raw);
    if (g.solicitation_id !== null && kind !== null) {
      kindUpdates.set(g.solicitation_id, kind);
    }
    const codes = listingCodes(src?.name ?? "", raw);
    if (g.solicitation_id !== null && codes !== null) {
      codesUpdates.set(g.solicitation_id, JSON.stringify(codes));
    }
    const setaside = setAside(src?.name ?? "", raw);
    if (g.solicitation_id !== null && setaside !== null) {
      setAsideUpdates.set(g.solicitation_id, setaside);
    }

    if (g.solicitation_id === null) {
      /* Migration 010: the solicitation records the source whose payload it
       * reflects, and `latest_source_id` IS that source -- the same one `raw`
       * and therefore `title` above were read from. Passing anything else
       * here would make the column disagree with the row it describes. */
      inserts.push({
        external_id: g.external_id,
        title,
        source_id: g.latest_source_id,
        kind,
        codes: codes === null ? null : JSON.stringify(codes),
        set_aside: setaside,
        closes_at: closes,
        posted_at: posted?.date ?? null,
        posted_at_origin: posted?.origin ?? null,
      });
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
          /* `codes` is jsonb, so its unnest column is text[] and cast per
           * row -- a text[] of JSON strings is the only shape unnest can
           * carry, and ::jsonb on the SELECT side is where it becomes the
           * column's real type. */
          `INSERT INTO solicitation
             (external_id, title, source_id, closes_at, posted_at, posted_at_origin, kind, codes, set_aside)
           SELECT u.external_id, u.title, u.source_id, u.closes_at, u.posted_at, u.posted_at_origin,
                  u.kind, u.codes::jsonb, u.set_aside
             FROM unnest($1::text[], $2::text[], $3::int[], $4::text[], $5::text[],
                         $6::text[], $7::text[], $8::text[], $9::text[])
               AS u(external_id, title, source_id, closes_at, posted_at, posted_at_origin, kind, codes, set_aside)
           RETURNING id, external_id`,
          [
            inserts.map((i) => i.external_id),
            inserts.map((i) => i.title),
            inserts.map((i) => i.source_id),
            inserts.map((i) => i.closes_at),
            inserts.map((i) => i.posted_at),
            inserts.map((i) => i.posted_at_origin),
            inserts.map((i) => i.kind),
            inserts.map((i) => i.codes),
            inserts.map((i) => i.set_aside),
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

    /* IS DISTINCT FROM, not <>, because the column being null is the whole
     * case this repairs -- `<>` against NULL yields NULL and WHERE reads
     * that as false, so a `<>` guard here would update precisely nothing and
     * look like it worked. That is the same NULL-comparison trap that hid an
     * empty candidate list in extract/discover.ts. The guard still makes a
     * steady-state run free: nothing is written when the payload agrees with
     * the column. */
    const deadlinesSet = deadlineUpdates.size
      ? await q.run(
          `UPDATE solicitation s SET closes_at = u.closes_at
             FROM unnest($1::int[], $2::text[]) AS u(id, closes_at)
            WHERE s.id = u.id AND s.closes_at IS DISTINCT FROM u.closes_at`,
          [[...deadlineUpdates.keys()], [...deadlineUpdates.values()]],
        )
      : 0;

    /* Same guard as the deadline above: nothing is written when the payload
     * already agrees with the column, so a steady-state re-run is free.
     * `posted_at_origin` is written in the SAME statement as `posted_at` --
     * never a date without the provenance that migration 016's CHECK
     * constraint requires travel with it. */
    const postedSet = postedUpdates.size
      ? await q.run(
          `UPDATE solicitation s SET posted_at = u.posted_at, posted_at_origin = u.origin
             FROM unnest($1::int[], $2::text[], $3::text[]) AS u(id, posted_at, origin)
            WHERE s.id = u.id AND s.posted_at IS DISTINCT FROM u.posted_at`,
          [
            [...postedUpdates.keys()],
            [...postedUpdates.values()].map((p) => p.date),
            [...postedUpdates.values()].map((p) => p.origin),
          ],
        )
      : 0;

    /* Same IS DISTINCT FROM guard as every sibling above, and for the same
     * reason: the column being NULL is the entire case this repairs, and `<>`
     * against NULL yields NULL, which WHERE reads as false -- a `<>` guard
     * would update nothing and look like it worked. A steady-state re-run
     * writes nothing. */
    const descriptionsSet = descriptionUpdates.size
      ? await q.run(
          `UPDATE solicitation s SET description = u.description
             FROM unnest($1::int[], $2::text[]) AS u(id, description)
            WHERE s.id = u.id AND s.description IS DISTINCT FROM u.description`,
          [[...descriptionUpdates.keys()], [...descriptionUpdates.values()]],
        )
      : 0;

    /* The three listing facts. Same IS DISTINCT FROM guard as the two above,
     * and for the same reason: the column being NULL is the entire case this
     * repairs, and `<>` against NULL yields NULL, which WHERE reads as false
     * -- a `<>` guard here would update nothing and look like it worked. */
    const kindsSet = kindUpdates.size
      ? await q.run(
          `UPDATE solicitation s SET kind = u.kind
             FROM unnest($1::int[], $2::text[]) AS u(id, kind)
            WHERE s.id = u.id AND s.kind IS DISTINCT FROM u.kind`,
          [[...kindUpdates.keys()], [...kindUpdates.values()]],
        )
      : 0;

    const codesSet = codesUpdates.size
      ? await q.run(
          `UPDATE solicitation s SET codes = u.codes::jsonb
             FROM unnest($1::int[], $2::text[]) AS u(id, codes)
            WHERE s.id = u.id AND s.codes IS DISTINCT FROM u.codes::jsonb`,
          [[...codesUpdates.keys()], [...codesUpdates.values()]],
        )
      : 0;

    const setAsidesSet = setAsideUpdates.size
      ? await q.run(
          `UPDATE solicitation s SET set_aside = u.set_aside
             FROM unnest($1::int[], $2::text[]) AS u(id, set_aside)
            WHERE s.id = u.id AND s.set_aside IS DISTINCT FROM u.set_aside`,
          [[...setAsideUpdates.keys()], [...setAsideUpdates.values()]],
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

    return {
      created: inserted.length, updated, linked, orgsAttached,
      deadlinesSet, postedSet, descriptionsSet, kindsSet, codesSet, setAsidesSet,
    };
  });
}
