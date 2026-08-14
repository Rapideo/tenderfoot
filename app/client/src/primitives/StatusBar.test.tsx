// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";

/* The bundle's own separator format, byte-for-byte (V1.2, index ~617384):
 * "4 SOURCES · 1 DEGRADED · 1 ROT SUSPECTED" -- a middle dot (·, U+00B7)
 * between three counts, each an upper-case noun. Confirmed 2026-08-13: rot
 * suspicion belongs in this persistent chrome, not a settings screen
 * (task-8-brief.md). */
test("renders the counts in the bundle's exact separator format", () => {
  const { unmount } = render(
    <StatusBar sources={4} degraded={1} rotSuspected={1} lastRun="2026-08-10 06:04 EDT" />,
  );
  expect(screen.getByText("4 SOURCES · 1 DEGRADED · 1 ROT SUSPECTED")).toBeTruthy();
  unmount();
});

/* 0 DEGRADED / 0 ROT SUSPECTED is the healthy state the gallery must also
 * show (task-8-brief.md step 3) -- it must render plainly, the same
 * discipline ScoreBar's value=null and GatedDrawer's count=0 already
 * establish for a real, non-fabricated empty/clear state. */
test("a healthy state (0 degraded, 0 rot suspected) renders plainly, not hidden or special-cased", () => {
  const { unmount } = render(
    <StatusBar sources={4} degraded={0} rotSuspected={0} lastRun="2026-08-10 06:04 EDT" />,
  );
  expect(screen.getByText("4 SOURCES · 0 DEGRADED · 0 ROT SUSPECTED")).toBeTruthy();
  unmount();
});

test("renders LAST RUN with the given timestamp", () => {
  const { unmount } = render(
    <StatusBar sources={4} degraded={1} rotSuspected={1} lastRun="2026-08-10 06:04 EDT" />,
  );
  expect(screen.getByText("LAST RUN 2026-08-10 06:04 EDT")).toBeTruthy();
  unmount();
});

/* "TENDERFOOT 0.1.2 · MOCKUP" is static copy in the same footer, no prop
 * needed to carry it -- copy is specification, character-for-character
 * (task-8-brief.md). */
test("renders the version stamp verbatim", () => {
  const { unmount } = render(
    <StatusBar sources={4} degraded={1} rotSuspected={1} lastRun="2026-08-10 06:04 EDT" />,
  );
  expect(screen.getByText("TENDERFOOT 0.1.2 · MOCKUP")).toBeTruthy();
  unmount();
});

/* The bundle's counts control is a real <button sc-camel-on-click="{{
 * goAdmin }}">. This task's interface carries no onClick, so it is
 * reproduced as a real, unwired button -- same pattern GatedDrawer.tsx
 * already establishes for a bundle control this task must not wire. */
test("the counts control is a real, unwired button", () => {
  const { unmount } = render(
    <StatusBar sources={4} degraded={1} rotSuspected={1} lastRun="2026-08-10 06:04 EDT" />,
  );
  const btn = screen.getByRole("button", { name: "4 SOURCES · 1 DEGRADED · 1 ROT SUSPECTED" });
  expect((btn as HTMLButtonElement).onclick).toBeNull();
  unmount();
});

/* Every value in this component comes from a token or from prop text
 * content -- nothing is ever painted with an inline style. */
test("carries no inline style anywhere -- tokens only, not literals", () => {
  const { unmount } = render(
    <StatusBar sources={4} degraded={1} rotSuspected={1} lastRun="2026-08-10 06:04 EDT" />,
  );
  const bar = document.querySelector(".status-bar") as HTMLElement;
  expect(bar.getAttribute("style")).toBeNull();
  for (const el of Array.from(bar.querySelectorAll("*"))) {
    expect(el.getAttribute("style")).toBeNull();
  }
  unmount();
});
