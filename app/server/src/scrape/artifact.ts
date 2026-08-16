// app/server/src/scrape/artifact.ts
/* The transport artifact: one SQLite file per run.
 *
 * SQLite is the ARTIFACT here, never the application's database — Vercel has
 * no writable persistent filesystem and Postgres is the only system of
 * record (spec §1, and app/server/src/db/index.ts:3).
 *
 * Uses node:sqlite, built into Node 24, rather than better-sqlite3. A native
 * addon would be a build risk on Vercel and better-sqlite3 was deliberately
 * removed in SP1.5. node:sqlite emits an ExperimentalWarning; that is
 * expected and is not suppressed.
 *
 * The file is SELF-DESCRIBING: `run` states what was asked for and how far
 * it got, so an artifact found on disk in six months explains itself.
 *
 * DEVIATION FROM THE BRIEF: `import { DatabaseSync } from "node:sqlite"` (a
 * static ESM import) fails under this repo's test runner, not under Node
 * itself. vitest 2.1.9's module runner (vite-node) unconditionally strips
 * the "node:" prefix from any specifier not on its own short allowlist of
 * prefix-only builtins (currently just "node:test"; "node:sqlite" isn't in
 * it) and then tries to resolve the bare name "sqlite" as an npm package,
 * which fails. `node --env-file-if-exists=.env ...` running the file
 * directly (outside vitest) has no such problem. Routing the import through
 * `createRequire` sidesteps vite-node's import interceptor -- it hands back
 * a genuine native CommonJS `require`, so resolution happens inside Node
 * itself instead of vite-node's specifier-rewriting layer. Verified this is
 * the actual mechanism (not a guess) by tracing vite-node's debug output:
 * the request that reaches its resolver is literally "sqlite", stripped of
 * "node:", per node_modules/vite-node/dist/utils.mjs's `normalizeModuleId`.
 * Still node:sqlite, still zero added dependencies -- only the import
 * mechanism changed.
 */
import { createRequire } from "node:module";
import type { Depth } from "./contract.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");

export interface RunMeta {
  sourceName: string;
  since: string;
  until: string;
  depth: Depth;
  scraperVer: string;
}

export interface CaptureRow {
  hop: "listing" | "detail" | "document";
  url: string;
  httpStatus: number;
  payload: string;
}

export interface SightingRow {
  externalId: string;
  seenAt: string;
  raw: unknown;
  captureId: number;
  extractorVer: string;
  mode: "mechanical" | "smart";
}

export interface DocumentRefRow {
  captureId: number;
  url: string;
  filename: string;
  contentType: string | null;
  statedBytes: number | null;
}

const SCHEMA = `
CREATE TABLE run (
  source_name TEXT NOT NULL, since TEXT NOT NULL, until TEXT NOT NULL,
  depth TEXT NOT NULL, scraper_ver TEXT NOT NULL,
  started_at TEXT NOT NULL, finished_at TEXT, outcome TEXT, next_since TEXT
);
CREATE TABLE capture (
  id INTEGER PRIMARY KEY AUTOINCREMENT, hop TEXT NOT NULL, url TEXT NOT NULL,
  http_status INTEGER NOT NULL, fetched_at TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE sighting (
  id INTEGER PRIMARY KEY AUTOINCREMENT, external_id TEXT NOT NULL,
  seen_at TEXT NOT NULL, raw TEXT NOT NULL, capture_id INTEGER NOT NULL,
  extractor_ver TEXT NOT NULL, mode TEXT NOT NULL
);
CREATE TABLE document_ref (
  id INTEGER PRIMARY KEY AUTOINCREMENT, capture_id INTEGER NOT NULL,
  url TEXT NOT NULL, filename TEXT, content_type TEXT, stated_bytes INTEGER,
  fetched_at TEXT NOT NULL, http_status INTEGER,
  sha256 TEXT, blob_ref TEXT
);
`;

export interface ArtifactWriter {
  path: string;
  writeCapture(c: CaptureRow): number;
  writeSighting(s: SightingRow): void;
  writeDocumentRef(d: DocumentRefRow): void;
  finish(outcome: string, nextSince: string | null): void;
  close(): void;
}

export function openArtifact(path: string, meta: RunMeta): ArtifactWriter {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  db.prepare(
    `INSERT INTO run (source_name, since, until, depth, scraper_ver, started_at)
     VALUES (?,?,?,?,?,?)`,
  ).run(meta.sourceName, meta.since, meta.until, meta.depth, meta.scraperVer, new Date().toISOString());

  return {
    path,
    writeCapture(c) {
      const r = db
        .prepare(
          `INSERT INTO capture (hop, url, http_status, fetched_at, payload) VALUES (?,?,?,?,?)`,
        )
        .run(c.hop, c.url, c.httpStatus, new Date().toISOString(), c.payload);
      return Number(r.lastInsertRowid);
    },
    writeSighting(s) {
      db.prepare(
        `INSERT INTO sighting (external_id, seen_at, raw, capture_id, extractor_ver, mode)
         VALUES (?,?,?,?,?,?)`,
      ).run(s.externalId, s.seenAt, JSON.stringify(s.raw), s.captureId, s.extractorVer, s.mode);
    },
    /* sha256 and blob_ref stay NULL at reference depth. A hash cannot be
     * computed for a document that was never downloaded, and inventing one
     * is worse than leaving it absent. */
    writeDocumentRef(d) {
      db.prepare(
        `INSERT INTO document_ref (capture_id, url, filename, content_type, stated_bytes, fetched_at)
         VALUES (?,?,?,?,?,?)`,
      ).run(d.captureId, d.url, d.filename, d.contentType, d.statedBytes, new Date().toISOString());
    },
    finish(outcome, nextSince) {
      db.prepare(`UPDATE run SET finished_at = ?, outcome = ?, next_since = ?`).run(
        new Date().toISOString(),
        outcome,
        nextSince,
      );
    },
    close() {
      db.close();
    },
  };
}

export function readArtifact(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return {
      run: db.prepare(`SELECT * FROM run`).get() as any,
      captures: db.prepare(`SELECT * FROM capture ORDER BY id`).all() as any[],
      sightings: db.prepare(`SELECT * FROM sighting ORDER BY id`).all() as any[],
      documentRefs: db.prepare(`SELECT * FROM document_ref ORDER BY id`).all() as any[],
    };
  } finally {
    db.close();
  }
}
