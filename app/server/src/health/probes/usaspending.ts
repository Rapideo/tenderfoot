import type { Probe, ProbeResult } from "../probe.js";

/* USASpending's search endpoint is a POST with a JSON body. One row is
 * enough to prove it is serving. Same rot rule as sam.ts: 200 with nothing
 * in it is not health. */
const PROBE_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

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
