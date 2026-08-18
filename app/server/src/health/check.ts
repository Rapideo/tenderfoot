/* Resolve which sources may be contacted, probe them concurrently, write the
 * result. The one thing this module must never do is issue a request for a
 * source the eligibility rule refused -- see eligibility.ts. Filtering
 * happens BEFORE a probe is even selected, let alone called, so a bug that
 * skipped it could not be papered over by a probe declining to fire. */
import { all, run } from "../db/index.js";
import { probeEligibility } from "./eligibility.js";
import { probeFor } from "./probes/registry.js";
import { withTimeout, PROBE_TIMEOUT_MS } from "./probe.js";

export interface CheckedRow {
  name: string;
  state: string;
  method: string | null;
  note: string | null;
}

interface SourceRow {
  id: number;
  name: string;
  legal_posture: string;
  platform: string | null;
  probe_url: string | null;
}

export async function checkSources(
  opts: { sourceName?: string; fetchImpl?: typeof fetch } = {},
): Promise<CheckedRow[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const rows = opts.sourceName
    ? await all<SourceRow>(
        `SELECT id, name, legal_posture, platform, probe_url FROM source WHERE name = $1`,
        [opts.sourceName],
      )
    : await all<SourceRow>(
        `SELECT id, name, legal_posture, platform, probe_url FROM source ORDER BY name`,
      );

  /* Excluded and unknown rows keep health_checked_at = NULL: nothing
   * measured them, and rows that never make it into `eligible` are never
   * touched by the UPDATE below, so that stays true by construction. */
  const eligible = rows.filter((r) => probeEligibility(r).probeable);

  const results = await Promise.allSettled(
    eligible.map(async (row) => {
      const { probe, method } = probeFor(row.platform);
      const result = await withTimeout(
        probe({ probeUrl: row.probe_url, fetchImpl }),
        PROBE_TIMEOUT_MS,
        method,
      );
      await run(
        `UPDATE source
            SET health = $1, health_method = $2, health_note = $3, health_checked_at = now()
          WHERE id = $4`,
        [result.state, result.method, result.note, row.id],
      );
      return { name: row.name, state: result.state, method: result.method, note: result.note };
    }),
  );

  /* allSettled, not all: one source failing in an unforeseen way must not
   * discard the rows already written for the others. */
  return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
}
