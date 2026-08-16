/* A deterministic adapter. Exists so the scrape loop's budget, checkpoint
 * and artifact behaviour can be tested without a network. */
import type { Adapter, ListingPage } from "../adapter.js";

/* Anchor instant for the fixture's modifiedAt values. Arbitrary, but fixed,
 * so the fixture is deterministic across runs. */
const FAKE_BASE_MS = Date.parse("2026-08-15T00:00:00.000Z");

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
          /* Mirrors the real source: SAM.gov pages DESCENDING, newest
           * first (verified in corpus/calibration/pull-naics.py, which
           * sorts `-modifiedDate`). Index 0 -- the first item of page 1
           * -- is therefore the NEWEST record, and modifiedAt descends
           * monotonically as the index increases, exactly as it would
           * across real pages. This is deliberate: the previous fixture
           * cycled modifiedAt uncorrelated with index, so a resume-marker
           * direction bug (tracking max instead of min) was invisible to
           * every test. A monotonically descending fixture makes that
           * class of bug observable. Still a fixed-width ISO string
           * (YYYY-MM-DDTHH:mm:ss.sssZ via toISOString), so lexicographic
           * comparison agrees with chronological comparison. */
          modifiedAt: new Date(FAKE_BASE_MS - i * 1000).toISOString(),
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
