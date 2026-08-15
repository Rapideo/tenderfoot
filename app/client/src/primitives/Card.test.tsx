// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

test("renders its children inside a token-styled surface, not inline values", () => {
  render(
    <Card>
      <p>Hello</p>
    </Card>,
  );
  const child = screen.getByText("Hello");
  const card = child.parentElement as HTMLElement;
  /* The point of the assertion: NO hardcoded colour, radius, or border. If a
   * future edit inlines a `style` attribute this fails -- same guard as
   * every other primitive. */
  expect(card.getAttribute("style")).toBeNull();
  expect(card.className).toMatch(/card/);
  expect(child.textContent).toBe("Hello");
});
