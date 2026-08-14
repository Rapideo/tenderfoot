import type { ReactNode } from "react";
import "./Callout.css";

/* The amber entity-resolution note -- the finding surfaced to a human, one
 * of the six gaps the prototype closed by itself. See Callout.css for the
 * bundle declaration this was matched against. Copy is supplied by the
 * caller, never hardcoded here, so the component never drifts from the
 * exact record it is describing. */
export function Callout({ children }: { children: ReactNode }) {
  return <div className="callout">{children}</div>;
}
