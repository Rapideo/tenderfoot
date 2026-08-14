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

/* Ruling 9 (review of this task): primary/secondary each have a second,
 * smaller bundle-evidenced size cluster (saveView/tourNext/confirmReason;
 * cancelReason/closeEditor) that --radius-button and
 * --type-ui-action(-primary) are purpose-named for. */
test("size='sm' renders via tokens, not inline values, for primary and secondary", () => {
  for (const variant of ["primary", "secondary"] as const) {
    const { unmount } = render(
      <Button variant={variant} size="sm">
        Save changes
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save changes" });
    expect(btn.getAttribute("style")).toBeNull();
    expect(btn.className).toMatch(new RegExp(`btn--${variant}`));
    expect(btn.className).toMatch(/btn--sm/);
    unmount();
  }
});

test("size='sm' is a distinct class from the default size", () => {
  const { unmount: unmountDefault } = render(<Button variant="secondary">Pass</Button>);
  const defaultClass = screen.getByRole("button", { name: "Pass" }).className;
  unmountDefault();

  const { unmount: unmountSm } = render(
    <Button variant="secondary" size="sm">
      Cancel
    </Button>,
  );
  const smClass = screen.getByRole("button", { name: "Cancel" }).className;
  unmountSm();

  expect(smClass).not.toBe(defaultClass);
});

test("size defaults to 'default' (no btn--sm class) when omitted", () => {
  const { unmount } = render(<Button variant="primary">Interested</Button>);
  const btn = screen.getByRole("button", { name: "Interested" });
  expect(btn.className).not.toMatch(/btn--sm/);
  unmount();
});
