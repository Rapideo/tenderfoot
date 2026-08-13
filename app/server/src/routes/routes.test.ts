import { afterAll, beforeAll, expect, test } from "vitest";
import { rmSync } from "node:fs";
import express from "express";

process.env.TENDERFOOT_DB = "tmp-routes-test.db";
const { migrate } = await import("../db/migrate.js");
const { db } = await import("../db/index.js");
const { api } = await import("./index.js");

let base = "";
let server: any;

beforeAll(async () => {
  migrate(false);
  const app = express();
  app.use(express.json());
  app.use("/api", api);
  await new Promise<void>((r) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}/api`;
      r();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
  for (const s of ["", "-wal", "-shm"]) rmSync(`tmp-routes-test.db${s}`, { force: true });
});

const get = (p: string) => fetch(base + p).then(async (r) => [r.status, await r.json()] as const);
const patch = (p: string, body: unknown) =>
  fetch(base + p, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => [r.status, await r.json()] as const);

test("the firm profile is readable and is the seeded firm", async () => {
  const [status, body] = await get("/profile");
  expect(status).toBe(200);
  expect(body.vendor_name).toBe("Koehler Partners");
  /* Deferred 2026-08-10: records not accessible. Empty BY DECISION, and a
   * test asserts it so nobody "fixes" it by inventing data. */
  expect(body.past_performance).toBeNull();
});

test("the profile is editable", async () => {
  const [status, body] = await patch("/profile", { negative_profile: "No construction." });
  expect(status).toBe(200);
  expect(body.updated).toContain("negative_profile");
  const [, after] = await get("/profile");
  expect(after.negative_profile).toBe("No construction.");
});

test("unknown profile fields are rejected rather than silently ignored", async () => {
  const [status] = await patch("/profile", { capacity_calendar: "Q4 is full" });
  expect(status).toBe(400);
});

test("the source registry is readable", async () => {
  const [status, body] = await get("/sources");
  expect(status).toBe(200);
  expect(body.length).toBeGreaterThanOrEqual(11);
});

/* §5.5.1 -- the whole point of the standing rule. */
test("a legal posture cannot be changed without recording the evidence", async () => {
  const [, sources] = await get("/sources");
  const ohio = sources.find((s: any) => s.name === "Ohio OhioBuys");

  /* Ohio ALREADY carries a note explaining its CAPTCHA gate. That note is
   * evidence for the OLD posture, so it must not be accepted as evidence for
   * changing to a new one. */
  const [status, body] = await patch(`/sources/${ohio.id}`, { legal_posture: "in" });
  expect(status).toBe(400);
  expect(body.field).toBe("legal_note");
  expect(body.current_note).toMatch(/CAPTCHA/i);

  const [ok] = await patch(`/sources/${ohio.id}`, {
    legal_posture: "in",
    legal_note: "Spoke to DAS 2026-08-13; written confirmation on file.",
  });
  expect(ok).toBe(200);
});

test("an unknown legal posture is refused", async () => {
  const [, sources] = await get("/sources");
  const [status] = await patch(`/sources/${sources[0].id}`, {
    legal_posture: "probably-fine",
    legal_note: "someone said it was ok",
  });
  expect(status).toBe(400);
});

/* Fail closed. A missing window that quietly means "everything" is how a
 * first run pulls two years of data. */
test("a source cannot be enabled without an ingestion window", async () => {
  const [, sources] = await get("/sources");
  const ohio = sources.find((s: any) => s.name === "Ohio OhioBuys");
  const [status, body] = await patch(`/sources/${ohio.id}`, { enabled: true });
  expect(status).toBe(400);
  expect(body.field).toBe("since_default");
});

test("a source whose posture is not 'in' cannot be enabled", async () => {
  const [, sources] = await get("/sources");
  const govwin = sources.find((s: any) => s.name === "GovWin IQ");
  const [status] = await patch(`/sources/${govwin.id}`, { enabled: true, since_default: "P7D" });
  expect(status).toBe(400);
});

test("an in-posture source with a window can be enabled", async () => {
  const [, sources] = await get("/sources");
  const il = sources.find((s: any) => s.name === "Illinois BidBuy");
  const [status, body] = await patch(`/sources/${il.id}`, { enabled: true });
  expect(status).toBe(200);
  expect(body.source.enabled).toBe(1);
});

test("solicitations list returns everything, in a stated order", async () => {
  const [status, body] = await get("/solicitations");
  expect(status).toBe(200);
  expect(body).toHaveProperty("count");
  expect(body.order).toBe("closes_at ASC");
});
