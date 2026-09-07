import { expect, test } from "vitest";
import { postedAt } from "./posted-at.js";

/* Pure -- no useTestSchema(), no database. Same posture as closes-at.test.ts,
 * title.test.ts and org-chain.test.ts: a rule that reads a payload should be
 * testable without a Postgres connection.
 *
 * ⚠️ THIS FILE DID NOT EXIST UNTIL 2026-09-07, and its absence is part of the
 * finding it was written for. posted-at.ts shipped with SAM.gov and
 * USASpending cases and no unit test of its own, so a source added later
 * falling silently through to `default: return null` -- which is exactly what
 * HigherGov did -- could not fail anything. The same shape D27 records for
 * org-chain.ts ("the module D27 found had no tests"). */

/* SAM's real shape, both candidate fields present and disagreeing, which is
 * the measured case posted-at.ts's header justifies its choice against. */
const SAM = {
  publishDate: "2026-08-14T09:12:00-04:00",
  originalPublishDate: "2025-08-14T09:12:00-04:00",
};

test("SAM.gov reads publishDate, not originalPublishDate", () => {
  expect(postedAt("SAM.gov", SAM)).toEqual({ date: "2026-08-14", origin: "published" });
});

test("SAM.gov falls back to originalPublishDate only when publishDate is absent", () => {
  expect(postedAt("SAM.gov", { originalPublishDate: "2025-08-14T09:12:00-04:00" })).toEqual({
    date: "2025-08-14",
    origin: "published",
  });
  expect(postedAt("SAM.gov", {})).toBeNull();
});

test("USASpending yields nothing: an award date is not a posting date", () => {
  expect(postedAt("USASpending", { action_date: "2026-08-14" })).toBeNull();
});

/* ── HigherGov, added 2026-09-07 ──────────────────────────────────────── */

/* THE DEFECT THIS FILE'S HIGHERGOV BLOCK EXISTS FOR: with no case here, every
 * ingested HigherGov row inserted with posted_at NULL -- the same measurement
 * that was 1,724 of 1,724 on SAM.gov, reintroduced for the source the fitness
 * gate exists to judge Indiana on. `posted_date` is the field, per
 * docs/2026-09-03-highergov-field-mapping.md:53. */
test("HigherGov's posted_date lands as a published posting date", () => {
  expect(postedAt("HigherGov", { posted_date: "2026-09-01" })).toEqual({
    date: "2026-09-01",
    origin: "published",
  });
});

test("a HigherGov posted_date carrying a time is truncated to the bare date", () => {
  expect(postedAt("HigherGov", { posted_date: "2026-09-01T00:00:00Z" })).toEqual({
    date: "2026-09-01",
    origin: "published",
  });
});

/* 🔴 THE ASSERTION THE WHOLE CASE TURNS ON. `captured_date` is present on
 * every HigherGov row (100/100 measured) and reading it would make this
 * column look populated on every single row -- while recording HigherGov's
 * own watermark, when THEY saw it, under `origin: 'published'`. That is the
 * one thing migration 016 was created to make impossible. */
test("HigherGov's captured_date is NOT read as a posting date", () => {
  expect(postedAt("HigherGov", { captured_date: "2026-09-03" })).toBeNull();
  /* Both present: the posted date wins and the watermark is ignored, rather
   * than the two being blended by whichever happens to parse. */
  expect(postedAt("HigherGov", { posted_date: "2026-08-20", captured_date: "2026-09-03" })).toEqual({
    date: "2026-08-20",
    origin: "published",
  });
});

test("a HigherGov row with no usable posted_date yields null rather than a guess", () => {
  expect(postedAt("HigherGov", {})).toBeNull();
  expect(postedAt("HigherGov", { posted_date: null })).toBeNull();
  expect(postedAt("HigherGov", { posted_date: "" })).toBeNull();
  expect(postedAt("HigherGov", { posted_date: "not a date" })).toBeNull();
  expect(postedAt("HigherGov", { posted_date: 20260901 })).toBeNull();
});

/* ⚠️ docs/2026-09-03-highergov-field-mapping.md:53 writes the origin as
 * 'listing'. Migration 016's CHECK is `posted_at_origin IN ('published',
 * 'observed')` -- a row carrying 'listing' is rejected by the database. The
 * two words are the same claim in two vocabularies and the column's word is
 * the one that ships; this pins that so a later "corrected to match the doc"
 * fails here rather than at an INSERT nobody is watching. */
test("the origin is the column's vocabulary, never the field-mapping document's word", () => {
  const posted = postedAt("HigherGov", { posted_date: "2026-09-01" });
  expect(posted?.origin).toBe("published");
  expect(posted?.origin).not.toBe("listing");
});

/* Regression: SAM and USASpending are unchanged by HigherGov's new case, and
 * HigherGov's field means nothing to a source that does not publish it. */
test("HigherGov's posted_date field means nothing to a different source", () => {
  expect(postedAt("SAM.gov", { posted_date: "2026-09-01" })).toBeNull();
  expect(postedAt("USASpending", { posted_date: "2026-09-01" })).toBeNull();
});

test("an unrecognised source yields nothing, and absence never throws", () => {
  expect(postedAt("some-future-source", { posted_date: "2026-09-01" })).toBeNull();
  expect(postedAt("HigherGov", null)).toBeNull();
  expect(postedAt("HigherGov", undefined)).toBeNull();
  expect(postedAt("SAM.gov", null)).toBeNull();
});
