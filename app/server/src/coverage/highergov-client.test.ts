/* 🛑 NO LIVE CALLS. CLAUDE.md §5.1 covers testing explicitly. Every case here
 * injects fetchImpl and returns the committed fixture. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

/* fetchDay builds its URL BEFORE it calls the injected fetchImpl, so apiKey()
 * runs even here -- without this the suite fails wherever the key is absent,
 * and CI has no .env at all. HARD-SET rather than `??=`: if .env carries a
 * real key, defaulting would interpolate the real credential into a URL
 * string. It is never sent anywhere, but CLAUDE.md §5.3's posture is that
 * this value is not handled casually. */
process.env.HIGHERGOV_API_KEY = "TESTKEYTESTKEYTESTKEYTESTKEY0000";

/* Same reasoning as HIGHERGOV_API_KEY above, and for the same structural
 * reason: fetchDay now throws if this is unset (the fix for review finding
 * #1 -- an unscoped call bills every row nationwide for the day, measured at
 * 5,266 records for one unfiltered Indiana day). Every test that calls
 * fetchDay needs this set BEFORE the import runs. */
process.env.HIGHERGOV_SEARCH_ID = "TESTSEARCHIDTESTSEARCHID0000";

import { higherGovClient, redact } from "./highergov-client.js";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/highergov-opportunity.json", import.meta.url)),
  "utf8",
);

/* Captures the URL each call was made with, so a test can assert on the QUERY
 * STRING itself -- not merely on the parsed result, which stayed green even
 * with the search_id line deleted (review finding #2). */
function fakeFetch(body: string, status = 200): typeof fetch & { calls: string[] } {
  const calls: string[] = [];
  const impl = (async (url: string | URL) => {
    calls.push(String(url));
    return new Response(body, { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch & { calls: string[] };
  impl.calls = calls;
  return impl;
}

test("a day pull returns one notice per result row", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.notices).toHaveLength(4);
  expect(out.notices[0]!.externalId).toBe("003000000088067");
  expect(out.notices[0]!.capturedDate).toBe("2026-09-03");
});

/* 🔴 THE METER COUNTS RECORDS RETURNED, not rows we keep. Verified
 * 2026-09-03: 478 -> 489 on one call returning 1 opportunity + 10 documents.
 * The duplicate pair in the fixture is still TWO billed records even though
 * dedup will later collapse them to one notice. */
test("records billed is the row count, before any dedup", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.records).toBe(4);
});

test("the feed count is read from meta.pagination, for the saved-search detector", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.feedCount).toBe(4);
});

/* Review finding #2 (compare.ts's leadDays cannot survive this on its own --
 * this test only proves the CLIENT is a faithful pass-through). Nothing in
 * this repo pins the vendor's response shape to a bare YYYY-MM-DD; the
 * client's job is to hand the raw string on, unmodified, and let compare.ts
 * decide how to parse it. */
test("a timestamp-shaped captured_date is passed through as-is, not truncated or reparsed", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  const row = out.notices.find((n) => n.externalId === "003000000088200");
  expect(row?.capturedDate).toBe("2026-09-05T14:30:00Z");
});

/* Review finding #3: a truncated day must be DETECTABLE by a caller, not
 * silently read as HigherGov not having the rows -- that would be a false
 * miss, the exact failure this slice exists to catch. This client still
 * fetches page one only; it just stops hiding whether there was a page two. */
test("pages is read from meta.pagination, so a caller can detect a truncated day", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.pages).toBe(1);
});

test("a non-OK response throws rather than reporting an empty feed", async () => {
  await expect(higherGovClient.fetchDay("2026-09-03", fakeFetch("nope", 500))).rejects.toThrow();
});

/* 🔴 THE LEAK TEST. A live key was leaked on 2026-09-03 and rotated the same
 * hour, because a scrub() helper covered every ERROR path while field VALUES
 * printed raw. document_path embeds the api_key in EVERY response. */
test("the redactor removes an api_key nested anywhere in a response", () => {
  const raw = {
    results: [
      { document_path: "https://x/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001" },
      { nested: { deeper: ["https://y/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001"] } },
    ],
  };
  const printed = JSON.stringify(redact(raw));
  expect(printed).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001");
  expect(printed).toContain("REDACTED");
});

test("the redactor leaves harmless values alone", () => {
  expect(redact({ title: "Walleye", count: 3 })).toEqual({ title: "Walleye", count: 3 });
});

/* 🔴 A KEY-SHAPED PROPERTY NAME, NOT ONLY A VALUE. redact() used to walk
 * values only (`out[k] = redact(v)`), so a credential sitting in a property
 * NAME crossed this boundary untouched. `raw` is what scrape/run.ts writes
 * into the hashed artifact and ingest/import-artifact.ts writes into
 * Postgres `sighting.raw` jsonb -- permanent, and the hardest place to
 * retract from. The adapter's string-level scrubPayload() caught this for
 * `page.payload` and for nothing else. */
test("the redactor removes an api_key sitting in a property NAME, not just a value", () => {
  const raw = {
    "https://x/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0005": "harmless value",
    nested: { deeper: { "?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0005": 1 } },
  };
  const printed = JSON.stringify(redact(raw));
  expect(printed).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0005");
  expect(printed).toContain("api_key=REDACTED");
});

/* ⚠️ IDEMPOTENCE IS LOAD-BEARING, and redacting KEYS could have broken it:
 * a redacted name is itself key-shaped, so a second pass must rewrite it to
 * the identical string rather than to something new. scrubPayload() (the
 * string form, pinned in adapters/highergov.test.ts) is this same function,
 * so byte-stability of what gets persisted rests on exactly this. */
test("redacting an already-redacted structure changes nothing, keys included", () => {
  const raw = {
    "https://x/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0006": {
      url: "https://y/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0006",
      list: ["?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0006", "plain"],
    },
  };
  const once = redact(raw);
  expect(JSON.stringify(redact(once))).toBe(JSON.stringify(once));
});

/* document_path is a CREDENTIAL, not a URL (CLAUDE.md §5.3). It must not
 * survive into anything a caller could persist or print. */
test("a parsed notice carries no document_path at all", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(JSON.stringify(out)).not.toContain("api_key");
  expect(JSON.stringify(out)).not.toContain("document_path");
});

/* Review finding #2: fetchDay's ONLY geographic filter is search_id -- this
 * asserts it is actually ON THE WIRE, not merely that the parsed result looks
 * right (which stayed green even with the search_id line deleted). */
test("fetchDay puts search_id on the request", async () => {
  const fetchImpl = fakeFetch(FIXTURE);
  await higherGovClient.fetchDay("2026-09-03", fetchImpl);
  expect(fetchImpl.calls).toHaveLength(1);
  expect(fetchImpl.calls[0]).toContain("search_id=TESTSEARCHIDTESTSEARCHID0000");
});

/* 🔴 THE TEST THAT STOPS page_size FROM SILENTLY TRIPLING SPEND. Omitting the
 * new (optional) third argument must produce a request BYTE-IDENTICAL to one
 * that never knew page_size existed -- not the vendor's own default (10)
 * written out explicitly, which would still behave the same today but would
 * no longer be provable from the wire alone. */
test("fetchDay sends no page_size when none is given -- today's request, unchanged", async () => {
  const fetchImpl = fakeFetch(FIXTURE);
  await higherGovClient.fetchDay("2026-09-03", fetchImpl);
  expect(fetchImpl.calls).toHaveLength(1);
  expect(fetchImpl.calls[0]).not.toContain("page_size");
});

test("fetchDay puts page_size on the request when one is explicitly given", async () => {
  const fetchImpl = fakeFetch(FIXTURE);
  await higherGovClient.fetchDay("2026-09-03", fetchImpl, 50);
  expect(fetchImpl.calls[0]).toContain("page_size=50");
});

/* fetchBySourceId had NO test at all -- the one asymmetry Task 7 depends on
 * (an exact-id lookup must never be narrowed by a saved search) was
 * unverified. This exercises it end to end against the fixture AND asserts
 * search_id is absent from the wire. */
test("fetchBySourceId returns notices and sends no search_id", async () => {
  const fetchImpl = fakeFetch(FIXTURE);
  const out = await higherGovClient.fetchBySourceId("003000000088191", fetchImpl);
  expect(out.notices).toHaveLength(4);
  expect(fetchImpl.calls).toHaveLength(1);
  expect(fetchImpl.calls[0]).toContain("source_id=003000000088191");
  expect(fetchImpl.calls[0]).not.toContain("search_id");
});

/* THE REGRESSION TEST for the money bug (review finding #1): an unset
 * HIGHERGOV_SEARCH_ID must fail LOUD, not fall back to an unfiltered
 * nationwide call that bills every row for the day (measured: 5,266 records
 * for one unfiltered Indiana day, against a 10,000/month allowance that
 * cannot be read back from the vendor). */
test("fetchDay throws when HIGHERGOV_SEARCH_ID is unset, rather than fetching unscoped", async () => {
  const saved = process.env.HIGHERGOV_SEARCH_ID;
  delete process.env.HIGHERGOV_SEARCH_ID;
  try {
    await expect(higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE))).rejects.toThrow(
      /HIGHERGOV_SEARCH_ID/,
    );
  } finally {
    process.env.HIGHERGOV_SEARCH_ID = saved;
  }
});

/* Review finding #4: proves the VITEST guard is real, the same way the
 * mutation check proves redact() is real. No fetchImpl is injected here --
 * fetchDay falls through to the real global fetch, which is exactly the
 * "one forgotten argument" scenario the guard exists to catch. If this
 * throws anything other than the guard's own message, it means a live,
 * billed HTTP request was about to be attempted. */
test("fetchDay refuses a live fetch when fetchImpl is left at its default under vitest", async () => {
  await expect(higherGovClient.fetchDay("2026-09-03")).rejects.toThrow(/refusing a live fetch/);
});

/* 🔴 CREDENTIAL-ADJACENT (final review, item 1). A truncated or malformed 200
 * can make JSON.parse's own SyntaxError quote a window of raw input around
 * the error position -- version-dependent, but when it happens, for a
 * truncated body that window sits near the END of the payload, exactly where
 * document_path (and its embedded api_key) lives. This body is cut off
 * mid-string, right after "api_key=". Rather than pin a specific V8 error
 * message's exact wording (which varies by Node version), this asserts the
 * two things that must hold regardless: the raw SyntaxError never escapes
 * unwrapped (a raw one never says "malformed JSON body"), and whatever the
 * final message says, it does not carry the fake key through. */
test("a malformed JSON 200 throws a clean, redacted error instead of a raw SyntaxError", async () => {
  const truncated =
    '{"results":[{"document_path":"https://x/api-external/document/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0002';
  let caught: unknown;
  try {
    await higherGovClient.fetchDay("2026-09-03", fakeFetch(truncated));
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(Error);
  /* A raw, unfixed SyntaxError's own message never says this -- it proves the
   * try/catch actually wrapped it rather than letting it bubble through
   * verbatim, regardless of how much (if any) raw context a given V8/Node
   * version chooses to quote in its own message. */
  expect((caught as Error).message).toContain("malformed JSON body");
  expect((caught as Error).message).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0002");
});

/* 🔴 SPEND UNDER-REPORT (final review, item 1). `body.results ?? []` only
 * catches null/undefined -- a truthy-but-wrong shape reaches `.map()`
 * unguarded and throws a bare TypeError, and that throw happens in run.ts
 * BEFORE recordSpend, so a call the vendor already billed never reaches
 * api_spend. This must fail with a clean, named error instead. */
test("a non-array \"results\" field throws a clean error rather than a bare TypeError", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 0, pages: 1 } },
    results: { not: "an array" },
  });
  await expect(higherGovClient.fetchDay("2026-09-03", fakeFetch(body))).rejects.toThrow(
    /non-array "results"/,
  );
});

/* The ingest needs every field the coverage test threw away -- description,
 * deadline, agency -- but document_path must STILL never appear. The whole
 * value of one client is that this stays true in one place. */
test("a notice carries the full record, with document_path removed", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  const first = out.notices[0]!;
  expect(first.raw).toBeDefined();
  expect(first.raw.source_id).toBe("003000000088067");
  expect(first.raw.title).toBe("300 SP Salamonie Sludge and WW RemovalBid Documents");
  expect("document_path" in first.raw).toBe(false);
});

test("no key-shaped value survives into raw, at any depth", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  const serialized = JSON.stringify(out.notices.map((n) => n.raw));
  expect(serialized).not.toContain("api_key");
  expect(serialized).not.toContain("FAKEKEY");
});

/* Proves that redact() runs on raw and catches nested keys, not just the
 * top-level document_path. The fixture itself carries no nested urls, so
 * this test must inject them inline. */
test("redact() removes key-shaped values nested deeply in raw", async () => {
  const bodyWithNestedKey = JSON.stringify({
    meta: { pagination: { count: 1, pages: 1 } },
    results: [
      {
        source_id: "nested-test-id",
        captured_date: "2026-09-03",
        version_key: "v1",
        title: "Test with nested key",
        document_path: "https://example.com/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0099",
        metadata: {
          nested_field: "value",
          deeper: {
            url: "https://example.com/doc?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0099",
          },
        },
      },
    ],
  });
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(bodyWithNestedKey));
  const serialized = JSON.stringify(out.notices.map((n) => n.raw));
  /* The key at the top level is removed by destructuring. Nested ones are
   * removed by redact(), which walks every value recursively. The actual key
   * value should never survive; redaction should replace it with REDACTED. */
  expect(serialized).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0099");
  expect(serialized).toContain("api_key=REDACTED");
});

/* Task 7: fetchDocuments. Verified 2026-09-03: 478 -> 489 on one call
 * returning 1 opportunity + 10 documents -- ~11 records per call, the single
 * most expensive thing in this codebase per invocation. Every one of
 * fetchDay's protections (apiKey(), the VITEST guard, the redact()-wrapped
 * parse) must hold for it too. */

const DOCUMENTS_BODY = JSON.stringify({
  meta: { pagination: { count: 2, pages: 1 } },
  results: [
    {
      file_name: "sow.pdf",
      document_path: "https://x/api-external/document/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0003",
    },
    {
      file_name: "addendum.docx",
      document_path: "https://x/api-external/document/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0003",
    },
  ],
});

test("fetchDocuments returns one FetchedDoc per document row", async () => {
  const out = await higherGovClient.fetchDocuments("003000000088067", fakeFetch(DOCUMENTS_BODY));
  expect(out.docs).toHaveLength(2);
  expect(out.docs[0]!.fileName).toBe("sow.pdf");
  expect(out.docs[1]!.fileName).toBe("addendum.docx");
});

/* 🔴 records IS WHAT THE VENDOR BILLED, not what this client kept. */
test("fetchDocuments reports what the vendor billed, not what we kept", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 2 } },
    results: [
      { file_name: "sow.pdf", document_path: "https://x/?api_key=FAKEKEYFAKEKEY0002" },
      { file_name: "", document_path: "https://x/?api_key=FAKEKEYFAKEKEY0002" },
    ],
  });
  const out = await higherGovClient.fetchDocuments("003000000088067", fakeFetch(body));
  /* The empty file_name is unusable and dropped, but both rows were billed. */
  expect(out.docs).toHaveLength(1);
  expect(out.records).toBe(2);
});

/* 🔴 THE HARD CONSTRAINT. An exact-id lookup narrowed by a saved search
 * would report a notice's documents as absent when they were merely out of
 * scope -- the same reasoning fetchBySourceId already carries. */
test("fetchDocuments sends source_id and no search_id", async () => {
  const fetchImpl = fakeFetch(DOCUMENTS_BODY);
  await higherGovClient.fetchDocuments("003000000088067", fetchImpl);
  expect(fetchImpl.calls).toHaveLength(1);
  expect(fetchImpl.calls[0]).toContain("source_id=003000000088067");
  expect(fetchImpl.calls[0]).not.toContain("search_id");
});

/* Same guard as fetchDay's own test: no fetchImpl injected, so this falls
 * through to the real global fetch -- the "one forgotten argument" scenario
 * the guard exists to catch on the single most expensive call in the app. */
test("fetchDocuments refuses a live fetch when fetchImpl is left at its default under vitest", async () => {
  await expect(higherGovClient.fetchDocuments("003000000088067")).rejects.toThrow(
    /refusing a live fetch/,
  );
});

/* document_path is a CREDENTIAL (CLAUDE.md §5.3) and must not survive into
 * anything a caller could persist or print, same as it must not for a
 * FeedNotice. */
test("a fetched doc carries no document_path or api_key", async () => {
  const out = await higherGovClient.fetchDocuments("003000000088067", fakeFetch(DOCUMENTS_BODY));
  expect(JSON.stringify(out)).not.toContain("api_key");
  expect(JSON.stringify(out)).not.toContain("document_path");
  expect(JSON.stringify(out)).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0003");
});

/* docs/2026-09-03-highergov-field-mapping.md §2 names the /document/ field
 * `download_url`, not `document_path` -- the schema doc and this repo's own
 * opportunity fixtures disagree on the name. Whichever the live API uses,
 * the key must never survive. */
test("fetchDocuments also drops a download_url field, whichever name the vendor uses", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 1 } },
    results: [
      {
        file_name: "sow.pdf",
        download_url: "https://x/signed?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0004",
      },
    ],
  });
  const out = await higherGovClient.fetchDocuments("003000000088067", fakeFetch(body));
  expect(JSON.stringify(out)).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0004");
});

test("a non-OK response throws for fetchDocuments too", async () => {
  await expect(higherGovClient.fetchDocuments("x", fakeFetch("nope", 500))).rejects.toThrow();
});

/* 🔴 THE DOCUMENT PATH HAD NO REDACTION BOUNDARY AT ALL. fetchValidated()
 * redacts its ERROR MESSAGES; it never redacted its RETURN VALUE, and unlike
 * the opportunity path (toNotice -> `raw: redact(rest)`) toFetchedDoc read
 * file_name and text_extract straight off the raw body. Both fields are
 * vendor-controlled, and extract/fetch-documents-for.ts writes text_extract
 * into `document.extracted_text` permanently. Not-reading document_path
 * defends against the field we know carries the key; it says nothing about a
 * key-shaped string arriving anywhere else on the row. */
test("fetchDocuments redacts a key-shaped file_name and text_extract, not only errors", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 1 } },
    results: [
      {
        file_name: "sow?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0007.pdf",
        text_extract:
          "See https://x/api-external/document/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0007 for the addendum.",
      },
    ],
  });
  const out = await higherGovClient.fetchDocuments("003000000088067", fakeFetch(body));
  expect(out.docs).toHaveLength(1);
  expect(JSON.stringify(out)).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0007");
  expect(out.docs[0]!.fileName).toContain("api_key=REDACTED");
  expect(out.docs[0]!.textExtract).toContain("api_key=REDACTED");
});

/* A null text_extract (the `.xlsx` case, per the field-mapping doc) must
 * still come back null -- redact() passing a non-string through unchanged is
 * what fetch-documents-for.ts's status decision depends on. */
test("a null text_extract survives redaction as null, not as a string", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 1 } },
    results: [{ file_name: "cost-proposal.xlsx", text_extract: null }],
  });
  const out = await higherGovClient.fetchDocuments("003000000088067", fakeFetch(body));
  expect(out.docs[0]!.textExtract).toBeNull();
});

/* 🔴 FIX 6a: the parse guard's comment claimed "nothing downstream --
 * including the CLI's own console.error(err) -- can print it raw even by
 * accident", and that was true of the PARSE path alone. A rejection from the
 * fetch layer carried whatever the runtime attached, `cause` included, and
 * the CLI prints errors. This pins that a transport rejection is re-wrapped
 * with a redacted message and NO cause chain to print. */
test("a rejection from the fetch layer is re-wrapped redacted, with no cause chain", async () => {
  const throwing = (async () => {
    const err = new Error("fetch failed");
    (err as Error & { cause?: unknown }).cause = new Error(
      "connect ECONNREFUSED for https://www.highergov.com/api-external/opportunity/" +
        "?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0008",
    );
    throw err;
  }) as unknown as typeof fetch;

  let caught: unknown;
  try {
    await higherGovClient.fetchDay("2026-09-03", throwing);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toContain("before any response");
  /* The cause is DROPPED, not merely redacted: console.error prints a cause
   * chain, and nothing here can vouch for what a runtime put in one. */
  expect((caught as Error & { cause?: unknown }).cause).toBeUndefined();
  expect(JSON.stringify((caught as Error).message)).not.toContain("FAKEKEY");
});
