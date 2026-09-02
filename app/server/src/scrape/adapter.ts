/* The adapter framework (build inventory 2A).
 *
 * Every adapter takes `since` — this is what makes backfill and live the
 * same code path (§3.1). Adapters bind to PLATFORM + config, not
 * jurisdiction (§5.7).
 *
 * `modifiedAt` is the field the caller compares against the window. It is
 * named for what it is rather than "postedAt" because at least one real
 * source sorts only by modification date and silently ignores a request to
 * sort by publication date (see adapters/sam.ts).
 */
export type SourceShape = "windowed" | "snapshot";

export interface WindowedItem {
  externalId: string;
  modifiedAt: string;
  raw: unknown;
}

/* NO modifiedAt, and that is the whole point: an undated source must have
 * nowhere to put a fabricated date. See the design doc §2.1. */
export interface SnapshotItem {
  externalId: string;
  raw: unknown;
}

interface PageBase {
  nextCursor: string | null;
  requestUrl: string;
  httpStatus: number;
  payload: string;
}

export interface WindowedPage extends PageBase {
  items: WindowedItem[];
  /* Spec §5.4: sources degrade rather than fail. A record with no usable
   * date cannot be placed in the window and is excluded from `items`
   * rather than poisoning the low-water resume marker with an empty
   * string -- but it must not vanish silently. OPTIONAL so adapters that
   * cannot produce this (or never encounter it) are unaffected. */
  undatedSkipped?: number;
}

export interface SnapshotPage extends PageBase {
  items: SnapshotItem[];
  /* No undatedSkipped: there is no date to be missing, so the counter would
   * always read 0 and be mistaken for "we checked and found none". */
}

export interface WindowedAdapter {
  shape: "windowed";
  name: string;
  fetchListing(since: string, until: string, cursor: string | null): Promise<WindowedPage>;
}

export interface SnapshotAdapter {
  shape: "snapshot";
  name: string;
  fetchSnapshot(cursor: string | null): Promise<SnapshotPage>;
}

export type Adapter = WindowedAdapter | SnapshotAdapter;

export function isSnapshot(a: Adapter): a is SnapshotAdapter {
  return a.shape === "snapshot";
}

/** @deprecated Kept so existing importers keep compiling. Use WindowedItem. */
export type ListingItem = WindowedItem;
/** @deprecated Kept so existing importers keep compiling. Use WindowedPage. */
export type ListingPage = WindowedPage;
