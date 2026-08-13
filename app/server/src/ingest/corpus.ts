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
import { db } from "../db/index.js";

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

function upsertOrg(raw: string, note: string, defaultJurisdiction: string): number {
  const name = CANONICAL.get(raw) ?? raw;
  const viaAlias = db
    .prepare("SELECT org_id FROM organization_alias WHERE alias = ?")
    .get(name) as { org_id: number } | undefined;
  if (viaAlias) return viaAlias.org_id;

  const existing = db.prepare("SELECT id FROM organization WHERE name = ?").get(name) as
    | { id: number }
    | undefined;
  if (existing) return existing.id;

  const known = KNOWN_ORGS[name];
  const info = db
    .prepare("INSERT INTO organization (name, jurisdiction, kind, source_note) VALUES (?, ?, ?, ?)")
    .run(name, known?.jurisdiction ?? defaultJurisdiction, known?.kind ?? "agency", note);
  const id = Number(info.lastInsertRowid);

  for (const alias of known?.aliases ?? []) {
    db.prepare(
      "INSERT OR IGNORE INTO organization_alias (org_id, alias, source_note) VALUES (?, ?, ?)",
    ).run(id, alias, "Seeded from the corpus import.");
  }
  return id;
}

function sourceId(name: string): number {
  const row = db.prepare("SELECT id FROM source WHERE name = ?").get(name) as
    | { id: number }
    | undefined;
  if (row) return row.id;
  const info = db
    .prepare(
      `INSERT INTO source (name, jurisdiction, platform, adapter_tier, legal_posture,
                           legal_note, archive_depth, enabled, source_note)
       VALUES (?, 'US', 'Manual import', '4 manual', 'in', ?, ?, 0, ?)`,
    )
    .run(
      name,
      "Material already collected and read during research. No live access involved.",
      "Fixed -- a snapshot, not a feed.",
      "Not an adapter. SP1 uses it so the sighting path is exercised by the first data in the system.",
    );
  return Number(info.lastInsertRowid);
}

/** Indiana open solicitations, parsed out of the manifest table. */
function loadIndiana(srcId: number): number {
  const md = readFileSync(join(CORPUS, "manifest.md"), "utf8");
  /* The external id is NOT always numeric. Row 1 is "*(NASPO)*" -- a
   * cooperative award with no Indiana event number -- and a \d{6,} pattern
   * drops precisely the row that proves the buyer is not the host
   * jurisdiction. Found by SP1's own verification. */
  const rows = [...md.matchAll(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\d{1,2}\/\d{1,2})\s*\|/gm)];

  const insSol = db.prepare(
    `INSERT INTO solicitation (org_id, external_id, title, kind, status, closes_at, source_note)
     VALUES (?, ?, ?, 'RFP', 'open', ?, ?)`,
  );
  const insSight = db.prepare(
    `INSERT INTO sighting (source_id, solicitation_id, external_id, seen_at, raw)
     VALUES (?, ?, ?, '2026-08-04', ?)`,
  );

  let n = 0;
  const run = db.transaction(() => {
    for (const m of rows) {
      const [, , rawExtId, rawTitle, buyer, due] = m;
      const extId = rawExtId!.replace(/[*()]/g, "").trim();
      const title = rawTitle!.replace(/\*\*/g, "").trim();
      /* The manifest carries MM/DD with the year implied by collection. */
      const [mm, dd] = due!.split("/");
      const closes = `2026-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;

      const orgId = upsertOrg(cleanBuyer(buyer!), "corpus/manifest.md, fetched 2026-08-04", "IN");
      const sol = insSol.run(orgId, extId, title, closes, "corpus/manifest.md, fetched 2026-08-04");
      insSight.run(srcId, sol.lastInsertRowid, extId, JSON.stringify({ buyer, due, title }));
      n++;
    }
  });
  run();
  return n;
}

/** Closed federal solicitations used for calibration. */
function loadCalibration(srcId: number): number {
  const raw = JSON.parse(readFileSync(join(CORPUS, "calibration", "rows.json"), "utf8"));
  const rows: any[] = Array.isArray(raw) ? raw : raw.rows;

  const insSol = db.prepare(
    `INSERT INTO solicitation (org_id, external_id, title, kind, status, posted_at, closes_at,
                               codes, source_note)
     VALUES (?, ?, ?, ?, 'closed', ?, ?, ?, ?)`,
  );
  const insSight = db.prepare(
    `INSERT INTO sighting (source_id, solicitation_id, external_id, seen_at, raw)
     VALUES (?, ?, ?, '2026-08-10', ?)`,
  );

  let n = 0;
  const run = db.transaction(() => {
    for (const r of rows) {
      const orgId = upsertOrg(
        cleanBuyer(String(r.agency ?? "Unknown federal agency").split(" / ")[0]!),
        "corpus/calibration/rows.json, fetched 2026-08-10",
        /* The calibration corpus is entirely federal. Defaulting these to IN
         * mislabelled every one of them. */
        "US",
      );
      const sol = insSol.run(
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
      );
      insSight.run(srcId, sol.lastInsertRowid, r.sol ?? r.id, JSON.stringify(r));
      n++;
    }
  });
  run();
  return n;
}

export function loadCorpus(verbose = true): { indiana: number; calibration: number } {
  const already = db.prepare("SELECT count(*) AS n FROM solicitation").get() as { n: number };
  if (already.n > 0) {
    if (verbose) console.log(`${already.n} solicitations already loaded; nothing to do.`);
    return { indiana: 0, calibration: 0 };
  }
  const live = sourceId("Corpus import — Indiana open (2026-08-04)");
  const cal = sourceId("Corpus import — federal calibration (2026-08-10)");
  const indiana = loadIndiana(live);
  const calibration = loadCalibration(cal);
  if (verbose) console.log(`loaded ${indiana} Indiana, ${calibration} calibration`);
  return { indiana, calibration };
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  loadCorpus();
}
