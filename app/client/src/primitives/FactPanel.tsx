import { Children, type ReactNode } from "react";
import "./FactPanel.css";
import { MicroLabel } from "./MicroLabel";

/* Absence is a distinct state from low confidence (SVRC View 2.3) -- "we
 * looked and it is not there" is a different fact from "we are unsure", and
 * with V1 shipping no scores, the empty case is the common one, not an
 * edge case. This copy says exactly that: it is not a placeholder, and it
 * is not styled or worded like a broken panel -- see FactPanel.css. */
const EMPTY_MESSAGE = "No cost facts recorded for this opportunity.";

/* "COST TO PURSUE — FACTS, NOT A SCORE" -- that title is an argument, not a
 * label. The panel exists to present facts a person judges, explicitly not
 * a computed score. See FactPanel.css for the bundle declaration this was
 * matched against; `title` and `note` are supplied by the caller so the
 * component never hardcodes copy it does not own. */
export function FactPanel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children?: ReactNode;
}) {
  const hasFacts = Children.count(children) > 0;
  return (
    <div className="fact-panel">
      <div className="fact-panel__title">
        <MicroLabel>{title}</MicroLabel>
      </div>
      {note && <div className="fact-panel__note">{note}</div>}
      {hasFacts ? (
        <div className="fact-panel__grid">{children}</div>
      ) : (
        <div className="fact-panel__empty">{EMPTY_MESSAGE}</div>
      )}
    </div>
  );
}
