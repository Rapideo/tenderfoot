/* The dev-only design-system gallery -- SP2's sign-off instrument. Every
 * primitive from Tasks 4-8 landed here across six commits, each one
 * APPENDING its own section (progress.md Ruling 2: append-only, "T9 is the
 * sole reorganiser"). This is that one reorganisation: everything below is
 * grouped as Atoms / Surfaces / Intelligence / Chrome (task-9-brief.md step
 * 1), not as the six arrival-order sections it used to be. No primitive's
 * behaviour, props, or rendered state changed to do this -- only where each
 * one sits on the page and what surrounds it.
 *
 * "dev-gallery-marker" below is not a UI string; it exists only so
 * scripts/check.mjs can grep a production build for it -- and, as of this
 * task, so the SAME script can grep THIS FILE for it too. Deleting this
 * string used to make the absence-from-build check pass vacuously (nothing
 * to find is not the same as nothing shipped): checkGalleryMarkerAbsentFrom
 * Build() would report success even if /dev/gallery reached production,
 * simply because the marker it was told to look for no longer existed
 * anywhere (progress.md, Task 3 minor, carried into Task 9 -- "same shape as
 * a test that cannot fail"). checkGalleryMarkerPresentInSource() closes that
 * gap by asserting the opposite fact. Reorganising this exact file is
 * precisely when that string is most likely to be edited away by accident
 * -- do not delete it. */
import "./Gallery.css";
import {
  Button,
  Callout,
  Card,
  Chip,
  FactPanel,
  FactTile,
  GatedDrawer,
  HeaderLockup,
  Keycap,
  MicroLabel,
  ScoreStrip,
  ShortcutCard,
  StatusBar,
  StatusDot,
  TableRow,
} from "../primitives";
import type { ButtonVariant, StatusDotState } from "../primitives";

const STATUS_STATES: StatusDotState[] = ["ok", "degraded", "rot", "off"];

/* Comparison affordance (task-9-brief.md step 3): the exact frozen-bundle
 * filename, cited once here rather than re-typed (and risking a typo) in
 * every group's compare note below. Two other files sit in the same
 * directory with near-identical names -- an unversioned "Tenderfoot UI
 * Mockups.html" and "Tenderfoot UI Mockups V1,1.html" (a comma, not a
 * period) -- and neither is the parity target. Getting the filename wrong
 * would mean comparing against a stale bundle without any error to catch
 * it, so naming the real one exactly, once, is the point. */
const FROZEN_BUNDLE_PATH = "prototype/PROTOTYPE/Tenderfoot UI Mockups V1.2.html";

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

/* Task 7 -- the intelligence chrome, built inert. THESE ARE BUILT AND
 * RENDERED. THEY ARE NOT WIRED, AND MUST NOT BECOME WIRED (Matt,
 * 2026-08-13; design spec §7.10 clause 2 superseded to require it).
 *
 * SCORE_STRIP_EXAMPLE is NOT invented: it is the bundle's own first mock
 * opportunity record (V1.2, index ~627585, id "in-fssa-ltss"), reproduced
 * verbatim -- Fit 84 / Winnability 61 / Value 72 / Timing 48 -- and
 * labelled illustrative below rather than presented as a live result. No
 * fixture anywhere in this file supplies a score V1 would not actually
 * have (task-7-brief.md, progress.md Ruling 3). These four land in the
 * fill's POS/MID tiers only (none below 45); the LOW/--signal-caution tier
 * is covered by ScoreBar.test.tsx, not by this gallery -- flagged in
 * task-7-report.md.
 *
 * SCORE_STRIP_EMPTY is the actual V1 state: the assessment table is empty
 * by design (design spec §1.1) and stays empty, so every real ScoreStrip
 * render in the shipped product looks like this one, not like the
 * illustrative example beside it. */
const SCORE_STRIP_EXAMPLE = [
  { label: "Fit", value: 84 },
  { label: "Winnability", value: 61 },
  { label: "Value", value: 72 },
  { label: "Timing", value: 48 },
];
const SCORE_STRIP_EMPTY = [
  { label: "Fit", value: null },
  { label: "Winnability", value: null },
  { label: "Value", value: null },
  { label: "Timing", value: null },
];

/* GatedDrawer's count=4 mirrors the bundle's own GATED mock array length
 * (V1.2, the triage screen's four hard-gate examples) -- illustrative, not
 * a claim V1 gates anything. count=0 is V1's actual state: SVRC Region
 * 1.1.5 records "V1 has no gates, so nothing is gated and the drawer has
 * no contents", the same shape as ScoreBar's value=null. */
const GATED_DRAWER_EXAMPLE_COUNT = 4;

/* Standing note (task-9-brief.md step 2): rendered ABOVE the Intelligence
 * group's demos, not after them -- a reviewer looking at a populated score
 * bar should not have to scroll past it to be told what it is. Content is
 * fixed: built-and-not-wired, V1 renders the empty state, and the
 * qualification gate, citing design spec §1.1 ("§1.1 parks matching as
 * undesigned, not as pending work") and its own §7.10 clause 2 (superseded
 * 2026-08-13 to require these controls exist, inert, rather than be
 * omitted). Not the `Callout` primitive: Callout is matched against one
 * specific bundle instance -- the buyerNote entity-resolution finding --
 * and reusing it here for an unrelated process note would misuse a
 * primitive whose whole identity is that one bundle citation. */
const STANDING_NOTE = (
  <p className="gallery-note gallery-standing-note">
    <strong>Read this before the score bars below, not after.</strong> Every
    control in this group is built and rendered. None is wired, and none may
    become wired: a rendered control here may never become a live filter,
    ranking, or score until qualification is designed. Design spec §1.1 parks
    matching as <strong>undesigned</strong>, not as pending work -- shipping
    inert filter chrome puts a wired-up switch one small commit away from
    existing, and that commit is the failure this note exists to prevent.
    V1 renders the empty state: the <code>assessment</code> table is empty by
    design and stays that way, so the "V1 RENDERS THIS STATE" examples below
    -- not the illustrative ones beside them -- are what every real render in
    the shipped product looks like.
  </p>
);

/* Task 8 -- rows and chrome: TableRow, StatusBar, HeaderLockup.
 *
 * SOURCES_EXAMPLE is the bundle's own Source Registry array, verbatim
 * (V1.2, index ~700536) -- name/platform/tier/legal/health for all five
 * mock sources, not invented. SOURCE_ROW_COLUMNS and SOURCE_ROW_PADDING are
 * that same list's own grid-template-columns and padding (index ~616303):
 * minmax(200px,1fr) 120px 84px 112px 112px, 13px 22px -- the exact citation
 * TableRow.tsx documents, and (per Ruling 14, SP2 T8 review) now passed as
 * the `padding` override rather than left at the component's 13px 24px
 * default, which this list's own bundle instance does not actually use.
 * The coloured legal-status badge and the column-header row the bundle
 * wraps this list in are separate, unbuilt elements out of this task's
 * scope ("these three only" -- task-8-brief.md), so each cell here is
 * plain text, not a claim of full-screen fidelity.
 *
 * ENTITY_OPPS_ROW_* is a second, independent padding citation (index
 * ~603268, "Live opportunities" nested inside an entity profile): columns
 * minmax(0,1.9fr) minmax(0,.7fr) minmax(0,.7fr), padding 14px 26px --
 * demonstrating the override is general-purpose, not something only the
 * Source Registry needed. Cell content is neutral placeholder text, not
 * bundle data (the `ent.opps` array's own field values were not captured),
 * kept honestly generic rather than invented as if it were.
 *
 * STATUS_BAR_* mirror the same five sources: GovWin IQ is EXCLUDED (not
 * ingested) and is not one of the "4 SOURCES" the footer counts; of the
 * remaining four, SAM.gov is the one "ROT SUSPECTED" and Ohio Procurement
 * (health: "Failing") is the one "DEGRADED" -- the bundle's own counts,
 * reproduced, not computed here. lastRun is the bundle's own literal
 * timestamp (V1.2, index ~617384). The healthy variant is not a bundle
 * instance (V1.2 ships only the degraded one) -- task-8-brief.md step 3
 * requires it anyway, so 0/0 is shown labelled as the counterfactual it is,
 * same discipline ScoreStrip's "V1 RENDERS THIS STATE" label already
 * establishes for a state the bundle does not itself render. */
const SOURCES_EXAMPLE = [
  { name: "Indiana Supplier Portal", platform: "Periscope", tier: "T1 API", legal: "ToS OK", health: "Healthy" },
  { name: "Indiana EDS Contracts", platform: "Custom", tier: "T1 API", legal: "ToS OK", health: "Healthy" },
  { name: "SAM.gov", platform: "SAM", tier: "T1 API", legal: "ToS OK", health: "Rot suspected" },
  { name: "Ohio Procurement", platform: "Bonfire", tier: "T2 scrape", legal: "Rate-limited", health: "Failing" },
  { name: "GovWin IQ", platform: "Aggregator", tier: "—", legal: "EXCLUDED", health: "Not ingested" },
];
const SOURCE_ROW_COLUMNS = "minmax(200px,1fr) 120px 84px 112px 112px";
const SOURCE_ROW_PADDING = "13px 22px";
const ENTITY_OPPS_ROW_COLUMNS = "minmax(0,1.9fr) minmax(0,.7fr) minmax(0,.7fr)";
const ENTITY_OPPS_ROW_PADDING = "14px 26px";
const STATUS_BAR_LAST_RUN = "2026-08-10 06:04 EDT";

export function Gallery() {
  return (
    <main>
      <h1>dev-gallery-marker — Design system gallery</h1>

      <p className="gallery-intro">
        Every primitive from SP2 Tasks 4-8, grouped as Atoms / Surfaces /
        Intelligence / Chrome, every state labelled -- built for a roughly
        hour-long sign-off read, not a passing glance. Each group cites
        exactly where in the frozen bundle (<code>{FROZEN_BUNDLE_PATH}</code>)
        its primitives were matched, so parity can be checked directly
        against it without searching the file first.
      </p>

      {/* Ruling 15 (SP2 T9 review): the decoy warning previously lived only
       * in the FROZEN_BUNDLE_PATH comment below, never on the page a
       * reviewer actually reads -- so it could not do the job it exists
       * for. Kept short deliberately (the review flagged that an intro this
       * long gets skimmed): one bolded claim, the two names, done. */}
      <p className="gallery-intro">
        <strong>Only V1.2 is the parity reference.</strong> Two
        similarly-named files sit beside it and are NOT current: the
        unversioned "Tenderfoot UI Mockups.html" and "Tenderfoot UI Mockups
        V1,1.html" (a comma, not a period).
      </p>

      {/* ============================== ATOMS ============================
       * MicroLabel, Keycap, Chip, StatusDot (Task 4) and Button (Task 5),
       * merged into one group: all five are the smallest, most-repeated
       * building blocks, and Button was previously its own top-level
       * section only because it arrived a task later, not because it is a
       * different kind of thing. */}
      <section className="gallery-section">
        <h2>Atoms</h2>
        <p className="gallery-compare">
          Compare in the frozen bundle -- Keycap index ~550324 (command-bar
          "Show menu"), Chip index ~555272 (opportunity-detail modal header),
          StatusDot index ~617159 (Source Registry drawer). MicroLabel (32
          uses) and Button (49 instances) recur too often for one index to
          stand in; MicroLabel was matched against the triage card's DEADLINE
          label, Button's full enumeration is in task-5-report.md.
        </p>

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

        {/* Button, in the four styles the bundle's 49 <button> elements
         * actually contain (primary/secondary/ghost from the original
         * brief, plus tertiary -- a fourth recurring style the brief did
         * not name; see Button.css and task-5-report.md). */}
        <h3>Button</h3>

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

      {/* ============================= SURFACES ===========================
       * Card, ShortcutCard, FactTile, FactPanel, Callout (Task 6). */}
      <section className="gallery-section">
        <h2>Surfaces</h2>
        <p className="gallery-compare">
          Compare in the frozen bundle -- Card index ~554745 (triage/detail
          card), ShortcutCard index ~570279/~570759 (goRadars/goReports),
          FactTile index ~556698 (the DEADLINE/EST. VALUE/POSTED trio),
          FactPanel index ~562481 (populated) and ~599427 (empty, Pipeline
          Board), Callout index ~629092 (data) rendered at ~556799.
        </p>

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

      {/* ============================ INTELLIGENCE ========================
       * ScoreBar (via ScoreStrip, which composes it), ScoreStrip, GatedDrawer
       * (Task 7) -- the chrome built inert. The standing note is rendered
       * FIRST, before either demo, per task-9-brief.md step 2. */}
      <section className="gallery-section">
        <h2>Intelligence</h2>

        {STANDING_NOTE}

        <p className="gallery-compare">
          Compare in the frozen bundle -- ScoreBar index ~560940, ScoreStrip
          ("MACHINE SCORES — A READING AID") index ~559895, GatedDrawer index
          ~567216. The illustrative ScoreStrip values below are the bundle's
          own first mock opportunity record (id "in-fssa-ltss", index
          ~627585), not invented; the illustrative GatedDrawer count mirrors
          the bundle's own four-item GATED mock array.
        </p>

        <div className="gallery-section">
          <div className="gallery-row gallery-row--align-top">
            <span className="gallery-panel-item">
              <MicroLabel>ILLUSTRATIVE -- BUNDLE MOCK DATA, NOT A LIVE SCORE</MicroLabel>
              <div className="gallery-score-demo">
                <Card>
                  <div className="gallery-card-body">
                    <ScoreStrip scores={SCORE_STRIP_EXAMPLE} />
                  </div>
                </Card>
              </div>
            </span>
            <span className="gallery-panel-item">
              <MicroLabel>V1 RENDERS THIS STATE</MicroLabel>
              <div className="gallery-score-demo">
                <Card>
                  <div className="gallery-card-body">
                    <ScoreStrip scores={SCORE_STRIP_EMPTY} />
                  </div>
                </Card>
              </div>
            </span>
          </div>
        </div>

        <div className="gallery-section">
          <div className="gallery-row">
            <span className="gallery-button-item">
              <MicroLabel>ILLUSTRATIVE -- BUNDLE MOCK GATED COUNT</MicroLabel>
              <GatedDrawer count={GATED_DRAWER_EXAMPLE_COUNT} />
            </span>
            <span className="gallery-button-item">
              <MicroLabel>V1 RENDERS THIS STATE</MicroLabel>
              <GatedDrawer count={0} />
            </span>
          </div>
        </div>
      </section>

      {/* =============================== CHROME ===========================
       * TableRow, StatusBar, HeaderLockup (Task 8).
       *
       * TableRow and StatusBar are each rendered in their own block-level
       * section rather than inside gallery-row/gallery-panel-item: those
       * two wrappers use align-items:flex-start, which shrink-wraps a flex
       * child to its own content width. StatusBar in particular has no
       * content-driven width of its own (every child is flex:none or a
       * flex:1 spacer that contributes nothing to shrink-to-fit sizing) --
       * exactly the class of bug task-7-report.md flagged when a dropped
       * width:100% collapsed a bar to 16px and every test still passed.
       * Kept out of that layout here rather than re-adding the property
       * defensively. */}
      <section className="gallery-section">
        <h2>Chrome</h2>
        <p className="gallery-compare">
          Compare in the frozen bundle -- TableRow index ~616303 (Source
          Registry) and ~603268 (entity opps, a second independent padding
          citation), StatusBar index ~617384 (the persistent footer),
          HeaderLockup index ~549237.
        </p>

        <div className="gallery-section">
          <MicroLabel>
            TABLE ROW -- SOURCE REGISTRY, THE BUNDLE'S OWN FIVE MOCK SOURCES (PADDING 13PX 22PX,
            ITS OWN BUNDLE VALUE, INDEX ~616303)
          </MicroLabel>
          <div className="gallery-tablerow-demo">
            <Card>
              {SOURCES_EXAMPLE.map((s) => (
                <TableRow key={s.name} columns={SOURCE_ROW_COLUMNS} padding={SOURCE_ROW_PADDING}>
                  <span>{s.name}</span>
                  <span>{s.platform}</span>
                  <span>{s.tier}</span>
                  <span>{s.legal}</span>
                  <span>{s.health}</span>
                </TableRow>
              ))}
            </Card>
          </div>
        </div>

        {/* Ruling 14 (SP2 T8 review): a second, independent padding
         * citation -- entity opps (index ~603268), 14px 26px -- to show the
         * override is general-purpose, not something only the Source
         * Registry row above needed. Cell text is neutral placeholder
         * content, not bundle data (see the constants comment above). */}
        <div className="gallery-section">
          <MicroLabel>
            TABLE ROW, PADDING OVERRIDE -- ENTITY OPPS' OWN 14PX 26PX (BUNDLE INDEX ~603268)
          </MicroLabel>
          <div className="gallery-tablerow-demo">
            <Card>
              <TableRow columns={ENTITY_OPPS_ROW_COLUMNS} padding={ENTITY_OPPS_ROW_PADDING}>
                <span>Opportunity</span>
                <span>Deadline</span>
                <span>Value</span>
              </TableRow>
            </Card>
          </div>
        </div>

        <div className="gallery-section gallery-statusbar-item">
          <MicroLabel>V1 RENDERS THIS STATE -- THE BUNDLE'S OWN COUNTS</MicroLabel>
          <StatusBar sources={4} degraded={1} rotSuspected={1} lastRun={STATUS_BAR_LAST_RUN} />
        </div>

        <div className="gallery-section gallery-statusbar-item">
          <MicroLabel>
            A HEALTHY STATE -- 0 DEGRADED, 0 ROT SUSPECTED (not a bundle instance; task-8-brief.md
            step 3)
          </MicroLabel>
          <StatusBar sources={4} degraded={0} rotSuspected={0} lastRun={STATUS_BAR_LAST_RUN} />
        </div>

        <div className="gallery-section">
          <MicroLabel>HEADER LOCKUP</MicroLabel>
          <div className="gallery-row">
            <HeaderLockup />
          </div>
        </div>
      </section>
    </main>
  );
}
