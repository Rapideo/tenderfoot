// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { MicroLabel } from "./MicroLabel";

test("renders its text uppercase-styled via the type token, not inline values", () => {
  render(<MicroLabel>order · ambiguity first</MicroLabel>);
  const el = screen.getByText(/order/i);
  /* The point of the assertion: NO hardcoded font or colour. If a future edit
   * inlines `font: 500 9.5px...` this fails, which is the whole guard. */
  expect(el.getAttribute("style")).toBeNull();
  expect(el.className).toMatch(/micro-label/);
});
