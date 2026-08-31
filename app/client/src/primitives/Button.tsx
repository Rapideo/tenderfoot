import type { ReactNode } from "react";
import "./Button.css";
import { Keycap } from "./Keycap";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost";
export type ButtonSize = "default" | "sm";

/* Action button, matched against the bundle's 49 <button> elements -- see
 * Button.css for the four style clusters this was built against and which
 * bundle declarations anchor each one. "tertiary" is not in the brief's
 * named set (primary | secondary | ghost); it is added here because a
 * fourth, recurring style exists in the bundle that neither of the other
 * three can represent without changing its colour -- see Button.css.
 *
 * `size` (Ruling 9, added on review) covers the smaller primary/secondary
 * cluster (tourNext, saveView, confirmReason / cancelReason, closeEditor)
 * that --radius-button and --type-ui-action(-primary) are purpose-named for
 * but had zero consumers before this. Only primary and secondary define a
 * distinct `sm` rule -- see Button.css; passing size="sm" on tertiary or
 * ghost is a harmless no-op, since neither has a second bundle-evidenced
 * size cluster of its own.
 *
 * `keycap` reuses the Keycap primitive rather than re-implementing it (its
 * origin is the "Show menu" command-bar button, label text followed by a
 * trailing keyboard-hint badge). `disabled` is conveyed by the native
 * `disabled` attribute -- picked up by assistive tech automatically -- and
 * is never the only signal: see the `:disabled` rule in Button.css for the
 * accompanying token-driven colour change. */
export function Button({
  variant,
  size = "default",
  keycap,
  disabled,
  onClick,
  ariaLabel,
  children,
}: {
  variant: ButtonVariant;
  size?: ButtonSize;
  keycap?: string;
  disabled?: boolean;
  /* ADDED AT SP6. SP2 built this primitive inert on purpose -- the gallery
   * proved it looked right and nothing was wired. This slice is the first
   * to compose a real screen, which is the trigger STATUS named. */
  onClick?: () => void;
  /* The keycap renders inside the button, so its letter joins the
   * accessible name. An explicit label keeps the control targetable. */
  ariaLabel?: string;
  children: ReactNode;
}) {
  const sizeClass = size === "sm" ? " btn--sm" : "";
  return (
    <button
      /* Default is "submit": inside a form, an un-typed decision button
       * submits and reloads instead of deciding. */
      type="button"
      className={`btn btn--${variant}${sizeClass}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
      {keycap && <Keycap>{keycap}</Keycap>}
    </button>
  );
}
