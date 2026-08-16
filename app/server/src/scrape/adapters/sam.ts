/* SAM.gov listing adapter.
 *
 * VERIFIED PARAMETERS (spec §5.4, and the `verified_facets` column on
 * `source`). Characterised at 2026-08-10 by corpus/calibration/pull-naics.py
 * and re-confirmed against a captured fixture:
 *
 *   sort=-modifiedDate   VERIFIED to order results.
 *   sort=-publishDate    ACCEPTED AND SILENTLY IGNORED. Do not rely on it.
 *   page, size           VERIFIED to paginate.
 *
 * The consequence is load-bearing: `since` cannot be pushed to the server,
 * so it is applied CLIENT-SIDE against modifiedDate. Since modifiedDate >=
 * publishDate always, paginating until modifiedDate passes the window is
 * guaranteed to have seen every in-window record.
 *
 * A record amended after the window re-appears. Under the sighting model
 * that is CORRECT -- it is a change, and it arrives as a second sighting.
 */
import type { Adapter, ListingItem, ListingPage } from "../adapter.js";

const BASE =
  "https://sam.gov/api/prod/sgs/v1/search?index=opp&size=100&sort=-modifiedDate&is_active=false";

export function parseSamPage(body: string): { items: ListingItem[]; count: number } {
  const d = JSON.parse(body);
  const results = d?._embedded?.results ?? [];
  const items: ListingItem[] = [];
  for (const x of results) {
    const id = x?._id;
    if (!id) continue;
    items.push({
      externalId: String(id),
      modifiedAt: String(x.modifiedDate ?? ""),
      raw: x,
    });
  }
  return { items, count: results.length };
}

export function samAdapter(fetchImpl: typeof fetch = fetch): Adapter {
  return {
    name: "sam",
    async fetchListing(since, _until, cursor): Promise<ListingPage> {
      const page = cursor ? Number(cursor) : 0;
      const url = `${BASE}&page=${page}`;
      /* The User-Agent is not decoration -- the endpoint rejects the default
       * Node agent. pull-naics.py sets it for the same reason. */
      const res = await fetchImpl(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const payload = await res.text();
      const { items, count } = parseSamPage(payload);

      const inWindow = items.filter((i) => i.modifiedAt >= since);
      /* Stop when the LAST item on the page has fallen out of the window:
       * results are ordered by modifiedDate descending, so nothing later can
       * come back in. */
      const last = items[items.length - 1];
      const exhausted = count === 0 || (last !== undefined && last.modifiedAt < since);

      return {
        items: inWindow,
        nextCursor: exhausted ? null : String(page + 1),
        requestUrl: url,
        httpStatus: res.status,
        payload,
      };
    },
  };
}
