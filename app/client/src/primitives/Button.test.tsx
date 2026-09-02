// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";
import type { ButtonVariant } from "./Button";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "tertiary", "ghost", "danger"];

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

test("every variant resolves to a distinct class", () => {
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

test("a button can be pressed", () => {
  const onClick = vi.fn();
  const { unmount } = render(
    <Button variant="primary" onClick={onClick}>
      Interested
    </Button>,
  );
  screen.getByRole("button", { name: "Interested" }).click();
  expect(onClick).toHaveBeenCalledOnce();
  unmount();
});

test("a disabled button does not fire", () => {
  const onClick = vi.fn();
  const { unmount } = render(
    <Button variant="primary" onClick={onClick} disabled>
      Interested
    </Button>,
  );
  screen.getByRole("button", { name: "Interested" }).click();
  expect(onClick).not.toHaveBeenCalled();
  unmount();
});

/* The keycap is INSIDE the button, so its letter joins the accessible name
 * -- "Interested I" rather than "Interested". An explicit label keeps a
 * control targetable by automation, which is how SP3.6's buttons were
 * finally proved to work. */
test("an explicit label survives a keycap", () => {
  const { unmount } = render(
    <Button variant="primary" keycap="I" ariaLabel="Interested">
      Interested
    </Button>,
  );
  expect(screen.getByRole("button", { name: "Interested" })).toBeTruthy();
  unmount();
});

/* Default type is "submit". Inside a form, an un-typed decision button
 * submits the form and reloads the page instead of deciding. */
test("it is type=button, not an accidental submit", () => {
  const { unmount } = render(<Button variant="primary">Interested</Button>);
  expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  unmount();
});

/* The reason step renders Pass-confirm and Interested-confirm side by side
 * across two modes, and the bundle's whole reason for branching confirmStyle
 * is that they must not look alike. A regression that dropped `danger` back
 * to `primary` would still pass every assertion above -- both are real
 * variants with real classes -- so this pins the pair apart explicitly. */
test("danger and primary are not the same button at size sm", () => {
  const { unmount } = render(
    <Button variant="danger" size="sm">
      Pass & next
    </Button>,
  );
  const danger = screen.getByRole("button", { name: "Pass & next" }).className;
  unmount();

  render(
    <Button variant="primary" size="sm">
      Save & next
    </Button>,
  );
  const primary = screen.getByRole("button", { name: "Save & next" }).className;

  expect(danger).not.toBe(primary);
  expect(danger).toMatch(/btn--danger/);
  expect(danger).toMatch(/btn--sm/);
});
