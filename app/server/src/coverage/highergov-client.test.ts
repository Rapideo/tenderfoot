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
