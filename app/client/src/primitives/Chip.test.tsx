// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chip } from "./Chip";

test("renders each tone via tokens, not inline values", () => {
  render(
    <>
      <Chip tone="neutral">RFP</Chip>
      <Chip tone="accent">IN · SUPPLIER PORTAL</Chip>
    </>,
  );

  const neutral = screen.getByText("RFP");
  expect(neutral.getAttribute("style")).toBeNull();
  expect(neutral.className).toMatch(/chip/);
  expect(neutral.className).toMatch(/neutral/);

  const accent = screen.getByText("IN · SUPPLIER PORTAL");
  expect(accent.getAttribute("style")).toBeNull();
  expect(accent.className).toMatch(/chip/);
  expect(accent.className).toMatch(/accent/);

  /* The two tones must resolve to different classes -- otherwise "tone"
   * does nothing and both chips look identical. */
  expect(neutral.className).not.toBe(accent.className);
});
