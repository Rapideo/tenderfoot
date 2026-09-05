/* ASKING A SOURCE FOR ONE NOTICE'S DOCUMENTS, AND NOTHING ELSE.
 *
 * Extracted from discoverAttachments on 2026-09-05 for ruling D2, which
 * needs the same question asked about ONE solicitation on demand. Only the
 * HTTP-and-parse half moved: the candidate query, the time budget, the
 * refresh pass and the writes are batch concepts and stayed behind.
 *
 * The argument against copying it instead is the one the production-target
 * extraction made the same day -- two implementations of the same question
 * drift, and the drift is silent.
 *
 * ⚠️ NO DATABASE ACCESS HERE, DELIBERATELY. A client fetches and parses; the
 * caller decides what to write, when to stamp, and what it cost. That is
 * what lets fetch-documents-for.ts put all three in ONE transaction. */
import { SAM_HOST } from "../scrape/adapters/sam.js";
/* Moved here from discover.ts by the preflight ruling: these three describe
 * how to talk to SAM.gov, and leaving them behind would make discover.ts and
 * this module import each other.
 *
 * discover.ts's own note on the URLs, which is why they are worth moving
 * rather than rewriting: "The response SHAPE this file already parses
 * (_embedded.opportunityAttachmentList[].attachments[]) was correct from the
 * start; only the URL was wrong." */
const resourcesUrl = (noticeId: string): string =>
  `${SAM_HOST}/opps/v3/opportunities/${encodeURIComponent(noticeId)}/resources`;
const downloadUrl = (resourceId: string): string =>
  `${SAM_HOST}/opps/v3/opportunities/resources/files/${encodeURIComponent(resourceId)}/download`;

interface AttachmentsResponse {
  _embedded?: { opportunityAttachmentList?: { attachments?: Record<string, string>[] }[] };
}

export interface FetchedDocument {
  filename: string;
  sourceUrl: string;
}

export interface DocumentFetchResult {
  documents: FetchedDocument[];
  /** What the VENDOR billed. SAM.gov is free and returns 0. */
  records: number;
}

export interface DocumentClient {
  fetchFor(externalId: string, fetchImpl?: typeof fetch): Promise<DocumentFetchResult>;
}

export const samDocumentClient: DocumentClient = {
  async fetchFor(externalId, fetchImpl = fetch) {
    /* The User-Agent is not decoration -- sam.ts's adapter and probe both
     * treat it as mandatory; the default Node agent is rejected. */
    const res = await fetchImpl(resourcesUrl(externalId), {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`SAM.gov answered ${res.status} for ${externalId}`);

    const body = (await res.json()) as AttachmentsResponse;
    const documents: FetchedDocument[] = [];
    for (const group of body._embedded?.opportunityAttachmentList ?? []) {
      for (const a of group.attachments ?? []) {
        if (a.fileExists !== "1") continue;
        /* Pre-existing guards, kept verbatim in intent: document.filename is
         * NOT NULL, and a missing resourceId produces the well-formed URL
         * `.../files/undefined/download` and a row that is fetched, fails,
         * and stays failed forever. */
        if (!a.name || !a.resourceId) continue;
        documents.push({ filename: a.name, sourceUrl: downloadUrl(a.resourceId) });
      }
    }
    /* SAM.gov costs nothing. The zero is what lets D2's whole mechanism be
     * proven before a metered source is ever wired in. */
    return { documents, records: 0 };
  },
};

/* Keyed by the canonical `source.name`, matching adapters/registry.ts's
 * `sourceName` rather than the CLI short key -- the identity that actually
 * reaches the database. */
export const DOCUMENT_CLIENTS: Record<string, DocumentClient> = {
  "SAM.gov": samDocumentClient,
};
