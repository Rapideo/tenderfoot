# SP2 Fidelity Audit

**Scope:** Every primitive built in SP2 Tasks 4–8, checked against `prototype/PROTOTYPE/Tenderfoot UI Mockups V1.2.html` (the frozen bundle), per design spec §7.10 — *"Pixel-for-pixel parity is the non-negotiable success criterion. Every other consideration — abstraction reuse, component elegance, developer ergonomics — is subordinate to it."*

**Commit audited:** `a95d799ee7c41295f67eabf615ee03535f4c8395` (`SP2 T9 review fix: render the decoy-bundle warning on the page (Ruling 15)`) — verified against `git log -1 --format='%H %ci'` immediately before writing this document.

**Author of this document:** Task 10 (this task). It records; it does not change code — no primitive `.tsx`/`.css` was touched while producing it.

---

## 0. A count, checked before being used

This task's dispatch said "thirteen" primitives. `app/client/src/primitives/index.ts` exports sixteen components (three type-only exports — `ButtonVariant`, `ChipTone`, `StatusDotState` — are not components and don't count). Confirmed against the file listing directly: `MicroLabel, Keycap, Chip, StatusDot` (Task 4) + `Button` (Task 5) + `Card, ShortcutCard, FactTile, FactPanel, Callout` (Task 6) + `ScoreBar, ScoreStrip, GatedDrawer` (Task 7) + `TableRow, StatusBar, HeaderLockup` (Task 8) = **16**.

This is the same class of error this slice's own ledger (`progress.md`) records four separate times against the coordinator's own numbers (Rulings 4, 5, 10, 12) — a count asserted rather than measured. Following the discipline those rulings established: **measured against source, not against the instruction.** All sixteen are recorded below; none omitted to match the number given.

### How to read the provenance tags

- **[REPORT]** — claim rests on the implementer's own task report (`task-N-report.md`). Not independently re-checked by anyone after the fact, as far as this audit found.
- **[REVIEW]** — an independent code-review pass re-derived the same fact from the bundle itself (byte offset, `grep` count, or `getComputedStyle`), per `progress.md`'s review summaries. Cited with which fact was re-derived, not just "reviewed."
- **[AUDIT]** — checked directly by this document, today, against the bundle file, `tokens.css`, or a live `npm run check` / grep run. Shown with the command or count.
- **[SPEC]** — asserted by the design spec or SVRC directly, not a bundle measurement.

---

## 1. Primitive-by-primitive record

### Atoms — Task 4 (commit `52e4b77`), Task 5 (`438abc5`, `ad52931`)

**MicroLabel** — `app/client/src/primitives/MicroLabel.{tsx,css}`
Bundle anchor: the `DEADLINE` label, triage card, **index ~556698** [REPORT, task-4-report.md]. Declaration: `font:500 9.5px/1 'IBM Plex Mono';letter-spacing:.14em;color:var(--text7)` → `--type-microlabel` (32 uses, the most-used type declaration in the bundle) / `--tracking-label-wide` (13 uses) / `--text-label`. [REVIEW] confirmed byte-exact per `progress.md` Task 4: *"Reviewer independently pulled bundle strings and confirmed byte-exact matches for MicroLabel."* No text-transform in CSS; uppercase comes from caller-supplied copy — bundle has zero `text-transform` declarations [REPORT, grep-verified by implementer, not independently re-run by this audit].
Deviation: none for the built declaration. See §2.1 for the unbuilt badge variant.

**Keycap** — `app/client/src/primitives/Keycap.{tsx,css}`
Bundle anchor: the ESC key, command-bar "Show menu" control, **index ~550324**. `font:500 9.5px/1 'IBM Plex Mono';color:var(--inktx);border:1px solid var(--ink5);border-radius:3px;padding:3px 4px` → `--type-microlabel` / `--on-ink-muted` / `--ink-line` (tokens.css names this exact use: *"borders on ink (the ESC keycap)"*) / `--radius-micro` (tokens.css: *"keycaps"*). [REVIEW] byte-exact per `progress.md` Task 4.
No deviation on the matched declaration. `display:inline-block` added — see §2.2 (structural, consolidated entry).

**Chip** — `app/client/src/primitives/Chip.{tsx,css}`
Bundle anchor: the opportunity-detail modal header, **index ~555272** — two adjacent declarations (`sourceLabel`/accent, tag chips/neutral). Both `font:500 10px/1 'IBM Plex Mono';letter-spacing:.1em;padding:5px 8px;border-radius:4px`, differing only in colour pair (`--acc`/`--accbg` vs `--text4`/`--chip`) → `--type-microlabel-queue` / `--tracking-label-tight` / `--radius-chip` (tokens.css: *"chips and tags"*) / `--accent`+`--accent-wash` / `--text-tertiary`+`--ground-chip-alt`. [REVIEW] byte-exact, both variants, per `progress.md` Task 4.
No deviation on either tone. `display:inline-block` added — §2.2.

**StatusDot** — `app/client/src/primitives/StatusDot.{tsx,css}`
Bundle anchor: Source Registry drawer, **index ~617159**. `width:7px;height:7px;border-radius:50%;background:{{ s.dot }}` → `--radius-round` (tokens.css: *"status dots and anything circular"*). Four states mapped from the Source Registry mock data by literal name correspondence: Healthy→`--signal-pos`, Failing→`--signal-neg`, Rot suspected→`--signal-watch`, Not ingested→`--text-label`. [REVIEW] per `progress.md` Task 4: *"traced StatusDot's mapping to the Source Registry data at source (Healthy→--ok, Failing→--bad, Rot suspected→--yellow, Not ingested→--text7), ran its own greps rather than trusting the implementer's audit script."*
No deviation — faithfully transcribed. **See Finding F1 (§4)**: `rot`=yellow/`degraded`=red is counter-intuitive by name; not a fidelity defect. Non-visual accessibility (`role="img"`, `aria-label`, `title`, `data-state`) added — acceptable without paperwork per §7.10.

**Button** — `app/client/src/primitives/Button.{tsx,css}`
Bundle anchor: 49 `<button>` elements total [AUDIT — counted directly against the bundle: `grep -c "<button" "Tenderfoot UI Mockups V1.2.html"` → **49**, matches the report exactly]. 25 reduce to four recurring styles: **primary** (`interestIt`/"Interested"), **secondary** (`passIt`/"Pass"), **tertiary** (`t.open`/"Open vendor record →", not in the original brief — a fourth recurring style the bundle evidences), **ghost** (`markRead`/"CLEAR"). `size="sm"` (Ruling 9, added on review) covers a second, smaller primary/secondary cluster (`saveView`, `closeEditor`), added because `--radius-button`/`--type-ui-action(-primary)` were purpose-named and unconsumed before the fix.
[REVIEW] per `progress.md` Task 5 re-review: *"Tokens now genuinely consumed... both sm mappings verified byte-for-byte; `.btn--primary.btn--sm` (0,2,0) confirmed to outrank `.btn--primary` (0,1,0) regardless of source order."* The review also caught and corrected the implementer's own error: `sm secondary`'s text colour is `--text4`/`--text-tertiary`, not `--text3` as first reported.
**Deviation D1** (mandatory, verbatim from dispatch): Button omits a danger-primary variant — `confirmReason`'s pass branch (`background:var(--bad);border:var(--baddk)`) — driven by app state this task's static prop set cannot express. [AUDIT] confirmed independently: `var(--baddk)` occurs **exactly once** in the bundle, at this exact site (`confirmStyle: "border:1px solid " + (s.askReason === "pass" ? "var(--baddk)"...`), grep-verified today.
**Deviation D2**: two singleton bundle styles below the 3× recurrence bar left unimplemented — `toggleDrawer`'s chip-background toggle and `newView`'s dashed "+ New view" affordance. Neither recurs elsewhere.
**Deviation D3** (mandatory): no hover treatment on primary/secondary/tertiary/ghost — the bundle declares exactly two `style-hover` values across all 49 buttons (`background:var(--hover)` on table/list rows only, `color:var(--inktx4)` on the command-bar avatar only), neither applying to these four. [AUDIT] partial: counted 7 raw `style-hover=` attribute occurrences in the bundle today; did **not** independently re-derive that they collapse to only 2 distinct declarations neither of which applies here — that finer claim rests on [REPORT] alone. See §3.

---

### Surfaces — Task 6 (commits `25548a8`, `b6a619c`)

**Card** — `app/client/src/primitives/Card.{tsx,css}`
Bundle anchor: the triage/detail card, **index ~554745**. `background:var(--surface);border:1px solid var(--brd);border-radius:10px;box-shadow:0 1px 2px rgba(20,24,28,.05),0 8px 24px -16px rgba(20,24,28,.35);overflow:hidden` → `--ground-surface` / `--line-card` (`--brd`, 21 uses — the most-used border colour after `--line-soft`) / `--radius-panel` (tokens.css: *"outer containers"*).
**Deviation D4** (mandatory, verbatim): `box-shadow` uses `rgba(20,24,28,…)` literals — no shadow token layer exists (tokens.css/type.css cover colour, radius, and type only). [AUDIT] verified today, independent of the task report's claim: `--text-primary: #14181c` in `tokens.css` line 107; `0x14=20, 0x18=24, 0x1c=28` — the box-shadow's rgb triplet is exactly `--text-primary`'s own hex, not an invented colour. This is not merely re-stated from the report; it was re-derived from `tokens.css` directly for this audit.
`animation:tfin .22s ease both` (a one-time mount transition) not reproduced — an entrance effect, not a resting property; consistent with how this slice treats hover states with no evidenced counterpart.

**ShortcutCard** — `app/client/src/primitives/ShortcutCard.{tsx,css}` (Ruling 11, added on Task 6 review — not in the original brief)
Bundle anchor: `goRadars`/`goReports`, **index ~570279 / ~570759**. `border:1px solid var(--brd);background:var(--surface);border-radius:9px;padding:16px 18px;text-align:left` → `--line-card` / `--ground-surface` / `--radius-card` (9px, "cards and content panels" — zero consumers before this component landed). Title `--type-heading-callout` (own comment names these exact two buttons); description `--type-body-note` (the same token `Callout` independently consumes — a second bundle instance of the same role).
[REVIEW] per `progress.md`: *"Real `<button type="button">`... styling verified byte-for-byte."* No box-shadow — the one deliberate visual difference from `Card`, placed adjacent to it in the gallery so the absence is directly comparable.
No deviation.

**FactTile** — `app/client/src/primitives/FactTile.{tsx,css}`
Bundle anchor: the DEADLINE/EST. VALUE/POSTED trio, **index ~556698**. Label reuses `MicroLabel` (byte-identical declaration). Value: `--type-metric-stat` (purpose-named, 4 uses). Sub: `--type-body-default-2` (11 uses, the single highest-use BODY-family token). `emphasis` is a boolean, not a colour prop, because across all 5 mock records `deadlineColor` only ever takes `var(--text)` or `var(--warn)` [REPORT — extracted all 5 values directly, not independently re-run by this audit].
No deviation.

**FactPanel** — `app/client/src/primitives/FactPanel.{tsx,css}`
Bundle anchor: "COST TO PURSUE" panel, **index ~562481** (populated), Pipeline Board's `c.empty`, **index ~599427** (empty-state precedent — FactPanel has no bundle instance of its own being empty; matched in *shape*, per the Task 6 brief's own instruction, not against a literal declaration). Title byte-identical to MicroLabel's. `--type-body-small` / `--line-mid` / `--radius-action` (8px, the grid shell).
**Deviation D5**: the empty state's dashed border uses `--line-control-3` (`--brdctl3`), **not** the flatteringly-named `--line-dashed`/`--brddash` — see **Finding F4 (§4)**, this is a naming puzzle in the bundle itself, not a fidelity defect; matched to the actual `c.empty` instance rather than the more suggestive token name.
**Deviation D6** (new, found by this audit, not disclosed in task-6-report.md): the bundle's real "COST TO PURSUE" panel sits inside a recessed section wrapper — `padding:20px 30px 24px;background:var(--surface3)` — that no primitive built in Tasks 4–8 supplies. `--surface3`/`--ground-recess-1` has **zero consumers anywhere in `app/client/src`** [AUDIT — confirmed by direct grep of the primitives directory today]. Task 6's own report flagged this as a gap for "whichever later task composes card sections" (naming Task 8); Task 8 did not pick it up — `TableRow`/`StatusBar`/`HeaderLockup` don't touch it either. In the gallery, `FactPanel` renders directly on `Card`'s plain white surface, which is not what the bundle shows. Grouped with two structurally identical gaps in D6 below (ScoreStrip's outer padding, HeaderLockup's nav-row spacing) — see §2.3.

**Callout** — `app/client/src/primitives/Callout.{tsx,css}`
Bundle anchor: the sole `buyerNote` instance, **index ~629092** (data) / **~556799** (rendered): *"Listed on Indiana's portal — the buyer is NY OGS, not Indiana. Cooperative award, participating states TBD."* → `--type-body-note` (7 uses) / `--radius-control-sm` (tokens.css: *"compact controls and inline callouts"*) / `--signal-caution-line` (`--warnbrd`) — **exactly one use in the whole bundle, this is it** [REPORT; not independently re-counted by this audit].
`margin-top:6px` (contextual to this one usage) not reproduced — a compositional-boundary exclusion, same reasoning as `MicroLabel`'s own sibling-margin exclusion.
No deviation.

---

### Intelligence — Task 7 (commits `b991cf9`, `0e42b99`, `15f4f95`)

**ScoreBar** — `app/client/src/primitives/ScoreBar.{tsx,css}`
Bundle anchor: one row of the "MACHINE SCORES — A READING AID" panel, **index ~560940**. Wrapper `border:1px solid var(--brdmid);border-radius:7px` → `--line-mid`/`--radius-button`. Track `background:var(--brdsoft);border-radius:3px` → `--line-soft`/`--radius-micro` (tokens.css names "score meters" directly). Value `--type-metric-score` (its own comment: "score value"). Colour thresholds reproduce the bundle's own `scoreColor(v)` function byte-for-byte: `v>=70→--ok`, `v>=45→--acc`, else `--warn`, mapped to `--signal-pos`/`--accent`/`--signal-caution`.
[REVIEW], Ruling 13 per `progress.md`: *"everything re-verified at source rather than taken from this report: `scoreColor` at its true definition site, the role mapping in `tokens.css`... `value={null}` renders no digit and no fill element at all — not a zero-width bar."* [REVIEW] also confirms the gallery's illustrative values are `TENDERFOOT.OPPS[0]` — real bundle mock data, not invented.
Corrected mid-task by **Ruling 12**: the low tier originally used `--signal-neg` on a dispatch instruction later found wrong against the bundle (`scoreColor()`'s low branch is `--warn`, never `--bad`, in all five mock records) — corrected at the generator (`extract-tokens.py`), re-verified live via `getComputedStyle()` returning `rgb(181,118,26)` = `--signal-caution`.
The 14px caret column and the click-to-expand-citation behaviour are dropped — see **Deviation D7** below (shared with ScoreStrip).
No colour/token deviation.

**ScoreStrip** — `app/client/src/primitives/ScoreStrip.{tsx,css}`
Bundle anchor: the panel itself, **index ~559895**. Title reuses `MicroLabel` (byte-identical, em-dash confirmed at byte level by review: `\xe2\x80\x94`). List: `display:flex;flex-direction:column;gap:7px`, the bundle's own values unchanged.
**Deviation D7** (new, found by this audit — not written up as a numbered deviation in task-7-report.md, though the underlying facts are documented there): the bundle's score panel is a `<button>` per row that expands to a citation on click, with a 14px caret signalling open/closed state, and the panel title carries an "EXPAND ALL / COLLAPSE ALL" toggle beside it (SVRC Region 1.1.2: *"each expandable to its citation. Collapsed by default"*). None of that disclosure mechanism is built — `ScoreBar` renders as a non-interactive `<div>`, `ScoreStrip` drops the toggle entirely. This is deliberate and correctly reasoned (the two-prop `{label,value}` interface carries no citation data to disclose, and §7.10 clause 2 forbids wiring a working control ahead of qualification design) — but it is a real interaction the bundle renders that this build omits outright, not a case of "prototype's is inert, ours works" (which would need no paperwork). Recorded here as its own entry because it is materially different from `GatedDrawer`'s closed-only scope (D9): there, SVRC explicitly settles the empty-panel question; here, the panel *would* have real rows to disclose once qualification exists, and the disclosure affordance itself — not just its contents — is what's missing.
**Deviation D6 (cont.)**: the panel's own outer `padding:20px 30px 24px;border-right:1px solid var(--brdsoft)` is not reproduced — belongs to a two-column layout container (a Card, or shell chrome) that was never built in this slice. Grouped with FactPanel's `--surface3` gap above.

**GatedDrawer** — `app/client/src/primitives/GatedDrawer.{tsx,css}`
Bundle anchor: the collapsed toggle chip, triage screen decision-bar footer, **index ~567216**. `border:1px solid var(--brdctl3);background:var(--chip2);border-radius:6px;padding:8px 11px;font:500 11px/1 'IBM Plex Mono';letter-spacing:.06em;color:var(--text4)` → `--line-control-3`/`--ground-chip`/`--radius-control`/`--text-tertiary` / `--type-microlabel-cmd` (14 uses) / `--tracking-hint-tight` (the same token `Button`'s ghost variant already consumes).
**Deviation D8** (mandatory, verbatim): GatedDrawer renders only the closed toggle, per SVRC Region 1.1.5. [AUDIT] confirmed the citation directly: `reference/Tenderfoot SVRC.md` line 206 reads *"Parked 2026-08-11. V1 has no gates, so nothing is gated and the drawer has no contents."* — read at source for this document, matching what `task-7-report.md` and the [REVIEW] both cite. The disclosed panel (header + gated-item rows with a gate-reason badge and Restore button) is not built: no item data in the `count`-only interface, a working Restore is exactly the live control this task must not wire, and SVRC settles that a faithful V1-state open drawer would show nothing anyway.
No token deviation on the chip itself.

---

### Chrome — Task 8 (commits `938b265`, `2d9296a`)

**TableRow** — `app/client/src/primitives/TableRow.{tsx,css}`
Bundle anchor: ten `display:grid` row-list instances, read directly from the bundle:

| Screen / list | index (approx) | tag | padding | gap |
|---|---|---|---|---|
| Detail editor `fields` | ~580971 | div | 12px 16px | 14px |
| Triage sidebar `gated` | ~568733 | div | 12px 16px | 14px |
| Source Registry `sources` | ~616303 | div | 13px 22px | 14px |
| Entity history | ~602301 | div | 13px 26px | 14px |
| Expiration Radar `expiring` | ~588129 | button | 13px 24px | 14px |
| Organizations `orgs` | ~605823 | button | 13px 24px | 14px |
| Teaming Radar `vendors` | ~608062 | button | 13px 24px | 14px |
| Source Yield `yields` | ~612210 | div | 13px 24px | 14px |
| Opportunities `oppRows` | ~594735 | button | 14px 22px | 12px |
| Entity `opps` | ~603268 | button | 14px 26px | 14px |

[REVIEW] confirmed two of the ten offsets independently per `progress.md` Ruling 14: *"Both corrected offsets (~616303 and ~603268) independently verified by the re-reviewer against the bundle."* The other eight rest on [REPORT] alone — not independently re-walked by review or by this audit.

`border-bottom:1px solid var(--brdrow)`/`align-items:center` constant across all ten → `--line-row`. `gap:14px` in nine of ten (`oppRows` is 12px, the outlier).
**Deviation D3** (mandatory, verbatim): default padding (`13px 24px`) is a 4-of-10 plurality; six real screens deviate (`12px 16px` through `14px 26px`). Now overridable via an optional `padding` prop (Ruling 14, review fix) rather than a variant enum, since the ten values don't cluster into named types. The fix also surfaced a latent parity bug: the gallery's own Source Registry demo had been silently rendering the *default* `13px 24px` when that screen's real value is `13px 22px` — caught only because the escape hatch made the discrepancy visible, now corrected.
**Deviation D10** (new, found by this audit — not disclosed in task-8-report.md or its two "Concerns for the gate" items): `TableRow` always renders a `<div>`. Five of its ten matched bundle instances are semantically `<button>` — natively clickable and keyboard-focusable rows (Expiration Radar, Organizations, Teaming Radar, Opportunities, Entity opps). §7.10's own definition of "matching" opens with *"Same semantic elements, nesting, and class names"* — a shared `<div>` standing in for what the bundle renders as a `<button>` in half its matched instances is a real element-type deviation, not merely a missing `onClick` (which is separately, correctly out of scope for an inert-primitives slice). `TableRow` currently has no `as`/element prop to express this; any screen consuming it for one of the five button-tagged lists will need to supply its own clickable wrapper or the primitive will need one added later.

**StatusBar** — `app/client/src/primitives/StatusBar.{tsx,css}`
Bundle anchor: the persistent footer, the only `<footer>` in the bundle, **index ~617384**. Full declaration transcribed in `StatusBar.tsx`'s own header comment. Cross-checked against the Source Registry's 5-entry mock array: 4 sources counted (GovWin IQ excluded, "Not ingested"), 1 degraded (Ohio Procurement, "Failing"), 1 rot suspected (SAM.gov) — the footer's literal counts reconcile exactly [REPORT; not independently re-summed by this audit].
**Deviation D11** (mandatory, verbatim): the dot colour is a fixed `--signal-watch` literal, not derived from `degraded`/`rotSuspected` — the bundle has one instance and it is never conditional (`background:var(--yellow)` is a static literal in the bundle, confirmed [REPORT], not a template binding).
**Deviation D12** (new, found by this audit): the bundle's footer also renders a theme-toggle button (`toggleTheme`/`{{themeLabel}}`) and a "▷ GUIDED TOUR" button (`startTour`) between the divider and the version stamp. Neither is built — both are dropped outright, not merely left unwired. This is a real omission of rendered bundle chrome, distinct from "prototype's interaction is inert, ours is real" (which needs no paperwork): here neither the prototype's nor this build's version does anything, but the bundle still *renders* two controls this build does not render at all. Justification recorded in `StatusBar.tsx`'s own comment: the four-prop static interface has no theme state or tour sequence to back either one, and inventing placeholder state would misrepresent both as functional. A later slice adding real theme/tour state will need to extend `StatusBar` or compose these beside it.
**Deviation D13** (new, found by this audit): the bundle's counts button (`goAdmin`) carries real hover evidence — `style-hover="color:var(--inktx4)"` — not reproduced. `--on-ink-secondary` (`--inktx4`) has zero consumers in this component; deliberately withheld per `task-8-report.md` ("a hover treatment on a control with no click affordance misrepresents it"). Unlike Button's four variants (D3, where the bundle genuinely has *no* hover to reproduce), this is a case where real hover evidence exists and was withheld — worth distinguishing from D3 rather than folding into it.

**HeaderLockup** — `app/client/src/primitives/HeaderLockup.{tsx,css}`
Bundle anchor: **index ~549237**, confirmed [REPORT] as the *only* `border-radius:1px` and the only `1.5px solid` border in the whole bundle — not independently re-counted by this audit. `--radius-micro` (3px, outer) / `--radius-mark` (1px, inner) — tokens.css's own RADII-section worked example names this exact shape. `--type-wordmark`/`--tracking-wordmark`, each a single-use token named for this one control.
[REVIEW] per `progress.md` Task 8: *"Footer and lockup pulled at byte offsets, matched character-for-character. `border-radius:1px` and `1.5px solid` each confirmed to occur exactly once in the whole bundle."*
`min-width:150px;flex:none` (belongs to the header nav row this control sits inside in the bundle) not reproduced — grouped with the D6 outer-chrome gap, though currently moot since no header/nav row exists yet to expose the gap. No placeholder line beneath the mark (a V1.2 change, confirmed absent) — matches.
No deviation on the built declaration.

---

## 2. Consolidated deviation log

Every entry below requires (and has) justification per §7.10; the acceptable-without-paperwork categories (real data, routes, framework forms, working-where-inert, non-visual a11y) are not repeated here because none of the sixteen primitives' deviations fall into them except where noted.

**§2.1 — Unbuilt secondary bundle declarations, below evidentiary bar or out of interface scope**
- `MicroLabel` does not expose `--type-microlabel-badge` (1 bundle use, the "IN" badge) — dominant declaration (32 uses) built; no variant prop added for a single-instance style.
- `Button` (D1, D2): no danger-primary variant (`confirmReason`'s pass branch); two singleton styles (`toggleDrawer`, `+ New view`) below the 3× recurrence bar.

**§2.2 — Structural, non-token properties added for standalone rendering**
`display:inline-block` added to `Keycap`, `Chip`, `StatusDot`; `display:inline-flex` (+gap) added to `Button`'s base class; `display:block;width:100%` added to `ShortcutCard`. In every case the bundle's own instance sits inside a `display:flex` container that blockifies (or stretches) the element for free; these primitives are meant to render correctly standing alone in the gallery and in future screens, so the equivalent structural property is added explicitly. None is a colour, radius, or font value, so none is governed by the token-only scan — flagged here for full disclosure rather than left to pass silently.

**§2.3 — Outer/section-level chrome never built (D6)**
Three matched bundle instances sit inside container-level styling this slice never built a primitive for: `FactPanel`'s recessed section (`padding:20px 30px 24px;background:var(--surface3)`), `ScoreStrip`'s panel padding + right border (`padding:20px 30px 24px;border-right:1px solid var(--brdsoft)`), `HeaderLockup`'s nav-row spacing (`min-width:150px;flex:none`). `--surface3`/`--ground-recess-1` has zero consumers anywhere in `app/client/src` [AUDIT-confirmed]. Task 6's own report named this gap for a later task; no later task in this slice closed it. Not a pixel error in what's built — a real absence in what surrounds it wherever these primitives are composed today (the gallery renders them on plain `--ground-surface`).

**§2.4 — Individually mandatory entries (from this task's dispatch, verbatim, cross-referenced above)**
- D4 — Card's `box-shadow` uses `rgba(20,24,28,…)` literals; no shadow token layer exists. [AUDIT-verified: `#14181c` = `rgb(20,24,28)`.]
- Bare spacing/size literals throughout every primitive (`padding`, `gap`, `width`/`height` on atoms) — no spacing token layer exists. Present in all sixteen; not re-listed per component.
- D3 — TableRow's default padding is a 4-of-10 plurality; six bundle screens deviate; overridable by prop.
- D11 — StatusBar's dot colour is fixed, not derived from its counts.
- D1, D2, D3(Button) — Button omits a danger primary and two singleton styles below the recurrence bar.
- D8 — GatedDrawer renders only the closed toggle, per SVRC Region 1.1.5.
- D3(Button-hover) — no hover treatment on the four button variants; the bundle has none for them.

**§2.5 — Found by this audit, not previously written up as deviations**
- D6 (§2.3, above).
- D7 — ScoreBar/ScoreStrip drop the citation-disclosure caret and the "EXPAND ALL / COLLAPSE ALL" toggle outright, not merely leave them unwired.
- D10 — TableRow always renders `<div>`; five of its ten matched instances are semantically `<button>` in the bundle.
- D12 — StatusBar drops the theme-toggle and "GUIDED TOUR" buttons entirely, not merely leaves them unwired.
- D13 — StatusBar's counts button has real bundle hover evidence (`color:var(--inktx4)`) that is deliberately not reproduced.

---

## 3. What this audit could NOT verify, and why

This is the section that determines how much weight the parity claim above carries. Being specific about tiers:

**Byte-verified independently by code review** (highest confidence — re-derived from the bundle by a second party, not just re-stated from a report): MicroLabel, Keycap, Chip (both tones), StatusDot's four-state mapping (Task 4 review); Button's four variants + both `sm` mappings + CSS specificity ordering (Task 5 re-review); ShortcutCard's full declaration, the Card box-shadow/`--text-primary` identity, the `--brdctl3` vs `--brddash` naming gap (Task 6 review); ScoreBar's `scoreColor()` mapping at its true definition site, the em-dash byte value, `value={null}`'s empty-render behaviour, gallery data provenance, GatedDrawer's SVRC citation (Task 7 review, Ruling 13); StatusBar and HeaderLockup pulled at byte offsets and matched character-for-character, the uniqueness of `border-radius:1px`/`1.5px solid`, two of TableRow's ten padding offsets (Task 8 review, Ruling 14).

**Checked directly by this audit today**, independent of any prior report: the 16-vs-13 primitive count; `#14181c` = `rgb(20,24,28)` against Card's box-shadow; the 49-`<button>` count; `--baddk`'s single bundle occurrence (Button's danger-primary evidence); `--surface3`/`--ground-recess-1`'s zero-consumer status; SVRC Region 1.1.5's exact wording; the presence of all three near-identical bundle filenames the gallery warns about; that no non-test source file supplies a numeric score literal; the `npm run check` and hardcoded-literal grep results in §5.

**Rests on the implementer's report alone, not independently re-checked by review or this audit**: FactTile's `emphasis` boolean claim (that `deadlineColor` only ever takes two values across all 5 mock records); Callout's "`--warnbrd` has exactly one bundle use" count; eight of TableRow's ten row-instance offsets and their padding/gap values (only two were independently re-verified); the exact reconciliation arithmetic behind StatusBar's "4 SOURCES · 1 DEGRADED · 1 ROT SUSPECTED" claim against the five-entry mock array; the finer claim that the bundle's 7 raw `style-hover=` occurrences collapse to only 2 *distinct* declarations, neither applicable to Button's four variants (this audit confirmed the raw count of 7 but did not re-derive that they reduce to 2 unique values).

**Confirmed only visually, per the task reports** (this audit did not re-render the gallery in a browser — see below): the disabled-state dimming reading correctly on filled vs. bordered buttons; the four `StatusDot` colours being visually distinct enough alongside their non-colour affordances; Card vs. ShortcutCard's box-shadow difference being perceptible; all `TableRow`/`ScoreBar`/`StatusBar` full-width layout fixes (three separate "tests green, screen wrong" bugs were caught this way across Tasks 7–8, not by the test suite).

**Not verified by anyone, as far as this audit found**: full-page visual regression against the bundle (no side-by-side screenshot diffing exists in this repo — every visual check across Tasks 4–9 was a one-off headless/Playwright screenshot, reviewed once, not retained as a baseline); font rendering fidelity — every task report from 4 onward notes `IBM Plex Sans`/`Mono` fall back to the browser default serif because no `@font-face` is loaded into the client app, so **no primitive has ever been visually compared against the bundle in its actual typeface**; colour-contrast/JND verification beyond the specific pairs `tokens.css` already flags (the "90 sub-JND pairs" figure is carried forward from earlier token work, not re-measured by this audit or by Tasks 4–9).

**This audit did not run a browser.** All sixteen primitives' visual claims above are inherited from the task reports' own screenshot verification (headless Chrome / Playwright, `claude-in-chrome` unavailable in every session from Task 4 through Task 9) — this document did not independently re-render `/dev/gallery` and compare pixels.

---

## 4. Findings for Matt's ruling (not deviations — nothing here was fixed)

**F1 — `StatusDot`: `rot` = yellow, `degraded` = red.** Faithfully transcribed from the Source Registry mock data ("Rot suspected"→`--yellow`, "Failing"→`--bad`); possibly backwards in the prototype itself. `StatusBar`'s single dot instance is always `--signal-watch` (yellow) regardless, so this only bears on `StatusDot`.

**F2 — 98 type tokens: 88 font shorthands, 10 tracking values.** [AUDIT] re-confirmed today via `npm run tokens`'s own output: `bundle font declarations (distinct): 88 (251 total uses)`, `bundle letter-spacing values (distinct): 10 (72 total uses)`, `TOTAL type tokens: 98`. Not a scale — `--type-body-*` alone has 25 thin, honestly-named but not richly-distinct variants. This is a finding about the prototype's typography, not a defect in Task 1's extraction; extraction is verified exhaustive by a conservation check (raw substring count = matched + explicitly-named exclusions), not by a regex that could silently miss a category.

**F3 — No spacing layer and no shadow layer.** The same gap typography had before Task 1 closed it there. Every primitive inlines its own padding/gap/width literals (bare, not token-backed) because no spacing scale exists; Card's box-shadow is a literal `rgba()` pair because no shadow scale exists. Sixteen-for-sixteen consistent — no primitive invented a token that isn't there.

**F4 — `--brddash` is misleadingly named.** Its own tokens.css comment said "dashed affordance: empty states, add-new targets," and it appears at four bundle offsets — but **never** for an empty list. The actual "list has nothing in it" bundle instance (`c.empty`, ~index 599427) uses `--brdctl3`/`--line-control-3`, which is what `FactPanel`'s and `ScoreBar`'s empty states both correctly use instead. Matching the flattering name would have been the fidelity defect.

**Correction (I4, 2026-08-14 fix wave):** this entry's own parenthetical — "document-viewer placeholder, editor drop zone, two 'add new' targets" — was itself imprecise, re-checked directly against all four bundle offsets. There is no "add new" target anywhere in the four: each is a DEFERRED-FEATURE placeholder, a layout slot for something intentionally not built yet, captioned inline — "DOCUMENT RENDER — PLACEHOLDER" (the one true document-viewer instance), "Rescore history has no treatment yet (§6.4)", "Records are not accessible to this project. The slot stays in the layout so the brief can carry it again without a redesign.", and "Recall is quoted against its denominator...". The "never an empty list" conclusion stands; the description of what it IS instead is corrected at the generator (`extract-tokens.py`'s `NOTE_DASHED`) and propagated through `tokens.css`.

**F5 — `TableRow` grouped under Chrome.** Defensible by inheritance from Task 8's own section title ("rows and chrome"), mildly counter-intuitive for a cold reader expecting row-list primitives to sit with the other content primitives (Surfaces). Recorded at the gate rather than churned (Task 9 review).

**F6 — Sixteen primitives were built, not thirteen.** See §0. Not a defect — a count correction, made the same way this slice's ledger corrects every other count in it: by measuring against the source rather than the instruction.

---

## 5. Gate verification (Step 4 exit criteria)

**`npm run check`** — re-run in full for this audit, from a clean invocation:

```
Test Files  20 passed (20)
     Tests  92 passed (92)
...
✓ built in 1.80s
OK     "dev-gallery-marker" absent from .../app/client/dist
PASS: every token round-trips to the bundle value.        (67 tokens, 13 radii)
PASS: every type.css token round-trips to the bundle value, one role per value.  (88 font + 10 tracking = 98)
PASS: every client token copy is byte-identical to its prototype source.
EXIT: 0
```
Elapsed: **1m05.6s** (`time npm run check` real time, first run) — within the ~1m03s–1m38s band every prior task in this slice reports, dominated by `corpus.test.ts`'s Neon-contention variance (progress.md Ruling 6), not by anything this task touched. A second full run confirmed exit 0 / 20 files / 92 tests without a timed capture.

**Hardcoded colour/radius/font scan** — the corrected pattern (progress.md's own note: the original could not match `rgba()` or a leading-dot-free negative tracking value):
```
grep -rnE "#[0-9a-fA-F]{3,6}|rgba?\(|hsla?\(|font:\s*[0-9]|border-radius:\s*[0-9]|box-shadow:" \
  app/client/src --include=*.tsx --include=*.css
```
Run today. Every match outside `tokens/tokens.css` and `tokens/type.css` (the two token-definition files, expected to contain literals) is inside a `.tsx`/`.css` **comment** citing a bundle declaration — except `Card.css`'s own `box-shadow: rgba(20,24,28,…)` declaration (lines 46–48), which is Deviation D4, disclosed in that same file's comment, not hidden. No other undisclosed literal found.

**Gallery state coverage** — confirmed by reading `Gallery.tsx` directly (not re-rendered in a browser by this audit, per §3): every one of the sixteen primitives renders at least one state; every documented dual-state pair renders both sides labelled (StatusDot's four states; Button's four variants × default/disabled/`sm`; Card vs. ShortcutCard; FactPanel populated/empty; ScoreStrip illustrative/all-null; GatedDrawer count=4/count=0; StatusBar degraded/healthy).

**Correction (M5, 2026-08-14 fix wave):** this originally also claimed a "TableRow default-padding/override-padding" pair. That was false — checked directly against `Gallery.tsx`: both of its `TableRow` instances (lines ~512 and ~535) pass a measured `padding` override (`13px 22px`, `14px 26px`); neither omits the prop, so `TableRow.css`'s own CSS default (`13px 24px`) never renders anywhere in the gallery. Corrected here rather than rendered, because adding a third instance to demonstrate the default would need a genuine bundle citation for one of the four screens that actually use `13px 24px` (`expiring`, `orgs`, `vendors`, `yields` — TableRow.tsx's own header) — real column layout and cell data this fix wave did not go re-pull, and inventing placeholder content for it would risk exactly the fabrication this slice has repeatedly disciplined against. The override mechanism itself is still demonstrated twice, independently (Ruling 14); only the bare default is unrendered.

**`ScoreBar` with `value={null}`** — renders no digit and no fill element (confirmed at the code level in `ScoreBar.tsx`: `{!empty && (...)}` guards the fill entirely; the value span renders `"—"`, not `"0"` or a `0%`-width bar) — [REVIEW]-confirmed per Task 7 Ruling 13. **No fixture anywhere supplies a fake score** — [AUDIT] confirmed today: the only file in `app/client/src` with a bare numeric score literal outside a test file is none; `grep` for score-shaped numeric literals across `*.tsx` found exactly one hit, `ScoreBar.test.tsx` (a test file, not a fixture). `Gallery.tsx`'s `SCORE_STRIP_EXAMPLE` is the bundle's own second mock record (`naspo-ogs`, index ~628895 — reassigned from the first, `in-fssa-ltss`, by the I2 fix below), labelled "ILLUSTRATIVE," and `SCORE_STRIP_EMPTY` is all-`null`, labelled "V1 RENDERS THIS STATE."

**Correction (I2, 2026-08-14 fix wave):** at the time this audit was written, `SCORE_STRIP_EXAMPLE` held `in-fssa-ltss`'s scores (84/61/72/48) — the POS and MID fill tiers only. `--signal-caution`, the colour `scoreColor()` actually gives a score under 45 (Ruling 12), never painted a pixel anywhere in the gallery; its only coverage was `ScoreBar.test.tsx` asserting a class name. Swapped to `naspo-ogs` (43/21/91/34, the same record the Surfaces group's Callout/FactPanel demos already cite) so the low tier finally renders on the page Matt actually reads. No score in this record falls in the 45–69 MID band, so the swap trades MID-tier coverage for the LOW-tier coverage that was missing — not a fabricated value forcing all three tiers into one row.

**Build contains no trace of the gallery** — confirmed by the gate's own two-sided marker check (`checkGalleryMarkerPresentInSource` + `checkGalleryMarkerAbsentFromBuild`, both green above), which Task 9 closed the vacuous-pass hole on (the presence check now runs first, so a deleted marker fails loudly instead of making the absence check trivially true).

---

## 6. Sign-off

Sixteen primitives documented above (not thirteen — see §0). Every deviation from the matched bundle declaration carries an explicit `Deviation:` entry in §1/§2, including five found by this audit that were not written up as deviations in the underlying task reports (D6's ScoreStrip/HeaderLockup instances, D7, D10, D12, D13). Section 3 states plainly which claims are byte-verified by a second party, which rest on one implementer's citation, which were checked only visually by a screenshot no one retained, and which were not verified by anyone. `npm run check` is green at commit `a95d799`, elapsed ~1m06s. The build ships no trace of `/dev/gallery`, no fixture anywhere fakes a score, and the corrected hardcoded-literal scan finds nothing undisclosed.

This document does not constitute sign-off — per the task-10 brief's exit criteria, that is **Matt's**, reading this alongside `/dev/gallery` itself.
