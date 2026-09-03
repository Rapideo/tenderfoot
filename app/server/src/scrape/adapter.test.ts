import { expect, test } from "vitest";
import { isSnapshot, type Adapter, type SnapshotAdapter, type SnapshotItem } from "./adapter.js";

const snap: SnapshotAdapter = {
  shape: "snapshot",
  name: "stub",
  async fetchSnapshot() {
    return { items: [], nextCursor: null, requestUrl: "x", httpStatus: 200, payload: "" };
  },
};

test("isSnapshot narrows the union", () => {
  const a: Adapter = snap;
  expect(isSnapshot(a)).toBe(true);
  if (isSnapshot(a)) {
    /* Compiles only because the guard narrowed it -- a windowed adapter has
     * no fetchSnapshot. This is the assertion the whole type split exists
     * for, and it is checked by tsc, not at runtime. */
    expect(typeof a.fetchSnapshot).toBe("function");
  }
});

test("a snapshot item cannot carry a date", () => {
  // SnapshotItem has no modifiedAt, and that is the point of the type
  // split: fabricating a date must be structurally impossible. If someone
  // widens SnapshotItem, this line stops erroring and the ts-expect-error
  // directive below itself becomes the failure.
  // @ts-expect-error -- see above
  const bad: SnapshotItem = { externalId: "a", raw: {}, modifiedAt: "2026-01-01" };
  expect(bad.externalId).toBe("a");
});
