import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { idoaKeyFrom } from "./answer-key.js";

/* The committed IDOA fixture the adapter's own tests already use. Reused
 * rather than copied: a second copy would drift from the first. */
const FIXTURE = readFileSync(
  fileURLToPath(new URL("../scrape/adapters/fixtures/idoa-listing.html", import.meta.url)),
  "utf8",
);

test("every row on the page becomes a key entry", () => {
  const key = idoaKeyFrom(FIXTURE);
  expect(key.length).toBeGreaterThan(0);
});

test("IDOA rows are the state-agency segment and carry the page as their origin", () => {
  const key = idoaKeyFrom(FIXTURE);
  for (const entry of key) {
    expect(entry.segment).toBe("state_agency");
    expect(entry.keyOrigin).toBe("Indiana IDOA solicitations");
  }
});

/* The deadline is parsed by merge/closes-at.ts, which already handles IDOA's
 * "09/03/2026 10:00:00AM EST" shape and returns a bare YYYY-MM-DD. Writing a
 * second date parser here is how two implementations of one question start
 * to drift. */
test("deadlines are parsed to bare ISO dates, not invented timestamps", () => {
  const key = idoaKeyFrom(FIXTURE);
  const withDeadline = key.filter((e) => e.deadline !== null);
  expect(withDeadline.length).toBeGreaterThan(0);
  for (const entry of withDeadline) {
    expect(entry.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
});

/* A row whose due-date cell is unparseable must yield a NULL deadline, never
 * a guess. closes-at.ts's own header: "a wrong deadline sorts and filters the
 * queue on a lie, where a null deadline just sorts last and says nothing." */
test("an unparseable due date yields null rather than a guess", () => {
  const key = idoaKeyFrom(
    `<table><thead><tr><th>Event Name</th><th>Agency</th><th>Event ID</th>` +
      `<th>Event Description</th><th>Response Due By</th><th>Contact</th></tr></thead>` +
      `<tbody><tr><td>Thing</td><td>DNR</td><td>003000000099999</td>` +
      `<td>d</td><td>TBD</td><td>c</td></tr></tbody></table>`,
  );
  expect(key).toHaveLength(1);
  expect(key[0]!.deadline).toBeNull();
});

test("external ids come from the Event ID column", () => {
  const key = idoaKeyFrom(FIXTURE);
  expect(key.some((e) => /^\d{15}$/.test(e.externalId))).toBe(true);
});
