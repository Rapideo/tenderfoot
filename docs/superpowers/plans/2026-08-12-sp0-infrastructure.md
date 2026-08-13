# SP0 — Infrastructure

**Plan date:** 2026-08-12 · **Slice:** SP0, the first · **Standard:** `Proto2PRD.md` §5.4
**Executed:** 2026-08-12, branch `sp0-infrastructure`. All tasks complete, all exit criteria met. **Three defects found by the plan's own verification steps and corrected in both the code and this plan** — see the foot of this document.
**Reads with:** the [workflow spec](../specs/2026-08-12-tenderfoot-workflow.md) and the [design spec](../specs/2026-08-03-tenderfoot-design.md)

> **Commit this plan before writing any application code.** The design thinking happens here, where it is cheap; execution is then mechanical.

---

## What SP0 is

**A working vertical slice through every layer, carrying no domain logic.**

Demo criterion, from the workflow spec §7: **the client boots, calls the API, the API reads and writes SQLite, a migration has run, and the check gate passes on all of it.**

**What SP0 deliberately does not contain.** No domain tables — the eleven objects are SP1. No design tokens or primitives — that is SP2, and its sign-off gate. No adapters, no extraction, no screens from the SVRC. **If SP0 grows a feature, it has failed.** Its whole value is that when SP1 starts adding real tables, the plumbing underneath is already proven.

---

## Decisions taken in this plan

**1. npm workspaces, three packages.** `app/client`, `app/server`, `app/shared`. Low ceremony, no extra dependency, and it keeps client and server dependency trees honest.

**2. A hand-rolled migration runner, not a library.** Numbered `.sql` files applied in order, recorded in `schema_migrations`. For local-first SQLite this is ~40 lines, has no dependency, and is entirely inspectable — which matters because §2.2 makes the first migration the project's most expensive early commitment.

**3. `app_meta` is the only table SP0 creates.** A key/value table. It is infrastructure rather than domain — it will hold last-run timestamps and schema version later — so it does not pre-empt SP1's schema, and it gives SP0 something real to read and write.

**4. `npm run check` is the gate; CI calls it.** **There is no git remote yet**, so a GitHub Actions workflow would be aspirational. Putting the gates in a local script makes them real *today* and makes CI a three-line file that runs the same script when a remote appears. The workflow file is written now so it is not forgotten.

**5. Vitest as the test runner.** ⚠️ **The IDE8 stack list did not name one**, and the workflow spec §6 requires unit tests. Vitest is the natural fit with Vite. **If IDE8 already uses something else, change this — commonality is worth more than the choice itself.**

**6. `react-router-dom` for routing.** The addition to the IDE8 stack recorded in workflow spec §1. SP0 wires exactly one route to prove it works.

> **Version pinning.** Dependency versions below are caret ranges matching the IDE8 stack. The install step writes `package-lock.json`, which is what actually pins them. Commit the lockfile.

---

## Preconditions

- [x] **P1.** Node ≥ 20 and npm ≥ 10 available. *Verify:* `node -v && npm -v` — confirmed 2026-08-12 as v24.13.0 / 11.6.2.
- [x] **P2.** Python available for the token-drift gate. *Verify:* `python --version`.
- [x] **P3.** On a branch, not `master`. *Verify:* `git checkout -b sp0-infrastructure && git branch --show-current`.

---

## Tasks

### 1. Root workspace

- [x] **T1.** Create `package.json` at the repository root.

```json
{
  "name": "tenderfoot",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": ["app/client", "app/server", "app/shared"],
  "scripts": {
    "dev": "npm run dev --workspace app/server & npm run dev --workspace app/client",
    "build": "npm run build --workspace app/client",
    "typecheck": "tsc --build --force",
    "test": "vitest run",
    "tokens": "python prototype/tools/verify-tokens.py",
    "check": "npm run typecheck && npm run test && npm run build && npm run tokens"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

*Verify:* `node -e "JSON.parse(require('fs').readFileSync('package.json'))" && echo OK`

- [x] **T2.** Create `tsconfig.base.json` at the root.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "composite": true
  }
}
```

- [x] **T3.** Create `tsconfig.json` at the root — a solution file referencing the three packages.

```json
{
  "files": [],
  "references": [
    { "path": "app/shared" },
    { "path": "app/server" },
    { "path": "app/client" }
  ]
}
```

### 2. Shared package

- [x] **T4.** Create `app/shared/package.json`.

```json
{
  "name": "@tenderfoot/shared",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "build": "tsc --build" }
}
```

- [x] **T5.** Create `app/shared/tsconfig.json`.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [x] **T6.** Create `app/shared/src/index.ts`.

```ts
/* Types shared by client and server.
 *
 * SP0 carries only what the health check needs. The domain model -- the
 * eleven objects of design spec §4 -- arrives in SP1, and the rule-bearing
 * comments from prototype/PROTOTYPE/src/app.js move here with it
 * (workflow spec §2). Do not add domain types before then. */

export interface HealthResponse {
  ok: boolean;
  /** Migrations applied, newest last. */
  migrations: string[];
  /** Server-side read of app_meta, proving the DB round-trips. */
  meta: Record<string, string>;
}

export interface PingResponse {
  ok: boolean;
  /** ISO timestamp just written to app_meta by the server. */
  wroteAt: string;
}
```

*Verify:* `npx tsc --build app/shared && ls app/shared/dist/index.d.ts`

### 3. Server, database, migrations

- [x] **T7.** Create `app/server/package.json`.

```json
{
  "name": "@tenderfoot/server",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "migrate": "tsx src/db/migrate.ts",
    "build": "tsc --build"
  },
  "dependencies": {
    "@tenderfoot/shared": "*",
    "better-sqlite3": "^13.0.0",
    "cors": "^2.8.5",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "tsx": "^4.19.0"
  }
}
```

- [x] **T8.** Create `app/server/tsconfig.json`.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "types": ["node"] },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

- [x] **T9.** Create `app/server/src/db/index.ts` — the database handle.

```ts
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* ONE SQLITE FILE, LOCAL-FIRST (workflow spec §1).
 *
 * OPEN DECISION, do not settle it here: one file per FIRM, or one shared
 * database (workflow spec §9.3). The path is read from an env var precisely
 * so that decision stays open -- switching to per-firm files means varying
 * this value, not rewriting callers. */
/* Anchored to the repository root, NOT to cwd. npm sets cwd to the workspace
 * directory, so a cwd-relative default put the database at
 * app/server/tenderfoot.db when invoked one way and elsewhere when invoked
 * another -- which is how data quietly goes missing. Found by SP0's own
 * verification. Depth is identical from src/db and dist/db. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DB_PATH = process.env.TENDERFOOT_DB
  ? resolve(process.env.TENDERFOOT_DB)
  : resolve(REPO_ROOT, "tenderfoot.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

/* Explicitly typed. `composite: true` requires declaration emit, and an
 * inferred type here names BetterSqlite3.Database from a namespace the
 * emitted .d.ts cannot reference (TS4023). InstanceType<typeof Database>
 * names it without a second import. */
export const db: InstanceType<typeof Database> = new Database(DB_PATH);

/* WAL: concurrent reads while a long ingest writes. Ingestion runs for
 * minutes at a time (§5.3), and without this the UI blocks behind it. */
db.pragma("journal_mode = WAL");
/* Foreign keys are OFF by default in SQLite. Design spec §2.2 makes entity
 * FKs present from the first migration the expensive-mistake-to-avoid, and
 * they are worth nothing unenforced. */
db.pragma("foreign_keys = ON");

export { DB_PATH };
```

- [x] **T10.** Create `app/server/src/db/migrate.ts` — the runner.

```ts
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { db, DB_PATH } from "./index.js";

/* Hand-rolled rather than a library (SP0 plan, decision 2): ~40 lines, no
 * dependency, fully inspectable. The first migration is the project's most
 * expensive early commitment (§2.2), so the thing applying it should be
 * readable in one sitting. */

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");

export function migrate(verbose = true): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const applied = new Set(
    db.prepare("SELECT name FROM schema_migrations").all().map((r: any) => r.name as string),
  );
  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];

  const record = db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(DIR, file), "utf8");
    /* Each migration is one transaction. A half-applied migration is worse
     * than an unapplied one, because it looks like it worked. */
    db.transaction(() => {
      db.exec(sql);
      record.run(file, new Date().toISOString());
    })();
    ran.push(file);
    if (verbose) console.log(`applied ${file}`);
  }
  if (verbose && ran.length === 0) console.log("no pending migrations");
  return ran;
}

export function appliedMigrations(): string[] {
  return db
    .prepare("SELECT name FROM schema_migrations ORDER BY name")
    .all()
    .map((r: any) => r.name as string);
}

/* Entry-point guard. `file://${process.argv[1]}` is WRONG on Windows: argv[1]
 * is a backslashed path (C:\...) while import.meta.url is a file:///C:/...
 * URL, so the comparison silently never matches and the CLI does nothing.
 * pathToFileURL normalises both sides. Found by SP0's own verification. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`database: ${DB_PATH}`);
  migrate();
}
```

- [x] **T11.** Create `app/server/migrations/001_app_meta.sql`.

```sql
-- SP0. Infrastructure only -- NOT domain schema.
-- The eleven objects of design spec §4 arrive in SP1 and belong in their
-- own migration. This table exists so SP0 has something real to read and
-- write, and it earns its place later as the home for last-run timestamps
-- and schema version.
CREATE TABLE app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO app_meta (key, value, updated_at)
VALUES ('schema_owner', 'sp0', datetime('now'));
```

*Verify:* `npm run migrate --workspace app/server` then `npm run migrate --workspace app/server` again — the second run must print `no pending migrations`, proving idempotence.

- [x] **T12.** Create `app/server/src/index.ts` — the API.

```ts
import cors from "cors";
import express from "express";
import type { HealthResponse, PingResponse } from "@tenderfoot/shared";
import { db } from "./db/index.js";
import { appliedMigrations, migrate } from "./db/migrate.js";

const PORT = Number(process.env.PORT ?? 3003);

migrate(false);

const app = express();
app.use(cors());
app.use(express.json());

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
```

*Verify:* `npm run dev --workspace app/server` in one terminal, then
`curl -s localhost:3003/api/health` → JSON with `"migrations":["001_app_meta.sql"]`, and
`curl -s -X POST localhost:3003/api/health/ping` → JSON with a timestamp.

- [x] **T13.** Create `app/server/src/db/migrate.test.ts`.

```ts
import { afterAll, expect, test } from "vitest";
import { rmSync } from "node:fs";

/* Point at a scratch database BEFORE importing anything that opens one --
 * the module reads the env var at import time. */
process.env.TENDERFOOT_DB = "tmp-test.db";
const { migrate, appliedMigrations } = await import("./migrate.js");
const { db } = await import("./index.js");

afterAll(() => {
  db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`tmp-test.db${suffix}`, { force: true });
  }
});

test("migrations apply, and applying twice is a no-op", () => {
  const first = migrate(false);
  expect(first).toContain("001_app_meta.sql");
  const second = migrate(false);
  expect(second).toEqual([]);
  expect(appliedMigrations()).toEqual(["001_app_meta.sql"]);
});

test("foreign keys are enforced", () => {
  expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
});
```

*Verify:* `npx vitest run app/server` — two passing tests.

### 4. Client

- [x] **T14.** Create `app/client/package.json`.

```json
{
  "name": "@tenderfoot/client",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5175",
    "build": "tsc --build && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tenderfoot/shared": "*",
    "immer": "^10.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0"
  }
}
```

- [x] **T15.** Create `app/client/tsconfig.json`.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist-types",
    "rootDir": "src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": false
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

- [x] **T16.** Create `app/client/vite.config.ts`.

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    /* Proxy rather than CORS in the browser: the client calls /api/* on its
     * own origin in dev and in production alike, so there is no environment
     * where the URL differs. */
    proxy: { "/api": "http://localhost:3003" },
  },
});
```

- [x] **T17.** Create `app/client/index.html`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tenderfoot</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [x] **T18.** Create `app/client/src/main.tsx`.

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { Health } from "./Health";

/* One route in SP0, purely to prove routing works. The real route table
 * follows the SVRC's seven screens and is SP2/SP6 work.
 *
 * Routing is an ADDITION to the IDE8 stack and a pre-authorised deviation
 * from the prototype, which has none (design spec §7.10). */
const router = createBrowserRouter([{ path: "/", element: <Health /> }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

- [x] **T19.** Create `app/client/src/Health.tsx`.

```tsx
import { useEffect, useState } from "react";
import type { HealthResponse, PingResponse } from "@tenderfoot/shared";

/* SP0's demo surface. Deliberately unstyled -- no tokens, no primitives.
 * The design system is SP2 and carries a sign-off gate; styling anything
 * here would pre-empt it. */
export function Health() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [ping, setPing] = useState<PingResponse | null>(null);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth);
  }, []);

  async function doPing() {
    const r = await fetch("/api/health/ping", { method: "POST" });
    setPing(await r.json());
    setHealth(await (await fetch("/api/health")).json());
  }

  return (
    <main>
      <h1>Tenderfoot — SP0</h1>
      <p>Client → API → SQLite. No domain logic.</p>
      <h2>Read</h2>
      <pre>{health ? JSON.stringify(health, null, 2) : "loading…"}</pre>
      <h2>Write</h2>
      <button onClick={doPing}>Write a timestamp</button>
      {ping && <pre>{JSON.stringify(ping, null, 2)}</pre>}
    </main>
  );
}
```

*Verify:* with the server running, `npm run dev --workspace app/client`, open `http://localhost:5175`. The Read block lists `001_app_meta.sql`; clicking the button adds `last_ping` to `meta`.

### 5. Gates

- [x] **T20.** Create `.env.example` at the root.

```
# Copy to .env. Never commit .env.
# Workflow spec §8: V1's secret surface is nearly empty. Every source in
# use is anonymous. The two things that will populate this file are an
# authenticated Michigan adapter and, if extraction runs in smart mode, a
# model API key.

# Where the SQLite file lives. Defaults to ./tenderfoot.db
TENDERFOOT_DB=

# API port. Defaults to 3003
PORT=
```

- [x] **T21.** Append to `.gitignore`.

```
node_modules/
dist/
dist-types/
.env
*.db
*.db-wal
*.db-shm
tmp-test.db*
```

- [x] **T22.** Create `.github/workflows/ci.yml`.

```yaml
# There is no git remote yet (SP0 plan, decision 4), so this file does not
# run anything today. It exists so the gate is not reinvented later, and it
# calls the same `npm run check` a developer runs locally -- which is what
# keeps the two from drifting.
name: check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: npm ci
      - run: npm run check
```

- [x] **T23.** Install and run the full gate.

*Verify:* `npm install && npm run check` — typecheck, tests, client build, and token drift all pass. **Commit `package-lock.json`.**

---

## Exit criteria

- [x] `npm run check` passes from a clean clone
- [x] `npm run migrate --workspace app/server` twice: applies once, no-ops the second time
- [x] Client at `:5175` shows applied migrations, and the button writes a timestamp that survives a refresh
- [x] Deleting `tenderfoot.db` and restarting the server rebuilds it from migrations
- [x] **No domain tables, no tokens, no SVRC screens.** If any appeared, SP0 grew a feature

---

## What this plan will teach us about the workflow spec

SP0 exists partly to test B2 while it is cheap to correct. **Three things to watch:**

**Does `npm run check` stay fast enough to run every time?** If it does not, the gate gets skipped, and a skipped gate is worse than none.

**Is the three-package workspace worth its ceremony at this size?** If `shared` stays this thin through SP1, collapsing it into the server is the simplification.

**Does the proxy-not-CORS choice hold?** It is cleaner, but `cors` is installed because the IDE8 stack includes it. If nothing ever needs it, drop the dependency and note it.


---

## Execution record — three defects the verification caught

**Executed 2026-08-12.** The value of writing verification commands rather than "check it works" is that they fail. All three of these would have shipped silently.

**1. `TS4023` — the exported database handle could not be named.** `composite: true` requires declaration emit, and the inferred type of `db` referenced `BetterSqlite3.Database` from a namespace the emitted `.d.ts` could not reference. Fixed with an explicit `InstanceType<typeof Database>` annotation, which names the type without a second import. **Caught by `npm run typecheck`** on the first run of the gate.

**2. The migration CLI silently did nothing on Windows.** The entry-point guard read ``import.meta.url === `file://${process.argv[1]}` `` — but `argv[1]` is a backslashed path (`C:\...`) while `import.meta.url` is a `file:///C:/...` URL, so the comparison never matched. The command exited zero, printed nothing, and applied no migrations. **The unit tests passed throughout**, because they call `migrate()` directly. Fixed with `pathToFileURL`.

> **This one is worth remembering.** A green test suite and a zero exit code, and the command did nothing at all. It was caught only because the plan's verification step said *"the second run must print `no pending migrations`"* — an expectation about **output**, not about exit status.

**3. The database landed in a different place depending on how it was invoked.** `resolve("tenderfoot.db")` is cwd-relative, and npm sets cwd to the workspace directory — so `npm run migrate --workspace app/server` wrote `app/server/tenderfoot.db` while a root-level invocation would write elsewhere. **That is how data quietly goes missing.** Fixed by anchoring the default to the repository root, computed from the module's own location so `src/` and `dist/` resolve identically.

**None of the three were design errors.** The plan's decisions all held. They were the ordinary friction of a first slice on a specific machine — which is exactly what SP0 exists to absorb before SP1 puts real data on top of it.
