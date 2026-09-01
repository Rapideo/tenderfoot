import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Shell } from "../shell/Shell";
import { Callout, MicroLabel, Section, TableRow } from "../primitives";
import "./Record.css";

interface Conflict {
  value_text: string;
  origin: string;
  source_label: string | null;
  quote: string | null;
  confidence: number | null;
}
interface Field {
  field_name: string;
  value: string | null;
  origin: string | null;
  /* The bundle's SOURCE column names the FILE, not the kind of source:
   * "Scope.pdf", "listing metadata". Falls back to the origin when a
   * document row has somehow lost its filename. */
  source_label: string | null;
  confidence: number | null;
  quote: string | null;
  note: string | null;
  state: "found" | "absent" | "not_looked_for";
  conflicts: Conflict[];
}
interface Doc {
  id: number;
  filename: string;
  media_type: string | null;
  extract_status: string;
  source_url: string | null;
  extracted_text: string | null;
}
interface Event {
  kind: string;
  at: string;
  source_name: string | null;
  detail: string;
}
interface RecordBody {
  id: number;
  title: string;
  org_name: string | null;
  source_name: string | null;
  closes_at: string | null;
  fields: Field[];
  documents: Doc[];
  timeline: Event[];
}

/* The bundle's own column template for the tabFields panel (V1.2), copied
 * rather than approximated: 190px minmax(0,1fr) 110px 150px. */
const FIELD_COLUMNS = "190px minmax(0,1fr) 110px 150px";

/* Human labels, as the bundle uses them. It shows "Submission deadline", not
 * `closes_at` -- copy is specification (§7.10). */
const FIELD_LABELS: Record<string, string> = {
  closes_at: "Submission deadline",
  qa_closes_at: "Questions due",
  prebid_at: "Pre-proposal conf.",
  prebid_required: "Pre-proposal required",
  set_aside: "Set-aside",
  value_cents: "Estimated value",
};

/* Row background by state, from the bundle's own field data: a normal row is
 * --surface, an absent one --surface3, a conflicted one --badbg2. */
function rowBackground(f: Field): string {
  if (f.conflicts.length) return "var(--badbg2)";
  if (f.state === "found") return "var(--surface)";
  return "var(--surface3)";
}

/* Confidence is COLOUR-CODED in the bundle -- --ok high, --acc mid, --bad low
 * or conflicted, --text7 when there is nothing to report. */
function confColour(f: Field): string {
  if (f.state !== "found") return "var(--text7)";
  if (f.conflicts.length) return "var(--bad)";
  const c = f.confidence ?? 0;
  if (c >= 0.85) return "var(--ok)";
  if (c >= 0.6) return "var(--acc)";
  return "var(--bad)";
}

const pct = (c: number | null) => (c === null ? "—" : `${Math.round(c * 100)}%`);

/* THREE STATES, NOT TWO. "We looked and it is not there" is a different fact
 * from "we never looked", and collapsing them is how a missing ceiling
 * quietly becomes a guessed one (SVRC View 2.3). */
function stateLabel(f: Field): string {
  if (f.state === "absent") return "absent from bundle";
  if (f.state === "not_looked_for") return "not yet looked for";
  return f.source_label ?? f.origin ?? "";
}

/* The bundle's five tabs, in its order and with its labels. Two of them
 * (Brief, Scores & Evidence) are PARKED for V1 -- the Brief's live half is
 * qualification and View 2.2 is parked with scoring -- so they render the
 * parking rather than inventing content. The TAB STRUCTURE is the bundle's
 * and is what Screen 2 is organised around; hiding the tabs entirely would
 * have been a second, unrecorded divergence.
 * ⚠️ If Matt would rather parked tabs be absent than disclosed, that is a
 * prototype-versus-spec call under CLAUDE.md §1 and this is where it lands. */
const TABS = [
  ["fields", "Extracted Fields"],
  ["docs", "Documents"],
  ["timeline", "Timeline"],
  ["brief", "Brief"],
  ["scores", "Scores & Evidence"],
] as const;
type TabKey = (typeof TABS)[number][0];

export function Record() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [body, setBody] = useState<RecordBody | null>(null);
  /* Extracted Fields is the default: it is the tab that carries SP4's two
   * deferred criterion bullets, and the only one with a citation to read. */
  const [tab, setTab] = useState<TabKey>("fields");

  useEffect(() => {
    let live = true;
    fetch(`/api/solicitations/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => live && setBody(b as RecordBody))
      .catch(() => live && setBody(null));
    return () => {
      live = false;
    };
  }, [id]);

  if (!body) return <Shell>Loading…</Shell>;

  return (
    <Shell>
      {/* SCREEN 2's FRAME, matched to the bundle:
        *   page   max-width:1180px; margin:0 auto; padding:26px 24px 48px
        *   crumbs flex gap:16px; mono 500 11px ls .08em --text5
        *   card   --surface / --brd / radius 10 / overflow hidden
        *   head   padding:24px 28px 0
        *   h1     600 24px/1.25 Sans ls -.01em max-width:30ch
        *   sub    400 13.5px/1.5 Sans --text4, "buyer · source · closes date"
        *   tabs   flex gap:2px; margin-top:20px; border-bottom 1px --brdmid
        * Note the page is 1180px here, wider than the triage screen's 1080. */}
      <div className="record">
        <div className="record__crumbs">
          <button type="button" className="record__crumb" onClick={() => navigate("/")}>
            ← BACK TO QUEUE
          </button>
          <button type="button" className="record__crumb" onClick={() => navigate("/")}>
            ALL OPPORTUNITIES
          </button>
        </div>

        <div className="record__card">
          <div className="record__head">
            <h1 className="record__title">{body.title}</h1>
            <div className="record__sub">
              {[body.org_name ?? "Buyer unknown", body.source_name, body.closes_at && `closes ${body.closes_at}`]
                .filter(Boolean)
                .join(" · ")}
            </div>

            <div className="record__tabs" role="tablist">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={`record__tab${tab === key ? " record__tab--active" : ""}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="record__body">

      {tab === "fields" && (
      <Section>
        <MicroLabel>EXTRACTED FIELDS</MicroLabel>

        {/* MATCHED TO THE BUNDLE (V1.2, the tabFields panel), per the fidelity
          * mandate §7.10. The bundle's own declaration is:
          *   grid-template-columns:190px minmax(0,1fr) 110px 150px; gap:14px
          *   header  padding:11px 16px; background:var(--surface2)
          *   row     padding:12px 16px; border-bottom:1px solid var(--brdrow)
          * and the four cells are FIELD | VALUE | CONFIDENCE | SOURCE in that
          * order. Every font here resolves to a token SP2 extracted FOR this
          * panel -- --type-body-label is literally commented "field label
          * paired with a value", --type-data-conf "confidence".
          *
          * The first cut of this screen was a bare `display: grid` with no
          * template and hand-picked fonts, so four values stacked as four
          * unlabelled lines. That was a fidelity failure, not a styling
          * preference: the slice spec never invoked §7.10. */}
        <div className="record__table">
          <TableRow columns={FIELD_COLUMNS} padding="11px 16px" background="var(--surface2)">
            <span className="record__th">FIELD</span>
            <span className="record__th">VALUE</span>
            <span className="record__th">CONFIDENCE</span>
            <span className="record__th">SOURCE</span>
          </TableRow>

          {body.fields.map((f) => (
            <div key={f.field_name} className="record__fieldgroup">
              <TableRow columns={FIELD_COLUMNS} padding="12px 16px" background={rowBackground(f)}>
                <span className="record__field-name">{FIELD_LABELS[f.field_name] ?? f.field_name}</span>
                <span className="record__field-value">{f.value ?? "Not found"}</span>
                <span className="record__field-conf" style={{ color: confColour(f) }}>
                  {f.state === "found" ? pct(f.confidence) : "—"}
                </span>
                <span className="record__field-state">{stateLabel(f)}</span>
              </TableRow>

              {f.quote && <blockquote className="record__quote">“{f.quote}”</blockquote>}
              {f.note && <span className="record__note">{f.note}</span>}

              {/* The losing value is KEPT and SHOWN. A rejection you cannot
                * inspect is a bug you will never find -- and this display is
                * what makes the FSSA near-miss visible in the product.
                *
                * ⚠️ DIVERGENCE, deliberately surfaced rather than resolved:
                * the bundle expresses a conflict INLINE in the value cell
                * ("2026-09-18 · CONFLICT with Addendum 2 (2026-09-25)") on a
                * --badbg2 row. The SP6 spec §6.1 instead requires the loser
                * BENEATH the winner with its own origin and quote, which
                * carries strictly more evidence. Pending Matt's ruling
                * (CLAUDE.md §1), this keeps the spec's information and the
                * bundle's visual language: the same columns, and the bundle's
                * own conflict background. */}
              {f.conflicts.map((c) => (
                <div key={`${c.origin}-${c.value_text}`} className="record__conflict">
                  <TableRow columns={FIELD_COLUMNS} padding="10px 16px" background="var(--badbg2)">
                    <span className="record__conflict-tag">disagrees</span>
                    <span className="record__field-value">{c.value_text}</span>
                    <span className="record__field-conf" style={{ color: "var(--bad)" }}>
                      {pct(c.confidence)}
                    </span>
                    <span className="record__field-state">{c.source_label ?? c.origin}</span>
                  </TableRow>
                  {c.quote && <blockquote className="record__quote">“{c.quote}”</blockquote>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      )}

      {tab === "docs" && (
      <Section recessed>
        <MicroLabel>DOCUMENTS</MicroLabel>
        {/* D12: the bytes were discarded by SP4's ruling, so what is here is
          * the stored text and a link back to the original. */}
        <Callout>
          Documents are parsed and discarded — a citation quotes the extracted
          passage. The link opens the original at its source.
        </Callout>
        {body.documents.map((d) => (
          <div key={d.id} className="record__doc">
            {d.source_url ? (
              <a href={d.source_url} target="_blank" rel="noreferrer">
                {d.filename}
              </a>
            ) : (
              <span>{d.filename}</span>
            )}
            {/* D12: named as rendered, and until this fix was not. */}
            {d.media_type && <span className="record__doc-type">{d.media_type}</span>}
            <span className="record__doc-status">{d.extract_status}</span>
            {d.extracted_text && <pre className="record__text">{d.extracted_text}</pre>}
          </div>
        ))}
      </Section>

      )}

      {tab === "timeline" && (
      <Section>
        <MicroLabel>TIMELINE</MicroLabel>
        {body.timeline.map((e) => (
          <div key={`${e.kind}-${e.at}-${e.detail}`} className="record__event">
            <span className="record__event-at">{e.at}</span>
            <span>{e.detail}</span>
          </div>
        ))}
      </Section>
      )}

      {/* PARKED, disclosed rather than faked. View 2.1's live half ("why it
        * fits", "recommended posture") is qualification against the Firm
        * Profile, and View 2.2 is parked with scoring outright. Inventing
        * either would be the back-door reintroduction §6 warns against. */}
      {tab === "brief" && (
        <Callout>
          <strong>The Brief is parked for V1.</strong> Its live half — why this fits, and a
          recommended posture — is a judgement against the Firm Profile, and qualification is
          undesigned by decision (design spec §1.1). What remains of it is already carried by the
          card, the extracted fields and the timeline.
        </Callout>
      )}

      {tab === "scores" && (
        <Callout>
          <strong>Scores &amp; Evidence is parked for V1.</strong> There are no scores to cite:
          the assessment table is empty by design. The principle it enforced — a value without a
          citation is an assertion — moved down a layer to Extracted Fields, which is where a
          quoted passage now sits beside every value.
        </Callout>
      )}

          </div>
        </div>
      </div>
    </Shell>
  );
}
