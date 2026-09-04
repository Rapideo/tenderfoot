import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { fetchRegister } from "./eds-client.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, "fixtures/eds-sample.json"), "utf8");
const SAMPLE = JSON.parse(FIXTURE) as { results: unknown[] };

test("it asks for the count first, then for that many rows", async () => {
  const bodies: Array<Record<string, number>> = [];
  const fake: typeof fetch = async (_u, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(FIXTURE, { status: 200 });
  };
  const rows = await fetchRegister({ fetchImpl: fake, delayMs: 0 });

  expect(bodies).toHaveLength(2);
  /* First: the cheapest possible question -- how many are there? */
  expect(bodies[0]!.pageSize).toBe(1);
  /* Second: at least that many. The count comes FROM THE API, never from a
   * hard-coded 204,991, so a growing register cannot silently truncate us. */
  expect(bodies[1]!.pageSize).toBeGreaterThanOrEqual(SAMPLE.results.length);
  expect(rows).toHaveLength(SAMPLE.results.length);
});

test("`page` is always 1 and is never used as a cursor", async () => {
  const bodies: Array<Record<string, number>> = [];
  const fake: typeof fetch = async (_u, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(FIXTURE, { status: 200 });
  };
  await fetchRegister({ fetchImpl: fake, delayMs: 0 });
  /* This API ignores `page` entirely, so sending anything but 1 would be a lie
   * about how the fetcher works. Both keys must still always be present: an
   * empty body returns a ZEROED pagination block, not everything. */
  for (const b of bodies) expect(b.page).toBe(1);
});

test("it sends an identifying user-agent", async () => {
  let ua = "";
  const fake: typeof fetch = async (_u, init) => {
    ua = String((init?.headers as Record<string, string>)["user-agent"] ?? "");
    return new Response(FIXTURE, { status: 200 });
  };
  await fetchRegister({ fetchImpl: fake, delayMs: 0 });
  expect(ua).toMatch(/Tenderfoot/);
});

test("a non-2xx stops on the first failure rather than retrying", async () => {
  let calls = 0;
  const fake: typeof fetch = async () => {
    calls += 1;
    return new Response("no", { status: 429 });
  };
  await expect(fetchRegister({ fetchImpl: fake, delayMs: 0 })).rejects.toThrow(/429/);
  /* Retrying into a rate limiter is how a guest gets blocked. */
  expect(calls).toBe(1);
});

/* 🔴 The completeness assertion must fire THROUGH the client, not only in its
 * own unit test. A response shorter than its stated total is the silent
 * truncation case, and there is no cursor to recover with. */
test("a short response throws instead of returning a partial register", async () => {
  const short = JSON.stringify({ results: [{ id: "x" }], pagination: { totalResults: 500 } });
  const fake: typeof fetch = async () => new Response(short, { status: 200 });
  await expect(fetchRegister({ fetchImpl: fake, delayMs: 0 })).rejects.toThrow(
    /Incomplete register/,
  );
});
