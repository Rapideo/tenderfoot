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
    "2026-09-03", "2026-09-03", null,
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
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.items).toHaveLength(0);
  expect(page.undatedSkipped).toBe(1);
});

test("the raw record rides along on the item, without document_path", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  const raw = page.items[0]!.raw as Record<string, unknown>;
  expect(raw.description_text).toContain("Salamonie");
  expect("document_path" in raw).toBe(false);
});

/* run.ts's windowed loop trusts nextCursor alone to decide `done`, and this
 * adapter always returns nextCursor: null. A caller that has not learned to
 * walk days -- i.e. one that passes a real multi-day window -- must be told
 * loudly, not have it silently read one day and get reported complete. Not
 * reachable until Task 4 registers this adapter, which is exactly when it
 * becomes live. */
test("fetchListing refuses a window wider than one day", async () => {
  await expect(
    higherGovAdapter(fakeFetch(FIXTURE)).fetchListing("2026-09-03", "2026-09-05", null),
  ).rejects.toThrow(/since \(2026-09-03\) and until \(2026-09-05\) differ/);
});

/* The only prior assertion on payload was `not.toContain` -- payload: "{}"
 * or payload: "" would have passed every test above. This pins that the
 * payload actually carries the real data. (No REDACTED marker is asserted
 * here: this fixture's only credential-shaped text lives in document_path,
 * which the client DELETES outright rather than replacing in place -- by
 * the time this adapter sees `raw`, there is nothing left needing a marker.
 * The test below is the one that earns a REDACTED assertion honestly.) */
test("the payload carries the actual data, not an empty shell", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.payload).toContain("003000000088067");
});

/* THE MUTATION GAP THIS CLOSES. highergov-client.ts's redact() copies
 * object KEYS verbatim -- `out[k] = redact(v)` recurses into values only --
 * so a key-shaped string sitting in a property NAME survives the client
 * untouched and reaches JSON.stringify raw. Only this adapter's
 * string-level scrubPayload(), which redacts the whole serialized body
 * regardless of where the text sits, catches it. Removing scrubPayload from
 * the payload line (Step 6's mutation) must fail THIS test, even though it
 * does not fail "the page's payload is the scrubbed one" above -- that test
 * only ever exercised a key-shaped VALUE, which the client already strips. */
test("a key-shaped PROPERTY NAME, not just a value, does not survive into the payload", async () => {
  const body = JSON.stringify({
    meta: { pagination: { page: 1, pages: 1, count: 1 } },
    results: [
      {
        source_id: "Y",
        captured_date: "2026-09-03",
        title: "t",
        nested: { "https://h/?api_key=SOMEFAKE": "value" },
      },
    ],
  });
  const page = await higherGovAdapter(fakeFetch(body)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.payload).not.toContain("SOMEFAKE");
  expect(page.payload).toContain("REDACTED");
});

/* 🔴 THE HALF THE TEST ABOVE MISSED, AND THE WORSE HALF. It asserted only on
 * `page.payload`, which scrubPayload() scrubs as a whole string. The SAME
 * fixture left the key intact in `page.items[0].raw`, and `raw` is what
 * scrape/run.ts hands to art.writeSighting and ingest/import-artifact.ts
 * writes into Postgres `sighting.raw` jsonb -- permanently, in the one place
 * hardest to retract. The payload is a string in an artifact file; the raw is
 * a row in the production database. Only fixing redact() to walk property
 * NAMES as well as values closes this, which is why the assertion lives here
 * rather than being another scrubPayload() call at this call site. */
test("a key-shaped PROPERTY NAME does not survive into items[].raw either", async () => {
  const body = JSON.stringify({
    meta: { pagination: { page: 1, pages: 1, count: 1 } },
    results: [
      {
        source_id: "Y",
        captured_date: "2026-09-03",
        title: "t",
        nested: { "https://h/?api_key=SOMEFAKE": "value" },
      },
    ],
  });
  const page = await higherGovAdapter(fakeFetch(body)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  const raw = JSON.stringify(page.items.map((i) => i.raw));
  expect(raw).not.toContain("SOMEFAKE");
  expect(raw).toContain("api_key=REDACTED");
});

/* 🔴 THE VENDOR'S OWN BILLED COUNT, AND NOTHING WAS PINNING IT. Deleting
 * `records:` from the payload envelope used to leave every test in this file
 * green, while ingest/highergov-cli.ts's billedRecordsFromArtifact() -- which
 * reads exactly this field back out of the artifact to decide what to write
 * to api_spend -- silently fell through to an estimate on every real day. The
 * one test that exercised that function used a fake adapter writing its own
 * payload, so it never touched this file's envelope at all.
 *
 * `feedCount` and `pages` are asserted in the same breath for the same
 * reason: this adapter's own comment argues all three are load-bearing, and
 * an argument in a comment is not a test. */
test("the payload envelope carries records, feedCount and pages -- the vendor's own scalars", async () => {
  const body = JSON.stringify({
    meta: { pagination: { page: 1, pages: 3, count: 41 } },
    results: [
      { source_id: "A", captured_date: "2026-09-03", title: "a" },
      /* Billed, but dropped by the client for a missing source_id -- the exact
       * row that makes `records` differ from items.length + undatedSkipped,
       * which is the whole reason the envelope carries it. */
      { captured_date: "2026-09-03", title: "no source_id" },
    ],
  });
  const page = await higherGovAdapter(fakeFetch(body)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  const envelope = JSON.parse(page.payload) as {
    records?: unknown;
    feedCount?: unknown;
    pages?: unknown;
  };
  /* 2, not 1: both rows were billed, only one became an item. */
  expect(envelope.records).toBe(2);
  expect(page.items).toHaveLength(1);
  expect(page.undatedSkipped).toBe(0);
  expect(envelope.feedCount).toBe(41);
  expect(envelope.pages).toBe(3);
});

/* A single page and done: paginating costs records, and this adapter reads
 * one page per day-window call by design. */
test("a single-page response reports no next cursor", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.nextCursor).toBeNull();
});
