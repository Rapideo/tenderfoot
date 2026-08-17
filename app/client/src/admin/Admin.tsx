import { useCallback, useEffect, useState } from "react";
import type { FirmProfile, LegalPosture, SourceRow } from "@tenderfoot/shared";
import { StatusDot, type StatusDotState } from "../primitives/StatusDot";
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
 * ⚠️ NO AUTHENTICATION. Neither this screen nor the endpoints behind it
 * check anything -- `PATCH /api/sources/:id` was already open before this
 * screen existed, so the UI adds no exposure it did not have, but it does
 * make the exposure reachable by clicking. Production is gated only by
 * Vercel Deployment Protection (it answers 302 publicly). "Auth in V1" is an
 * open question on Matt's list and this screen is now a reason to answer it.
 */

/* The bundle's four states. `unknown` -- the schema default, and the value
 * every production row actually carries -- is deliberately ABSENT: it falls
 * through to the grey dot below and keeps its own word.
 *
 * Collapsing it into "Not ingested" would be a lie with a live counterexample:
 * SAM.gov has been ingested twice and still reads `unknown`, because nothing
 * writes this column yet. "Nobody measured" and "measured, nothing there" are
 * different facts, and a registry that blurs them is telling the operator a
 * source is dead when it is merely unobserved. See app/shared. */
const HEALTH_TO_DOT: Record<string, StatusDotState> = {
  Healthy: "ok",
  "Rot suspected": "rot",
  Failing: "failing",
  "Not ingested": "off",
};

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
          <div className="admin-source" key={s.id}>
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
                onChange={(e) => changePosture(s, e.target.value as LegalPosture)}
              >
                {POSTURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <span className="admin-source__health">
                {/* D6. StatusDot hard-codes an accessible name per state, and
                    `off` speaks "Not ingested" -- so routing `unknown`
                    through it would put the same falsehood in the
                    accessibility layer that the visible label avoids. An
                    unmeasured source therefore gets a decorative grey dot
                    (aria-hidden) and lets the adjacent word carry the
                    meaning, rather than a fifth StatusDot state invented
                    from one consumer. */}
                {HEALTH_TO_DOT[s.health] ? (
                  <StatusDot state={HEALTH_TO_DOT[s.health]!} />
                ) : (
                  <span className="admin-dot-unmeasured" aria-hidden="true" />
                )}
                {s.health}
              </span>
              <label className="admin-toggle">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  disabled={busy[s.id]}
                  aria-label={`Enable ${s.name}`}
                  onChange={(e) => patchSource(s.id, { enabled: e.target.checked })}
                />
                <span>{s.enabled ? "on" : "off"}</span>
              </label>
            </div>
            {errors[s.id] ? (
              <p className="admin-error" role="alert">
                {errors[s.id]}
              </p>
            ) : null}
          </div>
        ))}
      </section>
    </main>
  );
}
