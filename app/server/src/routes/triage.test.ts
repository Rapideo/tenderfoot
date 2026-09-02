import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_triage_routes");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, insert } = await import("../db/index.js");
const { app } = await import("../index.js");

const ADMIN_SECRET = "test-shared-secret-do-not-use-in-prod";
let source: number;
let solicitation: number;

beforeAll(async () => {
  await migrate(false);
  source = await insert(`INSERT INTO source (name) VALUES ('route source') RETURNING id`);
  solicitation = await insert(
    /* Migration 016: a non-null posted_at requires a non-null origin. */
    `INSERT INTO solicitation (title, source_id, posted_at, posted_at_origin, closes_at)
     VALUES ('route fixture', $1, '2026-08-01', 'published', '2027-06-01') RETURNING id`,
    [source],
  );
}, 120000);
beforeEach(() => {
  process.env.ADMIN_SECRET = ADMIN_SECRET;
});
afterAll(async () => {
  await close();
});

async function call(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  headers: Record<string, string> = { "X-Admin-Secret": ADMIN_SECRET },
) {
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } finally {
    server.close();
  }
}

test("the queue is readable without a secret -- reads are not gated", async () => {
  const res = await call("GET", "/api/queue", undefined, {});
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.mode).toBe("all");
  expect(Array.isArray(body.items)).toBe(true);
});

/* REAL DEFECT FOUND IN THE BRIEF (not transcribed): the brief's own
 * "Consumes" interface list at the top of task-7-brief.md names `getSample`
 * as an interface this router consumes, but the router code the brief goes
 * on to give never imports or calls it -- only `drawSample` and `listSamples`
 * are pulled from sample.js. Without it, `GET /api/queue?sample=<unknown
 * id>` falls straight into queuePage()'s own `throw new Error(...)` (a plain
 * Error, no distinguishing class) for a sample that does not exist, which
 * asyncHandler forwards to the global error handler as an unhandled 500 --
 * the exact "ambiguous empty / unhandled fault" shape this codebase
 * consistently refuses everywhere else an id is looked up (source,
 * solicitation, adapter name, source name in admin.ts's /health). Confirmed
 * by mutation: deleting the pre-check this test drove (see triage.ts) turns
 * this test's expectation from 404 back into a 500. */
test("the queue for an unknown sample is a 404, not a 500", async () => {
  const res = await call("GET", "/api/queue?sample=999999", undefined, {});
  expect(res.status).toBe(404);
});

/* MINOR fix. A non-numeric sample id used to fall through clampInt's
 * NaN-fallback-to-0 and silently degrade to mode: "all" -- no error, no
 * sample, the whole queue. An operator who typos the id would triage the
 * firehose believing it is bounded. */
test("a non-numeric sample id is a 400, not a silent fallback to the whole queue", async () => {
  const res = await call("GET", "/api/queue?sample=abc", undefined, {});
  expect(res.status).toBe(400);
  const body = (await res.json()) as any;
  expect(body.field).toBe("sample");
});

test("drawing a sample without the secret is refused", async () => {
  const res = await call("POST", "/api/triage/samples", { source_id: source, n: 5 }, {});
  expect(res.status).toBe(401);
});

test("drawing a sample with the secret records its denominator", async () => {
  const res = await call("POST", "/api/triage/samples", {
    source_id: source,
    n: 5,
    seed: "route-seed",
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as any;
  expect(body.population_size).toBeGreaterThanOrEqual(1);
  expect(body.seed).toBe("route-seed");
});

test("a sample for an unknown source is a 404, not an empty success", async () => {
  const res = await call("POST", "/api/triage/samples", { source_id: 999999, n: 5 });
  expect(res.status).toBe(404);
});

test("deciding without the secret is refused", async () => {
  const res = await call(
    "POST",
    `/api/solicitations/${solicitation}/decision`,
    { state: "Interested" },
    {},
  );
  expect(res.status).toBe(401);
});

test("a decision appends and returns the new latest state", async () => {
  const res = await call("POST", `/api/solicitations/${solicitation}/decision`, {
    state: "Interested",
    decided_by: "matt",
    /* Required on Interested since migration 013 -- §8.5's discovery measure. */
    discovery_channel: "nowhere",
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as any;
  expect(body.state).toBe("Interested");

  const rows = await all(`SELECT id FROM pursuit WHERE solicitation_id = $1`, [solicitation]);
  expect(rows.length).toBeGreaterThanOrEqual(1);
});

/* A missing reason is the caller's to fix, not a fault -- 400, never 500. */
test("Pass with no reason answers 400 and names the field", async () => {
  const res = await call("POST", `/api/solicitations/${solicitation}/decision`, {
    state: "Not Interested",
  });
  expect(res.status).toBe(400);
  const body = (await res.json()) as any;
  expect(body.field).toBe("reason");
});

test("a decision on an unknown solicitation is a 404", async () => {
  const res = await call("POST", "/api/solicitations/999999/decision", { state: "Interested" });
  expect(res.status).toBe(404);
});

test("metrics report both numbers and the exclusion", async () => {
  const res = await call("GET", "/api/triage/metrics", undefined, {});
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.volume).toHaveProperty("excluded_unparseable_posted_at");
  expect(Array.isArray(body.interested)).toBe(true);
});

/* ⚖️ THE DISCOVERY CHANNEL AT THE ROUTE BOUNDARY (migration 013, ruled
 * 2026-09-01). A missing channel is the CALLER's to fix, so it must answer 400
 * and name the field -- a 500 here would read as a server fault and tell the
 * screen nothing about which control to point at. Same contract
 * ReasonRequiredError already sets one branch over. */
test("Interested without a discovery channel is a 400 naming the field", async () => {
  const res = await call("POST", `/api/solicitations/${solicitation}/decision`, {
    state: "Interested",
  });
  expect(res.status).toBe(400);
  const body = (await res.json()) as any;
  expect(body.field).toBe("discovery_channel");
});

/* Validity is the DATABASE's job (migration 013's CHECK), not the route's. The
 * route passes the value through unvalidated on purpose, so a word outside the
 * vocabulary must fail rather than be silently coerced into something the
 * discovery rate would then count. */
test("a channel outside the vocabulary does not become a stored decision", async () => {
  const res = await call("POST", `/api/solicitations/${solicitation}/decision`, {
    state: "Interested",
    discovery_channel: "carrier_pigeon",
  });
  expect(res.status).not.toBe(201);
});
