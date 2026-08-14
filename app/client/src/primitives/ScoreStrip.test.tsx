// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreStrip } from "./ScoreStrip";

/* "MACHINE SCORES — A READING AID" is an argument, not a label -- the
 * scores it introduces are explicitly not a decision (task-7-brief.md).
 * Copy is specification: character-for-character, em-dash included,
 * verified against the bundle byte-for-byte before this test was written. */
const TITLE = "MACHINE SCORES — A READING AID";

test("renders the panel title exactly, em-dash included, via MicroLabel not a reimplementation", () => {
  const { unmount } = render(<ScoreStrip scores={[]} />);
  const title = screen.getByText(TITLE);
  expect(title.textContent).toBe(TITLE);
  expect(title.getAttribute("style")).toBeNull();
  expect(title.className).toMatch(/micro-label/);
  unmount();
});

test("renders one ScoreBar per score, in the order given -- no sorting, filtering, or ranking", () => {
  const { unmount } = render(
    <ScoreStrip
      scores={[
        { label: "Fit", value: 84 },
        { label: "Winnability", value: 61 },
        { label: "Value", value: 72 },
        { label: "Timing", value: 48 },
      ]}
    />,
  );
  const labels = Array.from(document.querySelectorAll(".score-bar__label")).map((el) => el.textContent);
  // Deliberately NOT sorted by value (61 < 72 < 84 would reorder this) --
  // asserts the list stays in caller order, the whole point of the rule.
  expect(labels).toEqual(["Fit", "Winnability", "Value", "Timing"]);
  unmount();
});

/* value={null} is the V1 case (assessment table empty by design, §1.1) --
 * an all-null strip is the state V1 actually renders, not a corner case. */
test("all-null scores render four deliberate empty states, no numbers anywhere", () => {
  const { unmount } = render(
    <ScoreStrip
      scores={[
        { label: "Fit", value: null },
        { label: "Winnability", value: null },
        { label: "Value", value: null },
        { label: "Timing", value: null },
      ]}
    />,
  );
  const rows = document.querySelectorAll(".score-bar");
  expect(rows.length).toBe(4);
  for (const row of rows) {
    expect(row.className).toMatch(/score-bar--empty/);
  }
  expect(document.querySelector(".score-bar__fill")).toBeNull();
  unmount();
});

test("empty scores array renders the title with no rows -- not hidden, not broken", () => {
  const { unmount } = render(<ScoreStrip scores={[]} />);
  expect(screen.getByText(TITLE)).toBeTruthy();
  expect(document.querySelectorAll(".score-bar").length).toBe(0);
  unmount();
});
