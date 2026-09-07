/* 🛑 NO LIVE CALLS. Every case injects fetchImpl. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

process.env.HIGHERGOV_API_KEY = "TESTKEYTESTKEYTESTKEYTESTKEY0000";
process.env.HIGHERGOV_SEARCH_ID = "TESTSEARCHID";

const { higherGovAdapter, scrubPayload } = await import("./highergov.js");

const FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/highergov-listing.json", import.meta.url)),
  "utf8",
);

function fakeFetch(body: string): typeof fetch {
  return (async () =>
    new Response(body, { status: 200, headers: { "content-type": "application/json" } })) as any;
}

/* 🔴 THE ONE THAT MATTERS. scrape/run.ts hands `page.payload` straight to
 * art.writeCapture, and import-artifact.ts hashes the file into
 * ingest_run.artifact_sha256. An unscrubbed payload writes a live
 * credential into storage permanently, hashed and immutable. */
test("the payload carries no api_key", () => {
  const scrubbed = scrubPayload(FIXTURE);
  expect(FIXTURE).toContain("api_key");
  expect(scrubbed).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001");
  expect(scrubbed).toContain("REDACTED");
});

test("the scrub is stable, so two runs over identical data hash the same", () => {
  expect(scrubPayload(FIXTURE)).toBe(scrubPayload(FIXTURE));
  expect(scrubPayload(scrubPayload(FIXTURE))).toBe(scrubPayload(FIXTURE));
});

test("the page's payload is the scrubbed one, not the raw body", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.payload).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001");
});

test("every result becomes an item keyed by source_id", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.items.map((i) => i.externalId)).toEqual([
    "003000000088067", "004950000088400", "FORECAST-2027-ROADS",
  ]);
});

/* captured_date is HigherGov's own watermark (R9), and modifiedAt is the
 * field scrape/run.ts compares against the window. */
test("modifiedAt is captured_date", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-05", null,
  );
  expect(page.items[0]!.modifiedAt).toBe("2026-09-03");
});

/* An item with no captured_date cannot be placed in the window. adapter.ts:
 * it is counted, never allowed to decide the window or poison the resume
 * marker. */
test("an undated record is skipped and counted, not dropped silently", async () => {
  const body = JSON.stringify({
    meta: { pagination: { page: 1, pages: 1, count: 1 } },
    results: [{ source_id: "X", captured_date: null, title: "t" }],
  });
  const page = await higherGovAdapter(fakeFetch(body)).fetchListing(
    "2026-09-03", "2026-09-05", null,
  );
  expect(page.items).toHaveLength(0);
  expect(page.undatedSkipped).toBe(1);
});

test("the raw record rides along on the item, without document_path", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-05", null,
  );
  const raw = page.items[0]!.raw as Record<string, unknown>;
  expect(raw.description_text).toContain("Salamonie");
  expect("document_path" in raw).toBe(false);
});

/* A single page and done: paginating costs records, and this adapter reads
 * one page per day-window call by design. */
test("a single-page response reports no next cursor", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.nextCursor).toBeNull();
});
