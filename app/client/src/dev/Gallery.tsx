/* The dev-only design-system gallery. Primitives arrive with SP2 Tasks 4-9,
 * each appending its own section (progress.md, Ruling 2: append-only, T9 is
 * the sole reorganiser).
 *
 * "dev-gallery-marker" below is not a UI string; it exists only so Task 3
 * step 4 can grep a production build for it. A string that cannot occur
 * anywhere else in the bundle turns "the guard in router.tsx works" from an
 * assumption into something a command either finds or does not. */
import "./Gallery.css";
import { Button, Chip, Keycap, MicroLabel, StatusDot } from "../primitives";
import type { ButtonVariant, StatusDotState } from "../primitives";

const STATUS_STATES: StatusDotState[] = ["ok", "degraded", "rot", "off"];

/* Button copy is reproduced character-for-character from the bundle
 * instance each variant was matched against (see Button.css): interestIt
 * ("Interested"), passIt ("Pass"), openDetail ("Open full detail →"),
 * markRead ("CLEAR"). */
const BUTTON_EXAMPLES: Record<ButtonVariant, string> = {
  primary: "Interested",
  secondary: "Pass",
  tertiary: "Open full detail →",
  ghost: "CLEAR",
};
const BUTTON_VARIANTS: ButtonVariant[] = ["primary", "secondary", "tertiary", "ghost"];

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

      {/* Task 5 -- Button, in the four styles the bundle's 49 <button>
       * elements actually contain (primary/secondary/ghost from the brief,
       * plus tertiary -- a fourth recurring style the brief did not name;
       * see Button.css and task-5-report.md). Appended after Atoms per the
       * gallery's append-only rule; Task 4's section above is untouched. */}
      <section className="gallery-section">
        <h2>Button</h2>

        <div className="gallery-section">
          <div className="gallery-row">
            {BUTTON_VARIANTS.map((variant) => (
              <span className="gallery-button-item" key={variant}>
                <MicroLabel>{variant.toUpperCase()}</MicroLabel>
                <Button variant={variant}>{BUTTON_EXAMPLES[variant]}</Button>
              </span>
            ))}
          </div>
        </div>

        <div className="gallery-section">
          <div className="gallery-row">
            {BUTTON_VARIANTS.map((variant) => (
              <span className="gallery-button-item" key={`${variant}-disabled`}>
                <MicroLabel>{variant.toUpperCase()}, DISABLED</MicroLabel>
                <Button variant={variant} disabled>
                  {BUTTON_EXAMPLES[variant]}
                </Button>
              </span>
            ))}
          </div>
        </div>

        {/* size="sm" (Ruling 9, added on review): a second, smaller
         * primary/secondary cluster -- saveView ("Save changes", editor
         * footer) and closeEditor ("Cancel", editor footer) -- purpose-named
         * by --radius-button and --type-ui-action(-primary), which had zero
         * consumers before this. sm secondary's colour is var(--text4), a
         * real step down from default secondary's var(--text3), not just a
         * smaller size -- see Button.css. */}
        <div className="gallery-section">
          <div className="gallery-row">
            <span className="gallery-button-item">
              <MicroLabel>PRIMARY, SM</MicroLabel>
              <Button variant="primary" size="sm">
                Save changes
              </Button>
            </span>
            <span className="gallery-button-item">
              <MicroLabel>SECONDARY, SM</MicroLabel>
              <Button variant="secondary" size="sm">
                Cancel
              </Button>
            </span>
          </div>
        </div>

        <p className="gallery-note">
          Hover: the bundle declares exactly two hover treatments across all
          49 buttons (background:var(--hover) on table/list rows,
          color:var(--inktx4) on the command-bar avatar) -- neither applies
          to primary, secondary, tertiary, or ghost. None was invented for
          them here; see task-5-report.md.
        </p>
      </section>
    </main>
  );
}
