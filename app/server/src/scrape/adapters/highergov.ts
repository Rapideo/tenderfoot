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
import {
  DEFAULT_FEED_AXIS,
  HIGHERGOV_SOURCE_NAME,
  higherGovClient,
  redact,
  type FeedAxis,
  type FeedNotice,
} from "../../coverage/highergov-client.js";

export const HIGHERGOV_ADAPTER_KEY = "highergov";

/** Scrub a raw response body for safe persistence. Idempotent: scrubbing an
 * already-scrubbed body returns it unchanged, which is what lets the
 * artifact hash be stable across runs. */
export function scrubPayload(body: string): string {
  return redact(body);
}

/* 🔴 THE VALUE ON THE WALKED AXIS, AND NOTHING ELSE. This is the whole point
 * of threading an axis rather than only swapping a query parameter.
 *
 * adapter.ts: "`modifiedAt` is the field the caller compares against the
 * window" -- and it is deliberately not called `postedAt`, because sources
 * differ in which axis they can filter on. scrape/run.ts folds every item's
 * `modifiedAt` into the run's low-water resume marker.
 *
 * So a notice PUBLISHED in June but CRAWLED in September, returned by a
 * `posted_date=2026-06-09` request, must report June. Reporting its
 * `captured_date` instead would hand the runner a September date for a day it
 * asked about in June -- a day would appear to contain records it does not,
 * and the resume marker would be built from the wrong calendar entirely.
 *
 * Exported so the CLI's dry-run-sample reuse (ingest/highergov-cli.ts's
 * sampleAsPage) reads the axis the SAME way rather than re-deriving it: two
 * places choosing the field independently is exactly how the two would drift. */
export function axisValue(n: FeedNotice, axis: FeedAxis): string | null {
  return axis === "posted_date" ? n.postedDate : n.capturedDate;
}

/* `pageSize` is OPTIONAL, threaded here only from ingest/highergov-cli.ts's
 * `--page-size` flag -- see highergov-client.ts's fetchDay for the full
 * economics comment. Left unset (the default), this adapter's request is
 * unchanged from before this parameter existed.
 *
 * `axis` is OPTIONAL in the same provable sense and defaults to
 * `captured_date` -- see FeedAxis in highergov-client.ts for Matt's
 * 2026-09-07 ruling and why backfill and live now want different questions.
 * registry.ts constructs this adapter with no arguments at all, so the
 * ordinary scrape path is untouched by the existence of the parameter. */
export function higherGovAdapter(
  fetchImpl: typeof fetch = fetch,
  pageSize?: number,
  axis: FeedAxis = DEFAULT_FEED_AXIS,
): WindowedAdapter {
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
            /* NAMES THE AXIS IN USE, not a hard-coded "captured_date". On a
             * posted_date walk that hard-coded word was simply false, and a
             * refusal message that misdescribes what the adapter does is
             * worse than no message: it sends the reader to fix the wrong
             * thing. */
            `This adapter reads a single ${axis} per call and always reports ` +
            "nextCursor: null -- a multi-day request would silently read only the " +
            "first day and be reported complete. The caller must walk days itself.",
        );
      }

      /* R5 only ever sent a single date, and whether either axis parameter
       * accepts a RANGE is unverified -- the dry run in highergov-cli.ts
       * answers it for free. Until it does, the caller walks days and this
       * reads one. `since` IS the day, on whichever axis was asked for. */
      const result = await higherGovClient.fetchDay(since, fetchImpl, pageSize, axis);

      let undatedSkipped = 0;
      const items: ListingItem[] = [];
      for (const n of result.notices) {
        /* adapter.ts §5.4: a record with no usable date cannot be placed in
         * the window. Counted, never allowed to decide it.
         *
         * 🔴 "USABLE" MEANS ON THE WALKED AXIS. A row with a captured_date but
         * no posted_date cannot be placed in a posted_date window, however
         * much other date it carries -- substituting the other axis's value
         * would be fabricating a position in the window, which is precisely
         * what §5.4 forbids. So it is skipped and counted, exactly as a row
         * with no date at all always has been. */
        const modifiedAt = axisValue(n, axis);
        if (!modifiedAt) {
          undatedSkipped++;
          continue;
        }
        items.push({ externalId: n.externalId, modifiedAt, raw: n.raw });
      }

      return {
        items,
        undatedSkipped,
        nextCursor: null,
        /* NOT the real URL: it carries the api_key as a query parameter
         * (CLAUDE.md §5.3) and this value is persisted in the artifact. The
         * synthetic `highergov:` form is kept exactly as it was -- only the
         * parameter NAME follows the axis, so this can still never carry a
         * credential. It has to follow it, though: this string is the only
         * record in the artifact of what was actually asked for. */
        requestUrl: `highergov:/opportunity/?${axis}=${since}`,
        httpStatus: 200,
        /* The envelope carries FOUR scalars beyond the rows, and dropping
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
         *  - `axis` + `day`: WHICH QUESTION THIS SAMPLE ANSWERS. This used to
         *    be a single field, `capturedDate: since`, written unconditionally
         *    -- so the moment a posted_date walk existed, a posted_date sample
         *    would be labelled `capturedDate` and the artifact would be
         *    evidence that LIES. Two fields rather than one renamed field
         *    because the axis and the day are two facts: "2026-06-09" alone
         *    cannot say whether it was published or crawled then, and this
         *    file is the only place that still knows.
         *
         * All four are scalars, so carrying them costs no extra API
         * records and does not touch the scrub or the hash's stability.
         *
         * ⚠️ NOTHING READ THE OLD `capturedDate` KEY -- checked, not assumed.
         * ingest/highergov-cli.ts's readArtifactEnvelope (the single reader of
         * this envelope, feeding billedRecordsFromArtifact and
         * pagesFromArtifact) reads `records` and `pages` only, and no other
         * module in the repo parses a capture payload at all. Renaming it is
         * therefore safe today; it is named here so a future reader knows the
         * question was asked. */
        payload: scrubPayload(
          JSON.stringify({
            axis,
            day: since,
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
