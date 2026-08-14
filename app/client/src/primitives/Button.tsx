import type { ReactNode } from "react";
import "./Button.css";
import { Keycap } from "./Keycap";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost";

/* Action button, matched against the bundle's 49 <button> elements -- see
 * Button.css for the four style clusters this was built against and which
 * bundle declarations anchor each one. "tertiary" is not in the brief's
 * named set (primary | secondary | ghost); it is added here because a
 * fourth, recurring style exists in the bundle that neither of the other
 * three can represent without changing its colour -- see Button.css.
 *
 * `keycap` reuses the Keycap primitive rather than re-implementing it (its
 * origin is the "Show menu" command-bar button, label text followed by a
 * trailing keyboard-hint badge). `disabled` is conveyed by the native
 * `disabled` attribute -- picked up by assistive tech automatically -- and
 * is never the only signal: see the `:disabled` rule in Button.css for the
 * accompanying token-driven colour change. */
export function Button({
  variant,
  keycap,
  disabled,
  children,
}: {
  variant: ButtonVariant;
  keycap?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button className={`btn btn--${variant}`} disabled={disabled}>
      {children}
      {keycap && <Keycap>{keycap}</Keycap>}
    </button>
  );
}
