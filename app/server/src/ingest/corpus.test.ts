import { afterAll, beforeAll, expect, test } from "vitest";
import { rmSync } from "node:fs";

process.env.TENDERFOOT_DB = "tmp-corpus-test.db";
const { migrate } = await import("../db/migrate.js");
const { db } = await import("../db/index.js");
const { loadCorpus } = await import("./corpus.js");

beforeAll(() => {
  migrate(false);
  loadCorpus(false);
});

afterAll(() => {
  db.close();
  for (const s of ["", "-wal", "-shm"]) rmSync(`tmp-corpus-test.db${s}`, { force: true });
});

const one = (sql: string, ...a: unknown[]) => db.prepare(sql).get(...a) as any;

test("real solicitations loaded into the real schema", () => {
  expect(one("SELECT count(*) n FROM solicitation").n).toBeGreaterThan(190);
});

/* §4.4 -- the canonical record is produced by MERGING sightings. If the
 * first data in the system bypasses that path, the path is untested when
 * SP3 needs it. */
test("every solicitation carries a sighting", () => {
  const orphans = one(
    `SELECT count(*) n FROM solicitation s
      WHERE NOT EXISTS (SELECT 1 FROM sighting g WHERE g.solicitation_id = s.id)`,
  ).n;
  expect(orphans).toBe(0);
});

/* The edge case that justifies the alias table, found inside the first
 * sixty-one records collected. A NASPO award issued by New York, listed on
 * Indiana's portal. */
test("the NASPO solicitation resolves to New York, not Indiana", () => {
  const row = one(
    `SELECT o.name, o.jurisdiction
       FROM solicitation s JOIN organization o ON o.id = s.org_id
      WHERE s.title LIKE '%NASPO%'`,
  );
  expect(row, "the NASPO row was not loaded at all").toBeTruthy();
  expect(row.jurisdiction).toBe("NY");
  expect(row.name).toMatch(/New York/);
});

/* Its external id is "*(NASPO)*" rather than an event number, and a numeric
 * pattern silently dropped precisely this row. */
test("solicitations with a non-numeric external id are not dropped", () => {
  expect(one("SELECT count(*) n FROM solicitation WHERE external_id = 'NASPO'").n).toBe(1);
});

test("aliases resolve rather than creating duplicate organizations", () => {
  /* Matched on the CANONICAL name, which is the point: "OGS" appears only in
   * the aliases, so a pattern looking for it finds nothing and proves the
   * resolution worked rather than that it failed. */
  expect(one("SELECT count(*) n FROM organization WHERE name LIKE '%General Services%'").n).toBe(1);
  expect(one("SELECT count(*) n FROM organization WHERE name = 'NY OGS'").n).toBe(0);
  expect(one("SELECT count(*) n FROM organization_alias").n).toBeGreaterThan(4);
});

/* The calibration corpus is entirely federal; defaulting it to Indiana
 * mislabelled sixty-two organizations. */
test("federal agencies are not tagged as Indiana", () => {
  expect(one("SELECT count(*) n FROM organization WHERE jurisdiction = 'US'").n).toBeGreaterThan(50);
});

/* corpus/calibration/README.md: no precision figure may EVER be computed
 * from the enriched set, whose base rate is wrong by construction. The split
 * has to survive the import or that rule becomes unenforceable. */
test("the enriched / unbiased split survived the import", () => {
  const enriched = one("SELECT count(*) n FROM solicitation WHERE source_note LIKE '%set=enriched%'").n;
  const unbiased = one("SELECT count(*) n FROM solicitation WHERE source_note LIKE '%set=unbiased%'").n;
  expect(enriched).toBe(80);
  expect(unbiased).toBe(60);
});

test("loading twice does not duplicate", () => {
  const before = one("SELECT count(*) n FROM solicitation").n;
  loadCorpus(false);
  expect(one("SELECT count(*) n FROM solicitation").n).toBe(before);
});
