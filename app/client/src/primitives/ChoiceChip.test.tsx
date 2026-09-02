// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChoiceChip } from "./ChoiceChip";

test("selection is announced, not merely coloured", () => {
  render(
    <>
      <ChoiceChip selected={false} onClick={() => {}}>
        Portal
      </ChoiceChip>
      <ChoiceChip selected onClick={() => {}}>
        Nowhere
      </ChoiceChip>
    </>,
  );

  const off = screen.getByRole("button", { name: "Portal" });
  const on = screen.getByRole("button", { name: "Nowhere" });

  /* The whole point of the primitive: a screen reader can tell these apart
   * without seeing the background swap. */
  expect(off.getAttribute("aria-pressed")).toBe("false");
  expect(on.getAttribute("aria-pressed")).toBe("true");

  /* Styling comes from tokens via classes, never inline -- the same check
   * every SP2 primitive carries. */
  expect(off.getAttribute("style")).toBeNull();
  expect(on.getAttribute("style")).toBeNull();
  expect(off.className).not.toBe(on.className);
  expect(on.className).toMatch(/choice-chip--on/);
});

test("type=button, so a chip inside a form selects instead of submitting", () => {
  render(
    <ChoiceChip selected={false} onClick={() => {}}>
      Colleague
    </ChoiceChip>,
  );
  expect(screen.getByRole("button", { name: "Colleague" }).getAttribute("type")).toBe("button");
});

test("clicking reports the choice", () => {
  const onClick = vi.fn();
  render(
    <ChoiceChip selected={false} onClick={onClick}>
      Already knew
    </ChoiceChip>,
  );
  screen.getByRole("button", { name: "Already knew" }).click();
  expect(onClick).toHaveBeenCalledTimes(1);
});
