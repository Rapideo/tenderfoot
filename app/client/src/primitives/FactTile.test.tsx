// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { FactTile } from "./FactTile";

test("renders label, value and sub via tokens, not inline values -- reusing MicroLabel, not reimplementing it", () => {
  const { unmount } = render(
    <FactTile label="DEADLINE" value="17 days out" sub="Jun 12, 2026 · 5:00 PM EDT" />,
  );
  const label = screen.getByText("DEADLINE");
  const value = screen.getByText("17 days out");
  const sub = screen.getByText("Jun 12, 2026 · 5:00 PM EDT");

  /* Label reuses the MicroLabel primitive rather than reimplementing it --
   * see MicroLabel.css, whose declaration this was matched against
   * byte-for-byte in the bundle's own DEADLINE/EST. VALUE/POSTED trio. */
  expect(label.className).toMatch(/micro-label/);

  expect(label.getAttribute("style")).toBeNull();
  expect(value.getAttribute("style")).toBeNull();
  expect(sub.getAttribute("style")).toBeNull();
  expect(value.className).toMatch(/fact-tile__value/);
  expect(sub.className).toMatch(/fact-tile__sub/);
  unmount();
});

test("sub is omitted entirely when not passed", () => {
  const { unmount } = render(<FactTile label="EST. VALUE" value="$12M+" />);
  expect(screen.getByText("EST. VALUE")).toBeTruthy();
  expect(screen.getByText("$12M+")).toBeTruthy();
  /* No stray empty node left behind when `sub` is omitted. */
  expect(document.querySelector(".fact-tile__sub")).toBeNull();
  unmount();
});

test("emphasis resolves to a class distinct from the default value styling", () => {
  const { unmount: unmountDefault } = render(<FactTile label="POSTED" value="2026-07-14" />);
  const defaultValue = screen.getByText("2026-07-14");
  const defaultClass = defaultValue.className;
  unmountDefault();

  const { unmount: unmountEmphasis } = render(
    <FactTile label="DEADLINE" value="17 days out" emphasis />,
  );
  const emphasisValue = screen.getByText("17 days out");
  expect(emphasisValue.getAttribute("style")).toBeNull();
  expect(emphasisValue.className).not.toBe(defaultClass);
  unmountEmphasis();
});

test("emphasis defaults to off when omitted", () => {
  const { unmount } = render(<FactTile label="POSTED" value="2026-07-14" />);
  const value = screen.getByText("2026-07-14");
  expect(value.className).not.toMatch(/emphasis/);
  unmount();
});
