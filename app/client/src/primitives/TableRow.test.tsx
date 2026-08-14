// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { TableRow } from "./TableRow";

/* columns is per-screen data (the bundle's rows use a different
 * grid-template-columns per list -- task-8-brief.md), not a design literal,
 * same class of exception ScoreBar.tsx documents for its fill's width. It
 * must land as this row's own grid-template-columns. No commas in the test
 * value -- jsdom/CSSOM can reformat a comma-bearing value like
 * "minmax(200px,1fr) ..." on the way back out, which would make this
 * assertion fragile for a reason that has nothing to do with the
 * component. */
test("columns become the row's grid-template-columns -- data, not a token", () => {
  const { unmount } = render(
    <TableRow columns="200px 120px 84px 112px 112px">
      <span>Indiana EDS Contracts</span>
    </TableRow>,
  );
  const row = screen.getByText("Indiana EDS Contracts").closest(".table-row") as HTMLElement;
  expect(row.style.gridTemplateColumns).toBe("200px 120px 84px 112px 112px");
  unmount();
});

test("with no background prop, the row sets no background -- it takes whatever the surface under it supplies, not a literal default", () => {
  const { unmount } = render(
    <TableRow columns="1fr 1fr">
      <span>Cell</span>
    </TableRow>,
  );
  const row = screen.getByText("Cell").closest(".table-row") as HTMLElement;
  expect(row.style.background).toBe("");
  unmount();
});

/* background, like columns, is caller-supplied data -- every {{ x.bg }}
 * binding in the bundle's own per-row lists (fields, docs, notes, saved
 * views) resolves to a token reference (var(--surface), var(--accbg2),
 * var(--badbg2)...), never a literal hex, confirmed by reading the bundle's
 * own mock arrays. This component does not choose that value; it only
 * carries whatever the caller already resolved from a token. */
test("background, when given, is applied verbatim", () => {
  const { unmount } = render(
    <TableRow columns="1fr 1fr" background="var(--accent-wash-2)">
      <span>Cell</span>
    </TableRow>,
  );
  const row = screen.getByText("Cell").closest(".table-row") as HTMLElement;
  expect(row.style.background).toBe("var(--accent-wash-2)");
  unmount();
});

test("renders children directly as grid cells -- no per-cell wrapper injected", () => {
  const { unmount } = render(
    <TableRow columns="1fr 1fr 1fr">
      <span>A</span>
      <span>B</span>
      <span>C</span>
    </TableRow>,
  );
  const row = document.querySelector(".table-row") as HTMLElement;
  expect(row.children.length).toBe(3);
  expect(Array.from(row.children).map((c) => c.textContent)).toEqual(["A", "B", "C"]);
  unmount();
});

test("carries the row-separator class -- token-driven border, not a literal", () => {
  const { unmount } = render(
    <TableRow columns="1fr">
      <span>Cell</span>
    </TableRow>,
  );
  const row = screen.getByText("Cell").closest(".table-row") as HTMLElement;
  expect(row.className).toMatch(/table-row/);
  unmount();
});
