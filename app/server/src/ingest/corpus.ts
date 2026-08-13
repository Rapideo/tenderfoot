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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CORPUS = join(ROOT, "corpus");

/* Buyers whose name in the source data does not identify the jurisdiction
 * that actually buys. Kept explicit and small -- this is a seed for entity
 * resolution, not a substitute for it (§4.2, still unaddressed as a
 * mechanism). */
const KNOWN_ORGS: Record<string, { jurisdiction: string; kind: string; aliases: string[] }> = {
  "New York State Office of General Services": {
    jurisdiction: "NY",
    kind: "agency",
    aliases: ["NY OGS", "New York State OGS", "NYS OGS", "NY OGS (co-op)"],
  },
  "FSSA Medicaid Policy & Planning": {
    jurisdiction: "IN",
    kind: "agency",
    aliases: ["FSSA", "Indiana Family and Social Services Administration", "IN-FSSA"],
  },
};

/* Buyer strings in the manifest carry markdown and qualifiers:
 * "**NY OGS** (co-op)". Normalise before resolving, or the alias never
 * matches and a second organisation is created for the same buyer. */
function cleanBuyer(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

/* Reverse index: every alias points at its canonical name. Without this the
 * KNOWN_ORGS lookup only matches when the source already used the canonical
 * spelling -- which is exactly when you do not need it. "NY OGS" resolved to
 * a new Indiana organisation until this existed. */
const CANONICAL = new Map<string, string>();
for (const [canon, def] of Object.entries(KNOWN_ORGS)) {
  CANONICAL.set(canon, canon);
  for (const a of def.aliases) CANONICAL.set(a, canon);
}

/* Called from INSIDE both transaction loops below, and so takes the
 * transaction's own Querier rather than the module-level pool helpers.
 * better-sqlite3's db.transaction(fn)() ran on one connection by
 * construction and could not have got this wrong; a pool can, because an
 * insert issued through the module-level helpers runs on a DIFFERENT pool
 * connection than BEGIN did -- outside the transaction. A rollback would
 * then leave orphan organisations behind, and nothing anywhere would report
 * it. */
async function upsertOrg(
  q: Querier,
  raw: string,
  note: string,
  defaultJurisdiction: string,
): Promise<number> {
  const name = CANONICAL.get(raw) ?? raw;
  const viaAlias = await q.one<{ org_id: number }>(
    "SELECT org_id FROM organization_alias WHERE alias = $1",
    [name],
  );
  if (viaAlias) return viaAlias.org_id;

  const existing = await q.one<{ id: number }>("SELECT id FROM organization WHERE name = $1", [name]);
  if (existing) return existing.id;

  const known = KNOWN_ORGS[name];
  const id = await q.insert(
    "INSERT INTO organization (name, jurisdiction, kind, source_note) VALUES ($1, $2, $3, $4) RETURNING id",
    [name, known?.jurisdiction ?? defaultJurisdiction, known?.kind ?? "agency", note],
  );

  for (const alias of known?.aliases ?? []) {
    await q.run(
      "INSERT INTO organization_alias (org_id, alias, source_note) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [id, alias, "Seeded from the corpus import."],
    );
  }
  return id;
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

  let n = 0;
  /* The loop body awaits INSIDE the transaction callback, which the
   * synchronous db.transaction(() => {...})() version could not have got
   * wrong -- there was only ever one connection. tx() hands the callback a
   * client-bound Querier so every insert below (including the ones inside
   * upsertOrg) commits on that same connection or none of them do. */
  await tx(async (q) => {
    for (const m of rows) {
      const [, , rawExtId, rawTitle, buyer, due] = m;
      const extId = rawExtId!.replace(/[*()]/g, "").trim();
      const title = rawTitle!.replace(/\*\*/g, "").trim();
      /* The manifest carries MM/DD with the year implied by collection. */
      const [mm, dd] = due!.split("/");
      const closes = `2026-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;

      const orgId = await upsertOrg(q, cleanBuyer(buyer!), "corpus/manifest.md, fetched 2026-08-04", "IN");
      const solId = await q.insert(
        `INSERT INTO solicitation (org_id, external_id, title, kind, status, closes_at, source_note)
         VALUES ($1, $2, $3, 'RFP', 'open', $4, $5) RETURNING id`,
        [orgId, extId, title, closes, "corpus/manifest.md, fetched 2026-08-04"],
      );
      await q.run(
        `INSERT INTO sighting (source_id, solicitation_id, external_id, seen_at, raw)
         VALUES ($1, $2, $3, '2026-08-04', $4)`,
        [srcId, solId, extId, JSON.stringify({ buyer, due, title })],
      );
      n++;
    }
  });
  return n;
}

/** Closed federal solicitations used for calibration. */
async function loadCalibration(srcId: number): Promise<number> {
  const raw = JSON.parse(readFileSync(join(CORPUS, "calibration", "rows.json"), "utf8"));
  const rows: any[] = Array.isArray(raw) ? raw : raw.rows;

  let n = 0;
  await tx(async (q) => {
    for (const r of rows) {
      const orgId = await upsertOrg(
        q,
        cleanBuyer(String(r.agency ?? "Unknown federal agency").split(" / ")[0]!),
        "corpus/calibration/rows.json, fetched 2026-08-10",
        /* The calibration corpus is entirely federal. Defaulting these to IN
         * mislabelled every one of them. */
        "US",
      );
      const solId = await q.insert(
        `INSERT INTO solicitation (org_id, external_id, title, kind, status, posted_at, closes_at,
                                   codes, source_note)
         VALUES ($1, $2, $3, $4, 'closed', $5, $6, $7, $8) RETURNING id`,
        [
          orgId,
          r.sol ?? r.id,
          r.title,
          r.type ?? null,
          r.pub ?? null,
          r.resp ?? null,
          JSON.stringify({ naics: r.naics ?? [], psc: r.psc_codes ?? [] }),
          /* The enriched/unbiased split is load-bearing and must survive the
           * import: no precision figure may ever be computed from the enriched
           * set, whose base rate is wrong by construction. */
          `corpus/calibration -- set=${r.set}`,
        ],
      );
      await q.run(
        `INSERT INTO sighting (source_id, solicitation_id, external_id, seen_at, raw)
         VALUES ($1, $2, $3, '2026-08-10', $4)`,
        [srcId, solId, r.sol ?? r.id, JSON.stringify(r)],
      );
      n++;
    }
  });
  return n;
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
