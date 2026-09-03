import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIdoaPage } from "./idoa.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, "fixtures/idoa-listing.html"), "utf8");

test("parses every solicitation row on the page", () => {
  const { items } = parseIdoaPage(FIXTURE);
  /* 71 = docs/2026-09-02-idoa-page-facts.md Q1: 70 rows from the main
   * `events-table` + 1 row from the separate "Additional Business
   * Opportunities" table (`table05781`), which shares an identical header
   * and is a real, distinct solicitation (a NASPO ValuePoint cooperative
   * RFP), not a rendering artifact. The pre-proposal-conference table (a
   * third table, different header) is excluded and contributes 0. An
   * adapter reading only the biggest/DataTables table would report 70 and
   * silently drop this whole category -- that is exactly the defect this
   * assertion guards against. */
  expect(items.length).toBe(71);
});

/* Corrected from the brief's original ^\d{15}$-for-every-item version:
 * table05781's one row has the literal Event ID "NA" (Task 1, Q1) and is
 * deliberately INCLUDED (cooperative vehicles are in scope), so a global
 * "every externalId is 15 digits" assertion is false by design, not by
 * bug. Every externalId must still be non-empty and unique, and at least
 * 70 of the 71 (the events-table rows, all confirmed 15-digit numeric ids
 * with 70 unique column values) must match the numeric shape. */
test("an item carries the Event ID as its external id when the Event ID is numeric", () => {
  const { items } = parseIdoaPage(FIXTURE);
  for (const item of items) {
    expect(item.externalId.length).toBeGreaterThan(0);
  }
  expect(new Set(items.map((i) => i.externalId)).size).toBe(items.length);
  expect(items.filter((i) => /^\d{15}$/.test(i.externalId)).length).toBeGreaterThanOrEqual(70);
});

/* The one row whose Event ID is not 15 digits (table05781's "NA" row) must
 * still be included, and its externalId must be a stable, non-numeric slug
 * derived from the event name -- never the literal "NA" (not unique or
 * stable) and never dropped (spec ruling: cooperative vehicles are in
 * scope). */
test("a non-numeric Event ID falls back to a name-derived slug, and the row is kept", () => {
  const { items } = parseIdoaPage(FIXTURE);
  const cooperative = items.find((i) => (i.raw as { eventId: string }).eventId === "NA");
  expect(cooperative).toBeDefined();
  expect(cooperative!.externalId).toBe("rfp-23420-group-71022-business-consulting-services");
});

/* Trap 2 (task-7-brief.md): row 52's free-text Event Description contains
 * "RFQ# 003000000088930" -- a live data-entry error, transposed against
 * its own Event ID column value 003000000088390. A parser that regexed a
 * 15-digit string out of row/description text instead of reading the
 * Event ID column could return either value, and the wrong one is
 * indistinguishable on its face from a real id. */
test("the Event ID is read from the Event ID column, not regexed out of the description", () => {
  const { items } = parseIdoaPage(FIXTURE);
  const row = items.find((i) => i.externalId === "003000000088390");
  expect(row).toBeDefined();
  const raw = row!.raw as { eventId: string; description: string };
  expect(raw.eventId).toBe("003000000088390");
  expect(raw.description).toContain("003000000088930");
  expect(raw.eventId).not.toBe("003000000088930");
});

test("no item carries a date presented as a posting date", () => {
  /* The whole reason this shape exists. IDOA publishes no posting date, so
   * there must be nothing in the item that could be mistaken for one. */
  for (const item of parseIdoaPage(FIXTURE).items) {
    expect(item).not.toHaveProperty("modifiedAt");
  }
});

test("the documents URL is the scraped href, not a constructed one", () => {
  const { items } = parseIdoaPage(FIXTURE);
  const withDocs = items.filter((i) => (i.raw as { documentsUrl: string | null }).documentsUrl);
  /* 66 of 71 rows carry a Bid Documents link (Task 1, "anything else
   * surprising"); the other 5 (4 in events-table + table05781's own row)
   * have none at all, which is why documentsUrl must be nullable rather
   * than assumed present. */
  expect(withDocs.length).toBe(66);
  for (const i of withDocs) {
    expect((i.raw as { documentsUrl: string }).documentsUrl).toMatch(/^https?:\/\//);
  }
});

test("a row with no Bid Documents anchor gets a null documentsUrl, not a thrown error", () => {
  const { items } = parseIdoaPage(FIXTURE);
  const withoutDocs = items.filter(
    (i) => (i.raw as { documentsUrl: string | null }).documentsUrl === null,
  );
  expect(withoutDocs.length).toBe(5);
});
