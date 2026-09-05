/* Pure over a stubbed fetch -- no database, no network. That is the point of
 * extracting this: the part that talks to a source can be tested without the
 * batch machinery around it. */
import { expect, test } from "vitest";
import { samDocumentClient, DOCUMENT_CLIENTS } from "./document-clients.js";

function stubFetch(body: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
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
