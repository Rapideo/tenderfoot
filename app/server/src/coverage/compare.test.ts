import { expect, test } from "vitest";
import { dedupBySourceId, leadDays, observe } from "./compare.js";
import type { KeyEntry } from "./answer-key.js";
import type { FeedNotice } from "./highergov-client.js";

const key = (externalId: string, deadline: string | null = "2026-09-30"): KeyEntry => ({
  externalId,
  segment: "state_agency",
  keyOrigin: "Indiana IDOA solicitations",
  deadline,
});

const notice = (externalId: string, capturedDate: string | null = "2026-09-03"): FeedNotice => ({
  externalId,
  capturedDate,
  versionKey: "v1",
  title: "t",
});

/* 🔴 R6: "several source_id lookups returned count=2" -- versioning, via
 * version_key. Without this, one carried notice counts twice and inflates
 * recall. */
test("two versions of one notice collapse to one, and the collapse is counted", () => {
  const out = dedupBySourceId([
    { ...notice("003000000088067"), versionKey: "v1" },
    { ...notice("003000000088067"), versionKey: "v2" },
    notice("003000000088191"),
  ]);
  expect(out.notices).toHaveLength(2);
  expect(out.collapsed).toBe(1);
});

test("dedup keeps the EARLIEST capture, because that is when they first carried it", () => {
  const out = dedupBySourceId([
    notice("003000000088067", "2026-09-05"),
    notice("003000000088067", "2026-09-01"),
  ]);
  expect(out.notices[0]!.capturedDate).toBe("2026-09-01");
});

test("lead time is days from capture to deadline", () => {
  expect(leadDays("2026-09-30", "2026-09-03")).toBe(27);
});

test("lead time is null when either side is missing, never zero", () => {
  expect(leadDays(null, "2026-09-03")).toBeNull();
  expect(leadDays("2026-09-30", null)).toBeNull();
});

/* A notice carried AFTER its deadline is a negative lead time, and that is a
 * real reading rather than an error: it says they carried it too late to bid. */
test("a notice carried after its deadline gives a negative lead time", () => {
  expect(leadDays("2026-09-01", "2026-09-03")).toBe(-2);
});

/* 🔴 THE ONE THAT CANNOT BE UNDONE (final review, item 2). Nothing in this
 * repo pins the vendor's response shape -- only a hand-authored fixture. If
 * captured_date ever comes back as a full timestamp instead of a bare date,
 * unsliced Date.parse chokes on the doubled "T...Z" and returns NaN for
 * EVERY row: every leadDays turns null, every carried notice reads untimely,
 * and C2 -- the gate -- reads 0.0 and fails on a formatting artifact. It does
 * not self-heal, because a notice settled `carried` is never re-asked. */
test("a timestamp-shaped capturedDate gives the same lead time as the bare-date form", () => {
  expect(leadDays("2026-09-30", "2026-09-03T12:00:00Z")).toBe(leadDays("2026-09-30", "2026-09-03"));
  expect(leadDays("2026-09-30", "2026-09-03T12:00:00Z")).toBe(27);
});

/* The deadline side gets the same treatment -- closes-at.ts is trusted to
 * emit a bare date today, but the guard is symmetric on purpose. */
test("a timestamp-shaped deadline gives the same lead time as the bare-date form", () => {
  expect(leadDays("2026-09-30T23:59:00Z", "2026-09-03")).toBe(leadDays("2026-09-30", "2026-09-03"));
});

test("a notice in the key and in the feed is carried", () => {
  const out = observe([key("A")], [notice("A")], new Set(["A"]));
  expect(out[0]!.carried).toBe("carried");
  expect(out[0]!.leadDays).toBe(27);
});

test("a notice in the key, checked, and absent from the feed is missing", () => {
  const out = observe([key("A")], [], new Set(["A"]));
  expect(out[0]!.carried).toBe("missing");
  expect(out[0]!.leadDays).toBeNull();
});

/* 🔴 THE ASSERTION THAT KEEPS AN ABORTED RUN HONEST. A notice we never
 * queried is NOT a miss. Counting it as one would manufacture coverage decay
 * out of our own budget cap and un-shelve the adapter backlog for no reason. */
test("a notice never queried is unchecked, not missing", () => {
  const out = observe([key("A")], [], new Set());
  expect(out[0]!.carried).toBe("unchecked");
});

test("feed rows with no matching key entry are ignored, not invented as extras", () => {
  const out = observe([key("A")], [notice("A"), notice("ZZZ")], new Set(["A"]));
  expect(out).toHaveLength(1);
});
