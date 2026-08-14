import "./GatedDrawer.css";

/* The collapsed toggle chip above the bundle's gated-items drawer (V1.2,
 * index ~567216, the triage screen's decision-bar footer):
 *
 *   <button sc-camel-on-click="{{ toggleDrawer }}" style="border:1px solid
 *     var(--brdctl3);background:var(--chip2);border-radius:6px;
 *     padding:8px 11px;font:500 11px/1 'IBM Plex Mono';letter-spacing:.06em;
 *     color:var(--text4)">{{ drawerLabel }}</button>
 *
 *   drawerLabel: (s.drawerOpen ? "▾ " : "▸ ") + count + " GATED ITEMS"
 *
 * Only the chip is reproduced here -- not the panel it discloses (header
 * "GATED ITEMS — FILED, NOT DELETED (§6.2)" plus a list of gated-item
 * rows, each with a gate-reason badge and a Restore button). SVRC Region
 * 1.1.5 settles this directly rather than leaving it to interpretation:
 * "Parked 2026-08-11. V1 has no gates, so nothing is gated and the drawer
 * has no contents." A faithful V1 rendering of the open drawer would show
 * nothing anyway -- there is no row content for the caret to reveal, this
 * task's interface (`count` alone) carries none, and a working Restore is
 * exactly the kind of live control this task must not wire up.
 *
 * So this is permanently the CLOSED state: the caret is always "▸", never
 * "▾", because there is nothing here that can open. No onClick either --
 * same pattern Button already establishes (a real, unwired <button>, ready
 * for a later slice to wire), not a click handler bound to nothing. */
export function GatedDrawer({ count }: { count: number }) {
  return (
    <button type="button" className="gated-drawer">
      {`▸ ${count} GATED ITEMS`}
    </button>
  );
}
