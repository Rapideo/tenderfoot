// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { FactPanel } from "./FactPanel";
import { FactTile } from "./FactTile";

/* "COST TO PURSUE — FACTS, NOT A SCORE" is an argument, not a label -- the
 * panel exists to present facts a person judges, explicitly not a computed
 * score (task-6-brief.md). Copy is specification: character-for-character,
 * em-dash included, verified against the bundle byte-for-byte before this
 * test was written. */
const TITLE = "COST TO PURSUE — FACTS, NOT A SCORE";

test("renders the title exactly, em-dash included, and via tokens not inline values", () => {
  const { unmount } = render(<FactPanel title={TITLE} />);
  const title = screen.getByText(TITLE);
  expect(title.textContent).toBe(TITLE);
  expect(title.getAttribute("style")).toBeNull();
  /* The title is a MicroLabel, not a re-implementation of one. */
  expect(title.className).toMatch(/micro-label/);
  unmount();
});

test("renders the optional note when passed, and omits it when not", () => {
  const NOTE = "Counted from the bundle. The light/moderate/heavy call is yours.";
  const { unmount } = render(<FactPanel title={TITLE} note={NOTE} />);
  const note = screen.getByText(NOTE);
  expect(note.getAttribute("style")).toBeNull();
  unmount();

  const { unmount: unmountNoNote } = render(<FactPanel title={TITLE} />);
  expect(screen.queryByText(NOTE)).toBeNull();
  unmountNoNote();
});

test("populated: renders passed FactTile children inside the facts grid", () => {
  const { unmount } = render(
    <FactPanel title={TITLE}>
      <FactTile label="Required forms" value="7" />
      <FactTile label="Page limit" value="40 pp" />
    </FactPanel>,
  );
  expect(screen.getByText("7")).toBeTruthy();
  expect(screen.getByText("40 pp")).toBeTruthy();
  expect(document.querySelector(".fact-panel__grid")).not.toBeNull();
  /* Absence is a distinct state from low confidence (SVRC View 2.3) -- a
   * populated panel must never ALSO show the empty-state message. */
  expect(document.querySelector(".fact-panel__empty")).toBeNull();
  unmount();
});

test("empty: renders a distinct empty-state message, not a blank or broken grid", () => {
  const { unmount } = render(<FactPanel title={TITLE} />);
  expect(document.querySelector(".fact-panel__grid")).toBeNull();
  const empty = document.querySelector(".fact-panel__empty");
  expect(empty).not.toBeNull();
  expect(empty?.getAttribute("style")).toBeNull();
  expect(empty?.textContent?.length).toBeGreaterThan(0);
  unmount();
});
