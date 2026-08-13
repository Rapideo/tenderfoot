import { afterAll, beforeAll, expect, test } from "vitest";
import { rmSync } from "node:fs";

/* Scratch database. Set before importing anything that opens one. */
process.env.TENDERFOOT_DB = "tmp-schema-test.db";
const { migrate } = await import("./migrate.js");
const { db } = await import("./index.js");

beforeAll(() => migrate(false));

afterAll(() => {
  db.close();
  for (const s of ["", "-wal", "-shm"]) rmSync(`tmp-schema-test.db${s}`, { force: true });
});

const tables = () =>
  db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r: any) => r.name as string);

test("all eleven objects plus the two alias tables exist", () => {
  const t = tables();
  for (const name of [
    "organization",
    "vendor",
    "firm_profile",
    "solicitation",
    "award",
    "contract",
    "source",
    "sighting",
    "document",
    "assessment",
    "pursuit",
    "organization_alias",
    "vendor_alias",
  ]) {
    expect(t, `${name} missing`).toContain(name);
  }
});

/* §2.2 -- the whole point of putting FKs in the first migration is that they
 * are enforced. An unenforced constraint is a comment. */
test("foreign keys are enforced, not decorative", () => {
  expect(() =>
    db.prepare("INSERT INTO solicitation (org_id, title) VALUES (99999, 'ghost')").run(),
  ).toThrow(/FOREIGN KEY/i);
});

/* §4.4 -- many sightings, one canonical record. If a unique constraint ever
 * appears on sighting.solicitation_id, deduplication across sources dies. */
test("many sightings may point at one solicitation", () => {
  const org = db.prepare("INSERT INTO organization (name) VALUES ('Test Agency')").run();
  const sol = db
    .prepare("INSERT INTO solicitation (org_id, title) VALUES (?, 'Test RFP')")
    .run(org.lastInsertRowid);
  const src = db.prepare("INSERT INTO source (name) VALUES ('Test Source')").run();

  const ins = db.prepare("INSERT INTO sighting (source_id, solicitation_id) VALUES (?, ?)");
  ins.run(src.lastInsertRowid, sol.lastInsertRowid);
  ins.run(src.lastInsertRowid, sol.lastInsertRowid);

  const n = db
    .prepare("SELECT count(*) AS n FROM sighting WHERE solicitation_id = ?")
    .get(sol.lastInsertRowid) as { n: number };
  expect(n.n).toBe(2);
});

/* §4.2 -- KP is one vendor row with is_self. A second would make "which
 * firm is this system for" ambiguous, which is the portability claim. */
test("only one vendor may be is_self", () => {
  db.prepare("INSERT INTO vendor (name, is_self) VALUES ('Koehler Partners', 1)").run();
  expect(() =>
    db.prepare("INSERT INTO vendor (name, is_self) VALUES ('Impostor', 1)").run(),
  ).toThrow(/UNIQUE/i);
});

test("aliases cascade when their entity is deleted", () => {
  const org = db.prepare("INSERT INTO organization (name) VALUES ('Doomed Agency')").run();
  db.prepare("INSERT INTO organization_alias (org_id, alias) VALUES (?, 'DA')").run(
    org.lastInsertRowid,
  );
  db.prepare("DELETE FROM organization WHERE id = ?").run(org.lastInsertRowid);
  const n = db
    .prepare("SELECT count(*) AS n FROM organization_alias WHERE org_id = ?")
    .get(org.lastInsertRowid) as { n: number };
  expect(n.n).toBe(0);
});

/* §5.5.1 -- the standing rule. A source defaults to OUT, and the posture
 * vocabulary is closed so a typo cannot invent a fourth state. */
test("a source defaults to legal_posture 'out' and rejects unknown postures", () => {
  const r = db.prepare("INSERT INTO source (name) VALUES ('Unvetted Portal')").run();
  const row = db.prepare("SELECT legal_posture FROM source WHERE id = ?").get(r.lastInsertRowid) as {
    legal_posture: string;
  };
  expect(row.legal_posture).toBe("out");
  expect(() =>
    db.prepare("INSERT INTO source (name, legal_posture) VALUES ('Bad', 'probably-fine')").run(),
  ).toThrow(/CHECK/i);
});

/* Mechanical vs smart must be recorded IN THE DATA (Pinned-Ingestion-
 * Scaffolding, proposal 4). A free-text column would drift into 'llm',
 * 'gpt', 'auto' and stop being comparable. */
test("document.produced_by accepts only the two modes, or nothing yet", () => {
  const sol = db.prepare("SELECT id FROM solicitation LIMIT 1").get() as { id: number };
  const ins = db.prepare(
    "INSERT INTO document (solicitation_id, filename, produced_by) VALUES (?, 'a.pdf', ?)",
  );
  ins.run(sol.id, "mechanical");
  ins.run(sol.id, "smart");
  ins.run(sol.id, null);
  expect(() => ins.run(sol.id, "llm")).toThrow(/CHECK/i);
});

/* §1.1 -- matching is parked. The table exists so scorer_version never has
 * to be retrofitted; nothing writes to it in V1. */
test("assessment exists and is empty", () => {
  const n = db.prepare("SELECT count(*) AS n FROM assessment").get() as { n: number };
  expect(n.n).toBe(0);
});

/* The Source Registry seed (003). These assert the RESEARCH survived into
 * the database, not merely that rows exist -- the registry is V1's only
 * control surface, and a seed that quietly loses a legal posture or a
 * verified facet is worse than an empty table. */
test("the source registry is seeded, and nothing is enabled yet", () => {
  /* Assert the seeded rows BY NAME rather than a total count: earlier tests
   * in this file insert their own sources, and a bare count would fail for a
   * reason that has nothing to do with the seed. Same brittleness as the
   * migration list this suite already learned about. */
  const seeded = [
    "SAM.gov",
    "USASpending",
    "Indiana IDOA solicitations",
    "Indiana EDS contract register",
    "Illinois BidBuy",
    "Michigan SIGMA VSS",
    "Kentucky eMARS VSS",
    "Ohio OhioBuys",
    "GovWin IQ",
    "BidNet Direct",
    "BidPrime",
  ];
  const names = db
    .prepare("SELECT name FROM source")
    .all()
    .map((r: any) => r.name as string);
  for (const n of seeded) expect(names, `${n} missing from the seed`).toContain(n);

  /* SP3 turns the first one on deliberately, and only after the ingestion
   * window exists in code. */
  const on = db.prepare("SELECT count(*) AS n FROM source WHERE enabled = 1").get() as { n: number };
  expect(on.n).toBe(0);
});

test("legal postures match the 2026-08-12 research", () => {
  const posture = (name: string) =>
    (db.prepare("SELECT legal_posture FROM source WHERE name = ?").get(name) as any)?.legal_posture;
  expect(posture("Illinois BidBuy")).toBe("in");
  expect(posture("Michigan SIGMA VSS")).toBe("in");
  expect(posture("Kentucky eMARS VSS")).toBe("in");
  expect(posture("Ohio OhioBuys")).toBe("manual-only");
  for (const agg of ["GovWin IQ", "BidNet Direct", "BidPrime"]) {
    expect(posture(agg), `${agg} must stay out`).toBe("out");
  }
});

/* §5.5.1 -- the evidence is recorded ON THE ROW. A posture without a note
 * is a decision nobody can audit, which is the thing the rule exists to
 * prevent. */
test("every non-default posture carries its evidence", () => {
  const rows = db
    .prepare("SELECT name, legal_note FROM source WHERE legal_posture != 'out' OR name LIKE '%Bid%' OR name LIKE '%GovWin%'")
    .all() as { name: string; legal_note: string | null }[];
  for (const r of rows) {
    expect(r.legal_note, `${r.name} has no legal_note`).toBeTruthy();
  }
});

test("verified_facets is valid JSON wherever it is present", () => {
  const bad = db
    .prepare("SELECT count(*) AS n FROM source WHERE verified_facets IS NOT NULL AND json_valid(verified_facets) = 0")
    .get() as { n: number };
  expect(bad.n).toBe(0);
});

/* §5.4. The silent-failure record is the most expensive thing we learned,
 * and it lives here so an adapter author reads it before repeating it. */
test("the silent-failure findings survived into the registry", () => {
  const sam = db.prepare("SELECT verified_facets AS v FROM source WHERE name = 'SAM.gov'").get() as { v: string };
  expect(JSON.parse(sam.v).silently_ignored).toContain("sort=-publishDate");

  const mi = db.prepare("SELECT verified_facets AS v FROM source WHERE name = 'Michigan SIGMA VSS'").get() as { v: string };
  expect(JSON.parse(mi.v).silently_ignored).toContain("Show Me");
});
