import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSamPage, samAdapter } from "./sam.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, "fixtures/sam-listing.json"), "utf8");

test("parses the real captured payload into listing items", () => {
  const { items } = parseSamPage(FIXTURE);
  expect(items.length).toBeGreaterThan(0);
  const item = items[0];
  if (!item) throw new Error("Expected at least one item");
  expect(item.externalId).toBeTruthy();
  expect(item.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  expect(item.raw).toBeTruthy();
});

/* corpus/calibration/pull-naics.py:52 records this as a live instance of
 * spec §5.4 -- a parameter accepted and silently ignored:
 *   "Only -modifiedDate sorts; -publishDate is silently ignored."
 * So `since` CANNOT be pushed to the server as a publish-date bound. It is
 * applied client-side against modifiedDate, and this test is the guard.
 *
 * CONTROLLER RULING: the brief's original version of this test computed a
 * `kept` array and asserted only `kept.length <= all.length` -- trivially
 * true of any filter, including a completely broken one. Replaced with a
 * real boundary test: two items straddling `since`, asserting the newer one
 * survives BY EXTERNAL ID and the older one does not, and that nextCursor
 * comes back null because the oldest item on the page has fallen out of the
 * window (results are ordered newest-first, so nothing later on the source
 * could re-enter it). */
test("since is applied client-side against modifiedDate", async () => {
  const since = "2026-08-01T00:00:00.000Z";
  const stub = async () =>
    new Response(
      JSON.stringify({
        _embedded: {
          results: [
            { _id: "newer", modifiedDate: "2026-08-10T00:00:00.000Z", publishDate: "2026-08-01T00:00:00.000Z" },
            { _id: "older", modifiedDate: "2026-07-15T00:00:00.000Z", publishDate: "2026-07-01T00:00:00.000Z" },
          ],
        },
      }),
      { status: 200 },
    );

  const page = await samAdapter(stub as unknown as typeof fetch).fetchListing(
    since,
    "2026-08-15T00:00:00.000Z",
    null,
  );

  expect(page.items.map((i) => i.externalId)).toEqual(["newer"]);
  /* The oldest item on the page (`older`) is already below `since`, and the
   * page is sorted newest-first, so nothing later on the source can still
   * be in-window: pagination is exhausted. */
  expect(page.nextCursor).toBeNull();
});

/* FIX ROUND 1, Finding 1 (Critical): the window was bounded only below, by
 * `since`. Because `fetchListing` is always called with `cursor = null` on
 * a fresh process invocation, an unbounded-above filter would re-match and
 * re-write every record from every page a PRIOR run already covered, on
 * every resume, forever. Bounding by `until` too is what makes the
 * already-covered prefix get skipped (not re-written) rather than merely
 * re-walked. */
test("until bounds the window from above, so already-covered records are not re-returned on resume", async () => {
  const since = "2026-08-01T00:00:00.000Z";
  const until = "2026-08-05T00:00:00.000Z"; // e.g. a resumed run's nextUntil
  const stub = async () =>
    new Response(
      JSON.stringify({
        _embedded: {
          results: [
            // Newer than `until` -- already covered by the run this one is
            // resuming from. Must NOT reappear.
            { _id: "too-new", modifiedDate: "2026-08-10T00:00:00.000Z" },
            // Genuinely in the resumed window.
            { _id: "in-window", modifiedDate: "2026-08-03T00:00:00.000Z" },
            // Older than `since` -- outside the window on the other end,
            // and it is the last item on the page, so it also drives
            // exhaustion.
            { _id: "too-old", modifiedDate: "2026-07-01T00:00:00.000Z" },
          ],
        },
      }),
      { status: 200 },
    );

  const page = await samAdapter(stub as unknown as typeof fetch).fetchListing(since, until, null);

  expect(page.items.map((i) => i.externalId)).toEqual(["in-window"]);
  expect(page.nextCursor).toBeNull();
});

/* FIX ROUND 1, Finding 2 (Important): `String(x.modifiedDate ?? "")`
 * yields "" for a record with no modifiedDate. Untreated, that empty
 * string sorts below every real date -- so if such a record lands last on
 * a page, "" < since trips `exhausted` early and every remaining page is
 * silently never fetched. Here the undated record IS last on the page and
 * would be the one deciding exhaustion under the old, unguarded logic; the
 * real dated record ahead of it is well inside the window, so a correct
 * adapter must keep paging. */
test("an undated record is skipped and counted, and never allowed to decide exhaustion", async () => {
  const since = "2026-08-01T00:00:00.000Z";
  const until = "2026-08-15T00:00:00.000Z";
  const stub = async () =>
    new Response(
      JSON.stringify({
        _embedded: {
          results: [
            { _id: "dated", modifiedDate: "2026-08-10T00:00:00.000Z" },
            { _id: "undated" /* no modifiedDate at all */ },
          ],
        },
      }),
      { status: 200 },
    );

  const page = await samAdapter(stub as unknown as typeof fetch).fetchListing(since, until, null);

  expect(page.items.map((i) => i.externalId)).toEqual(["dated"]);
  expect(page.undatedSkipped).toBe(1);
  /* Must NOT be null: an undated trailing record must never be read as
   * "past the window" and silently truncate the rest of the scrape. */
  expect(page.nextCursor).not.toBeNull();
});

test("stops paging when a page comes back empty", async () => {
  const stub = async () =>
    new Response(JSON.stringify({ _embedded: { results: [] } }), { status: 200 });
  const page = await samAdapter(stub as unknown as typeof fetch).fetchListing(
    "2026-08-01",
    "2026-08-15",
    null,
  );
  expect(page.items).toHaveLength(0);
  expect(page.nextCursor).toBeNull();
});
