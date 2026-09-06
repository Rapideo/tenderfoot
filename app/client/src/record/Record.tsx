import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Shell } from "../shell/Shell";
import { Button, Callout, MicroLabel, Section, TableRow } from "../primitives";
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
  /* The posting's own words, WHOLE here -- the card truncates to ~200 words,
   * this is the place that does not. Null when the source published none. */
  description: string | null;
  fields: Field[];
  documents: Doc[];
  timeline: Event[];
  /* Null means "we have never asked the source for its documents." Non-null
   * means we have -- which is a different fact from whether it found any
   * (D2, design spec §8). `GET /solicitations/:id` already returns this: the
   * handler does `SELECT s.*`, and migration 011 put the column there. */
  attachments_checked_at: string | null;
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

/* The bundle tags each file with a coloured extension chip: PDF red, DOCX
 * accent, XLSX green, ZIP grey, PPTX amber. Taken from its own docs fixture. */
function extColour(mediaType: string | null): string {
  switch ((mediaType ?? "").toLowerCase()) {
    case "pdf": return "var(--bad)";
    case "docx": return "var(--acc)";
    case "xlsx": return "var(--ok)";
    case "pptx": return "var(--warn)";
    case "zip": return "var(--text4)";
    default: return "var(--text6)";
  }
}

const pct = (c: number | null) => (c === null ? "—" : `${Math.round(c * 100)}%`);

/* D28 (corrected on review, fix round 1): only ONE state needed inventing.
 * The bundle's Documents tab is a static fixture that always has files, so
 * it never needed a "not yet looked" rendering -- CHECKING FOR DOCUMENTS is
 * genuinely new. The checked-and-zero case is NOT new copy: the bundle
 * computes its own head unconditionally as `"BUNDLE — " + D.docs.length +
 * " FILES"` (V1.2 ~581620, no zero branch), and because CHECKING already
 * reads distinctly from it, `BUNDLE — 0 FILES` already satisfies "a reader
 * can tell not-yet-looked from looked-and-none" with zero invented copy.
 * Inventing a second string here would have been the richer-than-the-bundle
 * treatment §7.10 warns against.
 *
 * `checkedAt` is compared with `=== null` on purpose, not `?? falsy`: a
 * fixture that omits the field entirely (every OLDER test in this file)
 * reads `undefined`, which must fall through to the ordinary count below,
 * not into CHECKING -- there is nothing to check for those records. */
function doclistHead(checkedAt: string | null | undefined, count: number): string {
  if (checkedAt === null) return "CHECKING FOR DOCUMENTS…";
  return `BUNDLE — ${count} FILE${count === 1 ? "" : "S"}`;
}

/* THREE STATES, NOT TWO. "We looked and it is not there" is a different fact
 * from "we never looked", and collapsing them is how a missing ceiling
 * quietly becomes a guessed one (SVRC View 2.3). */
function stateLabel(f: Field): string {
  if (f.state === "absent") return "absent from bundle";
  if (f.state === "not_looked_for") return "not yet looked for";
  /* CONFLICTED ROWS NAME BOTH ORIGINS, joined by the bundle's own connective:
   * its fixture reads src: "listing + addendum". This is the half of the
   * losing value's provenance that survives the inline form -- see valueCell
   * below for the half that does not. */
  const origin = f.source_label ?? f.origin ?? "";
  if (f.conflicts.length === 0) return origin;
  const others = f.conflicts.map((c) => c.source_label ?? c.origin);
  return [origin, ...others].filter(Boolean).join(" + ");
}

/* ⚖️ RULING 2026-09-01 -- CONFLICTS RENDER INLINE, as the bundle draws them.
 *
 * The bundle writes the disagreement into the value itself:
 *   v: "2026-09-18 · CONFLICT with Addendum 2 (2026-09-25)"
 *   conf: "48%"   src: "listing + addendum"   bg: var(--badbg2)
 *
 * SP6 spec §6.1 had specified the opposite -- the losing value BENEATH the
 * winner, on its own row, with its own origin AND its own quote. Both were
 * defensible and CLAUDE.md §1 reserves that call for Matt. He ruled for the
 * bundle; the spec is amended rather than quietly contradicted.
 *
 * ⚠️ WHAT THIS COSTS, recorded because it is a real loss and not a detail:
 * the losing value's QUOTED PASSAGE no longer appears anywhere on the screen.
 * The bundle's field table has no per-row quote at all, and one cell cannot
 * hold two citations. Both VALUES and both ORIGINS survive (above); the
 * loser's evidence does not. resolveField still returns it, and the winner's
 * quote still renders, so this is a display decision that can be revisited
 * without re-extraction. Deviation D18. */
function valueCell(f: Field): string {
  const value = f.value ?? "Not found";
  if (f.conflicts.length === 0) return value;
  const disagreements = f.conflicts
    .map((c) => `CONFLICT with ${c.source_label ?? c.origin} (${c.value_text})`)
    .join(" · ");
  return `${value} · ${disagreements}`;
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
  const [openDoc, setOpenDoc] = useState<number | null>(null);
  /* CRITICAL FIX, review round 1: the on-demand POST's own response carries
   * `documents` as a COUNT (Task 4's interface) -- there is nothing to splice
   * into `body.documents` without inventing filenames the API never sent,
   * but the COUNT itself is real and is what the head label needs right now,
   * not after a reload. `body.documents.length` stays whatever the ORIGINAL
   * GET returned (0, for a record fetched for the first time this session)
   * and is never otherwise refreshed, so reading it for the label after a
   * successful fetch rendered "NO DOCUMENTS" over a record the database had
   * just recorded 7 documents against -- a false claim, not merely a stale
   * one.
   *
   * FINAL-REVIEW FIX: `documents` is a number on EVERY outcome, not only
   * "fetched" -- it is 0 for "unsupported", "ceiling", and a racing
   * "already-looked", and none of those mean "we looked and found none," they
   * mean "we did not ask this time." Overriding on any of them clobbers a
   * real, already-known count with a stray 0. This is live: discover-idoa.ts
   * writes `document` rows but never stamps `attachments_checked_at`, and IDOA
   * has no `DOCUMENT_CLIENTS` entry, so opening an IDOA record that HOLDS
   * files used to settle from CHECKING straight to "BUNDLE — 0 FILES" over the
   * very file list it had just rendered. The override below is now gated on
   * `reason === "fetched"` -- the only outcome that actually asked the source
   * something new. Every other settled outcome still clears the CHECKING
   * state (the stamp, below) but leaves the count to `body.documents.length`,
   * the pre-branch rendering.
   *
   * Null means "trust `body.documents.length`" (true whenever the record was
   * already checked before this component mounted, whenever this outcome
   * wasn't a fresh fetch, or nothing has resolved yet); non-null means "this
   * session's own FETCHED outcome just found this many," and overrides. Reset
   * to null on every id change below, so a previous record's count cannot
   * leak onto a newly opened one. */
  const [freshDocCount, setFreshDocCount] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setFreshDocCount(null);
    fetch(`/api/solicitations/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => live && setBody(b as RecordBody))
      .catch(() => live && setBody(null));
    return () => {
      live = false;
    };
  }, [id]);

  /* ⚖️ D2, design spec §8: a solicitation's documents are fetched once, the
   * first time it is opened with `attachments_checked_at` still null --
   * never in bulk (CLAUDE.md §5.2). Guarded by a REF keyed to `id`, not by
   * re-reading `body.attachments_checked_at`: React re-renders freely and
   * StrictMode double-invokes effects in development, and "the stamp makes a
   * duplicate call free rather than harmful" is a SERVER fact the client
   * must not lean on (spec §8). The ref is what actually holds that line. */
  const checkedDocsFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!body || body.attachments_checked_at !== null) return;
    if (checkedDocsFor.current === id) return;
    checkedDocsFor.current = id;

    /* IMPORTANT FIX, review round 1: reused verbatim from the GET effect
     * above. Without it, a POST for a record the user has since navigated
     * away from can land after `id` (and `body`) have already moved on, and
     * stamp/merge onto whatever record is now displayed. */
    let live = true;
    fetch(`/api/solicitations/${id}/documents`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((outcome: { reason?: string; documents?: number } | null) => {
        if (!live) return;
        setBody((prev) => (prev ? { ...prev, attachments_checked_at: new Date().toISOString() } : prev));
        /* Gated on `reason`, not merely on `documents` being a number -- see
         * the comment on `freshDocCount`'s declaration above. Only "fetched"
         * means the source was actually asked; every other outcome's 0 is not
         * a count, it is the absence of one. */
        if (outcome && outcome.reason === "fetched" && typeof outcome.documents === "number") {
          setFreshDocCount(outcome.documents);
        }
      })
      .catch(() => {
        /* Left null. A network failure is not "we looked" -- the bundle
         * region stays on CHECKING rather than lying into a file count. The
         * ref set above still holds: this record will not retry itself into
         * a spend loop just because the first attempt failed. */
      });
    return () => {
      live = false;
    };
  }, [id, body]);

  const selected =
    body?.documents.find((d) => d.id === openDoc) ?? body?.documents[0] ?? null;

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
                <span className="record__field-value">{valueCell(f)}</span>
                <span className="record__field-conf" style={{ color: confColour(f) }}>
                  {f.state === "found" ? pct(f.confidence) : "—"}
                </span>
                <span className="record__field-state" title={stateLabel(f)}>{stateLabel(f)}</span>
              </TableRow>

              {/* The WINNER's quote still renders. That is not part of the
                * inline ruling -- the ruling was about where a DISAGREEMENT
                * goes, not whether citations are readable, and SP4's whole
                * deferred criterion rests on this line. */}
              {f.quote && <blockquote className="record__quote">“{f.quote}”</blockquote>}
              {f.note && <span className="record__note">{f.note}</span>}
            </div>
          ))}
        </div>
      </Section>

      )}

      {tab === "docs" && (
      <Section>
        {/* TWO PANES, as the bundle has it: a 300px file list beside the
          * reader. `grid-template-columns:300px minmax(0,1fr); gap:20px`.
          *
          * D12 governs the right-hand pane, and the bundle agrees with us
          * more than it looks: ITS viewer is a placeholder reading "DOCUMENT
          * RENDER — PLACEHOLDER … whether .docx / .xlsx render inline or
          * download is undecided". SP4 then ruled the bytes are discarded, so
          * there is nothing to render — and the stored extracted text goes
          * where the prototype left a hatched rectangle. */}
        <div className="record__docs">
          <div className="record__doclist">
            <div className="record__doclist-head">
              {doclistHead(body.attachments_checked_at, freshDocCount ?? body.documents.length)}
            </div>
            {body.documents.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`record__docrow${d.id === openDoc ? " record__docrow--on" : ""}`}
                onClick={() => setOpenDoc(d.id)}
              >
                <span className="record__ext" style={{ background: extColour(d.media_type) }}>
                  {(d.media_type ?? "?").toUpperCase()}
                </span>
                <span className="record__docname" title={d.filename}>
                  {d.filename}
                </span>
              </button>
            ))}
          </div>

          <div className="record__reader">
            <div className="record__reader-head">
              {selected
                ? `EXTRACTED TEXT — ${selected.filename}`
                : "EXTRACTED TEXT"}
            </div>
            {selected?.source_url && (
              <a
                className="record__reader-link"
                href={selected.source_url}
                target="_blank"
                rel="noreferrer"
              >
                {selected.filename}
              </a>
            )}
            {selected?.extracted_text ? (
              <pre className="record__text">{selected.extracted_text}</pre>
            ) : (
              <div className="record__reader-empty">
                {selected
                  ? `Nothing extracted from this file — status: ${selected.extract_status}.`
                  : "Select a file."}
                <div className="record__reader-note">
                  Documents are fetched, parsed and discarded; a citation quotes the extracted
                  passage rather than opening the original. The link above opens it at its source.
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>
      )}

      {tab === "timeline" && (
      <Section>
        {/* THE BUNDLE'S TIMELINE RAIL: `112px 20px minmax(0,1fr)` -- a
          * right-aligned mono date, a dot over a connecting line, then the
          * event. Ours was a flat date-and-text row with no rail at all.
          *
          * The dot colour carries the SVRC's own distinction: what the
          * DOCUMENTS did (a sighting) against what the SYSTEM decided (entity
          * resolution) -- "the least visible thing the system does and the
          * easiest to get silently wrong".
          *
          * ⚠️ The bundle also has a `diff` block on --badbg for an addendum's
          * real changes. NOT built: nothing in this system diffs addenda yet
          * (SVRC View 2.5's known gap), and rendering an empty container for
          * absent data would promise something we cannot deliver. */}
        <div className="record__timeline">
          {body.timeline.map((e) => (
            <div key={`${e.kind}-${e.at}-${e.detail}`} className="record__event">
              <span className="record__event-at">{String(e.at).slice(0, 10)}</span>
              <span className="record__rail">
                <span
                  className="record__dot"
                  style={{ background: e.kind === "resolution" ? "var(--warn)" : "var(--acc)" }}
                />
                <span className="record__railline" />
              </span>
              <div className="record__event-body">
                <div className="record__event-title">{e.detail}</div>
                <div className="record__event-sub">
                  {e.kind === "resolution"
                    ? "System decision — the merge resolved this record's organisation."
                    : `Sighting${e.source_name ? ` — carried by ${e.source_name}` : ""}.`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
      )}

      {/* PARKED, disclosed rather than faked. View 2.1's live half ("why it
        * fits", "recommended posture") is qualification against the Firm
        * Profile, and View 2.2 is parked with scoring outright. Inventing
        * either would be the back-door reintroduction §6 warns against. */}
      {/* THE BRIEF, half-unparked 2026-09-02.
        *
        * Matt: "We also need a summary and a full-text summary on the main
        * full-detail panel too." This is that panel, and the Brief is where it
        * belongs -- the tab is literally "what is this".
        *
        * ⚠️ The tab stays PARTLY parked, and the distinction is the point. Its
        * JUDGEMENT half -- why this fits, a recommended posture -- is a call
        * against the Firm Profile, and qualification is undesigned by decision
        * (design spec §1.1). That is still parked and still says so. What has
        * arrived is the source's own description, which is a FACT rather than
        * a judgement, and was never the parked part. */}
      {tab === "brief" && (
        <div className="record__brief">
          <div className="record__brief-head">
            <span className="record__brief-title">
              WHAT THIS IS — THE POSTING&rsquo;S OWN WORDS
            </span>
            {/* Inert, per §7.10 clause 2: the intelligence chrome is built and
              * left non-functional until the thing behind it is designed. This
              * is where the summariser will hang, and the heading above becomes
              * a machine-summary heading only when a model actually writes one
              * -- calling source prose a summary is D20's mistake. */}
            <Button variant="ghost" ariaLabel="Summarise" disabled>
              SUMMARISE
            </Button>
          </div>
          {body.description ? (
            <p className="record__brief-body">{body.description}</p>
          ) : (
            <p className="record__brief-empty">This source published no description.</p>
          )}

          <Callout>
            <strong>The Brief&rsquo;s judgement half is still parked for V1.</strong> Why this
            fits, and a recommended posture, are judgements against the Firm Profile, and
            qualification is undesigned by decision (design spec §1.1). The text above is the
            source&rsquo;s own — it is not an assessment, and nothing here has read it.
          </Callout>
        </div>
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
