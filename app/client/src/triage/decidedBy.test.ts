// @vitest-environment jsdom
import { expect, test, beforeEach } from "vitest";
import { getDecidedBy } from "./decidedBy.js";

beforeEach(() => sessionStorage.clear());

test("decided_by is asked for once and reused", () => {
  let asks = 0;
  const ask = () => { asks++; return "matt"; };
  expect(getDecidedBy(ask)).toBe("matt");
  expect(getDecidedBy(ask)).toBe("matt");
  expect(asks).toBe(1);
});

test("a cancelled prompt returns null and is not stored", () => {
  expect(getDecidedBy(() => null)).toBeNull();
  expect(sessionStorage.length).toBe(0);
});

test("a seeded sessionStorage value is used without prompting", () => {
  sessionStorage.setItem("tenderfoot.decidedBy", "seeded-name");
  let asks = 0;
  const ask = () => { asks++; return "should not be called"; };
  expect(getDecidedBy(ask)).toBe("seeded-name");
  expect(asks).toBe(0);
});
