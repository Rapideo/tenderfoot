import { expect, test } from "vitest";
import { fakeAdapter } from "./fake.js";

test("pages through a fixed corpus and then reports no cursor", async () => {
  const a = fakeAdapter(5, 2);
  const p1 = await a.fetchListing("2026-01-01", "2026-12-31", null);
  expect(p1.items).toHaveLength(2);
  expect(p1.nextCursor).toBe("2");

  const p2 = await a.fetchListing("2026-01-01", "2026-12-31", p1.nextCursor);
  expect(p2.items).toHaveLength(2);

  const p3 = await a.fetchListing("2026-01-01", "2026-12-31", p2.nextCursor);
  expect(p3.items).toHaveLength(1);
  expect(p3.nextCursor).toBeNull();
});

test("items carry a stable external id and a modifiedAt", async () => {
  const a = fakeAdapter(1, 10);
  const items = (await a.fetchListing("2026-01-01", "2026-12-31", null)).items;
  const item = items[0];
  if (!item) throw new Error("Expected at least one item");
  expect(item.externalId).toBe("fake-0");
  expect(item.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

/* Mirrors the real source (spec: corpus/calibration/pull-naics.py sorts
 * `-modifiedDate`) -- SAM.gov pages descending, newest first. The fixture
 * must reproduce that direction, or a resume-marker direction bug (tracking
 * max instead of min) is invisible to every test that uses it. */
test("modifiedAt descends monotonically as the index increases, within and across pages", async () => {
  const a = fakeAdapter(5, 2);
  const p1 = await a.fetchListing("2026-01-01", "2026-12-31", null);
  const p2 = await a.fetchListing("2026-01-01", "2026-12-31", p1.nextCursor);
  const p3 = await a.fetchListing("2026-01-01", "2026-12-31", p2.nextCursor);
  const all = [...p1.items, ...p2.items, ...p3.items];

  expect(all.map((i) => i.externalId)).toEqual(["fake-0", "fake-1", "fake-2", "fake-3", "fake-4"]);
  for (let i = 1; i < all.length; i++) {
    expect(all[i]!.modifiedAt < all[i - 1]!.modifiedAt).toBe(true);
  }
});
