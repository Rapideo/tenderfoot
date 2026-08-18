/* Platform -> probe, mirroring scrape/adapters/registry.ts: a plain
 * synchronous map, no database access, importable by tests without a
 * connection.
 *
 * Keyed by PLATFORM per §5.7 ("adapters bind to PLATFORM + config, not
 * jurisdiction") rather than by source. The payoff is concrete: one
 * 'CGI Advantage VSS' entry would cover Kentucky eMARS AND Michigan SIGMA,
 * and a probe can exist for a platform long before an adapter does.
 *
 * Empty on purpose -- Task 5 fills this in with real adapter-backed probes
 * for SAM and USASpending. Until then every platform, known or not, falls
 * back to genericUrlProbe.
 */
import type { Probe } from "../probe.js";
import { genericUrlProbe } from "./generic-url.js";

export const PROBES: Record<string, { probe: Probe; method: string }> = {};

export function probeFor(platform: string | null): { probe: Probe; method: string } {
  return (platform && PROBES[platform]) || { probe: genericUrlProbe, method: "generic-url" };
}
