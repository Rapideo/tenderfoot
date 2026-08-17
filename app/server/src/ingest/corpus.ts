/* SP1 T10-T11. Load the research corpus into the real schema.
 *
 * This is SP1's demo criterion: real solicitations, in the real structure,
 * reachable through the real API. It is NOT an adapter -- adapters are SP3.
 * It is a one-off import of material already collected and already read.
 *
 * Two things it does that a naive import would skip, both deliberate:
 *
 *   1. Every solicitation gets a SIGHTING. The canonical record is produced
 *      by merging sightings (§4.4), and if the first data in the system
 *      bypasses that path, the path is untested when SP3 needs it.
 *
 *   2. Organizations are resolved through an ALIAS table rather than created
 *      per distinct string. The corpus contains a NASPO solicitation issued
 *      by New York State OGS and listed on Indiana's portal -- inside the
 *      first sixty-one records. Creating an Indiana organisation for it
 *      would be wrong in a way nothing downstream could detect.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { one, insert, tx, close, type Querier } from "../db/index.js";
import { KNOWN_ORGS, canonicalName, cleanBuyer, requireUniqueKeys } from "./corpus-rows.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CORPUS = join(ROOT, "corpus");

/* BATCHED, 2026-08-17. This file used to resolve one organisation and insert
 * one solicitation and one sighting per row, each an awaited round trip to a
 * network database. 201 rows x ~4 trips came to roughly 800 sequential trips
 * and ~73 seconds, held inside a single open transaction -- long enough that
 * corpus.test.ts failed intermittently, and once died outright with
 * `Connection terminated unexpectedly` mid-transaction.
 *
 * The waste was worse than "one trip per row". Of those ~800 trips about 400
 * were organisation lookups -- for 79 distinct organisations. The same buyer
 * was re-resolved from scratch on every row that mentioned it.
 *
 * Third instance of the same fix in this repo, and the same shape both
 * previous times: `npm run import` went 12 -> 1,038 rows/sec on one UNNEST,
 * and `npm run merge` went 3m36s -> 4.07s set-based. Row-at-a-time against a
 * remote Postgres is a latency bill, not a throughput one, and the only
 * remedy is to stop making the trips.
 *
 * The pure logic moved to corpus-rows.ts, which is not tidying -- see that
 * file's header. Resolution now happens in JS before any SQL runs, so it
 * decides organisation identity outright where SQL used to. */

/** One corpus row, resolved and ready to insert. */
interface PendingRow {
  org: string; // canonical organisation name
  externalId: string;
  title: string;
  kind: string | null;
  status: string;
  postedAt: string | null;
  closesAt: string | null;
  codes: unknown | null;
  /* Per row, not per load: calibration encodes the enriched/unbiased split
   * here, and that split must survive the import (corpus/calibration/
   * README.md -- no precision figure may EVER be computed from the enriched
   * set, whose base rate is wrong by construction). */
  note: string;
  raw: unknown; // the sighting payload
}

/* Resolve every distinct organisation in one pass: one SELECT for what
 * already exists, one INSERT for what does not, one INSERT for the aliases of
 * anything newly created. Three trips regardless of row count.
 *
 * Takes the transaction's own Querier rather than the module-level pool
 * helpers, for the reason the row-at-a-time version did: an insert issued
 * through the module-level helpers runs on a DIFFERENT pool connection than
 * BEGIN did, so it would sit outside the transaction, and a rollback would
 * leave orphan organisations behind with nothing reporting it. */
async function resolveOrgs(
  q: Querier,
  rawNames: readonly string[],
  note: string,
  defaultJurisdiction: string,
): Promise<Map<string, number>> {
  const names = [...new Set(rawNames.map((n) => canonicalName(n)))];
  const byName = new Map<string, number>();
  if (names.length === 0) return byName;

  /* An organisation is reachable by its own name OR by any of its aliases,
   * exactly as the two sequential lookups did. Both arms are checked in one
   * statement; where both match they agree, because an alias row is only ever
   * written pointing at the organisation of that canonical name. */
  const existing = await q.all<{ key: string; id: number }>(
    `SELECT alias AS key, org_id AS id FROM organization_alias WHERE alias = ANY($1::text[])
     UNION ALL
     SELECT name  AS key, id     FROM organization       WHERE name  = ANY($1::text[])`,
    [names],
  );
  for (const row of existing) byName.set(row.key, row.id);

  const missing = names.filter((n) => !byName.has(n));
  if (missing.length > 0) {
    const created = await q.all<{ id: number; name: string }>(
      `INSERT INTO organization (name, jurisdiction, kind, source_note)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[])
       RETURNING id, name`,
      [
        missing,
        missing.map((n) => KNOWN_ORGS[n]?.jurisdiction ?? defaultJurisdiction),
        missing.map((n) => KNOWN_ORGS[n]?.kind ?? "agency"),
        missing.map(() => note),
      ],
    );
    for (const row of created) byName.set(row.name, row.id);

    /* Aliases are seeded only for organisations created just now, which is
     * what the row-at-a-time version did -- they lived inside the branch that
     * had just inserted. Re-seeding on every run would be harmless given the
     * ON CONFLICT, but it would also be a different behaviour. */
    const aliasOrgIds: number[] = [];
    const aliasNames: string[] = [];
    for (const name of missing) {
      for (const alias of KNOWN_ORGS[name]?.aliases ?? []) {
        aliasOrgIds.push(byName.get(name)!);
        aliasNames.push(alias);
      }
    }
    if (aliasNames.length > 0) {
      await q.run(
        `INSERT INTO organization_alias (org_id, alias, source_note)
         SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[])
         ON CONFLICT DO NOTHING`,
        [aliasOrgIds, aliasNames, aliasNames.map(() => "Seeded from the corpus import.")],
      );
    }
  }
  return byName;
}

/* Insert every solicitation and every sighting in two statements.
 *
 * The sightings need each solicitation's generated id, which is why this
 * cannot be one statement without depending on RETURNING preserving input
 * order -- true in practice for a single INSERT ... SELECT, but not a
 * guarantee Postgres makes, and a wrong assumption here would link sightings
 * to the wrong solicitations SILENTLY. Correlating by external_id instead
 * rests on a property that IS checkable, and requireUniqueKeys checks it. */
async function insertRows(
  q: Querier,
  srcId: number,
  seenAt: string,
  rows: readonly PendingRow[],
  orgs: Map<string, number>,
): Promise<number> {
  if (rows.length === 0) return 0;
  requireUniqueKeys(
    rows.map((r) => r.externalId),
    "corpus solicitation batch",
  );

  const inserted = await q.all<{ id: number; external_id: string }>(
    `INSERT INTO solicitation (org_id, external_id, title, kind, status, posted_at,
                               closes_at, codes, source_note)
     SELECT org_id, external_id, title, kind, status, posted_at, closes_at,
            codes::jsonb, source_note
       FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[], $5::text[],
                   $6::text[], $7::text[], $8::text[], $9::text[])
         AS t(org_id, external_id, title, kind, status, posted_at, closes_at,
              codes, source_note)
     RETURNING id, external_id`,
    [
      rows.map((r) => orgs.get(r.org)!),
      rows.map((r) => r.externalId),
      rows.map((r) => r.title),
      rows.map((r) => r.kind),
      rows.map((r) => r.status),
      rows.map((r) => r.postedAt),
      rows.map((r) => r.closesAt),
      rows.map((r) => (r.codes === null ? null : JSON.stringify(r.codes))),
      rows.map((r) => r.note),
    ],
  );

  const idByExternal = new Map(inserted.map((r) => [r.external_id, r.id]));
  /* Belt and braces on the correlation above: the guard proves the INPUT had
   * no repeats, this proves the database handed back one row per input row. A
   * mismatch means an assumption about RETURNING is wrong, and the sightings
   * below would be attached to whatever survived. */
  if (idByExternal.size !== rows.length) {
    throw new Error(
      `corpus import: inserted ${rows.length} solicitations but RETURNING mapped ` +
        `${idByExternal.size} distinct external_ids. Refusing to attach sightings.`,
    );
  }

  await q.run(
    `INSERT INTO sighting (source_id, solicitation_id, external_id, seen_at, raw)
     SELECT $1, t.solicitation_id, t.external_id, $2::timestamptz, t.raw::jsonb
       FROM UNNEST($3::int[], $4::text[], $5::text[])
         AS t(solicitation_id, external_id, raw)`,
    [
      srcId,
      seenAt,
      rows.map((r) => idByExternal.get(r.externalId)!),
      rows.map((r) => r.externalId),
      rows.map((r) => JSON.stringify(r.raw)),
    ],
  );
  return rows.length;
}

/* Not called from inside a transaction (loadCorpus resolves both sources
 * before either loadIndiana or loadCalibration opens its own), so the
 * module-level pool helpers are safe here -- unlike upsertOrg above. */
async function sourceId(name: string): Promise<number> {
  const row = await one<{ id: number }>("SELECT id FROM source WHERE name = $1", [name]);
  if (row) return row.id;
  return insert(
    `INSERT INTO source (name, jurisdiction, platform, adapter_tier, legal_posture,
                         legal_note, archive_depth, enabled, source_note)
     VALUES ($1, 'US', 'Manual import', '4 manual', 'in', $2, $3, false, $4) RETURNING id`,
    [
      name,
      "Material already collected and read during research. No live access involved.",
      "Fixed -- a snapshot, not a feed.",
      "Not an adapter. SP1 uses it so the sighting path is exercised by the first data in the system.",
    ],
  );
}

/** Indiana open solicitations, parsed out of the manifest table. */
async function loadIndiana(srcId: number): Promise<number> {
  const md = readFileSync(join(CORPUS, "manifest.md"), "utf8");
  /* The external id is NOT always numeric. Row 1 is "*(NASPO)*" -- a
   * cooperative award with no Indiana event number -- and a \d{6,} pattern
   * drops precisely the row that proves the buyer is not the host
   * jurisdiction. Found by SP1's own verification. */
  const rows = [...md.matchAll(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\d{1,2}\/\d{1,2})\s*\|/gm)];

  const NOTE = "corpus/manifest.md, fetched 2026-08-04";
  /* Parsed and resolved entirely before the transaction opens. Nothing here
   * touches the database, so the transaction below stays open for three
   * statements rather than the length of the file. */
  const pending: PendingRow[] = rows.map((m) => {
    const [, , rawExtId, rawTitle, buyer, due] = m;
    const title = rawTitle!.replace(/\*\*/g, "").trim();
    /* The manifest carries MM/DD with the year implied by collection. */
    const [mm, dd] = due!.split("/");
    return {
      org: canonicalName(cleanBuyer(buyer!)),
      externalId: rawExtId!.replace(/[*()]/g, "").trim(),
      title,
      kind: "RFP",
      status: "open",
      postedAt: null,
      closesAt: `2026-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`,
      codes: null,
      note: NOTE,
      /* The sighting keeps the RAW buyer and due strings and the CLEANED
       * title, exactly as the row-at-a-time version stored them. */
      raw: { buyer, due, title },
    };
  });

  /* tx() hands the callback a client-bound Querier so every statement below
   * commits on that same connection or none of them do. */
  return tx(async (q) => {
    const orgs = await resolveOrgs(
      q,
      pending.map((r) => r.org),
      NOTE,
      "IN",
    );
    return insertRows(q, srcId, "2026-08-04", pending, orgs);
  });
}

/** Closed federal solicitations used for calibration. */
async function loadCalibration(srcId: number): Promise<number> {
  const raw = JSON.parse(readFileSync(join(CORPUS, "calibration", "rows.json"), "utf8"));
  const rows: any[] = Array.isArray(raw) ? raw : raw.rows;

  const NOTE = "corpus/calibration/rows.json, fetched 2026-08-10";
  const pending: PendingRow[] = rows.map((r) => ({
    org: canonicalName(cleanBuyer(String(r.agency ?? "Unknown federal agency").split(" / ")[0]!)),
    /* Cast rather than passed through: these arrive as numbers in the JSON and
     * the batched insert binds a text[]. The row-at-a-time version let pg
     * coerce each one individually. */
    externalId: String(r.sol ?? r.id),
    title: r.title,
    kind: r.type ?? null,
    status: "closed",
    postedAt: r.pub ?? null,
    closesAt: r.resp ?? null,
    codes: { naics: r.naics ?? [], psc: r.psc_codes ?? [] },
    note: `corpus/calibration -- set=${r.set}`,
    raw: r,
  }));

  return tx(async (q) => {
    const orgs = await resolveOrgs(
      q,
      pending.map((r) => r.org),
      NOTE,
      /* The calibration corpus is entirely federal. Defaulting these to IN
       * mislabelled every one of them. */
      "US",
    );
    return insertRows(q, srcId, "2026-08-10", pending, orgs);
  });
}

export async function loadCorpus(verbose = true): Promise<{ indiana: number; calibration: number }> {
  const already = await one<{ n: number }>("SELECT count(*) AS n FROM solicitation");
  if (already!.n > 0) {
    if (verbose) console.log(`${already!.n} solicitations already loaded; nothing to do.`);
    return { indiana: 0, calibration: 0 };
  }
  const live = await sourceId("Corpus import — Indiana open (2026-08-04)");
  const cal = await sourceId("Corpus import — federal calibration (2026-08-10)");
  const indiana = await loadIndiana(live);
  const calibration = await loadCalibration(cal);
  if (verbose) console.log(`loaded ${indiana} Indiana, ${calibration} calibration`);
  return { indiana, calibration };
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  await loadCorpus();
  await close();
}
