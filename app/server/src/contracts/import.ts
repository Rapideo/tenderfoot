/* Rows into `contract`. Direct, and deliberately so.
 *
 * Design spec §2: contracts do NOT go through sighting/merge. That pipeline
 * answers whether two sources saw the same thing and which observation is
 * newest, and neither applies to a single-source archive where each amendment
 * is its own record. Routing through it would mean making `sighting`
 * polymorphic to gain machinery that does nothing.
 *
 * 🔴 AND IT IS WHAT MAKES THE QUEUE SAFE STRUCTURALLY. Nothing in this file
 * touches solicitation, sighting or pursuit, so a contract cannot reach triage
 * by ANY code path -- a stronger guarantee than remembering to exclude them.
 * There is a test asserting exactly that. */
import { tx, type Querier } from "../db/index.js";
import type { EdsRow } from "./eds-client.js";

export interface ImportResult {
  written: number;
  /** Rows already present under the natural key. A re-run is all skips. */
  skipped: number;
}

/* The source ships "2006-05-01T00:00:00.0000000" -- seven fractional digits,
 * which Date.parse handles but the column does not need. starts_at/ends_at are
 * `text` holding ISO dates elsewhere in this schema, so match that. */
const day = (v: unknown): string | null => {
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/* Dollars in, CENTS stored. The column name says cents; the source says
 * dollars. Math.round rather than truncation because a source that ever ships
 * 1234.56 should not silently lose the change. */
const cents = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

/* Ruling 4 (binding, 2026-09-03): the whole register arrives as ONE fetch of
 * 204,991 rows. A single unnest insert over all of them would bind eight
 * arrays of that length -- roughly 50 MB of parameters in one statement.
 * Chunking keeps each round trip small and keeps the whole run inside one
 * transaction, which is what makes the import atomic: a failure partway
 * through rolls back everything written so far rather than leaving the table
 * half-loaded. */
const CHUNK_SIZE = 5_000;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size) as T[]);
  return out;
}

/* Ruling 1 (binding, 2026-09-03): `organization.name` carries NO unique
 * constraint -- the only UNIQUE in migration 002 is
 * `organization_alias (alias, org_id)` -- so `ON CONFLICT (name)` is not a
 * legal conflict target and the statement fails at runtime. Resolved the way
 * merge.ts already does it (merge/merge.ts:610): read what exists by name,
 * then insert only the names that are missing.
 *
 * Ruling 2 (binding, 2026-09-03): no `orgChain` here. The EDS payload
 * publishes a flat `agencyName` with no hierarchy to walk, so the name is
 * inserted directly and org-chain resolution is left for a source that
 * actually has a chain. */
async function resolveOrgIds(q: Querier, names: readonly string[]): Promise<Map<string, number>> {
  const byName = new Map<string, number>();
  if (!names.length) return byName;

  const existing = await q.all<{ id: number; name: string }>(
    `SELECT id, name FROM organization WHERE name = ANY($1::text[])`,
    [names],
  );
  for (const o of existing) byName.set(o.name, o.id);

  const missing = names.filter((n) => !byName.has(n));
  if (missing.length) {
    const made = await q.all<{ id: number; name: string }>(
      `INSERT INTO organization (name, source_note)
       SELECT u.name, 'Resolved from an Indiana EDS contract row.'
         FROM unnest($1::text[]) AS u(name)
       RETURNING id, name`,
      [missing],
    );
    for (const o of made) byName.set(o.name, o.id);
  }
  return byName;
}

export async function importContracts(
  sourceId: number,
  rows: EdsRow[],
): Promise<ImportResult> {
  if (!rows.length) return { written: 0, skipped: 0 };

  return tx(async (q) => {
    /* Organisations first, one round trip across the WHOLE set, so every
     * chunk of the insert below can reference them. Measured 2026-09-03: 698
     * distinct agency names across 204,991 rows -- small enough that this
     * does not need chunking even though the insert below does. */
    const agencies = [...new Set(rows.map((r) => String(r.agencyName ?? "")).filter(Boolean))];
    const orgIds = await resolveOrgIds(q, agencies);

    let written = 0;
    let skipped = 0;

    for (const part of chunk(rows, CHUNK_SIZE)) {
      /* ON CONFLICT DO NOTHING against the natural key is what makes a re-run
       * idempotent. `written` counts what the statement actually inserted, so
       * a second run reports 0 written and every row skipped -- which is the
       * assertion the idempotency test makes. */
      const inserted = await q.all<{ id: number }>(
        `INSERT INTO contract
           (source_id, external_id, amendment, action_type, amount_cents,
            starts_at, ends_at, org_id, source_note)
         SELECT $1::int, u.external_id, u.amendment::int, u.action_type,
                u.amount_cents::bigint, u.starts_at, u.ends_at, u.org_id::int, u.vendor
           FROM unnest($2::text[], $3::int[], $4::text[], $5::bigint[],
                       $6::text[], $7::text[], $8::int[], $9::text[])
             AS u(external_id, amendment, action_type, amount_cents,
                  starts_at, ends_at, org_id, vendor)
         ON CONFLICT (source_id, external_id, amendment)
           WHERE source_id IS NOT NULL AND external_id IS NOT NULL AND amendment IS NOT NULL
           DO NOTHING
         RETURNING id`,
        [
          sourceId,
          part.map((r) => String(r.id)),
          part.map((r) => Number(r.amendment ?? 0)),
          part.map((r) => (r.actionType ? String(r.actionType) : null)),
          part.map((r) => cents(r.amount)),
          part.map((r) => day(r.startDate)),
          part.map((r) => day(r.endDate)),
          part.map((r) => orgIds.get(String(r.agencyName ?? "")) ?? null),
          /* v1 lands the raw vendor name. Vendor resolution -- vendor_alias
           * knowing TIMOTHY WARRICK and Timothy Warrick, Inc. are one -- is
           * its own slice, and a corpus with un-normalised vendors is useful
           * where a corpus that does not exist is not. */
          part.map((r) => (r.vendorName ? `vendorName: ${r.vendorName}` : null)),
        ],
      );

      written += inserted.length;
      skipped += part.length - inserted.length;
    }

    /* value_cents is NOT written. Ruled 2026-09-03: `amount` is a
     * per-amendment delta, and value_cents will one day hold PUBLISHED
     * figures from HigherGov's /sl-contract/. */
    return { written, skipped };
  });
}
