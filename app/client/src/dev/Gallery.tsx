/* The dev-only design-system gallery. Primitives arrive with SP2 Tasks 4-9,
 * each appending its own section (progress.md, Ruling 2: append-only, T9 is
 * the sole reorganiser).
 *
 * "dev-gallery-marker" below is not a UI string; it exists only so Task 3
 * step 4 can grep a production build for it. A string that cannot occur
 * anywhere else in the bundle turns "the guard in router.tsx works" from an
 * assumption into something a command either finds or does not. */
import "./Gallery.css";
import { Chip, Keycap, MicroLabel, StatusDot } from "../primitives";
import type { StatusDotState } from "../primitives";

const STATUS_STATES: StatusDotState[] = ["ok", "degraded", "rot", "off"];

export function Gallery() {
  return (
    <main>
      <h1>dev-gallery-marker — Design system gallery</h1>

      {/* Task 4 -- the atoms: micro-label, keycap, chip, status dot. Each
       * primitive's CSS declaration was matched against its exact
       * counterpart in the frozen bundle; see the CSS files under
       * ../primitives for the citations. */}
      <section className="gallery-section">
        <h2>Atoms</h2>

        <div className="gallery-section">
          <MicroLabel>DEADLINE</MicroLabel>
        </div>

        <div className="gallery-section gallery-ink-context">
          <div className="gallery-row">
            <Keycap>{"I"}</Keycap>
            <Keycap>ESC</Keycap>
          </div>
        </div>

        <div className="gallery-section">
          <div className="gallery-row">
            <Chip tone="neutral">RFP</Chip>
            <Chip tone="accent">IN · SUPPLIER PORTAL</Chip>
          </div>
        </div>

        <div className="gallery-section">
          <div className="gallery-row">
            {STATUS_STATES.map((state) => (
              <span className="gallery-status-item" key={state}>
                <StatusDot state={state} />
                <MicroLabel>{state.toUpperCase()}</MicroLabel>
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
