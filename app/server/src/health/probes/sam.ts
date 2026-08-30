import type { Probe, ProbeResult } from "../probe.js";
import { parseSamPage, SAM_HOST } from "../../scrape/adapters/sam.js";

/* A real, minimal SAM query -- one page, smallest window the API accepts.
 *
 * This is the only kind of probe that can return 'rot', because it is the
 * only kind that knows what a good answer looks like. `is_active=true` is
 * not incidental: with `false` this endpoint cheerfully returns millions of
 * archived notices and would report perfect health while the adapter was
 * pointed at the wrong five million records.
 *
 * MUST be the same door the adapter walks through (scrape/adapters/sam.ts's
 * `BASE`), not SAM's public v2 API -- the two return different shapes
 * (`_embedded.results` here vs. `opportunitiesData` there), and this probe
 * hands the body straight to `parseSamPage`, which only understands the
 * former. Pointing at the wrong endpoint doesn't fail loudly: it returns
 * 200 with a body `parseSamPage` silently reads as empty, so a healthy SAM
 * would report `rot` forever -- the exact failure mode this probe exists to
 * catch, self-inflicted. size=1 keeps the request itself as small as the
 * adapter's size=100 pages allow. */
const PROBE_URL =
  `${SAM_HOST}/sgs/v1/search?index=opp&size=1&sort=-modifiedDate&is_active=true`;

export const samProbe: Probe = async ({ fetchImpl }): Promise<ProbeResult> => {
  const method = "sam";
  let res: Response;
  try {
    res = await fetchImpl(PROBE_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  } catch (e) {
    return { state: "failing", method, note: (e as Error).message };
  }
  if (!res.ok) return { state: "failing", method, note: `HTTP ${res.status}` };

  const body = await res.text();
  try {
    const { count } = parseSamPage(body);
    return count > 0
      ? { state: "ok", method, note: `${count} records available` }
      : { state: "rot", method, note: "answered 200 but returned 0 rows" };
  } catch (e) {
    return { state: "failing", method, note: `unparseable body: ${(e as Error).message}` };
  }
};
