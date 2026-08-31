import { Router } from "express";
import { all, one, run, tx } from "../db/index.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAdminSecret } from "../lib/adminSecret.js";
import { resolveField, type FieldRow } from "../extract/precedence.js";
import { latestPursuitFor } from "../triage/latest.js";

/* SP1 T5-T8. The API surface is deliberately small: read and edit the two
 * configuration objects, and read what has been collected. No scoring, no
 * ranking -- V1 returns everything (§1.1). */

export const api = Router();

/* ---- FIRM PROFILE -------------------------------------------------------
 * §4.2, §7.8: the only place customer-specific facts exist. No fact about
 * the firm appears in code, which is what makes a second customer a second
 * row rather than a fork. */

const PROFILE_FIELDS = [
  "capabilities",
  "codes",
  "certifications",
  "geography",
  "remote_ok",
  "hard_limits",
  "past_performance",
  "negative_profile",
] as const;

/* Marks the four jsonb columns for the validation task that has not been
 * written yet -- this Set is a placeholder, not an implemented check.
 * Nothing here inspects a caller's payload; a shape check on these four
 * columns lands wherever this Set is finally read. (Today pg happens to
 * serialise a plain object to jsonb correctly on its own, and a caller who
 * already JSON-encoded a string is passed through unchanged -- but that is
 * pg's behaviour, not validation this code performs.) */
const JSON_FIELDS = new Set(["codes", "certifications", "geography", "hard_limits"]);

api.get(
  "/profile",
  asyncHandler(async (_req, res) => {
    const row = await one(
      `SELECT f.*, v.name AS vendor_name
         FROM firm_profile f JOIN vendor v ON v.id = f.vendor_id
        WHERE v.is_self`,
    );
    if (!row) return res.status(404).json({ error: "No firm profile. Run migrations." });
    res.json(row);
  }),
);

/* GATED 2026-08-18. Per-route, NOT `api.use(...)`, and that distinction is
 * the whole design: the GET routes on this router stay open, because
 * /admin fetches /sources and /profile on mount and demanding the secret
 * merely to LOOK at the screen would turn a shared bearer token into a
 * login -- which design spec §7 explicitly says it is not. Writes are
 * gated; reads are not.
 *
 * Why it was worth doing at all, given the secret is not authentication:
 * `/api/admin/*` has been gated since SP3.6's final review, but THIS route
 * with `{enabled: true}` is what makes a source scrapeable, and
 * `resolveSource` refuses a disabled source. The fail-closed posture the
 * whole ingestion path depends on was itself switchable by anyone who
 * could reach the API. */
api.patch(
  "/profile",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const updates = Object.entries(req.body ?? {}).filter(([k]) =>
      (PROFILE_FIELDS as readonly string[]).includes(k),
    );
    if (!updates.length) {
      return res.status(400).json({
        error: "No editable fields supplied.",
        editable: PROFILE_FIELDS,
      });
    }
    const sets = updates.map(([k], i) => `${k} = $${i + 1}`).join(", ");
    const changes = await run(
      `UPDATE firm_profile SET ${sets}, updated_at = now()
        WHERE vendor_id = (SELECT id FROM vendor WHERE is_self)`,
      updates.map(([, v]) => v as any),
    );
    if (!changes) return res.status(404).json({ error: "No firm profile to update." });
    res.json({ ok: true, updated: updates.map(([k]) => k) });
  }),
);

/* ---- SOURCE REGISTRY ----------------------------------------------------
 * In V1 this is the ENTIRE configuration of what a user sees, because
 * nothing is filtered or ranked. Switching a source on or off is the whole
 * control surface -- so it is editable at runtime, without a deploy. */

const POSTURES = new Set(["in", "manual-only", "out"]);

/* Mirrors the CHECK in migrations/006_source_health.sql. Both exist on
 * purpose: the constraint is the guarantee, this is the error message. */
export const HEALTH_VALUES = new Set(["ok", "failing", "rot", "excluded", "unknown"]);

api.get(
  "/sources",
  asyncHandler(async (_req, res) => {
    res.json(await all("SELECT * FROM source ORDER BY legal_posture, name"));
  }),
);

api.patch(
  "/sources/:id",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const current = await one("SELECT * FROM source WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: `No source ${id}.` });

    const { enabled: rawEnabled, legal_posture, legal_note, since_default, health } = req.body ?? {};

    /* C2 fix (SP1.5 final review). `enabled` is normalised to a real
     * boolean EXACTLY ONCE, here, before both the guard below and the write
     * further down -- so the value the guard checks is the value the row
     * ends up holding.
     *
     * Why this matters under Postgres and did not under SQLite: `enabled`
     * is now a real `boolean` column. Postgres' boolean input parser
     * coerces bound text -- "true", "t", "yes", "on", "1" -- to true, for
     * ANY of those spellings, regardless of what a guard upstream compared
     * against. Under SQLite `enabled` was an integer column and a string
     * like "true" landed as opaque text that `WHERE enabled = 1` never
     * matched -- so a malformed request was inert there and is a live
     * bypass here, once the raw value is passed through to the write below
     * without first being resolved to the same boolean the guard tested.
     *
     * Only the JS values that already meant "true"/"false" before this port
     * -- real booleans, and the 1/0 the SQLite CHECK constraint accepted --
     * are treated as unambiguous. Everything else, including every string
     * spelling Postgres itself would happily coerce, is refused with a 400
     * rather than guessed at. */
    let enabled: boolean | undefined;
    if (rawEnabled !== undefined) {
      if (rawEnabled === true || rawEnabled === 1) enabled = true;
      else if (rawEnabled === false || rawEnabled === 0) enabled = false;
      else {
        return res.status(400).json({
          error: `"enabled" must be a boolean (true or false), not ${JSON.stringify(rawEnabled)}.`,
          field: "enabled",
        });
      }
    }

    /* §5.5.1 -- the standing rule. Ambiguous or restrictive terms default a
     * source to OUT; documented permission moves it IN, and THE EVIDENCE IS
     * RECORDED ON THE ROW. A rule that says evidence is recorded is
     * unenforceable if the field may be left blank, so it is enforced here
     * rather than left to discipline. */
    if (legal_posture !== undefined && legal_posture !== current.legal_posture) {
      if (!POSTURES.has(legal_posture)) {
        return res.status(400).json({
          error: `Unknown legal posture "${legal_posture}".`,
          allowed: [...POSTURES],
        });
      }
      /* The note must arrive WITH the change, not merely exist on the row.
       * An existing note documents the OLD posture -- Ohio's explains why it was
       * CAPTCHA-gated -- so carrying it forward would leave a row reading "in"
       * beside evidence for "manual-only". That is worse than no note, because
       * it looks documented. */
      if (!legal_note || !String(legal_note).trim()) {
        return res.status(400).json({
          error:
            "Changing a legal posture requires a new legal_note recording the evidence " +
            "for THIS change. The existing note documents the previous posture.",
          field: "legal_note",
          current_posture: current.legal_posture,
          current_note: current.legal_note,
        });
      }
    }

    if (health !== undefined && !HEALTH_VALUES.has(health)) {
      return res.status(400).json({
        error:
          `Invalid health '${health}'. Must be one of: ${[...HEALTH_VALUES].join(", ")}.`,
      });
    }

    /* Enabling a source with no ingestion window would let a first run pull
     * everything. Fail closed (docs/Pinned-Ingestion-Scaffolding.md). */
    if (enabled === true) {
      const window = since_default ?? current.since_default;
      if (!window) {
        return res.status(400).json({
          error:
            "Cannot enable a source with no ingestion window. A missing window that " +
            "quietly means 'everything' is how a first run pulls two years of data.",
          field: "since_default",
        });
      }
      if (current.legal_posture !== "in" && legal_posture !== "in") {
        return res.status(400).json({
          error: `Cannot enable a source whose legal posture is "${current.legal_posture}".`,
        });
      }
    }

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries({ enabled, legal_posture, legal_note, since_default, health })) {
      if (v !== undefined) patch[k] = v;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update." });

    const cols = Object.keys(patch);
    const sets = cols.map((k, i) => `${k} = $${i + 1}`).join(", ");
    await run(`UPDATE source SET ${sets} WHERE id = $${cols.length + 1}`, [...Object.values(patch), id]);
    res.json({ ok: true, source: await one("SELECT * FROM source WHERE id = $1", [id]) });
  }),
);

/* ---- SOLICITATIONS ------------------------------------------------------
 * Everything, in a defensible order that is NOT a judgment (§1.1). The
 * caller picks; the default is soonest deadline first. */

api.get(
  "/solicitations",
  asyncHandler(async (req, res) => {
    const order = req.query.order === "newest" ? "posted_at DESC" : "closes_at ASC";
    /* BOUNDED. This returned every row -- 9,883 on a deliberately-public
     * production. Validate before clamping: `Number(x) || 200` accepts a
     * negative, because -5 is truthy and Math.min does not catch it. */
    const asInt = (raw: unknown, fallback: number, min: number, max: number) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(Math.trunc(n), max));
    };
    const limit = asInt(req.query.limit, 200, 1, 1000);
    const offset = asInt(req.query.offset, 0, 0, 2 ** 31 - 1);

    const rows = await all(
      `SELECT s.*, o.name AS org_name, o.jurisdiction,
              (SELECT count(*) FROM sighting g WHERE g.solicitation_id = s.id) AS sightings,
              (SELECT count(*) FROM document d WHERE d.solicitation_id = s.id) AS documents
         FROM solicitation s
    LEFT JOIN organization o ON o.id = s.org_id
     ORDER BY ${order}
        LIMIT ${limit} OFFSET ${offset}`,
    );
    res.json({ count: rows.length, order, limit, offset, solicitations: rows });
  }),
);

api.get(
  "/solicitations/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const row = await one(
      `SELECT s.*, o.name AS org_name, o.jurisdiction
         FROM solicitation s LEFT JOIN organization o ON o.id = s.org_id
        WHERE s.id = $1`,
      [id],
    );
    if (!row) return res.status(404).json({ error: `No solicitation ${id}.` });

    /* Sightings joined, because a solicitation is the canonical record produced
     * by merging them (§4.4) and the merge should be inspectable. */
    const documents = await all("SELECT * FROM document WHERE solicitation_id = $1", [id]);
    const sightings = await all<{ id: number; seen_at: string; source_name: string }>(
      `SELECT g.*, src.name AS source_name
         FROM sighting g JOIN source src ON src.id = g.source_id
        WHERE g.solicitation_id = $1 ORDER BY g.seen_at`,
      [id],
    );

    /* SIX FIELDS, ALWAYS. A field with no row at all is "never looked for",
     * which is a different fact from a row with a NULL value ("looked and it
     * is not there"). Rendering only the rows that exist would collapse the
     * two, which SVRC View 2.3 forbids in as many words. */
    const FIELDS = [
      "closes_at", "qa_closes_at", "prebid_at", "prebid_required", "set_aside", "value_cents",
    ] as const;

    const raw = await all<
      FieldRow & { field_name: string; confidence: number | null; note: string | null }
    >(
      `SELECT field_name, value_text, origin, quote, document_id, confidence, note
         FROM extracted_field WHERE solicitation_id = $1`,
      [id],
    );

    const fields = FIELDS.map((name) => {
      const rows = raw.filter((r) => r.field_name === name);
      if (rows.length === 0) {
        return {
          field_name: name, value: null, origin: null, confidence: null,
          quote: null, note: null, state: "not_looked_for" as const, conflicts: [],
        };
      }
      const resolved = resolveField(rows);
      const winner = rows.find(
        (r) => r.value_text === resolved.value && r.origin === resolved.origin,
      );
      return {
        field_name: name,
        value: resolved.value,
        origin: resolved.origin,
        confidence: winner?.confidence ?? null,
        quote: winner?.quote ?? null,
        note: winner?.note ?? null,
        state: resolved.value === null ? ("absent" as const) : ("found" as const),
        conflicts: resolved.conflicts.map((c) => ({
          value_text: c.value_text as string,
          origin: c.origin,
          quote: c.quote,
          confidence: (c as { confidence?: number | null }).confidence ?? null,
        })),
      };
    });

    /* The timeline records what the DOCUMENTS did and what the SYSTEM
     * decided. Entity resolution is the least visible thing this system
     * does and the easiest to get silently wrong (SVRC View 2.5); this is
     * the only place a person watches it happen. */
    const timeline = [
      ...sightings.map((g) => ({
        kind: "sighting" as const,
        at: g.seen_at,
        source_name: g.source_name,
        detail: `Seen in ${g.source_name}`,
      })),
      ...(row.org_name
        ? [{
            kind: "resolution" as const,
            at: row.created_at as string,
            source_name: null,
            detail: `Buyer resolved to ${row.org_name}`,
          }]
        : []),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const [decision] = await latestPursuitFor([id]);

    res.json({ ...row, sightings, documents, fields, timeline, decision: decision ?? null });
  }),
);
