import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Shell } from "../shell/Shell";
import { Callout, MicroLabel, Section, TableRow } from "../primitives";
import "./Record.css";

interface Conflict {
  value_text: string;
  origin: string;
  quote: string | null;
  confidence: number | null;
}
interface Field {
  field_name: string;
  value: string | null;
  origin: string | null;
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
  return f.origin ?? "";
}

export function Record() {
  const { id } = useParams();
  const [body, setBody] = useState<RecordBody | null>(null);

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
      <h1 className="record__title">{body.title}</h1>
      <p className="record__buyer">{body.org_name ?? "Buyer unknown"}</p>

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
                    <span className="record__field-state">{c.origin}</span>
                  </TableRow>
                  {c.quote && <blockquote className="record__quote">“{c.quote}”</blockquote>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

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

      <Section>
        <MicroLabel>TIMELINE</MicroLabel>
        {body.timeline.map((e) => (
          <div key={`${e.kind}-${e.at}-${e.detail}`} className="record__event">
            <span className="record__event-at">{e.at}</span>
            <span>{e.detail}</span>
          </div>
        ))}
      </Section>
    </Shell>
  );
}
