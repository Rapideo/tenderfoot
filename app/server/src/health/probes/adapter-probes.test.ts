import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { samProbe } from "./sam.js";
import { usaSpendingProbe } from "./usaspending.js";
import { probeFor } from "./registry.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL = readFileSync(
  join(HERE, "../../scrape/adapters/fixtures/sam-listing.json"), "utf8",
);
const REAL_USASPENDING = readFileSync(
  join(HERE, "../../scrape/adapters/fixtures/usaspending-listing.json"), "utf8",
);

const respond = (body: string, status = 200) =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

const unreachable = (async () => {
  throw new Error("connect ECONNREFUSED");
}) as unknown as typeof fetch;

test("a real listing payload makes SAM ok", async () => {
  const r = await samProbe({ probeUrl: null, fetchImpl: respond(REAL) });
  expect(r.state).toBe("ok");
  expect(r.method).toBe("sam");
});

/* THE STATE THAT EARNS THIS SLICE. A source that answers 200 and serves
 * nothing is the is_active=false failure: every signal said success. Only an
 * adapter probe can tell this apart from health.
 *
 * The body is real-shaped -- `_embedded.results: []` -- because that is what
 * the actual sam.gov search endpoint returns for a genuinely empty result
 * set. A body missing `_embedded` entirely (e.g. a different SAM API's
 * shape) is a DIFFERENT case, covered separately below, precisely because
 * `parseSamPage`'s `?? []` fallback would make the two indistinguishable if
 * only one fixture ever stood in for both. */
test("a real-shaped 200 with zero results is rot, not ok", async () => {
  const empty = JSON.stringify({ _embedded: { results: [] } });
  const r = await samProbe({ probeUrl: null, fetchImpl: respond(empty) });
  expect(r.state).toBe("rot");
  expect(r.note).toMatch(/0 rows|zero/i);
});

/* DISTINCT from the case above on purpose. This body is shaped like SAM's
 * public v2 API (`opportunitiesData`), not the sgs/v1 endpoint this probe
 * calls and `parseSamPage` understands (`_embedded.results`). It has no
 * `_embedded` key at all, so `parseSamPage`'s `d?._embedded?.results ?? []`
 * fallback reads it as zero rows too -- currently indistinguishable from a
 * genuine empty result set, and that IS today's behaviour. Named and
 * asserted separately so a future change to that fallback (e.g. to detect a
 * shape mismatch and return 'failing' instead) breaks this test on its own,
 * without silently making the genuine-empty-results test above meaningless
 * as a stand-in for it. */
test("a 200 shaped like a different SAM API also reads as rot today", async () => {
  const wrongShape = JSON.stringify({ totalRecords: 0, opportunitiesData: [] });
  const r = await samProbe({ probeUrl: null, fetchImpl: respond(wrongShape) });
  expect(r.state).toBe("rot");
  expect(r.note).toMatch(/0 rows|zero/i);
});

test("a non-2xx is failing", async () => {
  const r = await samProbe({ probeUrl: null, fetchImpl: respond("nope", 503) });
  expect(r.state).toBe("failing");
  expect(r.note).toMatch(/503/);
});

test("an unparseable body is failing rather than a crash", async () => {
  const r = await samProbe({ probeUrl: null, fetchImpl: respond("<html>down</html>") });
  expect(r.state).toBe("failing");
});

/* The third failure mode named in the global constraints, alongside a
 * non-2xx and an unparseable body: an unreachable host must not throw out
 * of the probe. */
test("an unreachable host is failing, not a thrown exception", async () => {
  const r = await samProbe({ probeUrl: null, fetchImpl: unreachable });
  expect(r.state).toBe("failing");
  expect(r.note).toMatch(/ECONNREFUSED/);
});

test("both adapter platforms are registered by name", () => {
  expect(probeFor("SAM").method).toBe("sam");
  expect(probeFor("USASpending").method).toBe("usaspending");
});

/* USASpending's own fixture, exercised the same way as SAM's above -- it
 * would otherwise sit unused, and the two probes share the same rot rule. */
test("a real listing payload makes USASpending ok", async () => {
  const r = await usaSpendingProbe({ probeUrl: null, fetchImpl: respond(REAL_USASPENDING) });
  expect(r.state).toBe("ok");
  expect(r.method).toBe("usaspending");
});

test("200 with zero results is rot for USASpending too", async () => {
  const empty = JSON.stringify({ results: [] });
  const r = await usaSpendingProbe({ probeUrl: null, fetchImpl: respond(empty) });
  expect(r.state).toBe("rot");
  expect(r.note).toMatch(/0 rows|zero/i);
});

test("a non-2xx is failing for USASpending", async () => {
  const r = await usaSpendingProbe({ probeUrl: null, fetchImpl: respond("nope", 503) });
  expect(r.state).toBe("failing");
  expect(r.note).toMatch(/503/);
});

test("an unparseable body is failing rather than a crash for USASpending", async () => {
  const r = await usaSpendingProbe({ probeUrl: null, fetchImpl: respond("<html>down</html>") });
  expect(r.state).toBe("failing");
});

test("an unreachable host is failing for USASpending too", async () => {
  const r = await usaSpendingProbe({ probeUrl: null, fetchImpl: unreachable });
  expect(r.state).toBe("failing");
  expect(r.note).toMatch(/ECONNREFUSED/);
});
