import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../shell/Shell";
import {
  Button, Callout, Card, Chip, ChoiceChip, FactPanel, MicroLabel, ScoreStrip, ShortcutCard,
} from "../primitives";
import { DISCOVERY_CHANNELS, type DiscoveryChannel } from "@tenderfoot/shared";
import { adminHeaders, clearAdminSecret, getAdminSecret } from "../admin/adminSecret";
import { getDecidedBy } from "./decidedBy";
import { useQueueKeys } from "./useQueueKeys";
import "./Queue.css";

/* THE FOUR SCORE ROWS, and every value is null on purpose.
 *
 * The labels are the bundle's own -- Fit, Winnability, Value, Timing, read
 * off the rendered prototype rather than guessed (an earlier draft of this
 * work invented "Capability" and "Competition"; opening the prototype in a
 * browser is what caught it).
 *
 * `null` is not a placeholder for data that is coming in this slice. V1
 * ships NO scorer: the assessment table is empty by design (design spec
 * §1.1), and D16 records that two of the SVRC's three ratified queue
 * orderings need one before they can exist either. Nothing here may become
 * wired -- ScoreBar.tsx's own RULING 13 comment is the standing rule, and
 * these four constants must never acquire a source, a fetch or a sort.
 *
 * ⚠️ If a future reader is tempted to populate these: the honest move is a
 * scorer with its own slice and its own gate, not a number invented here. */
const SCORES: { label: string; value: number | null }[] = [
  { label: "Fit", value: null },
  { label: "Winnability", value: null },
  { label: "Value", value: null },
  { label: "Timing", value: null },
];

/* The disclosure Matt's 2026-09-01 ruling requires, and the whole reason the
 * panel is allowed back onto the card after D13 removed it. D13's objection
 * was that four bare dashes under "A READING AID" read as a RESULT -- the
 * machine scored this and found nothing. This says the opposite in words, so
 * the dashes cannot be misread as a verdict. */
const SCORES_NOTE =
  "Nothing is scored yet. These four rows show what will be judged, not a result.";

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
  /* 🔴 The stored deadline is EARLIER than the posting date, so it cannot be
   * true -- a year typo in the source (production: "posted 2026-08-25, closes
   * 2006-09-24"). 106 such rows, 62 of them biddable and recently posted, used
   * to be filed as closed and never reached this screen at all. */
  deadline_unreliable: boolean;
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

/* THE SEVEN CHANNELS AS A PERSON READS THEM.
 *
 * Typed `Record<DiscoveryChannel, string>` rather than an array of pairs so
 * that adding an eighth value to the shared vocabulary -- or to migration
 * 013's CHECK, which is the real authority -- fails TYPECHECK here instead of
 * silently rendering six chips for seven countable answers. That failure mode
 * is not hypothetical: it is exactly how `accuracyByField` came to have no
 * surface, a measure that existed and that nothing exposed.
 *
 * The labels are OURS, and D21 records that. The values are the migration's;
 * these are the reading of them, kept short because they sit in a wrapped
 * chip row under a ten-second decision. */
const CHANNEL_LABELS: Record<DiscoveryChannel, string> = {
  already_knew: "Already knew",
  indiana_email: "Indiana email",
  portal: "Portal",
  colleague: "Colleague",
  nowhere: "Nowhere",
  not_sure: "Not sure",
  other: "Other",
};

/* The decision bar's three modes, the bundle's own `askReason` state widened
 * from our boolean back to what it always was there:
 *
 *   askReason: null | "pass" | "interested"
 *
 * We shipped it as a boolean because only the Pass branch was built. The
 * bundle branches EIGHT rendered values off this one field -- prompt, help,
 * accent, chip list, confirm label and confirm style among them -- so the
 * boolean was not a simplification, it was half a state machine. */
type ReasonMode = null | "pass" | "interested";

export function Queue() {
  const [page, setPage] = useState<QueuePage | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastDecided, setLastDecided] = useState<number | null>(null);
  /* THE BUNDLE'S `last`, which we had never built. It is the human sentence
   * the toast shows -- "Interested · Nowhere" -- not the id. `lastDecided`
   * above is the id undo targets; the two are different things and the
   * bundle keeps both. */
  const [lastLabel, setLastLabel] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* The bundle's decision bar is a MODE machine, and both non-default modes
   * are now built: Pass opens the reason step, Interested opens the discovery
   * step. Until 2026-09-02 only the Pass branch existed. */
  const [askReason, setAskReason] = useState<ReasonMode>(null);
  /* SINGLE-SELECT, where the bundle's chips are multi. A decision may have
   * several reasons; it cannot have several places it first reached you, and
   * migration 013 stores one column. Selecting replaces rather than appends
   * -- see the chip row's onClick. */
  const [channel, setChannel] = useState<DiscoveryChannel | null>(null);
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

  /* A pending toast timer outliving the screen would setState on an unmounted
   * component. Cheap to get right, invisible when wrong. */
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

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
      /* Mandatory on Interested, same guard for the same reason. The server
       * answers 400 with field:"discovery_channel" if this ever gets past,
       * and that 400 is the authority -- this is the courtesy, not the rule.
       *
       * `state === "New"` is UNDO, and it deliberately falls through both
       * guards: undo decides a row back to New, which is not a qualified
       * opportunity and carries no channel (migration 013 stores NULL for
       * anything that is not Interested). */
      if (state === "Interested" && !channel) {
        setError("Where else would this have reached you? Pick one — “Not sure” counts.");
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
        body: JSON.stringify({
          state,
          reason: reason.trim() || null,
          decided_by: decidedBy,
          /* Sent only where it means something. A Pass carrying a channel
           * would enter the denominator of a rate it is not part of (§8.5
           * asks about QUALIFIED opportunities), and the server drops it on
           * any other state anyway -- but sending it would make the client
           * look like it believed otherwise. */
          discovery_channel: state === "Interested" ? channel : null,
        }),
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
      /* The bundle's commit(): a label naming what just happened, cleared
       * after 6000ms. Undo passes state "New" and clears it instead -- there
       * is nothing to undo back to, and the bundle sets `last: null` there
       * for the same reason. */
      const note = reason.trim();
      const parts =
        state === "Interested"
          ? ["Interested", channel ? CHANNEL_LABELS[channel] : null, note ? `“${note}”` : null]
          : state === "Not Interested"
            ? ["Passed", note ? `“${note}”` : null]
            : [];
      const label = parts.filter(Boolean).join(" · ");

      if (toastTimer.current) clearTimeout(toastTimer.current);
      setLastLabel(label || null);
      if (label) {
        toastTimer.current = setTimeout(() => setLastLabel(null), 6000);
      }

      setReason("");
      setChannel(null);
      setError(null);
      setAskReason(null);
      setLastDecided(id);
      await load();
    },
    [current, reason, channel, load],
  );

  /* BOTH branches are two-step now: the key or the button opens a step, and
   * the decision is only recorded on confirm. One function, as the bundle has
   * it (`confirm()` reads `this.state.askReason` rather than taking a kind),
   * because two near-identical confirm handlers is how the branches drift.
   *
   * The per-branch requirement is re-checked inside decide(); this only picks
   * the state to record. */
  const confirmReason = useCallback(async () => {
    if (askReason === "interested") await decide("Interested");
    else if (askReason === "pass") await decide("Not Interested");
  }, [askReason, decide]);

  /* Back out of either step. Clears BOTH inputs, not just the current
   * branch's: the bundle's cancelReason resets picked and freeText together,
   * and a channel left selected from an abandoned Interested would otherwise
   * still be sitting there when the next card's step opened. */
  const cancelReason = useCallback(() => {
    setAskReason(null);
    setChannel(null);
    setError(null);
  }, []);

  /* UNDO IS AN APPEND, not a delete: it decides the row back to New, and
   * both rows survive (spec §5.1). No time limit -- it is simply
   * "decide it again". */
  const undo = useCallback(async () => {
    if (lastDecided === null) return;
    await decide("New", lastDecided);
    setLastDecided(null);
    /* decide("New") already set the label to null via its empty `parts`;
     * this is belt and braces for the case where the POST is refused and
     * the toast would otherwise keep offering an undo that just failed. */
    setLastLabel(null);
  }, [lastDecided, decide]);

  useQueueKeys({
    /* `I` no longer decides -- it OPENS the step, exactly as `P` does. That
     * is a real behaviour change to the fastest path in the product, and it
     * is the price of §8.5 having any measure at all: an Interested recorded
     * without a channel is a row the gate cannot count. */
    onInterested: () => setAskReason("interested"),
    onPass: () => setAskReason("pass"),
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
              {/* AN IMPOSSIBLE DATE IS SHOWN AS UNKNOWN, NOT AS A DEADLINE.
                * These rows are in the queue precisely because a wrong date is
                * not a reason to hide an opportunity -- but rendering
                * "2006-09-24" in the deadline slot, coloured by urgency and
                * captioned "closes today", would be a worse lie than hiding it
                * was. The dash is what we actually know; the sub-line says why,
                * and still reports what the source claimed rather than
                * discarding it. */}
              {item.deadline_unreliable ? (
                <>
                  <div className="queue__fact-value">—</div>
                  <div className="queue__fact-sub">
                    Source states {item.closes_at}, before it was posted. Verify with the buyer.
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="queue__fact-value"
                    style={{ color: deadlineColour(item.closes_at) }}
                  >
                    {item.closes_at ?? "—"}
                  </div>
                  <div className="queue__fact-sub">{deadlineIn(item.closes_at)}</div>
                </>
              )}
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

        {/* THE TWO-UP BAND, per the bundle: scores left, cost right.
          *
          *   display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)
          *     left   padding:20px 30px 24px;border-right:1px solid --brdsoft
          *     right  padding:20px 30px 24px;background:--surface3
          *
          * Each band supplies its own padding because the bundle's triage card
          * has NO outer padding (26px 30px 22px for the header, 20px 30px 24px
          * here, 16px 30px for the decision bar). The Card primitive's generic
          * 16px 18px was leaving this panel outdented by 30px against the
          * title, the fact panel and the buttons.
          *
          * ⚖️ RULING 2026-09-01 -- MATT REVERSED D13. The score strip is back
          * on the card, which is what put this band into two columns; until
          * today the cost panel sat here alone at full width. D13's objection
          * is answered by the note below, not ignored: the bars render as
          * PLACEHOLDERS and say so. See docs/admin-deviations.md D13
          * (rewritten) and D17 (the note itself, which the bundle has no
          * equivalent of because all four of its scores are populated). */}
        <div className="queue__band">
          <div className="queue__scores">
            <ScoreStrip scores={SCORES} note={SCORES_NOTE} />
          </div>
          {/* D15: Region 1.1.3 renders and says what it does not have.
            *
            * ⚠️ Title corrected 2026-09-01. This read "PURSUIT COST", which is
            * a PARAPHRASE of the bundle's own copy and came from the SP6 plan
            * (plans/2026-08-30-sp6-triage-record.md:2806), not from the bundle
            * and not from any deviation. CLAUDE.md §1: "Copy is specification,
            * not placeholder... Do not paraphrase." FactPanel.tsx's own header
            * comment has quoted the correct string the whole time, which is
            * how the two drifted apart without anything failing. */}
          <div className="queue__cost">
            <FactPanel
              title="COST TO PURSUE — FACTS, NOT A SCORE"
              note="Required forms, conference, references and notarization are not yet extracted."
            />
          </div>
        </div>

        {/* THE DECISION BAR IS A MODE MACHINE, as the bundle has it: the
          * default state offers Interested and Pass, and either one SWAPS the
          * bar for a step with a prompt, help, a free-text field, Back and a
          * confirm. The first cut flattened this into a permanently-visible
          * textarea beside the buttons, which is not what the bundle does;
          * the second built the Pass branch only.
          *
          * ⚖️ THE INTERESTED BRANCH ASKS A DIFFERENT QUESTION FROM THE
          * BUNDLE'S, ON MATT'S RULING OF 2026-09-02. The bundle's is
          * "ANYTHING TO NOTE? — OPTIONAL" over four fit chips (YES_CHIPS:
          * Strong fit / Sub-teaming play / Known buyer / Watch only), and
          * confirming with nothing picked is allowed there. Ours is the
          * discovery channel: a different question, a different vocabulary,
          * and REQUIRED. Deviation D21, which also carries the vocabulary's
          * own argument against SVRC 1.1.4.
          *
          * What is NOT a deviation is the step existing, or its chrome: the
          * prompt/help/chips/input/Back/confirm frame, the "Save & next"
          * label and the accent confirm are all the bundle's own interested
          * branch, which we simply had never built.
          *
          * PASS CHIPS are still correctly absent -- SVRC 1.1.4 ratified free
          * text only for V1, since a preset reason vocabulary would flatten
          * the signal it exists to capture. The discovery chips do not
          * reopen that: a REASON is an open judgement, a CHANNEL is a closed
          * factual set, and free text cannot be counted. See migration 013. */}
        {askReason ? (
          <div className="queue__reason">
            <div className="queue__reason-head">
              <span
                className={`queue__reason-prompt queue__reason-prompt--${
                  askReason === "pass" ? "bad" : "acc"
                }`}
              >
                {askReason === "pass"
                  ? "WHY NOT? — REQUIRED"
                  : "WHERE ELSE WOULD THIS HAVE REACHED YOU? — REQUIRED"}
              </span>
              <span className="queue__reason-help">
                {askReason === "pass"
                  ? "A rejection with no reason is the one event that teaches nothing."
                  : "“Nowhere” is the discovery count — the gate’s only measure."}
              </span>
            </div>

            {/* Single-select: picking REPLACES, so there is never more than
              * one channel to send. The bundle's chips append to an array
              * because a pass may have several reasons; a first sighting
              * cannot, and migration 013 stores one column. */}
            {askReason === "interested" && (
              <div className="queue__reason-chips">
                {DISCOVERY_CHANNELS.map((c) => (
                  <ChoiceChip
                    key={c}
                    selected={channel === c}
                    onClick={() => {
                      setChannel(c);
                      setError(null);
                    }}
                  >
                    {CHANNEL_LABELS[c]}
                  </ChoiceChip>
                ))}
              </div>
            )}

            <div className="queue__reason-row">
              <input
                aria-label={askReason === "pass" ? "Reason" : "Note"}
                value={reason}
                autoFocus
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void confirmReason()}
                placeholder="…or say it in your own words (this is the training signal)"
              />
              <Button variant="secondary" size="sm" ariaLabel="Back" onClick={cancelReason}>
                Back
              </Button>
              {/* danger vs primary is the bundle's own ternary on this one
                * button: a rejection must not look like a save. */}
              <Button
                variant={askReason === "pass" ? "danger" : "primary"}
                size="sm"
                ariaLabel={askReason === "pass" ? "Confirm pass" : "Confirm interested"}
                onClick={() => void confirmReason()}
              >
                {askReason === "pass" ? "Pass & next" : "Save & next"}
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
              onClick={() => setAskReason("interested")}
            >
              Interested
            </Button>
            <Button
              variant="secondary"
              keycap="P"
              ariaLabel="Pass"
              onClick={() => setAskReason("pass")}
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
            {error && <Callout>{error}</Callout>}
          </div>
        )}
      </Card>

        {/* THE LAST-DECISION TOAST, and it is where the bundle's UNDO
          * actually lives (V1.2 ~567748):
          *
          *   <div style="display:flex;align-items:center;gap:12px;
          *        background:var(--ink);border-radius:7px;
          *        padding:9px 11px 9px 14px;animation:tfup .2s ease both">
          *     <span style="font:400 12px/1 Sans;color:var(--inktx4)">{{ lastDecision }}</span>
          *     <button on-click="{{ undo }}" style="border:none;background:var(--ink3);
          *        color:var(--inktx5);font:500 10px/1 Mono;letter-spacing:.08em;
          *        padding:6px 8px;border-radius:4px">UNDO · U</button>
          *   </div>
          *
          * ⚠️ WE HAD SHIPPED A `<span>` KEYCAP HINT IN THE DECISION BAR
          * INSTEAD, and Matt found it on 2026-09-02 by clicking it: it reads
          * as a button and is inert. The bundle has no such element. Its
          * keyboard legend is the meta line at the top -- `I INTERESTED · P
          * PASS · U UNDO`, which we already render verbatim -- so the hint
          * was both a duplicate and a false affordance. Removed; this is the
          * real control.
          *
          * --type-body-decision's own comment reads "last-decision toast
          * text", 1 use in V1.2. This is that use. --ink-raised's reads
          * "controls sitting on ink (Show menu, UNDO)". Both had been spent
          * elsewhere or not at all.
          *
          * The bundle places this in a space-between row with the gated-items
          * drawer toggle. That drawer is parked (Region 1.1.5), so the row
          * holds only the toast and is right-aligned -- see Queue.css. */}
        {lastLabel && (
          <div className="queue__toast-row">
            <div className="queue__toast" role="status" aria-live="polite">
              <span className="queue__toast-text">{lastLabel}</span>
              <button
                type="button"
                className="queue__toast-undo"
                onClick={() => void undo()}
              >
                UNDO · U
              </button>
            </div>
          </div>
        )}
       </div>
      </div>
    </Shell>
  );
}
