import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../shell/Shell";
import {
  Button, Callout, Card, Chip, FactPanel, Keycap, MicroLabel, ShortcutCard,
} from "../primitives";
import { adminHeaders, clearAdminSecret, getAdminSecret } from "../admin/adminSecret";
import { getDecidedBy } from "./decidedBy";
import { useQueueKeys } from "./useQueueKeys";
import "./Queue.css";

interface DeadlineConflict {
  value_text: string;
  origin: string;
  quote: string | null;
}
interface QueueItem {
  id: number;
  title: string;
  org_name: string | null;
  jurisdiction: string | null;
  closes_at: string | null;
  posted_at: string | null;
  value_cents: number | null;
  kind: string | null;
  set_aside: string | null;
  source_name: string | null;
  documents: number;
  sightings: number;
  deadline_conflict: DeadlineConflict[];
  /* SAMPLE MODE ONLY, spec §10: a drawn item whose deadline passed mid-
   * session stays in the sample and reaches the queue, marked closed,
   * rather than becoming unreachable. Always false outside sample mode. */
  closed: boolean;
}
interface SampleHeader {
  id: number;
  source_name: string;
  seed: string;
  population_size: number;
  drawn: number;
  decided: number;
  n_requested: number;
}
interface QueuePage {
  mode: "all" | "sample";
  sample: SampleHeader | null;
  total: number;
  remaining: number;
  items: QueueItem[];
}

/* The bundle colours the deadline by urgency (cur.deadlineColor) and prints a
 * human interval beneath it ("17 days out · 3:00 PM EDT"). We have the date;
 * the time-of-day half is not extracted, so the interval is what we can say
 * truthfully. */
function daysOut(closesAt: string | null): number | null {
  if (!closesAt) return null;
  const d = Date.parse(closesAt.slice(0, 10));
  if (Number.isNaN(d)) return null;
  return Math.round((d - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000);
}

function deadlineColour(closesAt: string | null): string {
  const n = daysOut(closesAt);
  if (n === null) return "var(--text7)";
  if (n < 0) return "var(--text7)";
  if (n <= 7) return "var(--bad)";
  if (n <= 21) return "var(--warntx)";
  return "var(--text)";
}

function deadlineIn(closesAt: string | null): string {
  const n = daysOut(closesAt);
  if (n === null) return "No deadline stated";
  if (n < 0) return `closed ${Math.abs(n)} days ago`;
  if (n === 0) return "closes today";
  return `${n} days out`;
}

/* value_cents is a bigint, and db/index.ts:20 parses OID 20 to Number
 * centrally -- so this arrives as a NUMBER over JSON, not a string.
 *
 * This function must never call .slice() on it -- that throws on a number.
 * Queue.test.tsx's fixture keeps value_cents a NUMBER (45000000, unquoted)
 * specifically so a regression back to string handling fails loudly here
 * instead of passing a green test over a browser crash. */
function money(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function Queue() {
  const [page, setPage] = useState<QueuePage | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastDecided, setLastDecided] = useState<number | null>(null);
  /* The bundle's decision bar is two-state: Pass opens a reason step. */
  const [askReason, setAskReason] = useState(false);
  const navigate = useNavigate();

  const sampleId = new URLSearchParams(window.location.search).get("sample");

  const load = useCallback(async () => {
    const qs = sampleId ? `?sample=${encodeURIComponent(sampleId)}` : "";
    const res = await fetch(`/api/queue${qs}`);
    if (res.ok) setPage((await res.json()) as QueuePage);
  }, [sampleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = page?.items[0] ?? null;

  const decide = useCallback(
    async (state: "Interested" | "Not Interested" | "New", forId?: number) => {
      const id = forId ?? current?.id;
      if (!id) return;
      /* Mandatory on Pass -- blocked HERE as well as on the server, so a
       * mis-tap never becomes a request. */
      if (state === "Not Interested" && !reason.trim()) {
        setError("A reason is required on Pass.");
        return;
      }
      const secret = getAdminSecret();
      if (!secret) return;
      /* Spec §5.3: "decided_by is set once per session and stored on every
       * row. Two people scoring cannot be merged into one ground truth
       * without knowing whose is whose." Same prompt-once shape as the
       * admin secret above -- see decidedBy.ts. */
      const decidedBy = getDecidedBy();
      if (!decidedBy) return;
      const res = await fetch(`/api/solicitations/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders(secret) },
        body: JSON.stringify({ state, reason: reason.trim() || null, decided_by: decidedBy }),
      });
      if (!res.ok) {
        /* adminSecret.ts's own rule: "Call on a 401 -- a wrong secret must
         * not silently break every later click." Admin.tsx already honours
         * it in five places; this screen did not, and a mistyped secret
         * bricked the whole session with no in-app recovery. */
        if (res.status === 401) clearAdminSecret();
        setError(((await res.json()) as any).error ?? "Decision failed.");
        return;
      }
      setReason("");
      setError(null);
      setAskReason(false);
      setLastDecided(id);
      await load();
    },
    [current, reason, load],
  );

  /* Pass is a two-step: the key or the button opens the reason step, and the
   * decision is only recorded on confirm. Mandatory-on-Pass is still enforced
   * here as well as on the server, so an empty reason never becomes a
   * request. */
  const confirmPass = useCallback(async () => {
    if (!reason.trim()) {
      setError("A reason is required on Pass.");
      return;
    }
    await decide("Not Interested");
    setAskReason(false);
  }, [reason, decide]);

  /* UNDO IS AN APPEND, not a delete: it decides the row back to New, and
   * both rows survive (spec §5.1). No time limit -- it is simply
   * "decide it again". */
  const undo = useCallback(async () => {
    if (lastDecided === null) return;
    await decide("New", lastDecided);
    setLastDecided(null);
  }, [lastDecided, decide]);

  useQueueKeys({
    onInterested: () => void decide("Interested"),
    onPass: () => setAskReason(true),
    onUndo: () => void undo(),
    onOpen: () => current && navigate(`/solicitation/${current.id}`),
  });

  if (!page) return <Shell reduced>Loading…</Shell>;

  if (page.items.length === 0) {
    return (
      <Shell reduced queueCount={0}>
        <div className="queue__cleared">
          <h2>Queue cleared</h2>
          {/* D14, corrected: the original three cards had no onClick at all,
            * inside a reduced Shell that hides the nav chrome -- nothing on
            * this screen did anything. "Draw another sample" is removed
            * rather than wired, because there is no draw-a-sample UI
            * anywhere in the product to send it to; a sample is drawn via
            * POST /api/triage/samples, stated here plainly instead of
            * promising a button that does not exist. The other two go
            * where the product actually has something to show. */}
          <Callout>
            A new sample is drawn via <code>POST /api/triage/samples</code>.
          </Callout>
          <ShortcutCard
            title="Metrics"
            description="Volume and Interested-per-hundred."
            onClick={() => navigate("/admin")}
          />
          <ShortcutCard
            title="Admin"
            description="Sources, health, and runs."
            onClick={() => navigate("/admin")}
          />
        </div>
      </Shell>
    );
  }

  const item = current!;
  return (
    <Shell reduced queueCount={page.remaining}>
      {/* THE PAGE FRAME. The bundle centres a 1080px column on --app with
        * padding:26px 24px 40px; without it the card spans the viewport and
        * the whole composition reads wrong. The CSS was written in the same
        * pass that rebuilt this screen and the markup never used it. */}
      <div className="queue">
       <div className="queue__inner">
      {page.mode === "sample" && page.sample && (
        <div className="queue__sample-banner">
          <MicroLabel>
            {`SAMPLE · ${page.sample.drawn} of ${page.sample.population_size.toLocaleString()} · ` +
              `${page.sample.source_name} · seed ${page.sample.seed}`}
          </MicroLabel>
        </div>
      )}

      {/* PROGRESS + ORDER + KEYBOARD LEGEND, matched to the bundle:
        *   "1 OF 5"  500 10px/1 Mono ls .14em --text5
        *   "ORDER · <value>"  400 10px/1 Mono ls .08em --text7
        *   right-aligned "I INTERESTED · P PASS · U UNDO"
        * ⚠️ ORDER is a LABEL PLUS A VALUE, not fixed copy -- §7.10 records
        * this exact trap. The label is the bundle's; the ordering is ours,
        * and V1's is deadline-first (D16), not the mock's ambiguity-first. */}
      <div className="queue__meta">
        <div className="queue__meta-left">
          <span className="queue__progress">
            {`${page.total - page.remaining + 1} OF ${page.total}`}
          </span>
          <span className="queue__order">ORDER · DEADLINE, SOONEST FIRST</span>
        </div>
        <span className="queue__legend">I INTERESTED · P PASS · U UNDO</span>
      </div>

      <Card>
        <div className="queue__head">
          <div className="queue__chips">
            {item.source_name && <span className="queue__chip-source">{item.source_name}</span>}
            {item.kind && <span className="queue__chip">{item.kind}</span>}
            {item.set_aside && <span className="queue__chip">{item.set_aside}</span>}
          </div>

          <h2 className="queue__title">{item.title}</h2>
          <div className="queue__buyer">{item.org_name ?? "Buyer unknown"}</div>

          {/* SAMPLE MODE ONLY, spec §10: the deadline passed mid-session but
            * the item stays in the sample and reachable here -- marked so a
            * reader can tell "closed, still decidable" from "still open".
            * Uses the bundle's buyerNote treatment (--warnbg/--warnbrd). */}
          {item.closed && (
            <div className="queue__note">
              The deadline has passed. Still part of the sample and still decidable.
            </div>
          )}

          {/* THE THREE-UP FACT PANEL -- the card's spine, and the largest gap
            * the 2026-08-31 fidelity audit found. The bundle's declaration:
            *   repeat(3,minmax(0,1fr)); gap:1px on --brdsoft; radius:8px
            *   cell --surface, padding 13px 15px
            *   label 500 9.5px Mono ls .14em --text7
            *   value 600 17px/1.1 Mono, deadline coloured by urgency
            *   sub   400 11px/1.4 Sans --text5
            * The SVRC calls these "the four facts that decide most items
            * without anything else being read". */}
          <div className="queue__facts">
            <div className="queue__fact">
              <div className="queue__fact-label">DEADLINE</div>
              <div className="queue__fact-value" style={{ color: deadlineColour(item.closes_at) }}>
                {item.closes_at ?? "—"}
              </div>
              <div className="queue__fact-sub">{deadlineIn(item.closes_at)}</div>
            </div>
            <div className="queue__fact">
              <div className="queue__fact-label">EST. VALUE</div>
              <div className="queue__fact-value">{money(item.value_cents)}</div>
              <div className="queue__fact-sub">
                {item.value_cents === null ? "No ceiling stated" : ""}
              </div>
            </div>
            <div className="queue__fact">
              <div className="queue__fact-label">POSTED</div>
              <div className="queue__fact-value">{item.posted_at ?? "—"}</div>
              <div className="queue__fact-sub">
                {item.sightings > 1 ? `${item.sightings} sightings` : ""}
              </div>
            </div>
          </div>

          {/* DEADLINE DISAGREEMENT, two-up, per the bundle:
            *   header ◆ … — NOT RESOLVED, 600 10px Mono ls .12em --bad
            *   panel  --badbg / --badbrd / radius 8 / padding 12px 14px
            *   cells  --surface / --badbrd2 / radius 6 / padding 9px 11px
            * This display currently carries the FSSA near-miss risk ALONE,
            * because Region 1.1.5's Gated Items Drawer is parked. It shows
            * BOTH values with their sources and resolves nothing. */}
          {item.deadline_conflict.length > 0 && (
            <div className="queue__conflict">
              <div className="queue__conflict-head">◆ DEADLINE DISAGREEMENT — NOT RESOLVED</div>
              <div className="queue__conflict-grid">
                <div className="queue__conflict-cell">
                  <div className="queue__conflict-value">{item.closes_at ?? "—"}</div>
                  <div className="queue__conflict-src">listing metadata</div>
                </div>
                {item.deadline_conflict.map((c) => (
                  <div className="queue__conflict-cell" key={`${c.origin}-${c.value_text}`}>
                    <div className="queue__conflict-value">{c.value_text}</div>
                    <div className="queue__conflict-src">
                      {c.quote ? `${c.origin} — “${c.quote}”` : c.origin}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* D15: Region 1.1.3 renders and says what it does not have.
          * Wrapped in its own band because the bundle's triage card has NO
          * outer padding -- each band supplies its own (26px 30px 22px for the
          * header, 20px 30px 24px here, 16px 30px for the decision bar). The
          * Card primitive's generic 16px 18px was leaving this panel outdented
          * by 30px against the title, the fact panel and the buttons. */}
        <div className="queue__cost">
        <FactPanel
          title="PURSUIT COST"
          note="Required forms, conference, references and notarization are not yet extracted."
        />
        </div>

        {/* THE DECISION BAR IS A MODE MACHINE, as the bundle has it: the
          * default state offers Interested and Pass; pressing Pass SWAPS the
          * bar for a reason step with a prompt, a free-text field, Back and a
          * confirm. The first cut flattened this into a permanently-visible
          * textarea beside the buttons, which is not what the bundle does.
          *
          * Reason CHIPS are correctly absent -- the SVRC ratified free text
          * only for V1, since with qualification parked no recorded reason
          * feeds anything and a preset vocabulary would flatten exactly the
          * signal it exists to capture. The two-state SHAPE is not a chip
          * decision, which is why it is built. */}
        {askReason ? (
          <div className="queue__reason">
            <div className="queue__reason-head">
              <span className="queue__reason-prompt">WHY ARE YOU PASSING?</span>
              <span className="queue__reason-help">
                Required on Pass. In six months this is the answer to “why did we pass on this”.
              </span>
            </div>
            <div className="queue__reason-row">
              <input
                aria-label="Reason"
                value={reason}
                autoFocus
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void confirmPass()}
                placeholder="…or say it in your own words"
              />
              <Button
                variant="secondary"
                ariaLabel="Back"
                onClick={() => {
                  setAskReason(false);
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button variant="primary" ariaLabel="Confirm pass" onClick={() => void confirmPass()}>
                Confirm pass
              </Button>
            </div>
            {error && <Callout>{error}</Callout>}
          </div>
        ) : (
          <div className="queue__decision">
            {/* Button's keycap prop puts the shortcut ON the control it
              * triggers. ariaLabel keeps each one targetable by automation --
              * the keycap letter otherwise joins the accessible name, and
              * SP3.6's lesson is that a control you cannot target is a
              * control nobody proves works. */}
            <Button
              variant="primary"
              keycap="I"
              ariaLabel="Interested"
              onClick={() => void decide("Interested")}
            >
              Interested
            </Button>
            <Button
              variant="secondary"
              keycap="P"
              ariaLabel="Pass"
              onClick={() => setAskReason(true)}
            >
              Pass
            </Button>
            <Button
              variant="ghost"
              keycap="↵"
              ariaLabel="Open record"
              onClick={() => navigate(`/solicitation/${item.id}`)}
            >
              Open full detail →
            </Button>
            {/* Undo has no button -- it is keyboard-only -- so it is the one
              * shortcut needing a visible hint of its own. */}
            <span className="queue__keys">
              <Keycap>U</Keycap> undo
            </span>
            {error && <Callout>{error}</Callout>}
          </div>
        )}
      </Card>
       </div>
      </div>
    </Shell>
  );
}
