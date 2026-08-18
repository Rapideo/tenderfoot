/* Platform -> probe, mirroring scrape/adapters/registry.ts: a plain
 * synchronous map, no database access, importable by tests without a
 * connection.
 *
 * Keyed by PLATFORM per §5.7 ("adapters bind to PLATFORM + config, not
 * jurisdiction") rather than by source. The payoff is concrete: one
 * 'CGI Advantage VSS' entry would cover Kentucky eMARS AND Michigan SIGMA,
 * and a probe can exist for a platform long before an adapter does.
 *
 * SAM and USASpending are the two platforms with adapter-backed probes
 * (Task 5) -- the only ones that can tell 'ok' apart from 'rot', because
 * they are the only ones that know what a good answer looks like. Every
 * other platform, known or not, falls back to genericUrlProbe.
 */
import type { Probe } from "../probe.js";
import { genericUrlProbe } from "./generic-url.js";
import { samProbe } from "./sam.js";
import { usaSpendingProbe } from "./usaspending.js";

export const PROBES: Record<string, { probe: Probe; method: string }> = {
  SAM: { probe: samProbe, method: "sam" },
  USASpending: { probe: usaSpendingProbe, method: "usaspending" },
};

export function probeFor(platform: string | null): { probe: Probe; method: string } {
  return (platform && PROBES[platform]) || { probe: genericUrlProbe, method: "generic-url" };
}
