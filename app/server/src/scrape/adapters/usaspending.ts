/* USASpending listing adapter.
 *
 * VERIFIED PARAMETERS (spec §5.4, and the `verified_facets` column on
 * `source`). Characterised at 2026-08-15 against a captured fixture
 * (`fixtures/usaspending-listing.json`) via a live POST to
 * https://api.usaspending.gov/api/v2/search/spending_by_award/ -- this
 * repo has no prior evidence for this API, unlike SAM.gov (see
 * corpus/calibration/pull-naics.py), so nothing below was assumed from
 * memory:
 *
 *   POST body { filters: { award_type_codes }, fields, page, limit, sort,
 *   order } -- VERIFIED to return 200 with a non-empty `results` array
 *   using exactly the four contract award-type codes ["A","B","C","D"].
 *
 *   sort="Last Modified Date", order="desc"   VERIFIED to order results
 *   descending by that field (checked over 100 consecutive rows: strictly
 *   non-increasing). This is the field this adapter windows on -- see
 *   below for why.
 *
 *   filters.time_period   TESTED AND DROPPED. It is accepted, but it
 *   filters by each award's action date, not by "Last Modified Date" --
 *   a different field entirely. Keeping it would conflate two unrelated
 *   date semantics (the same mistake `since`-as-a-server-filter would be
 *   for SAM.gov) and would require a moving end_date to avoid silently
 *   going stale. The endpoint does not require it: confirmed by omitting
 *   it entirely and still getting 200 + rows.
 *
 *   page, limit   VERIFIED to paginate (compared page=1 and page=2 of an
 *   otherwise-identical request: disjoint, correctly-ordered rows).
 *   limit=100 VERIFIED to return exactly 100 rows (SAM.gov uses the same
 *   page size; matched for consistency, not because 100 is a documented
 *   ceiling).
 *
 *   page_metadata.hasNext   VERIFIED present on every page observed and
 *   used as the primary "is there more" signal, the same role
 *   `_embedded.results.length` plays for SAM.gov -- but it is trusted only
 *   in combination with the client-side window check below, for the same
 *   resume reason SAM.gov's `count === 0` alone is not trusted either.
 *
 *   generated_internal_id   VERIFIED present and unique on every row
 *   observed (100/100 unique in the captured sample) and CHOSEN as the
 *   stable identifier over `Award ID` (a human-facing contract number,
 *   observably NOT globally unique -- e.g. IDs like "63L3" recur across
 *   awarding vehicles) and over `internal_id` (numeric, unique in-sample,
 *   but undocumented and not obviously stable across API versions;
 *   `generated_internal_id` is the identifier USASpending's own award
 *   detail pages are keyed by).
 *
 * WHICH FIELD THE WINDOW COMPARES AGAINST, AND WHAT IT COSTS:
 * USASpending's award records do not carry a single obvious "this changed"
 * timestamp the way SAM.gov's `modifiedDate` does -- award data is
 * naturally keyed by action/period-of-performance dates (`Start Date`,
 * `End Date` here), which describe the CONTRACT, not the RECORD. The
 * `fields` list was extended past the brief's starting set specifically to
 * probe for a change-tracking field, and "Last Modified Date" (format
 * "YYYY-MM-DD HH:MM:SS", verified present on 100/100 sampled rows) is it:
 * USASpending's own docs describe it as when the underlying award record
 * was last touched, which is the modification-timestamp semantics this
 * adapter's window needs and the closest analogue to SAM's `modifiedDate`.
 * COST: unlike `Start Date`/`End Date`, "Last Modified Date" is not
 * filterable server-side (see time_period above) -- exactly SAM's
 * situation, so `since`/`until` are applied client-side here too, and for
 * the same reason. It also arrives with NO timezone marker ("2026-08-13
 * 23:42:39", not "...Z"), so it is normalized to an ISO-8601 "T...Z" shape
 * before comparison (assuming the source's un-marked clock is already UTC
 * -- unverified, but it only needs to be SELF-consistent for string
 * comparison against `since`/`until` to order correctly, and it is: every
 * sampled row uses the identical un-marked format).
 */
import type { Adapter, ListingItem, ListingPage } from "../adapter.js";

const URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

const FIELDS = [
  "Award ID",
  "Recipient Name",
  "Start Date",
  "End Date",
  "Award Amount",
  "Awarding Agency",
  "Last Modified Date",
];

/* "2026-08-13 23:42:39" -> "2026-08-13T23:42:39.000Z". Only reshapes a
 * value already in the observed "YYYY-MM-DD HH:MM:SS" form; anything else
 * (missing, malformed) is left alone and the caller treats it as undated. */
function normalizeModifiedAt(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(raw);
  if (!m) return "";
  return `${m[1]}T${m[2]}.000Z`;
}

export function parseUsaSpendingPage(body: string): { items: ListingItem[]; hasNext: boolean } {
  const d = JSON.parse(body);
  const results = d?.results ?? [];
  const items: ListingItem[] = [];
  for (const x of results) {
    const id = x?.generated_internal_id;
    if (!id) continue;
    items.push({
      externalId: String(id),
      modifiedAt: normalizeModifiedAt(x["Last Modified Date"]),
      raw: x,
    });
  }
  const hasNext = Boolean(d?.page_metadata?.hasNext);
  return { items, hasNext };
}

export function usaSpendingAdapter(fetchImpl: typeof fetch = fetch): Adapter {
  return {
    name: "usaspending",
    async fetchListing(since, until, cursor): Promise<ListingPage> {
      const page = cursor ? Number(cursor) : 1;
      const requestBody = JSON.stringify({
        filters: { award_type_codes: ["A", "B", "C", "D"] },
        fields: FIELDS,
        page,
        limit: 100,
        sort: "Last Modified Date",
        order: "desc",
      });
      const res = await fetchImpl(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      const payload = await res.text();
      const { items, hasNext } = parseUsaSpendingPage(payload);

      /* Spec §5.4: sources degrade rather than fail, they do not throw. A
       * row with no usable "Last Modified Date" cannot be placed in time --
       * normalizeModifiedAt() already reduced that case to "", and an
       * empty string sorts BELOW every real date. Left untreated, that
       * would (a) silently drop the record from `items` (correct) but
       * (b), if it happened to be last on the page, satisfy `"" < since`
       * and trip `exhausted` early, silently truncating every remaining
       * page. So undated items are set aside before both the window
       * filter and the exhaustion check, and are only counted, never
       * allowed to decide either. Mirrors sam.ts exactly. */
      let undatedSkipped = 0;
      const dated: ListingItem[] = [];
      for (const i of items) {
        if (!i.modifiedAt) {
          undatedSkipped++;
          continue;
        }
        dated.push(i);
      }

      /* Bound the window at BOTH ends -- see sam.ts for the full resume
       * argument; it applies here unchanged. `fetchListing` is always
       * called with `cursor = null` on a fresh process invocation, so an
       * unbounded-above filter would re-match and re-write every record
       * from every page a PRIOR run already covered, on every resume,
       * forever. `until` is what makes that already-covered prefix get
       * skipped rather than merely re-walked. */
      const inWindow = dated.filter((i) => i.modifiedAt >= since && i.modifiedAt <= until);

      /* Stop when EITHER the source says there is no more (`hasNext`) OR
       * the oldest DATED item on the page has already fallen out of the
       * window below `since`: results are ordered by "Last Modified Date"
       * descending (verified above), so nothing later can come back in.
       * Deciding the second half from `dated` rather than `items` is what
       * keeps a trailing undated record from silently ending the scrape
       * early. If every item on a page is undated, `dated` is empty and
       * this page cannot decide exhaustion by date at all -- paging
       * continues (as long as `hasNext` says so), which is the safe
       * direction: it costs an extra fetch, never a silently dropped
       * page. */
      const last = dated[dated.length - 1];
      const exhausted = !hasNext || items.length === 0 || (last !== undefined && last.modifiedAt < since);

      return {
        items: inWindow,
        nextCursor: exhausted ? null : String(page + 1),
        requestUrl: URL,
        httpStatus: res.status,
        payload,
        ...(undatedSkipped > 0 ? { undatedSkipped } : {}),
      };
    },
  };
}
