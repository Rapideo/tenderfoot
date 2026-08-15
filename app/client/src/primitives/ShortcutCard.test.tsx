// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShortcutCard } from "./ShortcutCard";

/* Copy reproduced character-for-character from the bundle's goRadars button
 * (V1.2, index ~570279), em-dash included -- verified against the bundle
 * byte-for-byte before this test was written. */
const TITLE = "3 contracts expire inside your sectors";
const DESCRIPTION = "Expiration radar — re-competes, months early";

test("renders as a real button, keyboard-focusable, via tokens not inline values", () => {
  const { unmount } = render(<ShortcutCard title={TITLE} description={DESCRIPTION} />);
  const button = screen.getByRole("button");
  /* A native <button>, not a div wearing a click handler -- keyboard focus
   * and the accessible name both come from this for free. */
  expect(button.tagName).toBe("BUTTON");
  expect(button.getAttribute("style")).toBeNull();
  /* The visible text doubles as the accessible name. */
  expect(button.textContent).toContain(TITLE);
  expect(button.textContent).toContain(DESCRIPTION);
  unmount();
});

test("title and description render via tokens, not inline values", () => {
  const { unmount } = render(<ShortcutCard title={TITLE} description={DESCRIPTION} />);
  const title = screen.getByText(TITLE);
  const description = screen.getByText(DESCRIPTION);
  expect(title.getAttribute("style")).toBeNull();
  expect(description.getAttribute("style")).toBeNull();
  expect(title.className).toMatch(/shortcut-card__title/);
  expect(description.className).toMatch(/shortcut-card__description/);
  unmount();
});

test("calls onClick when clicked, and is a no-op safely when omitted", () => {
  const onClick = vi.fn();
  const { unmount } = render(
    <ShortcutCard title={TITLE} description={DESCRIPTION} onClick={onClick} />,
  );
  screen.getByRole("button").click();
  expect(onClick).toHaveBeenCalledTimes(1);
  unmount();

  const { unmount: unmountNoHandler } = render(
    <ShortcutCard title="Next ingest at 06:00" description="4 sources · last run clean" />,
  );
  expect(() => screen.getByRole("button").click()).not.toThrow();
  unmountNoHandler();
});
