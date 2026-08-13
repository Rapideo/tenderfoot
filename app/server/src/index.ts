import cors from "cors";
import express from "express";
import type { HealthResponse, PingResponse } from "@tenderfoot/shared";
import { db } from "./db/index.js";
import { appliedMigrations, migrate } from "./db/migrate.js";
import { api } from "./routes/index.js";

const PORT = Number(process.env.PORT ?? 3003);

migrate(false);

const app = express();
app.use(cors());
app.use(express.json());

/* SP1: profile, source registry, solicitations. */
app.use("/api", api);

function readMeta(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM app_meta").all() as {
    key: string;
    value: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/* READ path. */
app.get("/api/health", (_req, res) => {
  const body: HealthResponse = {
    ok: true,
    migrations: appliedMigrations(),
    meta: readMeta(),
  };
  res.json(body);
});

/* WRITE path. SP0's demo criterion needs both, or the slice proves half a
 * pipe. */
app.post("/api/health/ping", (_req, res) => {
  const wroteAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO app_meta (key, value, updated_at) VALUES ('last_ping', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(wroteAt, wroteAt);
  const body: PingResponse = { ok: true, wroteAt };
  res.json(body);
});

app.listen(PORT, () => console.log(`tenderfoot server on :${PORT}`));
