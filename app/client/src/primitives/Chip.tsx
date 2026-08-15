import type { ReactNode } from "react";
import "./Chip.css";

export type ChipTone = "neutral" | "accent";

/* Tag / source-label pill, matched against the bundle's two chip
 * declarations (tag chips and the sourceLabel chip) -- see Chip.css. */
export function Chip({
  tone,
  children,
}: {
  tone: ChipTone;
  children: ReactNode;
}) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}
