import type { ReactNode } from "react";
import "./ChoiceChip.css";

/* Selectable pill for the decision bar's reason step -- see ChoiceChip.css
 * for the bundle declaration this was matched against, and for why it is a
 * separate primitive from `Chip` rather than a tone on it.
 *
 * `selected` is conveyed by aria-pressed, not by colour alone. The bundle's
 * chips are bare <button>s whose only selected signal is a background swap,
 * which §7.10 permits us to improve: "non-visual accessibility additions --
 * labels, roles, focus management" are pre-authorised and change no pixel.
 *
 * aria-pressed rather than role="radio" DELIBERATELY. The bundle's chips are
 * multi-select (`picked` is an array and each chip toggles), so a toggle
 * button is what this primitive actually is. A caller that wants
 * single-select -- the discovery channel does -- gets it by replacing rather
 * than appending its own state; half-built radio semantics, with the role
 * but without a radiogroup or arrow-key roving focus, would announce a
 * keyboard contract that does not exist. */
export function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      /* Default is "submit": inside a form this would submit and reload
       * instead of selecting. Same guard, same reason, as Button. */
      type="button"
      className={`choice-chip${selected ? " choice-chip--on" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
