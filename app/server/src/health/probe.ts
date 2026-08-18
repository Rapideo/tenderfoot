/* The probe contract.
 *
 * The result is deliberately NOT a boolean. A boolean cannot express
 * "answered, and the answer was wrong" -- which is the whole point: the
 * is_active=false run returned 200 with 307 rows from a five-million-record
 * archive, and every signal said success.
 */
export interface ProbeResult {
  state: "ok" | "failing" | "rot";
  /** Recorded to source.health_method. */
  method: string;
  /** Recorded to source.health_note. Why, in a few words. */
  note: string | null;
}

export interface ProbeContext {
  probeUrl: string | null;
  /* Injected exactly as samAdapter(fetchImpl = fetch) already does, so every
   * probe is testable without a network. */
  fetchImpl: typeof fetch;
}

export type Probe = (ctx: ProbeContext) => Promise<ProbeResult>;

export const PROBE_TIMEOUT_MS = 10_000;

/* A hanging source must cost one slot, not the whole request. */
export function withTimeout(
  p: Promise<ProbeResult>,
  ms: number,
  method: string,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ state: "failing", method, note: `timed out after ${ms}ms` }),
      ms,
    );
    p.then(
      (r) => { clearTimeout(timer); resolve(r); },
      (e) => {
        clearTimeout(timer);
        resolve({ state: "failing", method, note: (e as Error).message });
      },
    );
  });
}
