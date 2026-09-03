/* A deterministic adapter. Exists so the scrape loop's budget, checkpoint
 * and artifact behaviour can be tested without a network.
 *
 * FIX ROUND 1 on Task 7 (2026-08-15): `since`/`until` used to be accepted
 * and silently ignored here, same as the bug just found in sam.ts. That
 * was harmless as long as no test's window was narrower than the fixture,
 * but it also meant this adapter could never stand in for a real one in a
 * test of the RESUME contract -- an adapter that always returns its whole
 * page regardless of the window can't exhibit (or verify the fix for) "a
 * resumed run keeps re-matching already-covered records because the filter
 * has no upper bound." Bounding here too, the same way sam.ts now does,
 * is what makes run.test.ts's two-invocation resume test meaningful. */
import type { WindowedAdapter, ListingPage } from "../adapter.js";

/* Anchor instant for the fixture's modifiedAt values. Arbitrary, but fixed,
 * so the fixture is deterministic across runs. */
const FAKE_BASE_MS = Date.parse("2026-08-15T00:00:00.000Z");

export function fakeAdapter(total: number, pageSize = 100): WindowedAdapter {
  return {
    shape: "windowed" as const,
    name: "fake",
    async fetchListing(since, until, cursor): Promise<ListingPage> {
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
      /* Positional cursor advance is unaffected by the window -- this
       * mirrors the real source, which paginates by position and can only
       * be filtered client-side after the fact (see sam.ts). Bounding
       * `items` (not the cursor) is exactly what sam.ts's fix does. */
      const inWindow = items.filter((i) => i.modifiedAt >= since && i.modifiedAt <= until);
      return {
        items: inWindow,
        nextCursor: end >= total ? null : String(end),
        requestUrl: `fake://listing?start=${start}`,
        httpStatus: 200,
        payload: JSON.stringify({ start, items }),
      };
    },
  };
}
