import { useCallback, useEffect, useState } from "react";
import type { FirmProfile, LegalPosture, SourceRow } from "@tenderfoot/shared";
import { StatusDot, type StatusDotState } from "../primitives/StatusDot";
import { adminHeaders, clearAdminSecret, getAdminSecret } from "./adminSecret";
import "./Admin.css";

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
 * ⚠️ STILL NO AUTHENTICATION -- but every WRITE is now gated (2026-08-18).
 * This block used to read "neither this screen nor the endpoints behind it
 * check anything", and that was true: `PATCH /api/sources/:id` and
 * `PATCH /api/profile` were open while `/api/admin/*` was not. The
 * asymmetry was the wrong way round, because the ungated toggle is what
 * decides whether a source may be scraped at all -- `resolveSource` refuses
 * a disabled source, so the fail-closed posture the ingestion path leans on
 * was itself switchable by anyone who could reach the API. Both writes now
 * sit behind `requireAdminSecret` (`lib/adminSecret.ts`); READS stay open,
 * so this screen still loads without demanding anything.
 *
 * That is consistency, NOT authentication. Design spec §7 calls the secret
 * "a shared bearer secret typed into a browser tab" -- one string every
 * operator shares, with no identity, no sessions, no revocation and no
 * audit. Production is still additionally gated by Vercel Deployment
 * Protection (it answers 302 publicly). **"Auth in V1" remains open on
 * Matt's list**, and this screen is still the reason to answer it.
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
          {/* REVIEW FIX (Minor, final review finding 3). Gated on
              `s.legal_posture === "in"` alone until this fix -- looser
              than isProbeable, which also excludes `platform ===
              "Manual import"`. The two corpus rows carry legal_posture
              'in' but are fixed snapshots with no endpoint, so Run used
              to render disabled reading "No adapter for this platform
              yet": technically true, but "yet" implies one is coming,
              and a snapshot never gets one. Gated on isProbeable(s)
              instead -- the same predicate Check already uses -- so a
              Manual-import row offers no Run control at all, matching
              Check exactly rather than growing a second disabled-reason
              branch that says the same thing a different way. Every
              other 'in'-posture row (a real feed, adapter or not) is
              unaffected: isProbeable and legal_posture === 'in' agree on
              all of them. The excluded/manual-only sources still never
              offer Run at all, matching D2's own posture: a source this
              project has no permission to contact gets no button, not a
              disabled one. Disabled WITH A REASON when a probeable
              platform has no adapter, though -- never hidden. An absent
              control is a mystery; a disabled one is an explanation. */}
          {isProbeable(s) ? (
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
  /* The profile card had no error slot at all -- it was the one write on
   * this screen that could fail with nothing shown. */
  const [profileError, setProfileError] = useState("");

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

  /* GATED 2026-08-18. This route used to need no secret at all, which made
   * the Enable toggle the one control that could switch a source on without
   * proving anything -- and `resolveSource` refuses a disabled source, so
   * that toggle IS the lock the whole ingestion path leans on. Same
   * prompt-once / clear-on-401 handling as checkHealth and runSource; the
   * secret is spread AFTER Content-Type so neither header is lost. */
  async function patchSource(id: number, body: Record<string, unknown>) {
    const secret = getAdminSecret();
    if (!secret) return false;
    setBusy((b) => ({ ...b, [id]: true }));
    setErrors((e) => ({ ...e, [id]: "" }));
    const r = await fetch(`/api/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...adminHeaders(secret) },
      body: JSON.stringify(body),
    });
    if (r.status === 401) clearAdminSecret();
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
    setErrors((e) => ({ ...e, [s.id]: "" }));
    /* 2026-08-27: `fetch` REJECTS -- a dropped connection, a request killed
     * at Vercel’s function ceiling, an offline client -- and there was no
     * `try` in this file, so the rejection escaped the handler and skipped
     * the `setBusy(..., false)` below. The operator got no message AND a row
     * frozen busy, since every control in it is `disabled={busy}`. A
     * permanently disabled control with no explanation is the same
     * broken-looking button `isProbeable`’s comment exists to prevent,
     * reached from the other side.
     *
     * The message is the browser’s own and is never composed here: this
     * screen cannot diagnose why a request died, and inventing wording for it
     * would be the same second-registry mistake the `since` and source-name
     * rulings above both refuse.
     *
     * Found in production on Run; fixed on both handlers, because the two
     * fail the same way. Recorded as D7 in docs/admin-deviations.md. */
    let r: Response;
    try {
      r = await fetch(`/api/admin/health?source=${encodeURIComponent(s.name)}`, {
        method: "POST",
        headers: adminHeaders(secret),
      });
    } catch (err) {
      setBusy((b) => ({ ...b, [s.id]: false }));
      setErrors((e) => ({ ...e, [s.id]: `Request failed — ${(err as Error).message}` }));
      return;
    }
    if (r.status === 401) clearAdminSecret();
    const data = await r.json().catch(() => ({}));
    setBusy((b) => ({ ...b, [s.id]: false }));
    /* REVIEW FIX (Important, final review finding 1). This used to ignore
     * the response body entirely, contradicting the file's own rule two
     * screens up ("a 400 from the fail-closed guards is the most useful
     * thing this screen can show -- swallowing it would turn a deliberate
     * refusal into a control that silently does nothing"). patchSource
     * already honoured that rule; Check and Run did not. Mirrored here:
     * read the body, surface data.error on !r.ok, and let a fixed problem
     * clear itself the same way patchSource's own leading setErrors(...,
     * "") does on the next click. */
    if (!r.ok) {
      setErrors((e) => ({ ...e, [s.id]: data.error ?? `Request failed (${r.status})` }));
      return;
    }
    /* A 200 does NOT mean this source was probed (2026-08-18). `isProbeable`
     * above mirrors the server's eligibility rule -- may we contact it --
     * but the server applies a second filter after that one: a platform with
     * no probe of its own and a row with no probe_url has nothing to
     * measure, so `checkSources` skips it deliberately rather than writing a
     * false 'failing'. Kentucky eMARS VSS and Michigan SIGMA VSS are both in
     * that state today. Before this, such a click answered `{checked: []}`
     * and the screen did nothing whatsoever -- identical, to the operator, to
     * a broken button.
     *
     * The REASON comes from the server and is never composed here: it lives
     * in the probe registry, which is deliberately not the adapter registry
     * ("a probe can exist for a platform long before an adapter does"), so
     * any rule written on this side would be a second registry that drifts
     * out of agreement with the first. */
    const skip = (data.skipped as { name: string; reason: string }[] | undefined)?.find(
      (x) => x.name === s.name,
    );
    if (skip) {
      setErrors((e) => ({ ...e, [s.id]: `Not checked — ${skip.reason}` }));
      return;
    }
    await load();
  }

  /* SP4's two batch controls. SCREEN-level, not row-level, so they carry
   * their own busy flag rather than joining the `busy`/`errors` maps keyed by
   * source id -- discover and extract walk the document queue, which belongs
   * to no single row.
   *
   * That distinction is not cosmetic. The task brief spelled these buttons
   * `disabled={busy}`, and `busy` here is a Record<number, boolean>: an
   * object, always truthy, so both controls would have shipped PERMANENTLY
   * DISABLED. A disabled control with no explanation is the same
   * broken-looking button D7 exists to prevent, reached from a third side,
   * and it is the kind of thing only a browser or a test that asserts
   * `.disabled` ever notices.
   *
   * Same shape as checkHealth and runSource otherwise, D7's rejection guard
   * included: a `fetch` that REJECTS must clear busy and report, or the
   * control freezes with nothing said. */
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [batchResult, setBatchResult] = useState("");

  async function callBatch(label: string, path: string) {
    const secret = getAdminSecret();
    if (!secret) return;
    setBatchBusy(true);
    setBatchError("");
    setBatchResult("");
    let r: Response;
    try {
      r = await fetch(path, { method: "POST", headers: adminHeaders(secret) });
    } catch (err) {
      setBatchBusy(false);
      setBatchError(`Request failed — ${(err as Error).message}`);
      return;
    }
    if (r.status === 401) clearAdminSecret();
    const data = await r.json().catch(() => ({}));
    setBatchBusy(false);
    if (!r.ok) {
      /* Same rule the rest of this screen follows: a 400 from a fail-closed
       * guard is the most useful thing this screen can show, and swallowing
       * it turns a deliberate refusal into a control that silently does
       * nothing. */
      setBatchError(data.error ?? `Request failed (${r.status})`);
      return;
    }
    /* THE TWO ENDPOINTS COUNT DIFFERENT THINGS, and the readout says which
     * rather than flattening them. Extract returns `processed` and
     * `remaining` (documents it read, documents still queued); discover
     * returns `documents`, `solicitations` and `skipped` (rows it created,
     * notices it asked about, notices it could not ask about). Rendering a
     * zero where a key was never sent would be a number the operator has no
     * way to distinguish from a real zero.
     *
     * `skipped` IS NOT OPTIONAL HERE, and the 2026-08-30 click-through is
     * why: a real run reported "0 document(s) from 10 solicitation(s)" and
     * nothing on the screen could say whether those ten notices genuinely
     * carry no attachments or whether all ten requests failed. discover.ts
     * added that counter for precisely this distinction -- skipped: 0 means
     * nothing to fetch, skipped === solicitations means every request failed
     * -- and leaving it off the only surface that shows it defeats the fix. */
    setBatchResult(
      data.remaining === undefined
        ? `${label}: ${data.documents ?? 0} document(s) from ${data.solicitations ?? 0} solicitation(s), ` +
            `${data.skipped ?? 0} skipped`
        : `${label}: processed ${data.processed ?? 0}, ${data.failed ?? 0} failed, ${data.remaining} remaining`,
    );
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
    setErrors((e) => ({ ...e, [s.id]: "" }));
    /* ⚠️ NO `since` PARAMETER, and that is the fix, not an omission
     * (2026-08-18). This used to append
     * `&since=${s.since_default}` -- but `since_default` is an ISO-8601
     * DURATION ('P7D') and the route's `validateRun` requires an ISO-8601
     * DATE, so every click of Run, on every source, answered
     *   400 since must be an ISO-8601 date (YYYY-MM-DD[T...]), got: P7D
     * and `last_run_at` never moved. Found by clicking the button; no test
     * could have found it, because this file's own test stubbed fetch to
     * answer `{ok: true}` to any POST and then asserted the defective URL
     * as the expected one.
     *
     * The window is now derived on the SERVER from the row it is about to
     * stamp (scrape/window.ts), following 003_seed_source_registry.sql's
     * stated rule -- `since = last successful run`, with `since_default` as
     * the seed for a source that has never run. That belongs there and not
     * here for the same reason source resolution does (the task-12 ruling,
     * routes/admin.ts): the client must not carry a second copy of registry
     * knowledge, because two copies drift. */
    /* Same rejection guard as checkHealth above -- see its note for why an
     * escaped rejection freezes the row and why the message is the browser’s
     * own. This is the handler the defect was actually found on. */
    let r: Response;
    try {
      r = await fetch(`/api/admin/run?source=${encodeURIComponent(s.name)}`, {
        method: "POST",
        headers: adminHeaders(secret),
      });
    } catch (err) {
      setBusy((b) => ({ ...b, [s.id]: false }));
      setErrors((e) => ({ ...e, [s.id]: `Request failed — ${(err as Error).message}` }));
      return;
    }
    if (r.status === 401) clearAdminSecret();
    const data = await r.json().catch(() => ({}));
    setBusy((b) => ({ ...b, [s.id]: false }));
    /* REVIEW FIX (Important, final review finding 1). Same swallow as
     * checkHealth above, and reachable today: USASpending has an adapter
     * and legal_posture 'in', so its Run button renders enabled -- but it
     * is seeded `enabled: false` (migration 003), so a click hits
     * resolveSource()'s disabled-source refusal, a 400 with a clear
     * message the operator used to never see. Same fix as checkHealth. */
    if (!r.ok) {
      setErrors((e) => ({ ...e, [s.id]: data.error ?? `Request failed (${r.status})` }));
      return;
    }
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
        {profileError ? (
          <p className="admin-error" role="alert">
            {profileError}
          </p>
        ) : null}
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
                    /* GATED 2026-08-18, same as the source PATCH above.
                       Silence on failure would be worse here than anywhere
                       else on the screen: a textarea that blurs and quietly
                       discards the edit looks exactly like one that saved. */
                    onBlur={async (e) => {
                      if (e.target.value === value) return;
                      const secret = getAdminSecret();
                      if (!secret) return;
                      const r = await fetch("/api/profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", ...adminHeaders(secret) },
                        body: JSON.stringify({ [key]: e.target.value }),
                      });
                      if (r.status === 401) clearAdminSecret();
                      setProfileError(
                        r.ok ? "" : ((await r.json().catch(() => ({}))).error ?? `Save failed (${r.status})`),
                      );
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

        {/* D10. The design bundle has no control group for these -- it
            predates SP4 -- so they sit at the foot of the registry card
            rather than in a new region invented for them, and reuse the
            row controls' own button classes. Placed AFTER the rows because
            that is the order of the work: a source is run, which produces
            solicitations; discover asks what is attached to them; extract
            reads what discover found. */}
        <div className="admin-batch-controls">
          <button
            type="button"
            className="admin-check-btn"
            disabled={batchBusy}
            aria-label="Discover attachments"
            onClick={() => callBatch("Discover", "/api/admin/discover?limit=10")}
          >
            Discover
          </button>
          <button
            type="button"
            className="admin-run-btn"
            disabled={batchBusy}
            aria-label="Extract documents"
            onClick={() => callBatch("Extract", "/api/admin/extract?limit=10")}
          >
            Extract
          </button>
          {batchResult ? <p className="admin-batch">{batchResult}</p> : null}
          {batchError ? (
            <p className="admin-error" role="alert">
              {batchError}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
