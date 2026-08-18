// @vitest-environment jsdom
import { expect, test, beforeEach } from "vitest";
import { getAdminSecret, clearAdminSecret, adminHeaders } from "./adminSecret.js";

beforeEach(() => sessionStorage.clear());

test("the secret is asked for once and reused", () => {
  let asks = 0;
  const ask = () => { asks++; return "s3cret"; };
  expect(getAdminSecret(ask)).toBe("s3cret");
  expect(getAdminSecret(ask)).toBe("s3cret");
  expect(asks).toBe(1);
});

test("a cancelled prompt returns null and is not stored", () => {
  expect(getAdminSecret(() => null)).toBeNull();
  expect(sessionStorage.length).toBe(0);
});

/* On a 401 the held value is wrong; keeping it would make every later click
 * fail silently with no way to correct it. */
test("clearing forces the next call to ask again", () => {
  getAdminSecret(() => "old");
  clearAdminSecret();
  expect(getAdminSecret(() => "new")).toBe("new");
});

test("headers carry the secret under the name the server checks", () => {
  expect(adminHeaders("abc")["X-Admin-Secret"]).toBe("abc");
});
