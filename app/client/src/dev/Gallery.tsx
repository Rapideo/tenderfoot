/* The dev-only design-system gallery. Primitives arrive with SP2 Tasks 4-9,
 * each appending its own section (progress.md, Ruling 2: append-only, T9 is
 * the sole reorganiser).
 *
 * "dev-gallery-marker" below is not a UI string; it exists only so Task 3
 * step 4 can grep a production build for it. A string that cannot occur
 * anywhere else in the bundle turns "the guard in router.tsx works" from an
 * assumption into something a command either finds or does not. */
import "./Gallery.css";
import {
  Button,
  Callout,
  Card,
  Chip,
  FactPanel,
  FactTile,
  Keycap,
  MicroLabel,
  ShortcutCard,
  StatusDot,
} from "../primitives";
import type { ButtonVariant, StatusDotState } from "../primitives";

const STATUS_STATES: StatusDotState[] = ["ok", "degraded", "rot", "off"];

/* Task 6 copy, reproduced character-for-character from the bundle (see
 * Callout.css and FactPanel.css for the exact declarations these were
 * matched against). The naspo-ogs mock record supplies both the fact trio
 * and the callout below -- the same real record the bundle pairs them on. */
const CALLOUT_COPY =
  "Listed on Indiana's portal — the buyer is NY OGS, not Indiana. Cooperative award, participating states TBD.";
const FACT_PANEL_TITLE = "COST TO PURSUE — FACTS, NOT A SCORE";
const FACT_PANEL_NOTE = "Counted from the bundle. The light/moderate/heavy call is yours.";

/* Ruling 11 (SP2 T6 review): ShortcutCard's copy, reproduced
 * character-for-character from the bundle's goRadars/goReports buttons
 * (see ShortcutCard.css). */
const SHORTCUT_CARDS = [
  { title: "3 contracts expire inside your sectors", description: "Expiration radar — re-competes, months early" },
  { title: "Next ingest at 06:00", description: "4 sources · last run clean" },
];

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

      {/* Task 6 -- surfaces: Card, FactTile, FactPanel, Callout. Appended
       * after Button per the gallery's append-only rule; Tasks 4-5's
       * sections above are untouched. */}
      <section className="gallery-section">
        <h2>Surfaces</h2>

        {/* Card -- the raised surface everything else sits on, matched
         * against the bundle's triage/detail card (task-6-report.md), which
         * itself wraps a FactTile trio and a Callout -- the composition
         * reproduced here, using the naspo-ogs mock record's real copy.
         *
         * ShortcutCard sits beside it deliberately (Ruling 11, SP2 T6
         * review): the bundle evidences a second, flatter card-shaped role
         * (goRadars/goReports) that Card's children-only interface cannot
         * express, because the bundle element is semantically a <button>,
         * not a container -- see ShortcutCard.css. The ONLY visual
         * difference from Card is the absent box-shadow, easy to miss
         * unless the two sit side by side, which is why they are placed
         * here rather than in a section of their own. */}
        <div className="gallery-section">
          <div className="gallery-row gallery-row--align-top">
            <span className="gallery-panel-item">
              <MicroLabel>CARD, WRAPPING A FACT TILE TRIO + CALLOUT</MicroLabel>
              <div className="gallery-card-demo">
                <Card>
                  <div className="gallery-card-body">
                    <Callout>{CALLOUT_COPY}</Callout>
                    <div className="gallery-fact-trio">
                      <FactTile
                        label="DEADLINE"
                        value="2026-08-27"
                        sub="17 days out · 3:00 PM EDT"
                        emphasis
                      />
                      <FactTile label="EST. VALUE" value="$12M+" sub="Multi-state, no ceiling stated" />
                      <FactTile label="POSTED" value="2026-07-14" sub="No addenda" />
                    </div>
                  </div>
                </Card>
              </div>
            </span>
            <span className="gallery-panel-item">
              <MicroLabel>SHORTCUT CARD -- SAME BORDER/RADIUS FAMILY, NO BOX-SHADOW</MicroLabel>
              <div className="gallery-shortcut-stack">
                {SHORTCUT_CARDS.map((card) => (
                  <ShortcutCard key={card.title} title={card.title} description={card.description} />
                ))}
              </div>
            </span>
          </div>
        </div>

        {/* FactPanel -- "COST TO PURSUE — FACTS, NOT A SCORE" is an
         * argument, not a label: the panel exists to present facts a person
         * judges, explicitly not a computed score (task-6-brief.md). Both a
         * populated and an empty panel are shown -- absence is a distinct
         * state from low confidence (SVRC View 2.3), and with V1 shipping
         * no scores, the empty case is the common one, not an edge case.
         * The populated example's six facts are the bundle's own costFacts
         * mock data; the two "warn" facts (Pre-proposal conference,
         * Notarization required) use `emphasis`. */}
        <div className="gallery-section">
          <div className="gallery-row gallery-row--align-top">
            <span className="gallery-panel-item">
              <MicroLabel>POPULATED</MicroLabel>
              <Card>
                <div className="gallery-card-body">
                  <FactPanel title={FACT_PANEL_TITLE} note={FACT_PANEL_NOTE}>
                    <FactTile label="Required forms" value="7" />
                    <FactTile label="Pre-proposal conference" value="Mandatory" emphasis />
                    <FactTile label="References demanded" value="3" />
                    <FactTile label="Notarization required" value="Yes" emphasis />
                    <FactTile label="Page limit" value="40 pp" />
                    <FactTile label="Sealed copies + USB" value="2" />
                  </FactPanel>
                </div>
              </Card>
            </span>
            <span className="gallery-panel-item">
              <MicroLabel>EMPTY</MicroLabel>
              <Card>
                <div className="gallery-card-body">
                  <FactPanel title={FACT_PANEL_TITLE} note={FACT_PANEL_NOTE} />
                </div>
              </Card>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
