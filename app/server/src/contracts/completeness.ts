/* THE COMPLETENESS ASSERTION. It is the entire correctness guarantee of this
 * ingest, which is why it lives alone, pure, and heavily tested.
 *
 * 🔴 THE API'S `page` PARAMETER IS SILENTLY IGNORED. Measured 2026-09-03:
 * pages 1, 2 and 100 at pageSize 50 returned IDENTICAL record sets -- 50 of 50
 * ids overlapping, same first id, same last. So there is no cursor, no second
 * request that could fill a gap, and no way to "continue" a short fetch.
 *
 * 🔴 AND DATE WINDOWS CANNOT TILE THE REGISTER. `startDate`/`endDate` filters
 * fully-contained-within -- a contract's own start AND end must both sit inside
 * the window -- so everything spanning a boundary is invisible to both
 * neighbours. Year windows recovered 24,933 of 204,991.
 *
 * What is left is one request for everything, and one question: did we receive
 * as many rows as the API says exist? A partial register that LOOKS complete is
 * the failure this file exists to make impossible. */

export interface RegisterPage {
  /** What the API says exists: `pagination.totalResults`. */
  total: number;
  /** What it actually handed over: `results`. */
  rows: unknown[];
}

/* Read from two different places on purpose. Deriving `total` from
 * `rows.length` would make assertComplete tautologically true. */
export function parseRegister(payload: string): RegisterPage {
  const j = JSON.parse(payload) as {
    results?: unknown[];
    pagination?: { totalResults?: number };
  };
  return {
    total: Number(j.pagination?.totalResults ?? 0),
    rows: j.results ?? [],
  };
}

export function assertComplete(page: RegisterPage): void {
  if (page.rows.length !== page.total) {
    throw new Error(
      `Incomplete register fetch: the API reports ${page.total} contracts but ` +
        `returned ${page.rows.length}. There is no cursor to continue with — ` +
        `this source silently ignores its own page parameter — so this is a ` +
        `hard stop rather than something to page past.`,
    );
  }
}
