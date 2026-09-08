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

import {
  higherGovClient,
  isPartialDay,
  MAX_PAGES_PER_DAY,
  recordsAlreadyBilled,
  redact,
  singlePageBudget,
  VENDOR_PAGE_RECORD_CAP,
} from "./highergov-client.js";

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
 * miss, the exact failure this slice exists to catch. Since 2026-09-08 the
 * client also WALKS those pages; `pages` beside `pagesFetched` is what says
 * whether it got to the end of them. */
test("pages is read from meta.pagination, so a caller can detect a truncated day", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.pages).toBe(1);
});

/* ═══════════════════════════════════════════════════════════════════════════
 * MULTI-PAGE FETCHING. 🛑 The most dangerous code in this project: every
 * other paid call buys exactly one response, and this one decides for itself
 * how many to buy, against an allowance that cannot be read back from the
 * vendor at all (CLAUDE.md §5.1). Every case below injects fetchImpl; not one
 * record is bought by this file.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* Returns a DIFFERENT body per page, so a test can tell "walked three pages"
 * from "asked for page one three times" -- and records the page_number each
 * request actually carried, because that is the parameter the vendor bills
 * against and the only proof the walk asked for anything new. */
function pagedFetch(
  pages: number,
  rowsPerPage: number,
): typeof fetch & { calls: string[]; pageNumbers: Array<string | null> } {
  const calls: string[] = [];
  const pageNumbers: Array<string | null> = [];
  const impl = (async (url: string | URL) => {
    const parsed = new URL(String(url));
    calls.push(String(url));
    const asked = parsed.searchParams.get("page_number");
    pageNumbers.push(asked);
    const pageNumber = asked === null ? 1 : Number(asked);
    const body = JSON.stringify({
      meta: { pagination: { page: pageNumber, pages, count: pages * rowsPerPage } },
      results: Array.from({ length: rowsPerPage }, (_, i) => ({
        source_id: `P${pageNumber}-R${i}`,
        captured_date: "2026-09-03",
        title: `page ${pageNumber} row ${i}`,
      })),
    });
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch & { calls: string[]; pageNumbers: Array<string | null> };
  impl.calls = calls;
  impl.pageNumbers = pageNumbers;
  return impl;
}

/* 🔴 THE INERT CASE, AND IT IS THE ONE THAT MUST NOT MOVE. A day the vendor
 * says fits on one page makes exactly ONE request, and that request carries
 * no `page_number` at all -- not `page_number=1`, which would behave the same
 * today but would stop the request being provably byte-identical to one built
 * before paging existed. This is a metered API; a silently changed request is
 * a silently changed bill. */
test("a single-page day makes exactly one request, with no page_number on the wire", async () => {
  const fetchImpl = pagedFetch(1, 4);
  const out = await higherGovClient.fetchDay("2026-09-03", fetchImpl);
  expect(fetchImpl.calls).toHaveLength(1);
  expect(fetchImpl.calls[0]).not.toContain("page_number");
  expect(out.records).toBe(4);
  expect(out.pages).toBe(1);
  expect(out.pagesFetched).toBe(1);
  expect(isPartialDay(out)).toBe(false);
});

/* 🔴 THE FEATURE. Three pages of ten: thirty notices, and `records` is the
 * SUM of all three -- that figure is what api_spend writes and what every
 * ceiling calculation reads, so reporting one page's worth would understate
 * real consumption by two thirds, in the one direction that cannot be caught
 * (the vendor's meter cannot be queried; only a person reading the dashboard
 * ever sees the truth). */
test("a three-page day returns all three pages' notices, and records is their SUM", async () => {
  const fetchImpl = pagedFetch(3, 10);
  const out = await higherGovClient.fetchDay("2026-09-03", fetchImpl);
  expect(fetchImpl.calls).toHaveLength(3);
  /* Pages two and three were ASKED FOR AS SUCH -- without this, three calls
   * for page one would satisfy every count above it. */
  expect(fetchImpl.pageNumbers).toEqual([null, "2", "3"]);
  expect(out.notices).toHaveLength(30);
  expect(out.notices.map((n) => n.externalId)).toContain("P3-R9");
  expect(out.records).toBe(30);
  expect(out.pagesFetched).toBe(3);
  expect(isPartialDay(out)).toBe(false);
});

/* 🛑 GUARD 2 -- THE HARD PER-DAY PAGE CEILING. A vendor reporting something
 * absurd (here: 500 pages) must not produce an unbounded walk, and this must
 * hold with NO budget passed at all -- it is the one guard that does not
 * depend on a caller remembering anything. */
test("the per-day page ceiling stops a walk that would exceed it", async () => {
  const fetchImpl = pagedFetch(500, 2);
  const out = await higherGovClient.fetchDay("2026-09-03", fetchImpl);
  expect(fetchImpl.calls).toHaveLength(MAX_PAGES_PER_DAY);
  expect(out.pagesFetched).toBe(MAX_PAGES_PER_DAY);
  expect(out.records).toBe(MAX_PAGES_PER_DAY * 2);
  /* And it comes back marked PARTIAL, not quietly presented as the day. */
  expect(isPartialDay(out)).toBe(true);
});

/* 🛑 GUARD 3 -- THE CALLER'S BUDGET, checked before each page and priced at
 * the most that page could bill. Ten pages of 100 exist; the caller allows
 * 250. Page one bills 100 (calling fetchDay IS the decision to buy it), page
 * two brings it to 200, and page three would price at 300 -- over. So two
 * pages, and the day is PARTIAL. */
test("a budget limit stops the walk mid-day and the result is marked partial", async () => {
  const fetchImpl = pagedFetch(10, VENDOR_PAGE_RECORD_CAP);
  const out = await higherGovClient.fetchDay("2026-09-03", fetchImpl, undefined, undefined, 250);
  expect(fetchImpl.calls).toHaveLength(2);
  expect(out.records).toBe(200);
  expect(out.pages).toBe(10);
  expect(out.pagesFetched).toBe(2);
  expect(isPartialDay(out)).toBe(true);
});

/* The budget's other edge: one that cannot afford even a second page buys
 * exactly the page that was already committed to, and nothing more. This is
 * how ingest/highergov-cli.ts keeps its dry-run sample to a single page. */
test("a one-page budget buys page one and stops, however many pages exist", async () => {
  const fetchImpl = pagedFetch(9, VENDOR_PAGE_RECORD_CAP);
  const out = await higherGovClient.fetchDay(
    "2026-09-03",
    fetchImpl,
    undefined,
    undefined,
    singlePageBudget(undefined),
  );
  expect(fetchImpl.calls).toHaveLength(1);
  expect(out.pagesFetched).toBe(1);
  expect(isPartialDay(out)).toBe(true);
});

/* And a budget priced against a SMALL page size still buys a page. Pricing
 * every page at the vendor's 100-row cap would refuse page two here even
 * though a page costs 10 -- a guard that stops affordable work is a guard
 * nobody will leave switched on. */
test("the next page is priced against page_size, not always at the vendor cap", async () => {
  const fetchImpl = pagedFetch(4, 10);
  const out = await higherGovClient.fetchDay("2026-09-03", fetchImpl, 10, undefined, 30);
  expect(fetchImpl.calls).toHaveLength(3);
  expect(out.records).toBe(30);
});

/* 🛑 GUARD 4 -- A MID-DAY THROW MUST NOT LOSE WHAT WAS ALREADY BILLED. Two
 * pages succeed and bill 100; page three fails. The vendor billed those 100
 * whether or not this client could finish the day, and the three tally sites
 * that catch this error charge `unparseableResponseRecords` for the call that
 * failed -- a flat 40 -- so without the figure riding on the error, 100 real
 * records would simply vanish from api_spend. Under-reporting is the one
 * direction that lets an operator believe there is budget left when there is
 * not. */
test("a throw on page three does not lose the records billed for pages one and two", async () => {
  let call = 0;
  const flaky = (async () => {
    call += 1;
    if (call === 3) {
      return new Response("nope", { status: 500 });
    }
    const body = JSON.stringify({
      meta: { pagination: { page: call, pages: 5, count: 250 } },
      results: Array.from({ length: 50 }, (_, i) => ({
        source_id: `C${call}-R${i}`,
        captured_date: "2026-09-03",
      })),
    });
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  let caught: unknown;
  try {
    await higherGovClient.fetchDay("2026-09-03", flaky);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(recordsAlreadyBilled(caught)).toBe(100);
  /* The vendor's own diagnostic must survive the wrapping -- the tally sites
   * re-throw this error and an operator has to be able to read it. */
  expect((caught as Error).message).toContain("HigherGov answered 500");
  /* No cause chain: console.error prints one, and nothing here can vouch for
   * what a runtime put in it (CLAUDE.md §5.3 rule 2). */
  expect((caught as Error & { cause?: unknown }).cause).toBeUndefined();
});

/* The inert half of guard 4: a failure on PAGE ONE is a failure of a single
 * call, exactly as it was before paging existed. Nothing was billed that the
 * existing conservative estimate does not already cover, so the error must
 * carry no figure at all -- adding one would double-count. */
test("a throw on page one carries no already-billed figure, as before paging", async () => {
  let caught: unknown;
  try {
    await higherGovClient.fetchDay("2026-09-03", fakeFetch("nope", 500));
  } catch (err) {
    caught = err;
  }
  expect(recordsAlreadyBilled(caught)).toBe(0);
  expect((caught as Error).message).toBe("HigherGov answered 500");
});

/* recordsAlreadyBilled must be ZERO for every ordinary error, or three tally
 * sites would start adding a number that came from nowhere. */
test("recordsAlreadyBilled is zero for anything that carries no such figure", () => {
  expect(recordsAlreadyBilled(new Error("plain"))).toBe(0);
  expect(recordsAlreadyBilled(undefined)).toBe(0);
  expect(recordsAlreadyBilled(null)).toBe(0);
  expect(recordsAlreadyBilled("a string")).toBe(0);
  expect(recordsAlreadyBilled({ recordsBilled: "12" })).toBe(0);
  expect(recordsAlreadyBilled({ recordsBilled: Number.NaN })).toBe(0);
});

/* A vendor that reports more pages than it can actually serve has told us its
 * own pagination is not to be trusted; walking on regardless is exactly the
 * unbounded-walk risk the ceiling exists for. The walk stops -- and reports
 * PARTIAL rather than claiming the day, because "we do not know what we
 * missed" is the honest reading and the safe one for a caller deciding
 * whether to grade it. */
test("an empty page ends the walk, and the day is reported partial rather than whole", async () => {
  let call = 0;
  const drying = (async () => {
    call += 1;
    const rows = call >= 3 ? 0 : 5;
    const body = JSON.stringify({
      meta: { pagination: { page: call, pages: 6, count: 10 } },
      results: Array.from({ length: rows }, (_, i) => ({
        source_id: `D${call}-R${i}`,
        captured_date: "2026-09-03",
      })),
    });
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  const out = await higherGovClient.fetchDay("2026-09-03", drying);
  expect(call).toBe(3);
  expect(out.records).toBe(10);
  expect(out.pagesFetched).toBe(3);
  expect(isPartialDay(out)).toBe(true);
});

/* `pages: null` -- the vendor said nothing about pagination -- must NOT be
 * probed. Asking for page two to find out costs records, and this client does
 * not spend to satisfy curiosity. It is also not partial: there is no figure
 * to be short of, and manufacturing a truncation from silence would abort
 * every run against a response shape nobody has seen. */
test("a response with no pages field is never probed for a second page", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 2 } },
    results: [
      { source_id: "N1", captured_date: "2026-09-03" },
      { source_id: "N2", captured_date: "2026-09-03" },
    ],
  });
  const fetchImpl = fakeFetch(body);
  const out = await higherGovClient.fetchDay("2026-09-03", fetchImpl);
  expect(fetchImpl.calls).toHaveLength(1);
  expect(out.pages).toBeNull();
  expect(isPartialDay(out)).toBe(false);
});

/* Every page of a day asks the SAME question except page_number -- the axis,
 * the search scope and the page size all ride along. A page two that lost
 * `search_id` would be an unscoped nationwide pull billed in full (R1
 * measured 5,266 records for one such day), which is the single most
 * expensive mistake available in this file. */
test("every page carries the same axis, search_id and page_size as page one", async () => {
  const fetchImpl = pagedFetch(3, 2);
  await higherGovClient.fetchDay("2026-06-09", fetchImpl, 25, "posted_date");
  expect(fetchImpl.calls).toHaveLength(3);
  for (const call of fetchImpl.calls) {
    expect(call).toContain("posted_date=2026-06-09");
    expect(call).not.toContain("captured_date");
    expect(call).toContain("search_id=TESTSEARCHIDTESTSEARCHID0000");
    expect(call).toContain("page_size=25");
    expect(call).toContain("api_key=");
  }
});

/* The measured vendor cap, pinned so the price the budget arithmetic uses
 * cannot drift from the observation it came from: a run requesting
 * --page-size=300 produced 14 calls of exactly 100 records (2026-09-08). */
test("a page is priced at the vendor's measured 100-row cap, never at page_size above it", () => {
  expect(VENDOR_PAGE_RECORD_CAP).toBe(100);
  expect(singlePageBudget(undefined)).toBe(100);
  expect(singlePageBudget(300)).toBe(100);
  expect(singlePageBudget(10)).toBe(10);
});

/* The walk must not page a `source_id` lookup: it answers about ONE notice,
 * so paging it would buy pages of a result set that is a single row by
 * construction. */
test("fetchBySourceId does not page, whatever the response claims", async () => {
  const body = JSON.stringify({
    meta: { pagination: { page: 1, pages: 7, count: 7 } },
    results: [{ source_id: "003000000088067", captured_date: "2026-09-03" }],
  });
  const fetchImpl = fakeFetch(body);
  const out = await higherGovClient.fetchBySourceId("003000000088067", fetchImpl);
  expect(fetchImpl.calls).toHaveLength(1);
  expect(out.pagesFetched).toBe(1);
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

/* ⚖️ THE AXIS (Matt's ruling, 2026-09-07; design spec §3.2's amendment).
 * BACKFILL runs on posted_date, LIVE stays on captured_date.
 *
 * 🔴 THE MANDATORY INERT-DEFAULT TEST, and it is the one that stops this whole
 * change from silently altering what every EXISTING run asks for. Omitting the
 * axis must put `captured_date` on the wire and `posted_date` nowhere on it --
 * asserted on the query string itself, because a parsed FeedResult looks
 * identical either way (the same trap review finding #2 caught for search_id,
 * which stayed green with its line deleted). */
test("fetchDay asks captured_date and never posted_date when no axis is given", async () => {
  const fetchImpl = fakeFetch(FIXTURE);
  await higherGovClient.fetchDay("2026-09-03", fetchImpl);
  expect(fetchImpl.calls).toHaveLength(1);
  expect(fetchImpl.calls[0]).toContain("captured_date=2026-09-03");
  expect(fetchImpl.calls[0]).not.toContain("posted_date");
});

/* 🔴 AND THE OTHER AXIS MUST ACTUALLY REPLACE IT, not join it. Sending both
 * would intersect two filters on this endpoint and return a window nobody
 * asked for -- billed in full, since the meter counts records returned. */
test("an explicit posted_date axis asks posted_date and never captured_date", async () => {
  const fetchImpl = fakeFetch(FIXTURE);
  await higherGovClient.fetchDay("2026-06-09", fetchImpl, undefined, "posted_date");
  expect(fetchImpl.calls).toHaveLength(1);
  expect(fetchImpl.calls[0]).toContain("posted_date=2026-06-09");
  expect(fetchImpl.calls[0]).not.toContain("captured_date");
});

/* Naming the default explicitly must be indistinguishable from omitting it --
 * that is what lets ingest/highergov-cli.ts always pass a resolved axis (so it
 * can PRINT which one it measured on) without that itself being a change to
 * the request. Compared as whole URLs, not by substring: a difference anywhere
 * in the query string is a difference in what was billed. */
test("naming captured_date explicitly builds the identical URL to omitting the axis", async () => {
  const omitted = fakeFetch(FIXTURE);
  const explicit = fakeFetch(FIXTURE);
  await higherGovClient.fetchDay("2026-09-03", omitted);
  await higherGovClient.fetchDay("2026-09-03", explicit, undefined, "captured_date");
  expect(explicit.calls[0]).toBe(omitted.calls[0]);
});

/* The search_id scope is not an accident of the captured_date branch: an
 * unscoped posted_date pull bills every row nationwide exactly as an unscoped
 * captured_date one does (R1 -- /opportunity/ has no location parameter at
 * all). One code path is what makes this true without a second assertion
 * somewhere else. */
test("a posted_date request still carries search_id and the api_key", async () => {
  const fetchImpl = fakeFetch(FIXTURE);
  await higherGovClient.fetchDay("2026-06-09", fetchImpl, undefined, "posted_date");
  expect(fetchImpl.calls[0]).toContain("search_id=TESTSEARCHIDTESTSEARCHID0000");
  expect(fetchImpl.calls[0]).toContain("api_key=");
});

/* The vendor's PUBLICATION date, parsed at the same boundary as capturedDate
 * -- the adapter needs it as a named field to use as `modifiedAt`, and a
 * field it has to dig out of `raw` by hand is a field that drifts out of step
 * with the query parameter. The fixture's posted dates differ from its
 * captured dates on purpose: reading the wrong one would be invisible if they
 * matched. */
test("a parsed notice carries posted_date, distinct from captured_date", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  const first = out.notices[0]!;
  expect(first.capturedDate).toBe("2026-09-03");
  expect(first.postedDate).toBe("2026-06-09");
});

/* A row with no posted_date at all yields null, not the captured date and not
 * a guess -- the adapter's undated-skip depends on being able to tell "this
 * row has no position on the axis I am walking" from "it has one". */
test("a row with no posted_date yields null rather than borrowing captured_date", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  const row = out.notices.find((n) => n.externalId === "003000000088200")!;
  expect(row.capturedDate).toBe("2026-09-05T14:30:00Z");
  expect(row.postedDate).toBeNull();
});

/* 🔴 BOTH DATE SCALARS CROSS THE BOUNDARY, so both go through redact() --
 * either can become an item's `modifiedAt`, which scrape/run.ts folds into the
 * run's low-water marker and writes into the artifact. Before the axis work
 * these were the only vendor-controlled strings on a FeedNotice that skipped
 * the scrub entirely; `raw` was redacted and they were not. */
test("a key-shaped value in either date field is redacted, not carried through", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 1, pages: 1 } },
    results: [
      {
        source_id: "Z",
        captured_date: "https://x/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0010",
        posted_date: "https://y/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0010",
      },
    ],
  });
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(body));
  expect(JSON.stringify(out)).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0010");
  expect(out.notices[0]!.capturedDate).toContain("api_key=REDACTED");
  expect(out.notices[0]!.postedDate).toContain("api_key=REDACTED");
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
