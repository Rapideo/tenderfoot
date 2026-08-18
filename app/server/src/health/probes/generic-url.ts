import type { Probe, ProbeResult } from "../probe.js";

/* The fallback probe: does probe_url answer 2xx.
 *
 * It CANNOT return 'rot', and that is a real limitation rather than an
 * oversight -- it has no idea what a good answer from this source looks
 * like. A green dot from here is a much weaker claim than a green dot from
 * an adapter probe, which is why health_method records which one ran.
 */
export const genericUrlProbe: Probe = async ({ probeUrl, fetchImpl }): Promise<ProbeResult> => {
  const method = "generic-url";
  if (!probeUrl) {
    return { state: "failing", method, note: "no probe_url set for this source" };
  }
  try {
    const res = await fetchImpl(probeUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
    });
    return res.ok
      ? { state: "ok", method, note: `HTTP ${res.status}` }
      : { state: "failing", method, note: `HTTP ${res.status}` };
  } catch (e) {
    return { state: "failing", method, note: (e as Error).message };
  }
};
