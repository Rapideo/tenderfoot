// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { GatedDrawer } from "./GatedDrawer";

/* drawerLabel in the bundle: (open ? "▾ " : "▸ ") + count + " GATED ITEMS".
 * GatedDrawer never opens (see GatedDrawer.tsx), so the caret is always the
 * closed glyph, "▸". */
test("renders the closed-state caret, the count, and GATED ITEMS -- via tokens, not inline values", () => {
  const { unmount } = render(<GatedDrawer count={4} />);
  const btn = screen.getByRole("button", { name: "▸ 4 GATED ITEMS" });
  expect(btn.getAttribute("style")).toBeNull();
  expect(btn.className).toMatch(/gated-drawer/);
  unmount();
});

/* count=0 is the V1 case (SVRC Region 1.1.5: "V1 has no gates, so nothing
 * is gated and the drawer has no contents") -- the same shape as
 * ScoreBar's value=null, so it must render plainly, not be hidden or
 * special-cased away. */
test("count=0 -- the V1 case -- renders plainly, not hidden or special-cased", () => {
  const { unmount } = render(<GatedDrawer count={0} />);
  expect(screen.getByRole("button", { name: "▸ 0 GATED ITEMS" })).toBeTruthy();
  unmount();
});

/* Built and rendered, not wired (task-7-brief.md) -- a real <button>, same
 * pattern Button.tsx already establishes (no onClick prop exists to pass
 * one), verified here at the DOM level too. */
test("carries no click handler", () => {
  const { unmount } = render(<GatedDrawer count={4} />);
  const btn = screen.getByRole("button", { name: "▸ 4 GATED ITEMS" }) as HTMLButtonElement;
  expect(btn.onclick).toBeNull();
  unmount();
});
