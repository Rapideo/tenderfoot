/* THE COMPARISON, AND IT IS PURE.
 *
 * No network, no database, no clock. Everything this module needs is passed
 * in, which is what lets the whole verdict be tested against fixtures -- and
 * what keeps CLAUDE.md §5.1 satisfiable: none of these tests can reach the
 * metered API even by accident. */
import type { FeedNotice } from "./highergov-client.js";
import type { KeyEntry, Segment } from "./answer-key.js";

export type Carried = "carried" | "missing" | "unchecked";

export interface Observation {
  externalId: string;
  segment: Segment;
  carried: Carried;
  capturedDate: string | null;
  leadDays: number | null;
}

const DAY_MS = 86_400_000;

/* 🔴 R6, THE DUPLICATE PROBLEM. HigherGov versions notices (version_key), and
 * several source_id lookups returned count=2. Counting both would inflate
 * recall -- one carried notice appearing twice reads as two successes.
 *
 * The EARLIEST capture wins, not the latest: the question C2 asks is when
 * they FIRST carried it, because that is the moment a bidder could first have
 * seen it. Keeping the latest would penalise a source for re-publishing. */
export function dedupBySourceId(notices: FeedNotice[]): {
  notices: FeedNotice[];
  collapsed: number;
} {
  const best = new Map<string, FeedNotice>();
  let collapsed = 0;
  for (const n of notices) {
    const seen = best.get(n.externalId);
    if (!seen) {
      best.set(n.externalId, n);
      continue;
    }
    collapsed += 1;
    const a = seen.capturedDate;
    const b = n.capturedDate;
    if (a === null || (b !== null && b < a)) best.set(n.externalId, n);
  }
  return { notices: [...best.values()], collapsed };
}

/* Days remaining to bid at the moment HigherGov first carried it.
 *
 * MEASURED AGAINST THE DEADLINE, NEVER AGAINST WHEN IDOA PUBLISHED. HigherGov
 * scrapes more sources than IDOA and can legitimately carry a notice before
 * IDOA's own page shows it, which would make an IDOA-relative lead time
 * negative and meaningless. Deadline-relative is well-defined regardless of
 * who published first, and it is what a bidder actually experiences.
 *
 * Both inputs are bare YYYY-MM-DD (closes-at.ts and captured_date), so UTC
 * midnight on both sides cancels: no timezone can shift this by a day. */
export function leadDays(deadline: string | null, capturedDate: string | null): number | null {
  if (!deadline || !capturedDate) return null;
  const end = Date.parse(`${deadline}T00:00:00Z`);
  const start = Date.parse(`${capturedDate}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(start)) return null;
  return Math.round((end - start) / DAY_MS);
}

/* `checked` is the set of external ids this run actually asked about. It is a
 * parameter rather than something inferred from the feed, because "absent
 * from the feed" and "never queried" are the SAME observable and DIFFERENT
 * facts -- exactly the distinction document.extract_status exists for. Infer
 * it and an aborted run manufactures misses out of its own budget cap. */
export function observe(
  key: KeyEntry[],
  feed: FeedNotice[],
  checked: Set<string>,
): Observation[] {
  const byId = new Map(feed.map((n) => [n.externalId, n]));
  return key.map((entry) => {
    const hit = byId.get(entry.externalId);
    if (hit) {
      return {
        externalId: entry.externalId,
        segment: entry.segment,
        carried: "carried" as const,
        capturedDate: hit.capturedDate,
        leadDays: leadDays(entry.deadline, hit.capturedDate),
      };
    }
    return {
      externalId: entry.externalId,
      segment: entry.segment,
      carried: checked.has(entry.externalId) ? ("missing" as const) : ("unchecked" as const),
      capturedDate: null,
      leadDays: null,
    };
  });
}
