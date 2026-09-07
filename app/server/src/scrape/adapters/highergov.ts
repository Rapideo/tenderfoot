/* THE HIGHERGOV LISTING ADAPTER.
 *
 * 🔴 THE REASON THIS FILE IS CAREFUL. scrape/run.ts passes `page.payload`
 * straight into art.writeCapture, and ingest/import-artifact.ts hashes the
 * resulting file into ingest_run.artifact_sha256 (NOT NULL UNIQUE). Every
 * HigherGov row carries `document_path`, and `document_path` embeds the
 * api_key. An unscrubbed payload therefore writes a LIVE CREDENTIAL into
 * storage: permanently, hashed, immutable, in the place hardest to retract.
 *
 * That is the 2026-09-03 leak in a worse location. It happened because a
 * scrub() helper covered every ERROR path while field VALUES printed raw --
 * the key was thought of as something in the request, not something that
 * comes back.
 *
 * ⚠️ AND THE SCRUB MUST BE STABLE, not merely present. The artifact's hash
 * is computed over the scrubbed bytes, so a scrub applied inconsistently
 * would make two runs over identical data hash differently and quietly
 * change what the UNIQUE constraint means. scrubPayload is idempotent and
 * a test pins that.
 *
 * ⚠️ NO DATABASE ACCESS, and no spend accounting here. An adapter fetches
 * and parses; ingest/highergov-cli.ts owns the budget, the ceiling and the
 * tally -- the same split coverage/highergov-client.ts already states. */
import type { WindowedAdapter, ListingItem, ListingPage } from "../adapter.js";
import { higherGovClient, redact } from "../../coverage/highergov-client.js";

export const HIGHERGOV_ADAPTER_KEY = "highergov";

/** Scrub a raw response body for safe persistence. Idempotent: scrubbing an
 * already-scrubbed body returns it unchanged, which is what lets the
 * artifact hash be stable across runs. */
export function scrubPayload(body: string): string {
  return redact(body);
}

export function higherGovAdapter(fetchImpl: typeof fetch = fetch): WindowedAdapter {
  return {
    shape: "windowed",
    /* Must match migration 019's seeded source.name exactly --
     * resolve-source.ts looks it up by this string. */
    name: "HigherGov",

    async fetchListing(since, _until, _cursor): Promise<ListingPage> {
      /* ONE DAY PER CALL. R5 only ever sent a single `captured_date`, and
       * whether the parameter accepts a range is unverified -- the dry run
       * in highergov-cli.ts answers it for free. Until it does, the caller
       * walks days and this reads one. `since` IS the day. */
      const result = await higherGovClient.fetchDay(since, fetchImpl);

      let undatedSkipped = 0;
      const items: ListingItem[] = [];
      for (const n of result.notices) {
        /* adapter.ts §5.4: a record with no usable date cannot be placed in
         * the window. Counted, never allowed to decide it. */
        if (!n.capturedDate) {
          undatedSkipped++;
          continue;
        }
        items.push({ externalId: n.externalId, modifiedAt: n.capturedDate, raw: n.raw });
      }

      return {
        items,
        undatedSkipped,
        nextCursor: null,
        /* NOT the real URL: it carries the api_key as a query parameter
         * (CLAUDE.md §5.3) and this value is persisted in the artifact. */
        requestUrl: `highergov:/opportunity/?captured_date=${since}`,
        httpStatus: 200,
        payload: scrubPayload(JSON.stringify({ capturedDate: since, results: result.notices.map((n) => n.raw) })),
      };
    },
  };
}
