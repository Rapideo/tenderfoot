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

/* Captures the URL each call was made with -- same shape as coverage/
 * highergov-client.test.ts's own fakeFetch, needed here too to assert on the
 * QUERY STRING itself rather than only on the parsed result. */
function fakeFetchCapturing(body: string): typeof fetch & { calls: string[] } {
  const calls: string[] = [];
  const impl = (async (url: string | URL) => {
    calls.push(String(url));
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch & { calls: string[] };
  impl.calls = calls;
  return impl;
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
 * field scrape/run.ts compares against the window. The fixture's first row now
 * carries posted_date 2026-06-09 as well, so this is no longer satisfiable by
 * "whichever date happened to be first". */
test("modifiedAt is captured_date on the default axis", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.items[0]!.modifiedAt).toBe("2026-09-03");
  expect(page.items[0]!.modifiedAt).not.toBe("2026-06-09");
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
 * `feedCount`, `pages` and `pagesFetched` are asserted in the same breath for
 * the same reason: this adapter's own comment argues all of them are
 * load-bearing, and an argument in a comment is not a test. */
test("the payload envelope carries records, feedCount, pages and pagesFetched", async () => {
  const body = JSON.stringify({
    meta: { pagination: { page: 1, pages: 1, count: 41 } },
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
    pagesFetched?: unknown;
  };
  /* 2, not 1: both rows were billed, only one became an item. */
  expect(envelope.records).toBe(2);
  expect(page.items).toHaveLength(1);
  expect(page.undatedSkipped).toBe(0);
  expect(envelope.feedCount).toBe(41);
  expect(envelope.pages).toBe(1);
  expect(envelope.pagesFetched).toBe(1);
});

/* 🔴 THE ADAPTER PAGES, AND THE ENVELOPE MUST SAY WHAT THAT COST. Before
 * 2026-09-08 this adapter bought page one of a three-page day and wrote
 * `pages: 3` beside a one-page record count -- an artifact that looked
 * complete to anything reading `records` alone. It now walks the day, and the
 * envelope's `records` is the SUM across the pages it bought (under-reporting
 * it is what a ceiling that cannot be read back from the vendor cannot
 * survive, CLAUDE.md §5.1), with `pagesFetched` beside `pages` to say the day
 * was bought WHOLE rather than truncated.
 *
 * Three identical two-row pages: 6 billed, 3 items (the same source_id
 * repeats, which the adapter does not dedup -- that is merge's job), 3 of 3
 * pages fetched. */
test("a multi-page day is walked whole, and the envelope's records is the SUM of every page", async () => {
  const body = JSON.stringify({
    meta: { pagination: { page: 1, pages: 3, count: 6 } },
    results: [
      { source_id: "A", captured_date: "2026-09-03", title: "a" },
      { captured_date: "2026-09-03", title: "no source_id" },
    ],
  });
  const fetchImpl = fakeFetchCapturing(body);
  const page = await higherGovAdapter(fetchImpl).fetchListing("2026-09-03", "2026-09-03", null);
  const envelope = JSON.parse(page.payload) as { records?: unknown; pagesFetched?: unknown };
  expect(fetchImpl.calls).toHaveLength(3);
  expect(envelope.records).toBe(6);
  expect(envelope.pagesFetched).toBe(3);
  expect(page.items).toHaveLength(3);
});

/* The adapter's per-day budget, threaded to the client's own paging walk.
 * The same three-page day, told it may bill at most 2 records, must buy page
 * one and stop -- and the envelope must record that it stopped, or the
 * artifact would claim a complete day. */
test("a per-day budget stops the adapter's walk, and the envelope records the shortfall", async () => {
  const body = JSON.stringify({
    meta: { pagination: { page: 1, pages: 3, count: 6 } },
    results: [
      { source_id: "A", captured_date: "2026-09-03", title: "a" },
      { source_id: "B", captured_date: "2026-09-03", title: "b" },
    ],
  });
  const fetchImpl = fakeFetchCapturing(body);
  const page = await higherGovAdapter(fetchImpl, undefined, undefined, 2).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  const envelope = JSON.parse(page.payload) as {
    records?: unknown;
    pages?: unknown;
    pagesFetched?: unknown;
  };
  expect(fetchImpl.calls).toHaveLength(1);
  expect(envelope.records).toBe(2);
  expect(envelope.pages).toBe(3);
  expect(envelope.pagesFetched).toBe(1);
});

/* One adapter call is one whole DAY, however many pages that took: the
 * client walks the pages internally, so scrape/run.ts's windowed loop --
 * which trusts nextCursor alone to decide `done` -- must always be told the
 * day is finished. */
test("a single-page response reports no next cursor", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.nextCursor).toBeNull();
});

/* page_size THREADING: this adapter's own knob is a pass-through to
 * highergov-client.ts's fetchDay, which owns the actual economics comment.
 * Left unset (the default, no second argument), the request must be
 * unchanged from before this parameter existed. */
test("higherGovAdapter sends no page_size when none is given", async () => {
  const fetchImpl = fakeFetchCapturing(FIXTURE);
  await higherGovAdapter(fetchImpl).fetchListing("2026-09-03", "2026-09-03", null);
  expect(fetchImpl.calls[0]).not.toContain("page_size");
});

test("higherGovAdapter threads an explicit page_size through to the request", async () => {
  const fetchImpl = fakeFetchCapturing(FIXTURE);
  await higherGovAdapter(fetchImpl, 25).fetchListing("2026-09-03", "2026-09-03", null);
  expect(fetchImpl.calls[0]).toContain("page_size=25");
});

/* ═══ THE AXIS ═══ Matt's ruling, 2026-09-07 (design spec §3.2's amendment):
 * the BACKFILL runs on posted_date, LIVE operation stays on captured_date.
 * `captured_date` is a CRAWL watermark, so a historical window on it returns
 * re-captures of notices we already hold -- billed in full, delivering
 * nothing, because the meter counts records RETURNED (CLAUDE.md §5.1).
 *
 * The fixture carries posted dates in JUNE against captured dates in SEPTEMBER
 * precisely so that reading the wrong one cannot pass by coincidence. */

/* 🔴 THE MANDATORY INERT DEFAULT. An adapter constructed the way registry.ts
 * constructs it -- no arguments -- must ask exactly what it asked before axes
 * existed. Asserted on the wire, not on the parsed page. */
test("higherGovAdapter asks captured_date and never posted_date when no axis is given", async () => {
  const fetchImpl = fakeFetchCapturing(FIXTURE);
  await higherGovAdapter(fetchImpl).fetchListing("2026-09-03", "2026-09-03", null);
  expect(fetchImpl.calls[0]).toContain("captured_date=2026-09-03");
  expect(fetchImpl.calls[0]).not.toContain("posted_date");
});

test("an explicit posted_date axis reaches the request, replacing captured_date", async () => {
  const fetchImpl = fakeFetchCapturing(FIXTURE);
  await higherGovAdapter(fetchImpl, undefined, "posted_date").fetchListing(
    "2026-06-09", "2026-06-09", null,
  );
  expect(fetchImpl.calls[0]).toContain("posted_date=2026-06-09");
  expect(fetchImpl.calls[0]).not.toContain("captured_date");
});

/* 🔴🔴 THE DEFECT THIS WHOLE DESIGN EXISTS TO AVOID, PINNED DIRECTLY.
 *
 * adapter.ts: "`modifiedAt` is the field the caller compares against the
 * window", and scrape/run.ts folds every item's modifiedAt into the run's
 * low-water resume marker. Query posted_date but report captured_date and a
 * notice PUBLISHED in June, CRAWLED in September, comes back from a June
 * request wearing a SEPTEMBER modifiedAt -- outside the window just asked for.
 * Days would appear to contain records they do not.
 *
 * If someone later "simplifies" `axisValue(n, axis)` back to `n.capturedDate`,
 * this test must be the thing that stops them. */
test("modifiedAt follows the WALKED axis: a posted_date walk reports the posted date", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE), undefined, "posted_date").fetchListing(
    "2026-06-09", "2026-06-09", null,
  );
  const byId = new Map(page.items.map((i) => [i.externalId, i.modifiedAt]));
  /* The vendor row says captured 2026-09-03, posted 2026-06-09. */
  expect(byId.get("003000000088067")).toBe("2026-06-09");
  expect(byId.get("003000000088067")).not.toBe("2026-09-03");
  expect(byId.get("004950000088400")).toBe("2026-06-10");
  expect(byId.get("004950000088400")).not.toBe("2026-09-04");
});

/* The same trap, read from the other end: a captured_date walk must NOT start
 * reporting posted dates. Both directions are asserted because a mutation that
 * swapped the two would otherwise be caught by only one of them. */
test("modifiedAt follows the WALKED axis: a captured_date walk reports no posted date", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE), undefined, "captured_date").fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.items.map((i) => i.modifiedAt)).toEqual([
    "2026-09-03", "2026-09-04", "2026-09-05",
  ]);
});

/* adapter.ts §5.4, applied to the axis actually in use: a row with no value on
 * the WALKED axis cannot be placed in the window, whatever other date it
 * carries. Borrowing the other axis's value would be fabricating a position.
 * The fixture's forecast row has a captured_date and NO posted_date, so it is
 * an item on one walk and an undatedSkipped count on the other. */
test("a row with no value on the walked axis is skipped and counted, not borrowed", async () => {
  const posted = await higherGovAdapter(fakeFetch(FIXTURE), undefined, "posted_date").fetchListing(
    "2026-06-09", "2026-06-09", null,
  );
  expect(posted.items.map((i) => i.externalId)).toEqual([
    "003000000088067", "004950000088400",
  ]);
  expect(posted.undatedSkipped).toBe(1);

  /* The very same row, on the axis it DOES have a value for, is an item -- so
   * this is a fact about the walk, not about the row. */
  const captured = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(captured.items.map((i) => i.externalId)).toContain("FORECAST-2027-ROADS");
  expect(captured.undatedSkipped).toBe(0);
});

/* The refusal message names the axis IN USE. Hard-coded "captured_date" was
 * simply false on a posted_date walk, and a refusal that misdescribes what the
 * adapter does sends the reader to fix the wrong thing. */
test("the multi-day refusal names the axis actually being walked", async () => {
  await expect(
    higherGovAdapter(fakeFetch(FIXTURE), undefined, "posted_date").fetchListing(
      "2026-06-01", "2026-06-05", null,
    ),
  ).rejects.toThrow(/reads a single posted_date per call/);
  await expect(
    higherGovAdapter(fakeFetch(FIXTURE)).fetchListing("2026-09-01", "2026-09-05", null),
  ).rejects.toThrow(/reads a single captured_date per call/);
});

/* requestUrl is PERSISTED in the artifact, and it is the only record there of
 * what was actually asked for -- so it must follow the axis. It must also stay
 * the synthetic `highergov:` form: the real URL carries the api_key as a query
 * parameter (CLAUDE.md §5.3). */
test("requestUrl names the axis and still carries no api_key", async () => {
  const posted = await higherGovAdapter(fakeFetch(FIXTURE), undefined, "posted_date").fetchListing(
    "2026-06-09", "2026-06-09", null,
  );
  expect(posted.requestUrl).toBe("highergov:/opportunity/?posted_date=2026-06-09");
  expect(posted.requestUrl).not.toContain("api_key");

  const captured = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(captured.requestUrl).toBe("highergov:/opportunity/?captured_date=2026-09-03");
});

/* 🔴 EVIDENCE THAT LIES. The envelope used to write `capturedDate: since`
 * unconditionally -- so a posted_date sample landed in the artifact labelled a
 * captured one, permanently, hashed, in the place hardest to retract. Two
 * fields rather than one renamed field: "2026-06-09" alone cannot say whether
 * it was published or crawled then. */
test("the payload envelope records WHICH AXIS it asked for, and the day", async () => {
  const posted = await higherGovAdapter(fakeFetch(FIXTURE), undefined, "posted_date").fetchListing(
    "2026-06-09", "2026-06-09", null,
  );
  const postedEnvelope = JSON.parse(posted.payload) as { axis?: unknown; day?: unknown };
  expect(postedEnvelope.axis).toBe("posted_date");
  expect(postedEnvelope.day).toBe("2026-06-09");
  /* And the old, now-lying key must be gone rather than kept alongside. */
  expect(postedEnvelope).not.toHaveProperty("capturedDate");

  const captured = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  const capturedEnvelope = JSON.parse(captured.payload) as { axis?: unknown; day?: unknown };
  expect(capturedEnvelope.axis).toBe("captured_date");
  expect(capturedEnvelope.day).toBe("2026-09-03");
});

/* The scrub is not weakened by the axis: a posted_date page's payload is
 * scrubbed by the same boundary, and scrubbing it a second time changes not
 * one byte (idempotence is what keeps the persisted bytes independent of how
 * many times they were scrubbed -- this file's own header). */
test("a posted_date page's payload is scrubbed, and scrubbing it again is a no-op", async () => {
  const body = JSON.stringify({
    meta: { pagination: { page: 1, pages: 1, count: 1 } },
    results: [
      {
        source_id: "P",
        captured_date: "2026-09-03",
        posted_date: "2026-06-09",
        document_path: "https://x/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0011",
        nested: { "https://h/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0011": "value" },
      },
    ],
  });
  const page = await higherGovAdapter(fakeFetch(body), undefined, "posted_date").fetchListing(
    "2026-06-09", "2026-06-09", null,
  );
  expect(page.payload).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0011");
  expect(page.payload).toContain("REDACTED");
  expect(scrubPayload(page.payload)).toBe(page.payload);
  expect(JSON.stringify(page.items.map((i) => i.raw))).not.toContain("FAKEKEY");
});
