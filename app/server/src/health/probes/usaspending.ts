import type { Probe, ProbeResult } from "../probe.js";

/* USASpending's search endpoint is a POST with a JSON body. One row is
 * enough to prove it is serving. Same rot rule as sam.ts: 200 with nothing
 * in it is not health. */
const PROBE_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

/* FINAL REVIEW FINDING 2 (Minor). A deferred note suggested this probe reuse
 * `scrape/adapters/usaspending.ts`'s `parseUsaSpendingPage` instead of the
 * hand-rolled `json.results?.length` below, "same class as F7" (the parser
 * shared with the adapter would have caught the shape drift F7 was about).
 * CHECKED, AND IT IS WRONG: `parseUsaSpendingPage` filters rows on
 * `x?.generated_internal_id`, a field this probe's own minimal request body
 * never asks for -- it sends `fields: ["Award ID"]` only, nothing else.
 * Reusing the adapter's parser here would make `items` come back empty on
 * every real response and report `rot` on a healthy USASpending -- i.e.
 * recreate F7 by "fixing" the one thing that only superficially resembles
 * it. DO NOT change this to call `parseUsaSpendingPage`. If USASpending's
 * response shape ever needs a real parser here, it needs its own, built
 * against THIS probe's request body, not borrowed from a different one. */

export const usaSpendingProbe: Probe = async ({ fetchImpl }): Promise<ProbeResult> => {
  const method = "usaspending";
  let res: Response;
  try {
    res = await fetchImpl(PROBE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({
        filters: { award_type_codes: ["A", "B", "C", "D"] },
        fields: ["Award ID"],
        limit: 1,
      }),
    });
  } catch (e) {
    return { state: "failing", method, note: (e as Error).message };
  }
  if (!res.ok) return { state: "failing", method, note: `HTTP ${res.status}` };

  try {
    const json = JSON.parse(await res.text()) as { results?: unknown[] };
    const n = json.results?.length ?? 0;
    return n > 0
      ? { state: "ok", method, note: `${n} row(s) returned` }
      : { state: "rot", method, note: "answered 200 but returned 0 rows" };
  } catch (e) {
    return { state: "failing", method, note: `unparseable body: ${(e as Error).message}` };
  }
};
