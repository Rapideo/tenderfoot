/* Two requests against Indiana's public contract register, politely.
 *
 * A state transparency API is an intended-use resource, not something to be
 * squeezed: an identifying User-Agent, a pause between the two calls, and STOP
 * on the first non-2xx rather than retrying into a rate limiter. The polite
 * failure is to stop.
 *
 * WHY TWO REQUESTS AND NOT MANY. `page` is silently ignored by this source, and
 * date windows cannot tile it -- they filter fully-contained-within, so
 * anything spanning a boundary vanishes from both neighbours. What works is
 * asking for everything at once: measured 2026-09-03, 204,991 rows in 47s at
 * 78 MB. The first request costs one row and says how many to ask for; the
 * second gets them. */
import { parseRegister, assertComplete, type RegisterPage } from "./completeness.js";

export const EDS_URL =
  "https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search";

const UA = "Tenderfoot/0.1 (Koehler Partners; procurement research)";

/* Asked for on top of the reported total, so a handful of contracts filed
 * between the count and the fetch cannot truncate the run. If that margin is
 * ever not enough, assertComplete catches it loudly. */
const MARGIN = 5_000;

export interface EdsRow {
  id: string;
  vendorName: string;
  agencyName: string;
  businessUnit: string;
  startDate: string;
  endDate: string;
  amount: number;
  actionType: string;
  amendment: number;
  zipCode: string;
  pdfUrl: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

async function ask(doFetch: typeof fetch, pageSize: number): Promise<RegisterPage> {
  const res = await doFetch(EDS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": UA,
    },
    /* page is ALWAYS 1 and is not a cursor -- this API ignores it. Both keys
     * must be present regardless: an empty body returns a zeroed pagination
     * block rather than everything. */
    body: JSON.stringify({ page: 1, pageSize }),
  });

  if (!res.ok) {
    throw new Error(
      `EDS returned ${res.status}. Stopping rather than retrying — see the ` +
        `politeness note in this file's header.`,
    );
  }
  return parseRegister(await res.text());
}

export async function fetchRegister(
  opts: { fetchImpl?: typeof fetch; delayMs?: number } = {},
): Promise<EdsRow[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const delayMs = opts.delayMs ?? 1000;

  /* One row, purely to read pagination.totalResults. Cheap, and it means the
   * size comes from the API rather than a constant that rots. */
  const probe = await ask(doFetch, 1);
  if (delayMs > 0) await sleep(delayMs);

  const full = await ask(doFetch, probe.total + MARGIN);
  assertComplete(full);
  return full.rows as EdsRow[];
}
