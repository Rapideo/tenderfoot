import type { ReactNode } from "react";
import "./Keycap.css";

/* A keyboard-shortcut hint badge, matched against the bundle's ESC key.
 * Its natural habitat is an ink (dark) surface -- see Keycap.css. */
export function Keycap({ children }: { children: ReactNode }) {
  return <span className="keycap">{children}</span>;
}
