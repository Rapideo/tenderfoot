import "./ScoreBar.css";

/* One row of the "MACHINE SCORES — A READING AID" panel (ScoreStrip),
 * matched against the bundle's per-score row (V1.2, index ~560940, inside
 * the opportunity-detail modal's score list):
 *
 *   wrapper: border:1px solid var(--brdmid);border-radius:7px;overflow:hidden
 *   button:  width:100%;display:grid;grid-template-columns:96px 1fr 44px 14px;
 *              align-items:center;gap:12px;padding:10px 12px;border:none;
 *              background:var(--surface);text-align:left
 *     label: font:500 11.5px/1 'IBM Plex Sans';color:var(--text3)
 *     track: height:5px;background:var(--brdsoft);border-radius:3px;
 *              display:block;position:relative;overflow:hidden
 *     fill:  position:absolute;left:0;top:0;bottom:0;border-radius:3px;
 *              background:{{ s.color }};width:{{ s.pct }}
 *     value: font:600 13px/1 'IBM Plex Mono';text-align:right
 *     caret: font:400 10px/1 'IBM Plex Mono';color:var(--text7);text-align:right
 *
 * The bundle row is a <button> (sc-camel-on-click="{{ s.toggle }}") that
 * expands to a citation (s.cite / s.doc) on click, and the "EXPAND ALL /
 * COLLAPSE ALL" control lives beside the panel title. Neither the 14px
 * caret column nor that disclosure is reproduced here: this task must not
 * become wired ("these are built and rendered ... not wired, and must not
 * become wired" -- task-7-brief.md), and the citation the caret exists to
 * signal is data this component's two-prop interface (label, value) has no
 * way to carry. So wrapper+button collapse into one non-interactive <div>
 * (a plain grid, not a <button> -- there is nothing here to click into),
 * and the grid drops from four columns to three: 96px 1fr 44px.
 *
 * value is nullable and null is the V1 case (assessment table empty by
 * design, spec §1.1). The empty state below is matched in SHAPE against
 * FactPanel's own populated/empty split (task-7-brief.md dispatch), not
 * against a literal bundle declaration -- the bundle has no "unscored"
 * state anywhere, every one of its four mock scores is populated. */
export function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const empty = value === null;
  const tier = empty ? null : value >= 70 ? "pos" : value >= 45 ? "mid" : "low";
  const rowClass = empty ? "score-bar score-bar--empty" : "score-bar";

  return (
    <div className={rowClass}>
      <span className="score-bar__label">{label}</span>
      <span className="score-bar__track">
        {!empty && (
          // width is data, not a design literal -- there is no token for a
          // per-instance numeric proportion, same class of exception as a
          // chart's plotted value. Colour, by contrast, IS token-governed:
          // it comes from the className below, never from this style.
          <span
            className={`score-bar__fill score-bar__fill--${tier}`}
            style={{ width: `${value}%` }}
          />
        )}
      </span>
      <span className="score-bar__value">{empty ? "—" : value}</span>
    </div>
  );
}
