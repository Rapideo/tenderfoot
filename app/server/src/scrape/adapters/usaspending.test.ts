import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseUsaSpendingPage, usaSpendingAdapter } from "./usaspending.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, "fixtures/usaspending-listing.json"), "utf8");

test("parses the real captured payload into listing items", () => {
  const { items } = parseUsaSpendingPage(FIXTURE);
  expect(items.length).toBeGreaterThan(0);
  const item = items[0];
  if (!item) throw new Error("Expected at least one item");
  expect(item.externalId).toBeTruthy();
  /* "Last Modified Date" arrives as "YYYY-MM-DD HH:MM:SS" (space, no
   * timezone) -- verified against the captured fixture. The adapter
   * normalizes it to an ISO-8601 "T...Z" shape so it strings-compares
   * correctly against `since`/`until`, which arrive in that shape (see
   * contract.ts's isValidDate). This assertion is the guard on that
   * normalization actually happening. */
  expect(item.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(item.raw).toBeTruthy();
});

/* FIX ROUND 1 pattern reused from sam.test.ts, Finding 1: the window must
 * be bounded at BOTH ends, or a resumed run (cursor always resets to page 1
 * on a fresh process invocation) re-matches and re-writes every record from
 * every page a prior run already covered. Two records straddling `since`
 * confirms the newer one survives and the older one does not, and that
 * nextCursor comes back null because the oldest DATED item on the page has
 * fallen out of the window (results are sorted newest-first by "Last
 * Modified Date", so nothing later on the source could re-enter it). */
test("since is applied client-side against the normalized Last Modified Date", async () => {
  const since = "2026-08-01T00:00:00.000Z";
  const stub = async () =>
    new Response(
      JSON.stringify({
        results: [
          { generated_internal_id: "newer", "Last Modified Date": "2026-08-10 12:00:00" },
          { generated_internal_id: "older", "Last Modified Date": "2026-07-15 12:00:00" },
        ],
        page_metadata: { hasNext: true },
      }),
      { status: 200 },
    );

  const page = await usaSpendingAdapter(stub as unknown as typeof fetch).fetchListing(
    since,
    "2026-08-15T00:00:00.000Z",
    null,
  );

  expect(page.items.map((i) => i.externalId)).toEqual(["newer"]);
  expect(page.nextCursor).toBeNull();
});

test("reports no next cursor when the response says there is no next page", async () => {
  const body = JSON.stringify({ results: [], page_metadata: { hasNext: false } });
  const stub = async () => new Response(body, { status: 200 });
  const page = await usaSpendingAdapter(stub as unknown as typeof fetch).fetchListing(
    "2026-01-01",
    "2026-08-15",
    null,
  );
  expect(page.nextCursor).toBeNull();
});

/* Mirrors sam.test.ts's undated-record guard: an item with no "Last
 * Modified Date" cannot be placed in the window. It must be excluded from
 * `items` and counted in `undatedSkipped`, but must never be allowed to
 * decide exhaustion -- spec §5.4, sources degrade rather than fail. */
test("an undated record is skipped and counted, and never allowed to decide exhaustion", async () => {
  const since = "2026-08-01T00:00:00.000Z";
  const until = "2026-08-15T00:00:00.000Z";
  const stub = async () =>
    new Response(
      JSON.stringify({
        results: [
          { generated_internal_id: "dated", "Last Modified Date": "2026-08-10 00:00:00" },
          { generated_internal_id: "undated" /* no Last Modified Date at all */ },
        ],
        page_metadata: { hasNext: true },
      }),
      { status: 200 },
    );

  const page = await usaSpendingAdapter(stub as unknown as typeof fetch).fetchListing(since, until, null);

  expect(page.items.map((i) => i.externalId)).toEqual(["dated"]);
  expect(page.undatedSkipped).toBe(1);
  expect(page.nextCursor).not.toBeNull();
});

test("the adapter is named for its source so the CLI can select it", () => {
  expect(usaSpendingAdapter().name).toBe("usaspending");
});
