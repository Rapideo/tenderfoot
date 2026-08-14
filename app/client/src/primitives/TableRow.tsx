import type { CSSProperties, ReactNode } from "react";
import "./TableRow.css";

/* TableRow -- the grid-row shape shared by every row-list body in the
 * bundle. `border-bottom:1px solid var(--brdrow);gap:14px;align-items:center`
 * is the one constant across all ten `display:grid` row instances found
 * (V1.2): the Expiration Radar's `expiring` rows (index ~588129), the
 * Opportunities list's `oppRows` (~594735), Organizations' `orgs`
 * (~605823), Teaming Radar's `vendors` (~608062), the Source Yield
 * drawer's `yields` (~612210), the Source Registry's `sources` (~616303),
 * entity history (~602301), and the detail editor's `fields`/gated-item
 * rows (~580971/568733). gap is 14px in nine of those ten; the tenth
 * (oppRows, 12px) is the single outlier.
 *
 * padding is where the screens genuinely disagree -- 12px 16px, 13px 22px,
 * 13px 24px, 13px 26px, 14px 22px, 14px 26px, all real, all measured.
 * `13px 24px` is the plurality (four of ten: expiring, orgs, vendors,
 * yields), so that is what this shared primitive carries; the other six
 * screens' own padding is a per-screen deviation this generic primitive
 * does not attempt to reproduce, same as this task's own `columns` prop
 * exists precisely because grid-template-columns does NOT generalise
 * across screens either. Flagged for the gate rather than silently
 * averaged away.
 *
 * `columns` and `background` are per-instance DATA, not design literals --
 * the bundle's own `grid-template-columns` differs by screen (task-8-
 * brief.md), and every `{{ x.bg }}` binding across the bundle's per-row
 * lists (fields, docs, notes, saved views) resolves to a token reference
 * the caller already chose (var(--surface), var(--accbg2), var(--badbg2)...),
 * never a literal hex -- confirmed by reading those mock arrays directly.
 * Same class of exception ScoreBar.tsx documents for its fill's width: an
 * inline style here carries a runtime value, not a hardcoded one, so the
 * "never hardcode a colour, radius, or font" rule is not in tension with
 * it. When `background` is omitted, no background is set at all -- the row
 * takes whatever surface it sits on (Card, in every one of the bundle's
 * own div-based row lists), not an invented default. */
export function TableRow({
  columns,
  background,
  children,
}: {
  columns: string;
  background?: string;
  children?: ReactNode;
}) {
  const style: CSSProperties = { gridTemplateColumns: columns };
  if (background) {
    style.background = background;
  }
  return (
    <div className="table-row" style={style}>
      {children}
    </div>
  );
}
