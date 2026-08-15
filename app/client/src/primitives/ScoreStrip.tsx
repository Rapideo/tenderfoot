import "./ScoreStrip.css";
import { MicroLabel } from "./MicroLabel";
import { ScoreBar } from "./ScoreBar";

/* "MACHINE SCORES — A READING AID" -- matched against the bundle's score
 * panel (V1.2, index ~559895, opportunity-detail modal): a MicroLabel title
 * (byte-identical declaration -- reused via that primitive rather than
 * reimplemented, same precedent as FactPanel.tsx) followed by a
 * flex/column list of ScoreBar rows (display:flex;flex-direction:column;
 * gap:7px). See ScoreStrip.css.
 *
 * The title is an argument, not a label (task-7-brief.md): the scores it
 * introduces are explicitly not a decision, and V1 ships none of them --
 * the assessment table is empty by design (design spec §1.1). Reproduced
 * character-for-character, em-dash included; never hardcoded downstream of
 * this one constant.
 *
 * The bundle's own panel also carries a toggleAllScores "EXPAND ALL /
 * COLLAPSE ALL" control beside the title, and each row expands to a
 * citation on click. Both dropped here, same reasoning as ScoreBar's
 * dropped caret column: this component must not become wired, and there is
 * no citation data in this task's {label, value} interface for either
 * control to reveal (SVRC Region 1.1.2: "each expandable to its citation.
 * Collapsed by default" -- the citations themselves are parked with §6).
 *
 * This component only lays scores out in the order it is given them -- it
 * never sorts, filters, thresholds, or ranks (task-7-brief.md: "if you
 * find yourself writing a comparator, stop"). */
const TITLE = "MACHINE SCORES — A READING AID";

export function ScoreStrip({ scores }: { scores: { label: string; value: number | null }[] }) {
  return (
    <div className="score-strip">
      <div className="score-strip__title">
        <MicroLabel>{TITLE}</MicroLabel>
      </div>
      <div className="score-strip__list">
        {scores.map((s) => (
          <ScoreBar key={s.label} label={s.label} value={s.value} />
        ))}
      </div>
    </div>
  );
}
