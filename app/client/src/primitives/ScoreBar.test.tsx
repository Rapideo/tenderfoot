// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreBar } from "./ScoreBar";

/* value=null is the V1 case (assessment table empty by design, design spec
 * §1.1) -- the guard that matters most is that this renders a real, distinct
 * empty state and never a fabricated 0 (task-7-brief.md). */
test("value=null renders a deliberate empty state and does NOT render a number", () => {
  const { unmount } = render(<ScoreBar label="Fit" value={null} />);
  const row = screen.getByText("Fit").closest(".score-bar");
  expect(row).not.toBeNull();
  // No digit anywhere in the row -- not the value slot, not a smuggled 0%.
  expect(row!.textContent).not.toMatch(/[0-9]/);
  expect(row!.className).toMatch(/score-bar--empty/);
  // No fill at all, not a 0-width one -- an invisible 0-width fill would be
  // indistinguishable from a real score of 0 on inspection.
  expect(document.querySelector(".score-bar__fill")).toBeNull();
  unmount();
});

test("value=43 renders the number and a bar at the bundle's proportions", () => {
  const { unmount } = render(<ScoreBar label="Fit" value={43} />);
  expect(screen.getByText("43")).toBeTruthy();
  const fill = document.querySelector(".score-bar__fill") as HTMLElement | null;
  expect(fill).not.toBeNull();
  // Bundle: pct: v + "%" -- a direct, unscaled percentage mapping.
  expect(fill!.style.width).toBe("43%");
  unmount();
});

test("label, row and value carry no inline style -- tokens only, not literals", () => {
  const { unmount } = render(<ScoreBar label="Fit" value={43} />);
  const row = screen.getByText("Fit").closest(".score-bar");
  expect(row!.getAttribute("style")).toBeNull();
  expect(screen.getByText("Fit").getAttribute("style")).toBeNull();
  expect(screen.getByText("43").getAttribute("style")).toBeNull();
  unmount();
});

/* The bar's fill colour comes from a signal token, tiered at the bundle's
 * own scoreColor(v) thresholds (v>=70 / v>=45 / below) -- verified directly
 * against the bundle's scorer function. The low tier's colour
 * (--signal-neg) is a handed-down deviation from what that function
 * actually returns there (var(--warn)); see ScoreBar.css. */
test("fill colour is class-driven and tiered at the bundle's own scoreColor thresholds", () => {
  const cases: Array<[number, string]> = [
    [84, "score-bar__fill--pos"],
    [70, "score-bar__fill--pos"],
    [61, "score-bar__fill--mid"],
    [45, "score-bar__fill--mid"],
    [30, "score-bar__fill--low"],
    [0, "score-bar__fill--low"],
  ];
  for (const [value, expectedClass] of cases) {
    const { unmount } = render(<ScoreBar label="X" value={value} />);
    const fill = document.querySelector(".score-bar__fill");
    expect(fill).not.toBeNull();
    expect(fill!.className).toMatch(new RegExp(expectedClass));
    // Colour is a class, never an inline style.
    expect(fill!.getAttribute("style")).not.toMatch(/background/);
    unmount();
  }
});
