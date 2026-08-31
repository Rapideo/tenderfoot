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
      setLastDecided(id);
      await load();
    },
    [current, reason, load],
  );

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
    onPass: () => void decide("Not Interested"),
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
      {page.mode === "sample" && page.sample && (
        <div className="queue__sample-banner">
          <MicroLabel>
            {`SAMPLE · ${page.sample.drawn} of ${page.sample.population_size.toLocaleString()} · ` +
              `${page.sample.source_name} · seed ${page.sample.seed}`}
          </MicroLabel>
        </div>
      )}

      <Card>
        <h2 className="queue__title">{item.title}</h2>
        <div className="queue__facts">
          <span>{item.org_name ?? "Buyer unknown"}</span>
          <span>{item.closes_at ?? "No deadline stated"}</span>
          <span>{money(item.value_cents)}</span>
          {item.kind && <Chip tone="neutral">{item.kind}</Chip>}
        </div>

        {/* SAMPLE MODE ONLY, spec §10: the deadline passed mid-session but
          * the item stays in the sample and reachable here -- marked so a
          * reader can tell "closed, still decidable" from "still open". */}
        {item.closed && (
          <Callout>
            <MicroLabel>CLOSED</MicroLabel>
            <span> The deadline has passed. Still part of the sample and still decidable.</span>
          </Callout>
        )}

        {item.deadline_conflict.length > 0 && (
          <Callout>
            <MicroLabel>DEADLINE DISAGREEMENT</MicroLabel>
            {item.deadline_conflict.map((c) => (
              <div key={`${c.origin}-${c.value_text}`}>
                <strong>{c.value_text}</strong> — {c.origin}
                {c.quote && <em> “{c.quote}”</em>}
              </div>
            ))}
          </Callout>
        )}

        {/* D15: Region 1.1.3 renders and says what it does not have. */}
        <FactPanel
          title="PURSUIT COST"
          note="Required forms, conference, references and notarization are not yet extracted."
        />

        <div className="queue__decision">
          <textarea
            aria-label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? (required on Pass)"
          />
          {/* The keycap prop already exists on Button and puts the shortcut
            * ON the control it triggers, rather than in a legend beside it.
            * ariaLabel is what keeps each one unambiguously targetable by
            * automation -- the keycap letter otherwise joins the accessible
            * name, and SP3.6's lesson is that a control you cannot target is
            * a control nobody proves works. */}
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
            onClick={() => void decide("Not Interested")}
          >
            Pass
          </Button>
          <Button
            variant="ghost"
            keycap="↵"
            ariaLabel="Open record"
            onClick={() => navigate(`/solicitation/${item.id}`)}
          >
            Open record
          </Button>
          {/* Undo has no button -- it is keyboard-only -- so it is the one
            * shortcut that needs a visible hint of its own; the other three
            * already carry theirs via Button's keycap prop. */}
          <span className="queue__keys">
            <Keycap>U</Keycap> undo
          </span>
        </div>
        {error && <Callout>{error}</Callout>}
      </Card>
    </Shell>
  );
}
