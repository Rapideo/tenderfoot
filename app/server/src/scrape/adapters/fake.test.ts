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
  const [item] = (await a.fetchListing("2026-01-01", "2026-12-31", null)).items;
  expect(item.externalId).toBe("fake-0");
  expect(item.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
});
