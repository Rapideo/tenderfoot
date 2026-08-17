/* The pure half of the corpus import: buyer-string cleaning, canonical
 * organisation resolution, and the uniqueness guard the batched insert
 * depends on.
 *
 * These live in their own module, and this file exists at all, because of
 * how the batching changed their standing. In the row-at-a-time version
 * every organisation was resolved by SQL, one buyer at a time -- the
 * database was the thing deciding whether two strings meant the same
 * organisation. The batched version resolves the whole distinct set in JS
 * FIRST and then issues one statement, so this logic now decides it, and a
 * bug here silently creates duplicate organisations instead of failing.
 *
 * Kept free of ../db/index.js on purpose: that module throws at import time
 * without DATABASE_URL, which would make these need a live Neon branch to
 * assert that a string has its asterisks removed. corpus.test.ts is the
 * slow, real-database half and takes ~80s; this half runs in milliseconds.
 */
import { expect, test } from "vitest";
import {
  canonicalName,
  cleanBuyer,
  DuplicateKeyError,
  requireUniqueKeys,
} from "./corpus-rows.js";

/* --- cleanBuyer ---------------------------------------------------------- */

test("markdown bold is stripped from a buyer string", () => {
  expect(cleanBuyer("**NY OGS**")).toBe("NY OGS");
});

/* The exact string that defeated the first version: a trailing qualifier in
 * parentheses meant the alias never matched and a second organisation was
 * created for the same buyer. */
test("a trailing parenthesised qualifier is dropped", () => {
  expect(cleanBuyer("**NY OGS** (co-op)")).toBe("NY OGS");
});

test("parentheses inside the name are left alone", () => {
  /* Only a TRAILING qualifier is a qualifier. Stripping every bracketed run
   * would rewrite legitimate names. */
  expect(cleanBuyer("Dept of Health (Region 5) Services")).toBe(
    "Dept of Health (Region 5) Services",
  );
});

/* --- canonicalName ------------------------------------------------------- */

test("an alias resolves to its canonical organisation name", () => {
  expect(canonicalName("NY OGS")).toBe("New York State Office of General Services");
});

test("the canonical name resolves to itself", () => {
  expect(canonicalName("New York State Office of General Services")).toBe(
    "New York State Office of General Services",
  );
});

test("an unknown buyer passes through unchanged", () => {
  /* KNOWN_ORGS is a seed for entity resolution, not a whitelist -- a name it
   * has never heard of is still a real organisation. */
  expect(canonicalName("Marion County Health Department")).toBe(
    "Marion County Health Department",
  );
});

/* The whole point of the reverse index. Every alias of every known org must
 * land on the same canonical string, or the batched resolver inserts one
 * organisation per spelling -- which is the bug the alias table exists to
 * prevent, reintroduced one layer up. */
test("every alias of a known organisation agrees on one canonical name", () => {
  const spellings = ["NY OGS", "New York State OGS", "NYS OGS", "NY OGS (co-op)"];
  const resolved = new Set(spellings.map((s) => canonicalName(cleanBuyer(s))));
  expect([...resolved]).toEqual(["New York State Office of General Services"]);
});

/* --- requireUniqueKeys --------------------------------------------------- */

/* The batched insert maps `RETURNING id, external_id` back onto its input by
 * external_id. That correlation is only sound if external_id is unique
 * WITHIN the batch: two rows sharing one would collapse into a single map
 * entry, and one solicitation would silently receive the other's sighting.
 *
 * The corpus happens to satisfy it today -- 61 and 140 rows, all distinct,
 * measured. This exists so that if it ever stops being true the import says
 * so, instead of quietly linking the wrong rows. */
test("a batch of distinct keys is accepted", () => {
  expect(() => requireUniqueKeys(["a", "b", "c"], "solicitation")).not.toThrow();
});

test("a duplicate key is rejected, and the error names the duplicate", () => {
  expect(() => requireUniqueKeys(["a", "b", "a"], "solicitation")).toThrow(DuplicateKeyError);
  expect(() => requireUniqueKeys(["a", "b", "a"], "solicitation")).toThrow(/\ba\b/);
});

test("the error names every duplicate, not just the first", () => {
  /* Reporting one at a time turns a data problem into a sequence of reruns. */
  try {
    requireUniqueKeys(["x", "y", "x", "y", "z"], "solicitation");
    throw new Error("should have thrown");
  } catch (e) {
    expect((e as Error).message).toMatch(/x/);
    expect((e as Error).message).toMatch(/y/);
    expect((e as Error).message).not.toMatch(/z/);
  }
});

test("an empty batch is accepted rather than treated as an error", () => {
  expect(() => requireUniqueKeys([], "solicitation")).not.toThrow();
});
