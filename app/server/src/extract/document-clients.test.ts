/* Pure over a stubbed fetch -- no database, no network. That is the point of
 * extracting this: the part that talks to a source can be tested without the
 * batch machinery around it. */
import { expect, test } from "vitest";

/* Same reasoning as highergov-client.test.ts: fetchDocuments builds its URL
 * (and therefore calls apiKey()) before it ever reaches the injected
 * fetchImpl, so this must be set BEFORE the import runs, and HARD-SET rather
 * than `??=` per that file's own comment. */
process.env.HIGHERGOV_API_KEY = "TESTKEYTESTKEYTESTKEYTESTKEY0000";

import { samDocumentClient, DOCUMENT_CLIENTS } from "./document-clients.js";

function stubFetch(body: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
}

/* Mirrors highergov-client.test.ts's own fakeFetch: a real Response, because
 * the HigherGov path (unlike SAM's stubFetch above) goes through
 * highergov-client.ts's res.ok / res.json() handling. */
function fakeFetch(body: string, status = 200): typeof fetch {
  return (async () =>
    new Response(body, { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
}

const ONE_ATTACHMENT = {
  _embedded: {
    opportunityAttachmentList: [
      { attachments: [{ name: "rfp.pdf", resourceId: "abc123", fileExists: "1" }] },
    ],
  },
};

test("a well-formed attachment list becomes documents", async () => {
  const r = await samDocumentClient.fetchFor("notice-1", stubFetch(ONE_ATTACHMENT));
  expect(r.documents).toHaveLength(1);
  expect(r.documents[0]!.filename).toBe("rfp.pdf");
  expect(r.documents[0]!.sourceUrl).toContain("abc123");
});

/* 🔴 SAM.gov IS FREE, AND THE ZERO IS LOAD-BEARING. It is what lets the
 * whole on-demand path -- ceiling, tally, stamp -- be exercised end to end
 * without spending a single metered record. */
test("SAM reports zero records billed, because SAM is free", async () => {
  const r = await samDocumentClient.fetchFor("notice-1", stubFetch(ONE_ATTACHMENT));
  expect(r.records).toBe(0);
});

/* Both guards are pre-existing discover.ts behaviour (fix round 1, item 3)
 * and must survive the extraction: `document.filename` is NOT NULL, and a
 * missing resourceId yields the well-formed URL `.../files/undefined/download`
 * and a row that is fetched, fails, and stays failed forever. */
test("an attachment with no name or no resourceId is skipped, not written", async () => {
  const malformed = {
    _embedded: {
      opportunityAttachmentList: [
        { attachments: [
          { name: "", resourceId: "abc", fileExists: "1" },
          { name: "ok.pdf", resourceId: "", fileExists: "1" },
        ] },
      ],
    },
  };
  const r = await samDocumentClient.fetchFor("notice-1", stubFetch(malformed));
  expect(r.documents).toEqual([]);
});

test("an attachment whose file does not exist is skipped", async () => {
  const gone = {
    _embedded: {
      opportunityAttachmentList: [
        { attachments: [{ name: "x.pdf", resourceId: "abc", fileExists: "0" }] },
      ],
    },
  };
  expect((await samDocumentClient.fetchFor("n", stubFetch(gone))).documents).toEqual([]);
});

/* A source that answered with an empty list HAS answered. The caller stamps
 * on this; it must not look like a failure. */
test("an empty list resolves rather than throwing", async () => {
  const r = await samDocumentClient.fetchFor("n", stubFetch({ _embedded: {} }));
  expect(r.documents).toEqual([]);
  expect(r.records).toBe(0);
});

test("a non-OK response throws, so the caller leaves no stamp", async () => {
  await expect(samDocumentClient.fetchFor("n", stubFetch({}, false))).rejects.toThrow();
});

test("unparseable JSON throws, so the caller leaves no stamp", async () => {
  const bad = (async () => ({
    ok: true,
    json: async () => {
      throw new Error("not json");
    },
  })) as unknown as typeof fetch;
  await expect(samDocumentClient.fetchFor("n", bad)).rejects.toThrow();
});

test("the registry is keyed by the canonical source.name", () => {
  expect(DOCUMENT_CLIENTS["SAM.gov"]).toBe(samDocumentClient);
});

/* ⚖️ D2 built the on-demand mechanism and deliberately left DOCUMENT_CLIENTS
 * holding one entry, so the whole path could be proven against SAM.gov at
 * zero metered cost. This is the entry it left out. */
test("HigherGov has a document client", () => {
  expect(DOCUMENT_CLIENTS["HigherGov"]).toBeDefined();
});

/* 🔴 The meter counts records RETURNED. A document fetch that returns ten
 * documents cost eleven records (1 opportunity + 10 documents, verified
 * 2026-09-03: 478 -> 489). `records` must be what the VENDOR billed, never
 * the count we kept. */
test("the document fetch reports what the vendor billed, not what we kept", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 2 } },
    results: [
      { file_name: "sow.pdf", document_path: "https://x/?api_key=FAKEKEYFAKEKEY0002" },
      { file_name: "", document_path: "https://x/?api_key=FAKEKEYFAKEKEY0002" },
    ],
  });
  const out = await DOCUMENT_CLIENTS["HigherGov"]!.fetchFor("003000000088067", fakeFetch(body));
  /* One document is unusable (no filename) and is not kept -- but both were
   * returned, so both were billed. */
  expect(out.documents).toHaveLength(1);
  expect(out.records).toBe(2);
});

test("no document url leaks the api_key", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 1 } },
    results: [{ file_name: "sow.pdf", document_path: "https://x/?api_key=FAKEKEYFAKEKEY0002" }],
  });
  const out = await DOCUMENT_CLIENTS["HigherGov"]!.fetchFor("x", fakeFetch(body));
  expect(JSON.stringify(out)).not.toContain("FAKEKEYFAKEKEY0002");
});

/* 🔴 THE THREE-STATE DISCIPLINE (CLAUDE.md, D2). HigherGov's document
 * endpoint carries either `document_path` or `download_url` -- both are
 * CREDENTIAL or CREDENTIAL-ADJACENT (docs/2026-09-03-highergov-field-mapping.md
 * §2: document_path embeds the api_key outright; download_url "expires in 60
 * minutes", so persisting it fills source_url with a dead link that looks
 * valid) -- and neither may ever leave highergov-client.ts. There is no
 * separate, stable per-document id in HigherGov's documented schema to
 * reconstruct a fresh address from later. That makes this the "we know it
 * exists, we cannot hand back an address" case, NOT "it does not exist": the
 * document must still be recorded, with sourceUrl null rather than dropped. */
test("a HigherGov document is recorded with no reachable sourceUrl, not dropped", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 1 } },
    results: [{ file_name: "sow.pdf", document_path: "https://x/?api_key=FAKEKEYFAKEKEY0002" }],
  });
  const out = await DOCUMENT_CLIENTS["HigherGov"]!.fetchFor("x", fakeFetch(body));
  expect(out.documents).toHaveLength(1);
  expect(out.documents[0]!.filename).toBe("sow.pdf");
  expect(out.documents[0]!.sourceUrl).toBeNull();
});

/* The field-mapping doc (written from the vendor's OpenAPI schema, zero live
 * calls) names the /document/ field `download_url`, not `document_path` --
 * this repo's own fixtures use `document_path` for the /opportunity/ field
 * that points AT /document/. Whichever name the live API actually uses for a
 * per-document result, the key must never survive. */
test("no document url leaks the api_key, whichever field name the vendor uses", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 1 } },
    results: [{ file_name: "sow.pdf", download_url: "https://x/signed?api_key=FAKEKEYFAKEKEY0005" }],
  });
  const out = await DOCUMENT_CLIENTS["HigherGov"]!.fetchFor("x", fakeFetch(body));
  expect(JSON.stringify(out)).not.toContain("FAKEKEYFAKEKEY0005");
});
