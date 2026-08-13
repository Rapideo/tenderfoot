import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { pathToFileURL } from "node:url";
import type { HealthResponse, PingResponse } from "@tenderfoot/shared";
import { all, run } from "./db/index.js";
import { appliedMigrations, migrate } from "./db/migrate.js";
import { asyncHandler } from "./lib/asyncHandler.js";
import { api } from "./routes/index.js";

const PORT = Number(process.env.PORT ?? 3003);

export const app = express();
app.use(cors());
app.use(express.json());

/* SP1: profile, source registry, solicitations. */
app.use("/api", api);

async function readMeta(): Promise<Record<string, string>> {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM app_meta");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/* READ path. */
app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    const body: HealthResponse = {
      ok: true,
      migrations: await appliedMigrations(),
      meta: await readMeta(),
    };
    res.json(body);
  }),
);

/* WRITE path. SP0's demo criterion needs both, or the slice proves half a
 * pipe. */
app.post(
  "/api/health/ping",
  asyncHandler(async (_req, res) => {
    const wroteAt = new Date().toISOString();
    await run(
      `INSERT INTO app_meta (key, value, updated_at) VALUES ('last_ping', $1, $2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [wroteAt, wroteAt],
    );
    const body: PingResponse = { ok: true, wroteAt };
    res.json(body);
  }),
);

/* I3 (SP1.5 final review). Express 4 does not catch a promise rejected by
 * an async handler -- every route above now forwards its rejection to
 * next(err) via asyncHandler, and this is where those land. Registered
 * after every route on purpose: Express only treats a four-argument
 * middleware as an error handler, and only errors from layers registered
 * BEFORE this one reach it.
 *
 * Never put the raw error -- message, stack, or any connection detail --
 * into the response body. A Neon cold-start timeout, a dropped connection,
 * or a malformed-payload SQLSTATE (22P02) all end up here, and none of
 * that is safe to hand back to the caller. Logged server-side instead. */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

/* Migrations no longer run at import. On one laptop that was convenient; on
 * Vercel it means every cold start of every concurrent function instance
 * would race to migrate the same database. Migrations are a deploy step now
 * (Task 14), and the server asserts rather than acts.
 *
 * Local only. Task 14 wires the deployed path, where this file is not the
 * entry point -- so the check and `listen` below only run when this file is
 * executed directly, not merely imported.
 *
 * `file://${process.argv[1]}` is WRONG on Windows: argv[1] is a backslashed
 * path (C:\...) while import.meta.url is a file:///C:/... URL, so the
 * comparison silently never matches and the guard's body never runs.
 * pathToFileURL normalises both sides. Found by SP0's own verification;
 * see db/migrate.ts. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pending = await migrate(false).catch(() => null);
  if (pending === null) {
    console.error("Could not reach the database. Is DATABASE_URL set?");
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`tenderfoot server on :${PORT}`));
}
