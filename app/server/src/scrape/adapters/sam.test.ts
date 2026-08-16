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
