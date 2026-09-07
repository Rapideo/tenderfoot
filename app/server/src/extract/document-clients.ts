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
import { ADAPTERS } from "../scrape/adapters/registry.js";
/* Task 7. This is the ONLY thing this module takes from highergov-client.ts:
 * a function to call and a name to key the registry with. It never imports
 * apiKey(), never builds a URL, and never sees document_path -- the whole
 * point of the one-client rule (CLAUDE.md §5.3) is that the credential stays
 * inside coverage/highergov-client.ts. */
import { higherGovClient, HIGHERGOV_SOURCE_NAME } from "../coverage/highergov-client.js";
/* Moved here from discover.ts by the preflight ruling: these three describe
 * how to talk to SAM.gov, and leaving them behind would make discover.ts and
 * this module import each other.
 *
 * FINAL-REVIEW FIX: restored from `git show 50cb2a1^:app/server/src/extract/
 * discover.ts`, whose fuller incident history was lost in the move -- only
 * the reassuring half survived here. The full history, Task 9 fix round 1
 * (CRITICAL): the original host used here was
 * `https://api.sam.gov/prod/opportunity/v1/api/`, written FROM MEMORY and
 * never verified against a real request -- it 404s on every id shape, so
 * this code inserted zero documents, EVER, silently. `SAM_HOST` is imported
 * from scrape/adapters/sam.js rather than typed again here precisely because
 * of that history: the same host the scrape adapter and health probe already
 * use and already have verified, not a second guess at what it is. The real,
 * working, unauthenticated endpoints (documented on `SAM_HOST`'s own
 * declaration) are:
 *
 *   {SAM_HOST}/opps/v3/opportunities/{noticeId}/resources           -- list
 *   {SAM_HOST}/opps/v3/opportunities/resources/files/{resourceId}/download
 *                                                    -- 303 -> signed S3
 *
 * The response SHAPE this file already parses (_embedded.
 * opportunityAttachmentList[].attachments[]) was correct from the start;
 * only the URL was wrong. */
const resourcesUrl = (noticeId: string): string =>
  `${SAM_HOST}/opps/v3/opportunities/${encodeURIComponent(noticeId)}/resources`;
const downloadUrl = (resourceId: string): string =>
  `${SAM_HOST}/opps/v3/opportunities/resources/files/${encodeURIComponent(resourceId)}/download`;

interface AttachmentsResponse {
  _embedded?: { opportunityAttachmentList?: { attachments?: Record<string, string>[] }[] };
}

export interface FetchedDocument {
  filename: string;
  /* Task 7 widens this from `string` to `string | null`: HigherGov's
   * documents cannot always be handed a persistable address (see
   * higherGovDocumentClient below) -- and a document we know exists but
   * cannot fetch is a different fact from one that does not exist. The
   * document.source_url column is already nullable (migration 008); the
   * record screen already renders on a null source_url (Record.tsx). */
  sourceUrl: string | null;
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

/* Task 7: the document client D2 deliberately left out (its own header
 * above: "so the whole path could be proven against SAM.gov at zero metered
 * cost"). This is a THIN MAPPER, and nothing else -- it never builds a URL,
 * never reads HIGHERGOV_API_KEY, and never sees a document_path or
 * download_url value. All of that stays inside coverage/highergov-client.ts,
 * behind fetchDocuments(). */
export const higherGovDocumentClient: DocumentClient = {
  async fetchFor(externalId, fetchImpl = fetch) {
    const { docs, records } = await higherGovClient.fetchDocuments(externalId, fetchImpl);
    /* 🔴 CASE HIT: "a document with no reachable URL is still a document."
     * docs/2026-09-03-highergov-field-mapping.md §2 says the /document/
     * endpoint's own address field (`download_url`, or `document_path` per
     * this repo's /opportunity/ fixtures -- the two disagree on the name)
     * must never be stored: one embeds the api_key outright, the other
     * expires in 60 minutes and would fill source_url with a dead link that
     * looks valid. highergov-client.ts -- the one file allowed to see either
     * field -- therefore never returns it, and there is no separate stable
     * per-document id in HigherGov's documented schema to reconstruct a
     * fresh address from later. That makes this NOT "the document does not
     * exist" -- we have its filename, proof it exists -- it is "we cannot
     * hand back an address for it." sourceUrl is recorded as null rather
     * than the document being dropped, per D2's three-state discipline. */
    const documents: FetchedDocument[] = docs.map((d) => ({
      filename: d.fileName,
      sourceUrl: null,
    }));
    return { documents, records };
  },
};

/* FINAL-REVIEW FIX: this used to hand-type `"SAM.gov"` here, and
 * document-clients.test.ts pinned it against ANOTHER hand-typed copy of the
 * same literal -- so a matched typo in both places would have passed both.
 * scrape/adapters/registry.ts already carries the canonical value as
 * `sourceName`, and discover-idoa.ts documents this exact defect class at
 * length (its own `IDOA_SOURCE_NAME`, derived the same way). Derived here
 * instead of retyped, same precedent this file already sets by importing
 * `SAM_HOST` rather than retyping it above.
 *
 * The runtime check below fails LOUD at module load if the registry entry is
 * ever renamed or removed, rather than silently keying `DOCUMENT_CLIENTS`
 * with `undefined` -- the same fail-closed posture discover-idoa.ts takes.
 *
 * ⚠️ THE FAILURE MODE A MISMATCH PRODUCES, and why it is worth this guard:
 * a key that does not match `solicitation`'s actual `source.name` is not an
 * error anywhere. `fetchDocumentsFor` (fetch-documents-for.ts) looks the
 * source up in this map, finds nothing, and returns `"unsupported"` --
 * forever, for every notice from that source. Documents are simply never
 * fetched, with no thrown exception and no log line to notice it by. */
const samEntry = ADAPTERS.sam;
if (!samEntry || typeof samEntry.sourceName !== "string") {
  throw new Error(
    "scrape/adapters/registry.ts's 'sam' entry is missing or has no sourceName -- " +
      "document-clients.ts cannot key DOCUMENT_CLIENTS without it.",
  );
}
const SAM_SOURCE_NAME = samEntry.sourceName;

export const DOCUMENT_CLIENTS: Record<string, DocumentClient> = {
  [SAM_SOURCE_NAME]: samDocumentClient,
  /* ⚠️ THE FIRST METERED DOCUMENT CLIENT. ~11 records per open (verified
   * 2026-09-03), against a 1,000/month ceiling shared with the ingest --
   * roughly 90 opens a month before the ceiling refuses. Keyed by the same
   * constant highergov-client.ts exports, not a retyped literal -- the exact
   * defect class SAM_SOURCE_NAME's own derivation above guards against. */
  [HIGHERGOV_SOURCE_NAME]: higherGovDocumentClient,
};
