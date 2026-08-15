import type { ReactNode } from "react";
import "./MicroLabel.css";

/* The uppercase letter-spaced mono microlabel -- the single most
 * characteristic element in the direction (33 uses across --type-microlabel
 * and --type-microlabel-badge). Every value comes from a token; see
 * MicroLabel.css for the bundle declaration this was matched against. */
export function MicroLabel({ children }: { children: ReactNode }) {
  return <span className="micro-label">{children}</span>;
}
