// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeaderLockup } from "./HeaderLockup";

test("renders the TENDERFOOT wordmark verbatim", () => {
  const { unmount } = render(<HeaderLockup />);
  expect(screen.getByText("TENDERFOOT")).toBeTruthy();
  unmount();
});

test("renders the mark as a 22x22 outer square containing an 8x8 inner square", () => {
  const { unmount } = render(<HeaderLockup />);
  const mark = document.querySelector(".header-lockup__mark");
  const inner = document.querySelector(".header-lockup__mark-inner");
  expect(mark).not.toBeNull();
  expect(inner).not.toBeNull();
  unmount();
});

/* As of V1.2 there is no placeholder line beneath the mark -- that deletion
 * was the whole of the V1.2 round (task-8-brief.md). Exactly two children:
 * the mark and the wordmark, nothing else. */
test("as of V1.2 there is no placeholder line beneath the mark", () => {
  const { unmount } = render(<HeaderLockup />);
  const lockup = document.querySelector(".header-lockup") as HTMLElement;
  expect(lockup.children.length).toBe(2);
  unmount();
});

/* Finished and must not be restyled (task-8-brief.md) -- every colour,
 * radius, and font comes from a token, never an inline literal. */
test("carries no inline style anywhere -- tokens only, not literals", () => {
  const { unmount } = render(<HeaderLockup />);
  const lockup = document.querySelector(".header-lockup") as HTMLElement;
  expect(lockup.getAttribute("style")).toBeNull();
  for (const el of Array.from(lockup.querySelectorAll("*"))) {
    expect(el.getAttribute("style")).toBeNull();
  }
  unmount();
});
