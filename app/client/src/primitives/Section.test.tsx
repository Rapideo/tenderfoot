// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Section } from "./Section";

function wrapperOf(text: string) {
  return screen.getByText(text).parentElement as HTMLElement;
}

test("renders its children inside a token-styled section, not inline values", () => {
  render(
    <Section>
      <p>Plain</p>
    </Section>,
  );
  const section = wrapperOf("Plain");
  /* Same guard as every other primitive: no hardcoded colour, spacing, or
   * border reachable from a `style` attribute. */
  expect(section.getAttribute("style")).toBeNull();
  expect(section.className).toBe("section");
});

test("both treatments default off, so the bare section is just the padding", () => {
  render(
    <Section>
      <p>Bare</p>
    </Section>,
  );
  const section = wrapperOf("Bare");
  expect(section.className).not.toMatch(/recessed/);
  expect(section.className).not.toMatch(/divider/);
});

/* The load-bearing claim of this primitive's shape: the recess and the
 * divider are INDEPENDENT, because the bundle shows one apiece and never
 * both together. If a later edit collapses them into a single "recessed"
 * variant, these three fail. */
test("recessed applies only the recess", () => {
  render(
    <Section recessed>
      <p>Recessed</p>
    </Section>,
  );
  const section = wrapperOf("Recessed");
  expect(section.className).toMatch(/section--recessed/);
  expect(section.className).not.toMatch(/section--divider/);
});

test("divider applies only the divider", () => {
  render(
    <Section divider>
      <p>Divided</p>
    </Section>,
  );
  const section = wrapperOf("Divided");
  expect(section.className).toMatch(/section--divider/);
  expect(section.className).not.toMatch(/section--recessed/);
});

test("the two compose without either being implied by the other", () => {
  render(
    <Section recessed divider>
      <p>Both</p>
    </Section>,
  );
  const section = wrapperOf("Both");
  expect(section.className).toMatch(/section--recessed/);
  expect(section.className).toMatch(/section--divider/);
});
