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
 * ⚠️ AND THE SCRUB MUST BE STABLE, not merely present. scrubPayload is
 * idempotent and a test pins that.
 *
 * ⚠️ THE REASON GIVEN HERE USED TO BE FALSE, and it is worth correcting
 * rather than deleting, because the wrong reason invited the wrong
 * conclusion. It said a non-idempotent scrub "would make two runs over
 * identical data hash differently and quietly change what the UNIQUE
 * constraint means." Two runs over identical data ALREADY hash differently,
 * unconditionally: ingest/import-artifact.ts hashes the whole SQLite file
 * (`createHash("sha256").update(readFileSync(path))`), and that file carries
 * `run.started_at`, `capture.fetched_at` and `sighting.seen_at`. No scrub,
 * idempotent or not, can make two runs collide on artifact_sha256.
 *
 * THE REAL REASON is byte-stability of what gets PERSISTED. The payload is
 * written verbatim into the artifact and, through the sighting rows, into
 * Postgres. A scrub whose output depended on how many times it had been
 * applied would mean the stored bytes depend on the path a value took to get
 * here rather than on the value itself -- so the same vendor row would read
 * back differently depending on whether it arrived through the live adapter
 * or through highergov-cli.ts's reuse of the dry run's sample, which
 * deliberately scrubs a second time (its own comment says so). Idempotence
 * is what makes that second pass provably free.
 *
 * CONSEQUENCE, recorded so the next reader does not re-derive it: because
 * the hash always differs, ingest/highergov-cli.ts's "artifact already
 * imported -- skipped" branch is structurally unreachable from that CLI. It
 * is kept as defence, and says so there.
 *
 * ⚠️ NO DATABASE ACCESS, and no spend accounting here. An adapter fetches
 * and parses; ingest/highergov-cli.ts owns the budget, the ceiling and the
 * tally -- the same split coverage/highergov-client.ts already states. */
import type { WindowedAdapter, ListingItem, ListingPage } from "../adapter.js";
import { HIGHERGOV_SOURCE_NAME, higherGovClient, redact } from "../../coverage/highergov-client.js";

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
     * resolve-source.ts looks it up by this string. Imported rather than
     * hand-typed a second time: HIGHERGOV_SOURCE_NAME exists precisely so a
     * rename is a loud failure (one place to fix), not a silent mismatch
     * against the wrong source_id (highergov-client.ts's own comment). */
    name: HIGHERGOV_SOURCE_NAME,

    async fetchListing(since, until, _cursor): Promise<ListingPage> {
      /* ONE DAY PER CALL, ENFORCED, NOT MERELY DOCUMENTED. run.ts's windowed
       * loop trusts `nextCursor` alone to decide `done` (scrape/run.ts:
       * `cursor = page.nextCursor; if (cursor === null) { done = true; ... }`)
       * -- and this adapter always returns `nextCursor: null`. Silently
       * reading only `since` while the caller believes `until` was honoured
       * would report a multi-day window as complete after fetching one day.
       * This codebase already fails loud on exactly this shape elsewhere
       * (searchId() throws rather than silently scoping nothing), so a
       * caller that has not yet learned to walk days here must be told,
       * not humoured. */
      if (until !== since) {
        throw new Error(
          `higherGovAdapter.fetchListing: since (${since}) and until (${until}) differ. ` +
            "This adapter reads a single captured_date per call and always reports " +
            "nextCursor: null -- a multi-day request would silently read only the " +
            "first day and be reported complete. The caller must walk days itself.",
        );
      }

      /* R5 only ever sent a single `captured_date`, and whether the
       * parameter accepts a range is unverified -- the dry run in
       * highergov-cli.ts answers it for free. Until it does, the caller
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
        /* The envelope carries three scalars beyond the rows, and dropping
         * any of them turns this artifact into evidence it cannot answer:
         *
         *  - `pages`: the client's own comment on FeedResult.pages says why
         *    this exists -- without it, a 19-of-19 day and a page-1-of-2 day
         *    are INDISTINGUISHABLE after the fact, and a later reader would
         *    silently treat a truncated day as HigherGov not having the
         *    rows -- a false miss this adapter is the caller that must not
         *    manufacture.
         *  - `feedCount`: the saved-search change detector (meta.pagination
         *    .count) -- the only signal that the search itself moved.
         *  - `records`: what the VENDOR BILLED, not `items.length +
         *    undatedSkipped` -- a row rejected by the client for a missing
         *    source_id (toNotice returning null) is billed but appears in
         *    neither count, and under-reporting spend is the dangerous
         *    direction against a ceiling that cannot be read back
         *    (CLAUDE.md §5.1).
         *
         * All three are scalars, so carrying them costs no extra API
         * records and does not touch the scrub or the hash's stability. */
        payload: scrubPayload(
          JSON.stringify({
            capturedDate: since,
            records: result.records,
            feedCount: result.feedCount,
            pages: result.pages,
            results: result.notices.map((n) => n.raw),
          }),
        ),
      };
    },
  };
}
