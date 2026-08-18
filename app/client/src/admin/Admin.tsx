import { useCallback, useEffect, useState } from "react";
import type { FirmProfile, LegalPosture, SourceRow as SourceRowBase } from "@tenderfoot/shared";
import { StatusDot, type StatusDotState } from "../primitives/StatusDot";
import { adminHeaders, clearAdminSecret, getAdminSecret } from "./adminSecret";
import "./Admin.css";

/* SP3.6 T11. app/shared's SourceRow predates migration 006 -- it has no
 * health_checked_at/health_method/health_note, because no earlier task in
 * this slice's plan touches app/shared/src/index.ts (see
 * docs/superpowers/plans/2026-08-18-sp3.6-source-health.md's per-task File
 * Structure table) and this task's own Files: list names only
 * Admin.tsx/Admin.css/Admin.test.tsx. Extended locally rather than editing a
 * package another task owns. `probe_url` is left off -- nothing here reads
 * it. */
type SourceRow = SourceRowBase & {
  health_checked_at: string | null;
  health_method: string | null;
  health_note: string | null;
};

/* View 6.1 + View 6.2 -- Firm Profile and Source Registry.
 *
 * THE FIRST COMPOSED SCREEN. Everything before this was a primitive on
 * /dev/gallery; this is the first place they sit together carrying real data.
 *
 * Matched against the frozen V1.2 bundle's ADMIN section rather than
 * designed -- the SVRC scores View 6.2 one of only two `Pri 5` nodes and
 * calls it "V1's entire control surface: switching a source on or off is the
 * only lever there is."
 *
 * ⚠️ THE BUNDLE IS READ-ONLY AND THIS SCREEN IS NOT. V1.2 renders both
 * cards as display surfaces: no toggle, no select, no input, no scrape
 * trigger anywhere in 700KB. But T14/T15 require both editable and the SVRC
 * says the lever is the reason the screen exists, so a strict-fidelity build
 * would ship a control surface with no controls. Ruled 2026-08-16: build the
 * fidelity, add the smallest controls that satisfy the requirement, and
 * record every invented affordance as a numbered deviation instead of
 * smuggling it in. They are D1-D5 in `docs/admin-deviations.md`.
 *
 * ⚠️ NO AUTHENTICATION. Neither this screen nor the endpoints behind it
 * check anything -- `PATCH /api/sources/:id` was already open before this
 * screen existed, so the UI adds no exposure it did not have, but it does
 * make the exposure reachable by clicking. Production is gated only by
 * Vercel Deployment Protection (it answers 302 publicly). "Auth in V1" is an
 * open question on Matt's list and this screen is now a reason to answer it.
 */

/* ⚠️ DEFECT FIXED HERE (SP3.6 T11). This map's keys used to be the bundle's
 * DISPLAY strings ("Healthy", "Rot suspected", ...), but `s.health` is
 * always the DATABASE enum -- `/api/sources` does `SELECT *`, so the row
 * carries whatever migration 006's CHECK constraint allows:
 * ok|failing|rot|excluded|unknown. `HEALTH_TO_DOT[s.health]` was therefore
 * `undefined` for every row, always, and every source silently rendered the
 * decorative grey dot regardless of its real health -- masked in production
 * only because every row happened to read `unknown`, which legitimately
 * gets that dot too. The moment a probe wrote `ok`/`failing`/`rot`, the
 * column would have kept showing the decorative dot beside the real word,
 * defeating "colour is never the only signal" for exactly the rows where it
 * would have mattered most. Fixed by keying on the enum the column can
 * actually hold.
 *
 * `excluded` and `unknown` are deliberately ABSENT: both fall through to the
 * decorative grey dot below and keep their own word. `off` is retired from
 * this map entirely (design spec §12, H1) -- StatusDot's `off` state hard-
 * codes the accessible name "Not ingested", an ingestion fact that has no
 * meaning under "health = is it up" (a disabled source can be perfectly
 * reachable; that fact lives in ENABLED and last_run_at instead). `excluded`
 * inherits `ea798e9`'s reasoning for `unknown`: nothing measured either
 * value, so routing them through StatusDot would put "Not ingested" into
 * the accessibility tree while the visible word avoided the same lie.
 * StatusDot itself keeps all four states (`StatusDot.tsx`) -- this is only
 * about which values the HEALTH column maps. */
const HEALTH_TO_DOT: Record<string, StatusDotState> = {
  ok: "ok",
  failing: "failing",
  rot: "rot",
};

/* A row may be Checked exactly when the server's own eligibility rule
 * (health/eligibility.ts) would actually probe it -- mirrored here so a
 * click never reaches the server just to be silently ignored, which would
 * look like a broken button rather than an absent one. All three of
 * eligibility.ts's conditions are reproduced, including the null-platform
 * refusal (its own comment: "an unknown platform is not evidence that
 * contact is permitted") -- `platform !== "Manual import"` alone lets
 * `null` through, since `null !== "Manual import"` is true, which would
 * show a Check button for a row `checkSources` silently drops (200,
 * `{ checked: [] }`) -- the exact broken-looking button this function
 * exists to prevent. */
function isProbeable(s: SourceRow): boolean {
  return s.legal_posture === "in" && s.platform !== null && s.platform !== "Manual import";
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];
const RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/* A verdict with no timestamp is the stale-green trap (design spec §3):
 * health is only measured when an operator asks, so a value can be
 * arbitrarily old and a green dot from three weeks ago would read as
 * current. This turns `health_checked_at` into words a human can judge at a
 * glance instead of an ISO string they have to do arithmetic on. */
function checkedLabel(iso: string): string {
  const deltaSec = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(deltaSec) >= secondsInUnit) {
      return `checked ${RELATIVE_TIME.format(Math.round(deltaSec / secondsInUnit), unit)}`;
    }
  }
  return `checked ${RELATIVE_TIME.format(Math.round(deltaSec), "second")}`;
}

/* D2. The bundle's LEGAL column reads "ToS OK" / "Rate-limited" /
 * "EXCLUDED"; the schema stores 'in' / 'manual-only' / 'out'. Those are
 * different axes -- a rate-limited source can still be `in` -- so the
 * display strings are NOT rendered. The posture is, because T15 makes this
 * editable and an editor must write the real enum. See the T13 note in
 * app/shared. Colour follows the bundle's three-tone treatment. */
const POSTURE_TONE: Record<LegalPosture, string> = {
  in: "ok",
  "manual-only": "warn",
  out: "bad",
};

const POSTURES: LegalPosture[] = ["in", "manual-only", "out"];

/* SP3.6 T12. Only these two platforms have a working adapter
 * (scrape/adapters/registry.ts's `ADAPTERS` map) -- everything else would
 * hit POST /run's own 400 ("No adapter named ..."). This is NOT the
 * name->key map registry.ts's header forbids: that ban is about resolving
 * an identity (a request would silently target the wrong row if it drifted
 * from the server's map); this is only which platforms get the Run button
 * enabled versus disabled-with-a-reason. If this set drifts stale, the
 * worst case is a wrong disabled/enabled hint -- the server remains the
 * only place identity is resolved (task-12 ruling, POST /run below), and it
 * still refuses with the same 400 either way. */
const ADAPTER_PLATFORMS = new Set(["SAM", "USASpending"]);

/* The five profile fields the bundle renders, in its order, with its exact
 * labels -- including the capitalised guard on the fourth, which is a rule
 * and not a caption: these facts answer "can KP legally bid this", never
 * "should KP take this on". */
const PROFILE_FIELDS: { key: keyof FirmProfile; label: string }[] = [
  { key: "capabilities", label: "SERVICE LINES" },
  { key: "certifications", label: "CERTIFICATIONS" },
  { key: "geography", label: "GEOGRAPHY" },
  { key: "hard_limits", label: "ELIGIBILITY FACTS — GATE INPUTS ONLY" },
  { key: "past_performance", label: "PAST PERFORMANCE LIBRARY" },
];

function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : JSON.stringify(v);
}

/* SP3.6 T12. Extracted once the per-row block picked up a FOURTH conditional
 * piece -- name / platform / tier / legal-select / health (itself three:
 * the dot, H3's timestamp, Check) / enabled, and now Run. Task 11's own
 * review named exactly this trigger ("extract when your Run control adds a
 * fourth conditional piece"), and it now has.
 *
 * A STRAIGHT MOVE, no behaviour change: every line of JSX below is what
 * `sources.map((s) => ...)` rendered inline before this task, unmoved
 * except that its closures over `s`, `busy[s.id]` and `errors[s.id]` became
 * props -- `Admin()` still owns all the state and every handler; this
 * component owns only how one row's data is laid out. */
function SourceRegistryRow({
  s,
  busy,
  error,
  onChangePosture,
  onPatch,
  onCheckHealth,
  onRunSource,
}: {
  s: SourceRow;
  busy: boolean;
  error: string | undefined;
  onChangePosture: (s: SourceRow, next: LegalPosture) => void;
  onPatch: (id: number, body: Record<string, unknown>) => void;
  onCheckHealth: (s: SourceRow) => void;
  onRunSource: (s: SourceRow) => void;
}) {
  return (
    <div className="admin-source">
      <div className="admin-row" role="row" data-source={s.name}>
        <div className="admin-source__name">
          <div>{s.name}</div>
          <div className="admin-source__archive">{s.archive_depth ?? "archive: —"}</div>
        </div>
        <span className="admin-source__platform">{s.platform ?? "—"}</span>
        <span className="admin-source__tier">{s.adapter_tier ?? "—"}</span>
        <select
          className={`admin-pill admin-pill--${POSTURE_TONE[s.legal_posture]}`}
          value={s.legal_posture}
          aria-label={`Legal posture for ${s.name}`}
          onChange={(e) => onChangePosture(s, e.target.value as LegalPosture)}
        >
          {POSTURES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="admin-source__health">
          <span className="admin-source__health-state">
            {/* D6/H1/H2. StatusDot hard-codes an accessible name per
                state, and `off` speaks "Not ingested" -- so routing
                `excluded` or `unknown` through it would put that
                falsehood in the accessibility layer that the visible
                label avoids. Both get a decorative grey dot
                (aria-hidden) and let the adjacent word carry the
                meaning, rather than a fifth StatusDot state invented
                from one consumer. */}
            {HEALTH_TO_DOT[s.health] ? (
              <StatusDot state={HEALTH_TO_DOT[s.health]!} />
            ) : (
              <span className="admin-dot-unmeasured" aria-hidden="true" />
            )}
            {s.health}
          </span>
          {/* H3. Non-null only -- an unmeasured row shows no timestamp
              at all rather than a misleading "never" or a blank. */}
          {s.health_checked_at !== null ? (
            <span className="admin-source__checked">{checkedLabel(s.health_checked_at)}</span>
          ) : null}
          {isProbeable(s) ? (
            <button
              type="button"
              className="admin-check-btn"
              disabled={busy}
              aria-label={`Check ${s.name}`}
              onClick={() => onCheckHealth(s)}
            >
              Check
            </button>
          ) : null}
        </span>
        {/* T12/D5. Stacked the same way HEALTH became a column in
            T11 -- this cell can now carry the toggle AND, on an
            `in`-posture row, the Run control, and neither is the
            bundle's own grid, so stacking is the smallest change
            that fits without touching the row's shared
            grid-template-columns. */}
        <span className="admin-source__enabled">
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={s.enabled}
              disabled={busy}
              aria-label={`Enable ${s.name}`}
              onChange={(e) => onPatch(s.id, { enabled: e.target.checked })}
            />
            <span>{s.enabled ? "on" : "off"}</span>
          </label>
          {/* Rendered only for legal_posture 'in' -- the four
              excluded/manual-only sources never offer Run at all,
              matching D2's own posture: a source this project has
              no permission to contact gets no button, not a disabled
              one. Disabled WITH A REASON when the platform has no
              adapter, though -- never hidden. An absent control is a
              mystery; a disabled one is an explanation. */}
          {s.legal_posture === "in" ? (
            <button
              type="button"
              className="admin-run-btn"
              disabled={busy || !ADAPTER_PLATFORMS.has(s.platform ?? "")}
              title={
                ADAPTER_PLATFORMS.has(s.platform ?? "")
                  ? undefined
                  : "No adapter for this platform yet"
              }
              aria-label={`Run ${s.name}`}
              onClick={() => onRunSource(s)}
            >
              Run
            </button>
          ) : null}
        </span>
      </div>
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Admin() {
  const [sources, setSources] = useState<SourceRow[] | null>(null);
  const [profile, setProfile] = useState<FirmProfile | null>(null);
  /* One error slot per source row. A 400 from the fail-closed guards is the
   * most useful thing this screen can show -- swallowing it would turn a
   * deliberate refusal into a control that silently does nothing. */
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([
      fetch("/api/sources").then((r) => r.json()),
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)),
    ]);
    setSources(s);
    setProfile(p);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchSource(id: number, body: Record<string, unknown>) {
    setBusy((b) => ({ ...b, [id]: true }));
    setErrors((e) => ({ ...e, [id]: "" }));
    const r = await fetch(`/api/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    setBusy((b) => ({ ...b, [id]: false }));
    if (!r.ok) {
      setErrors((e) => ({ ...e, [id]: data.error ?? `Request failed (${r.status})` }));
      return false;
    }
    await load();
    return true;
  }

  /* D2 continued. A posture change REQUIRES a note recording the evidence
   * for THIS change -- the server rejects it otherwise, and rightly: the
   * existing note documents the previous posture, so reusing it leaves a row
   * that looks documented and is not. The prompt is the smallest thing that
   * satisfies the rule; a designed screen would do better. */
  async function changePosture(s: SourceRow, next: LegalPosture) {
    if (next === s.legal_posture) return;
    const note = window.prompt(
      `Moving "${s.name}" from ${s.legal_posture} to ${next}.\n\n` +
        `Record the evidence for THIS change (required — the existing note documents the previous posture):`,
    );
    if (note === null) return;
    await patchSource(s.id, { legal_posture: next, legal_note: note });
  }

  /* Task 10's secret handling, reused rather than re-invented: prompt once,
   * hold in sessionStorage, clear on a 401 so a wrong secret does not
   * silently break every later click. `busy` is shared with the ENABLED
   * toggle's own use of it -- one row does not want two controls firing at
   * once. */
  async function checkHealth(s: SourceRow) {
    const secret = getAdminSecret();
    if (!secret) return;
    setBusy((b) => ({ ...b, [s.id]: true }));
    const r = await fetch(`/api/admin/health?source=${encodeURIComponent(s.name)}`, {
      method: "POST",
      headers: adminHeaders(secret),
    });
    if (r.status === 401) clearAdminSecret();
    setBusy((b) => ({ ...b, [s.id]: false }));
    await load();
  }

  /* D5, finally housed. Same shape as checkHealth above -- prompt-once
   * secret, shared busy flag, clear-on-401, reload on completion so
   * last_run_at and the counts move. `?source=` carries `s.name` (the
   * canonical row, "SAM.gov"), never the CLI's short key: the task-12
   * ruling puts that resolution on the server (routes/admin.ts's
   * `resolveAdapterKey`), specifically so this client never needs a
   * name->key map of its own (registry.ts's own header: "two registries
   * drift"). */
  async function runSource(s: SourceRow) {
    const secret = getAdminSecret();
    if (!secret) return;
    setBusy((b) => ({ ...b, [s.id]: true }));
    const r = await fetch(
      `/api/admin/run?source=${encodeURIComponent(s.name)}&since=${encodeURIComponent(s.since_default ?? "")}`,
      { method: "POST", headers: adminHeaders(secret) },
    );
    if (r.status === 401) clearAdminSecret();
    setBusy((b) => ({ ...b, [s.id]: false }));
    await load();
  }

  if (!sources) return <main className="admin">Loading…</main>;

  return (
    <main className="admin">
      <section className="admin-card" aria-labelledby="profile-h">
        <header className="admin-card__head">
          <h2 id="profile-h">Firm Profile</h2>
          <p>No fact about the firm appears in code. A second customer is a second row, not a fork.</p>
        </header>
        <div className="admin-profile">
          {profile ? (
            PROFILE_FIELDS.map(({ key, label }) => {
              const value = asText(profile[key]);
              /* The bundle greys the empty PAST PERFORMANCE field and
               * captions why. That treatment is data-driven here rather
               * than hard-coded to one field: any empty field reads the
               * same way. */
              return (
                <label className="admin-field" key={String(key)}>
                  <span className="admin-field__label">{label}</span>
                  {/* D3. The bundle renders a display box; T14 requires an
                      editable form, so the box became a textarea keeping the
                      bundle's border, radius, padding and type. */}
                  <textarea
                    className={`admin-field__input${value ? "" : " admin-field__input--empty"}`}
                    defaultValue={value}
                    rows={2}
                    onBlur={async (e) => {
                      if (e.target.value === value) return;
                      await fetch("/api/profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ [key]: e.target.value }),
                      });
                      await load();
                    }}
                  />
                </label>
              );
            })
          ) : (
            <p className="admin-empty">No firm profile. Run migrations.</p>
          )}
        </div>
      </section>

      <section className="admin-card" aria-labelledby="registry-h">
        <header className="admin-card__head">
          <h2 id="registry-h">Source Registry</h2>
          <p>Sources are rows, not code. Adding one is a row and a config.</p>
        </header>

        <div className="admin-row admin-row--head" role="row">
          <span>SOURCE</span>
          <span>PLATFORM</span>
          <span>TIER</span>
          <span>LEGAL</span>
          <span>HEALTH</span>
          {/* D1. No column for this exists in the bundle. */}
          <span>ENABLED</span>
        </div>

        {sources.map((s) => (
          <SourceRegistryRow
            key={s.id}
            s={s}
            busy={!!busy[s.id]}
            error={errors[s.id]}
            onChangePosture={changePosture}
            onPatch={patchSource}
            onCheckHealth={checkHealth}
            onRunSource={runSource}
          />
        ))}
      </section>
    </main>
  );
}
