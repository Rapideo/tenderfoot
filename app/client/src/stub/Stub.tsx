import { Shell } from "../shell/Shell";
import { MicroLabel } from "../primitives";
import "./Stub.css";

/* ⚖️ RULING 2026-09-01 -- ALL SEVEN NAV ITEMS, EACH TO A STUB.
 *
 * The bundle's shell carries seven primary-nav entries; we shipped two. Matt
 * ruled for the bundle AND for the more expensive form of "inert": every
 * entry goes to a real screen that says what it will be, rather than being
 * disabled or -- worse -- clickable to nothing.
 *
 * WHY THE EXPENSIVE FORM IS THE RIGHT ONE HERE, and this is not decoration:
 * D14 was corrected for exactly the cheap failure. `View 1.3` shipped three
 * ShortcutCards that looked like navigation and carried no onClick, so the
 * screen was the dead end the SVRC's own line exists to prevent. Five inert
 * nav entries would be that same mistake, five times, on the shell itself.
 *
 * WHAT A STUB MAY AND MAY NOT SAY. Every word of `body` (see router.tsx)
 * comes from the SVRC's own Overview for that screen -- these are not
 * invented summaries, and a stub must never promise a capability the SVRC
 * does not describe. The `when` line states the slice or the gate, so a
 * reader learns WHEN as well as WHAT.
 *
 * ⚠️ THE FRAME IS SCREEN 2's, and getting that wrong is what the first cut
 * of this file did. It used <Section>, whose padding (20px 30px 24px) is the
 * two-up BAND's padding inside the triage card -- not a screen body's -- and
 * it skipped the card wrapper entirely. The result rendered as prose floating
 * on the canvas with the title outdented 30px from its own paragraph. No test
 * caught it; the screenshot did, which is CLAUDE.md §4's whole point. The
 * values below are .record's, token for token. */
export function Stub({
  title,
  when,
  body,
}: {
  title: string;
  when: string;
  body: string;
}) {
  return (
    <Shell>
      <div className="stub">
        <div className="stub__card">
          <div className="stub__head">
            <MicroLabel>{when}</MicroLabel>
            <h1 className="stub__title">{title}</h1>
          </div>
          <div className="stub__body">
            <p className="stub__para">{body}</p>
            {/* The honest bottom line, in the same words on every stub. A
              * reader who lands here by clicking the nav needs to know this
              * screen is not broken and not hidden behind a permission --
              * it does not exist yet. */}
            <p className="stub__note">
              This screen is not built. It is in the navigation because the design
              calls for it, and it says so here rather than leading nowhere.
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
