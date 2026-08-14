import type { ReactNode } from "react";
import "./Card.css";

/* The raised surface everything else sits on. See Card.css for the bundle
 * declaration this was matched against. */
export function Card({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>;
}
