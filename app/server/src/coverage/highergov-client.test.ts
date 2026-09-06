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

import { higherGovClient, redact } from "./highergov-client.js";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/highergov-opportunity.json", import.meta.url)),
  "utf8",
);

function fakeFetch(body: string, status = 200): typeof fetch {
  return (async () =>
    new Response(body, { status, headers: { "content-type": "application/json" } })) as any;
}

test("a day pull returns one notice per result row", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.notices).toHaveLength(3);
  expect(out.notices[0]!.externalId).toBe("003000000088067");
  expect(out.notices[0]!.capturedDate).toBe("2026-09-03");
});

/* 🔴 THE METER COUNTS RECORDS RETURNED, not rows we keep. Verified
 * 2026-09-03: 478 -> 489 on one call returning 1 opportunity + 10 documents.
 * The duplicate pair in the fixture is still TWO billed records even though
 * dedup will later collapse them to one notice. */
test("records billed is the row count, before any dedup", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.records).toBe(3);
});

test("the feed count is read from meta.pagination, for the saved-search detector", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.feedCount).toBe(3);
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
