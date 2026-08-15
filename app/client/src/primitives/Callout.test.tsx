// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Callout } from "./Callout";

/* The entity-resolution finding surfaced to a human -- one of the six gaps
 * the prototype closed by itself (task-6-brief.md). Copy is specification:
 * character-for-character, em-dash included, verified against the bundle's
 * only buyerNote instance byte-for-byte before this test was written. */
const COPY =
  "Listed on Indiana's portal — the buyer is NY OGS, not Indiana. Cooperative award, participating states TBD.";

test("renders its copy exactly, em-dash included, via tokens not inline values", () => {
  render(<Callout>{COPY}</Callout>);
  const el = screen.getByText(COPY);
  expect(el.textContent).toBe(COPY);
  expect(el.getAttribute("style")).toBeNull();
  expect(el.className).toMatch(/callout/);
});
