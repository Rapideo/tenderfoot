import { expect, test } from "vitest";
import { withTimeout, PROBE_TIMEOUT_MS } from "./probe.js";
import { genericUrlProbe } from "./probes/generic-url.js";
import { probeFor } from "./probes/registry.js";

const okFetch = (status: number) =>
  (async () => new Response("body", { status })) as unknown as typeof fetch;

test("a 2xx makes the generic probe ok", async () => {
  const r = await genericUrlProbe({ probeUrl: "https://example.test/x", fetchImpl: okFetch(200) });
  expect(r.state).toBe("ok");
  expect(r.method).toBe("generic-url");
});

test("a non-2xx makes it failing, and the note carries the status", async () => {
  const r = await genericUrlProbe({ probeUrl: "https://example.test/x", fetchImpl: okFetch(503) });
  expect(r.state).toBe("failing");
  expect(r.note).toMatch(/503/);
});

test("a thrown network error is failing, not an exception", async () => {
  const boom = (async () => { throw new Error("connect ETIMEDOUT"); }) as unknown as typeof fetch;
  const r = await genericUrlProbe({ probeUrl: "https://example.test/x", fetchImpl: boom });
  expect(r.state).toBe("failing");
  expect(r.note).toMatch(/ETIMEDOUT/);
});

/* The generic probe structurally CANNOT return 'rot' -- it has no idea what
 * a good answer looks like. That limit is the reason health_method exists. */
test("the generic probe never returns rot", async () => {
  for (const status of [200, 204, 404, 500]) {
    const r = await genericUrlProbe({ probeUrl: "https://e.test/x", fetchImpl: okFetch(status) });
    expect(r.state).not.toBe("rot");
  }
});

test("a missing probe_url is failing rather than a crash", async () => {
  const r = await genericUrlProbe({ probeUrl: null, fetchImpl: okFetch(200) });
  expect(r.state).toBe("failing");
  expect(r.note).toMatch(/no probe_url/i);
});

/* One hanging source must not stall the request. */
test("a probe that never settles times out as failing", async () => {
  const hang = new Promise<never>(() => {});
  const r = await withTimeout(hang as never, 20, "generic-url");
  expect(r.state).toBe("failing");
  expect(r.note).toMatch(/timed out/i);
});

test("the default timeout is 10 seconds", () => {
  expect(PROBE_TIMEOUT_MS).toBe(10_000);
});

test("an unknown platform falls back to the generic probe", () => {
  expect(probeFor("Periscope S2G").method).toBe("generic-url");
  expect(probeFor(null).method).toBe("generic-url");
});
