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
    async fetchListing(since, until, cursor): Promise<ListingPage> {
      const page = cursor ? Number(cursor) : 0;
      const url = `${BASE}&page=${page}`;
      /* The User-Agent is not decoration -- the endpoint rejects the default
       * Node agent. pull-naics.py sets it for the same reason. */
      const res = await fetchImpl(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const payload = await res.text();
      const { items, count } = parseSamPage(payload);

      /* Spec §5.4: sources degrade rather than fail, they do not throw. A
       * record with no modifiedDate cannot be placed in time -- `""` would
       * sort BELOW every real date, which would (a) silently drop the
       * record from `items` (correct) but (b), if it happened to be last on
       * the page, satisfy `"" < since` and trip `exhausted` early, silently
       * truncating every remaining page. So undated items are set aside
       * before both the window filter and the exhaustion check, and are
       * only counted, never allowed to decide either. */
      let undatedSkipped = 0;
      const dated: ListingItem[] = [];
      for (const i of items) {
        if (!i.modifiedAt) {
          undatedSkipped++;
          continue;
        }
        dated.push(i);
      }

      /* Bound the window at BOTH ends. `since` alone is what the original
       * cut of this adapter had, and it is the reason resume was defeated:
       * fetchListing is always called with `cursor = null` on a fresh
       * process invocation (the CLI/HTTP handler do not persist a page
       * cursor across runs -- see the note below on why that would be
       * WRONG even if they did), so a resumed run restarts at page 0 and
       * an unbounded-above filter would re-match and re-write every record
       * from every page already covered by the PRIOR run, forever, instead
       * of skipping straight past them to the new ground below `until`.
       *
       * RESIDUAL COST, ACCEPTED: the API paginates POSITIONALLY (`page=N`),
       * not by date, so a resumed run still FETCHES pages 0..N before
       * reaching new ground -- that network cost is the price of not
       * persisting a page cursor across invocations. Persisting one would
       * be wrong regardless: page numbers shift as new records are
       * published between runs, so a stale cursor would skip or duplicate
       * records. Date-bounded re-paging is the robust choice; this filter
       * is what stops the re-walked prefix from being re-WRITTEN. */
      const inWindow = dated.filter((i) => i.modifiedAt >= since && i.modifiedAt <= until);

      /* Stop when the OLDEST DATED item on the page has fallen out of the
       * window: results are ordered by modifiedDate descending, so nothing
       * later can come back in. Deciding this from `dated` rather than
       * `items` is what keeps an undated trailing record from silently
       * ending the scrape early (see above). If EVERY item on a page is
       * undated, `dated` is empty and this page cannot decide exhaustion at
       * all -- paging continues, which is the safe direction: it costs an
       * extra fetch, never a silently dropped page. */
      const last = dated[dated.length - 1];
      const exhausted = count === 0 || (last !== undefined && last.modifiedAt < since);

      return {
        items: inWindow,
        nextCursor: exhausted ? null : String(page + 1),
        requestUrl: url,
        httpStatus: res.status,
        payload,
        ...(undatedSkipped > 0 ? { undatedSkipped } : {}),
      };
    },
  };
}
