/* A deterministic adapter. Exists so the scrape loop's budget, checkpoint
 * and artifact behaviour can be tested without a network. */
import type { Adapter, ListingPage } from "../adapter.js";

export function fakeAdapter(total: number, pageSize = 100): Adapter {
  return {
    name: "fake",
    async fetchListing(_since, _until, cursor): Promise<ListingPage> {
      const start = cursor ? Number(cursor) : 0;
      const end = Math.min(start + pageSize, total);
      const items = [];
      for (let i = start; i < end; i++) {
        items.push({
          externalId: `fake-${i}`,
          modifiedAt: `2026-08-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
          raw: { i, title: `Fake solicitation ${i}` },
        });
      }
      return {
        items,
        nextCursor: end >= total ? null : String(end),
        requestUrl: `fake://listing?start=${start}`,
        httpStatus: 200,
        payload: JSON.stringify({ start, items }),
      };
    },
  };
}
