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
