// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Keycap } from "./Keycap";

test("renders its label via tokens, not inline values", () => {
  render(<Keycap>{"I"}</Keycap>);
  const el = screen.getByText("I");
  /* Same guard as MicroLabel: no hardcoded font/colour/border/radius --
   * everything comes from a CSS class referencing tokens. */
  expect(el.getAttribute("style")).toBeNull();
  expect(el.className).toMatch(/keycap/);
});
