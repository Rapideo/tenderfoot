// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";
import type { ButtonVariant } from "./Button";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "tertiary", "ghost"];

test("renders every variant via tokens, not inline values", () => {
  for (const variant of VARIANTS) {
    const { unmount } = render(<Button variant={variant}>Label</Button>);
    const btn = screen.getByRole("button", { name: "Label" });
    /* The point of the assertion: NO hardcoded colour, radius or font. If a
     * future edit inlines a `style` attribute this fails, which is the
     * whole guard -- same pattern as the four Task 4 atoms. */
    expect(btn.getAttribute("style")).toBeNull();
    expect(btn.className).toMatch(/btn/);
    expect(btn.className).toMatch(new RegExp(`btn--${variant}`));
    unmount();
  }
});

test("the four variants resolve to four different classes", () => {
  const classNames = VARIANTS.map((variant) => {
    const { unmount } = render(<Button variant={variant}>X</Button>);
    const cls = screen.getByRole("button", { name: "X" }).className;
    unmount();
    return cls;
  });
  expect(new Set(classNames).size).toBe(VARIANTS.length);
});

test("renders a Keycap suffix when the keycap prop is passed -- reusing the primitive, not reimplementing it", () => {
  const { unmount } = render(
    <Button variant="secondary" keycap="U">
      Undo
    </Button>,
  );
  const btn = screen.getByRole("button", { name: /Undo/ });
  const kc = btn.querySelector(".keycap");
  expect(kc).not.toBeNull();
  expect(kc?.textContent).toBe("U");
  unmount();
});

test("omits the keycap suffix when the keycap prop is absent", () => {
  const { unmount } = render(<Button variant="secondary">Pass</Button>);
  const btn = screen.getByRole("button", { name: "Pass" });
  expect(btn.querySelector(".keycap")).toBeNull();
  unmount();
});

test("disabled is conveyed to assistive tech via the disabled attribute, not colour alone", () => {
  /* tokens.css: 90 colour pairs sit below the just-noticeable-difference
   * threshold. A disabled button distinguished only by colour may be
   * indistinguishable in practice, so this asserts the DOM attribute
   * directly rather than trusting a visual diff. */
  const { unmount } = render(
    <Button variant="primary" disabled>
      Interested
    </Button>,
  );
  const btn = screen.getByRole("button", { name: "Interested" }) as HTMLButtonElement;
  expect(btn.disabled).toBe(true);
  expect(btn.getAttribute("style")).toBeNull();
  unmount();
});

test("is not disabled by default", () => {
  const { unmount } = render(<Button variant="primary">Interested</Button>);
  const btn = screen.getByRole("button", { name: "Interested" }) as HTMLButtonElement;
  expect(btn.disabled).toBe(false);
  unmount();
});
