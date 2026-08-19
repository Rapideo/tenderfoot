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

/* A source we ARE permitted to contact and deliberately did not probe.
 * Distinct from an excluded row, which never reaches this stage at all --
 * see the `skipped` note below. */
export interface SkippedRow {
  name: string;
  reason: string;
}

export interface CheckResult {
  checked: CheckedRow[];
  skipped: SkippedRow[];
}

interface SourceRow {
  id: number;
  name: string;
  legal_posture: string;
  platform: string | null;
  probe_url: string | null;
}

/* RETURNS BOTH HALVES, since 2026-08-18. It used to return only the probed
 * rows, and a caller could not tell "probed it, here is the verdict" from
 * "may contact it, chose not to" -- both were an absence. On /admin that
 * absence rendered as a Check button that did nothing at all when clicked
 * (Kentucky eMARS VSS, Michigan SIGMA VSS), which is indistinguishable from
 * a broken control. The skip is still correct; it is now merely SAID. */
export async function checkSources(
  opts: { sourceName?: string; fetchImpl?: typeof fetch } = {},
): Promise<CheckResult> {
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

  /* A row that falls back to genericUrlProbe but carries no probe_url has
   * never been given anything to check. genericUrlProbe itself would report
   * that as 'failing' (health/probes/generic-url.ts) -- visually and
   * semantically identical to a genuinely dead source, which is a false
   * alarm in the one product whose job is telling those apart. `unknown`
   * already means "never checked", which is exactly true here, and the row
   * already starts as `unknown` (migration 006) -- so the fix is to skip it
   * entirely: no fetch, no UPDATE, no entry in the returned array. That is
   * different from WRITING 'unknown': it leaves whatever is already there
   * (health, health_checked_at, health_method, health_note) untouched,
   * which is the honest record of "we decided not to probe" rather than
   * "we probed and got nothing". `probeFor(...).method` (not a hardcoded
   * platform list) decides this, so the day a CGI Advantage VSS probe
   * exists, Kentucky and Michigan become probeable again with no change to
   * this file. */
  const hasProbeTarget = (r: SourceRow) =>
    probeFor(r.platform).method !== "generic-url" || !!r.probe_url;
  const probeable = eligible.filter(hasProbeTarget);

  /* Built from `eligible`, NOT from `rows`: an excluded source has no place
   * on a list that reads as "nearly probed". The reason names the missing
   * thing rather than the row, because that is what would have to change --
   * a probe for the platform (probes/registry.ts) or a probe_url for the
   * row (migration 007). */
  const skipped: SkippedRow[] = eligible
    .filter((r) => !hasProbeTarget(r))
    .map((r) => ({
      name: r.name,
      reason:
        `no probe target: ${r.platform ?? "this platform"} has no probe of its own ` +
        `and the row has no probe_url, so nothing could be measured without guessing`,
    }));

  const results = await Promise.allSettled(
    probeable.map(async (row) => {
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
  return {
    checked: results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    skipped,
  };
}
