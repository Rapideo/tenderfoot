// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusDot } from "./StatusDot";

const STATES = ["ok", "degraded", "rot", "off"] as const;

test("renders every state via tokens, not inline values", () => {
  for (const state of STATES) {
    const { unmount } = render(<StatusDot state={state} />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("style")).toBeNull();
    expect(el.className).toMatch(/status-dot/);
    expect(el.className).toMatch(new RegExp(state));
    unmount();
  }
});

test("each state carries a non-colour affordance (data-state + accessible name), and no two states share one", () => {
  const seenNames = new Set<string>();
  for (const state of STATES) {
    const { unmount } = render(<StatusDot state={state} />);
    const el = screen.getByRole("img");
    /* data-state: an attribute a test (or, someday, a colour-blind user's
     * assistive tech) can read regardless of hue. */
    expect(el.getAttribute("data-state")).toBe(state);
    /* Accessible name: distinguishes the four states even when two colours
     * are visually indistinguishable (tokens.css: 90 pairs below the JND
     * threshold, one hover state 0.44 dE from a resting surface). */
    const name = el.getAttribute("aria-label");
    expect(name).toBeTruthy();
    expect(seenNames.has(name!)).toBe(false);
    seenNames.add(name!);
    unmount();
  }
});
