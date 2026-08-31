import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Shell } from "../shell/Shell";
import { Callout, MicroLabel, Section } from "../primitives";
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
        {body.fields.map((f) => (
          <div key={f.field_name} className="record__field">
            <span className="record__field-name">{f.field_name}</span>
            <span className="record__field-value">{f.value ?? "—"}</span>
            <span className="record__field-state">{stateLabel(f)}</span>
            <span className="record__field-conf">{pct(f.confidence)}</span>
            {f.quote && <blockquote className="record__quote">“{f.quote}”</blockquote>}
            {f.note && <span className="record__note">{f.note}</span>}

            {/* The losing value is KEPT and SHOWN. A rejection you cannot
              * inspect is a bug you will never find -- and this display is
              * what makes the FSSA near-miss visible in the product. */}
            {f.conflicts.map((c) => (
              <div key={`${c.origin}-${c.value_text}`} className="record__conflict">
                <strong>{c.value_text}</strong>
                <span> — {c.origin}</span>
                <span> {pct(c.confidence)}</span>
                {c.quote && <blockquote>“{c.quote}”</blockquote>}
              </div>
            ))}
          </div>
        ))}
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
