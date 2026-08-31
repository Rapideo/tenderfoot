# SP6 fidelity audit — the composed screens against the V1.2 bundle

**Run 2026-08-31, after SP6 shipped.** Same shape as `SP2-fidelity-audit.md`, which audited the primitives. This audits what SP6 built *out of* them.

**Why it exists.** SP6 is the first slice to compose real screens — the moment design spec §7.10's pixel-for-pixel mandate becomes operative — and **neither its spec nor its plan referenced that mandate once.** The consequence was visible the moment anyone looked at production: the queue, assembled from SP2 primitives each matched to the bundle, reads like the product; the record, hand-rolled from bare `div`/`span` with CSS invented in the plan, did not. Matt spotted it in about ten seconds.

**Method.** Every row below quotes the bundle's own declaration, extracted from `prototype/PROTOTYPE/Tenderfoot UI Mockups V1.2.html`, against what SP6 shipped. Verdicts are **MATCH**, **PARTIAL**, **MISSING**, or **DIVERGES** (built differently on purpose — needs a ruling or a deviation).

**One rule applied throughout, from `CLAUDE.md` §1:** where the bundle and a spec disagree, this document records the conflict and does **not** resolve it. That is Matt's.

---

## A. Shell

| Region | Bundle | SP6 shipped | Verdict |
|---|---|---|---|
| A.1 Primary nav | `Triage · Opportunities · Radars · Entities · Reports · Admin · Pipeline` | `Queue · Admin` | **PARTIAL.** Five nav entries absent. Most lead to unbuilt screens (Radars SP8, Entities/Reports post-gate, Pipeline parked), so this is arguably correct-for-V1 — but the bundle shows them and §7.10 says parked nodes "must match when they are built". **Needs a ruling: render the full nav with unbuilt entries inert, or keep two?** |
| A.1.3 Queue counter | `<button>` with `font:600 20px/1 'IBM Plex Mono'` for the count and a stacked `IN`/`QUEUE` label at `500 9.5px/1.25`, `letter-spacing:.12em`, `opacity:.72` | A bare number in the header | **PARTIAL.** Right value, none of the treatment — no button, no stacked label, no mono. |
| A.1 Triage chrome | `CLEARING QUEUE · NAV COLLAPSED` pill + `Show menu ESC` when the queue collapses the nav | absent | **MISSING.** The SVRC's "reduced shell" has a designed expression and we implemented only its *effect* (hiding nav), not its *affordance* (telling the user, and offering the way back). |
| A.2 Status bar | `4 SOURCES · 1 DEGRADED · 1 ROT SUSPECTED │ LAST RUN … │ DARK │ GUIDED TOUR │ TENDERFOOT 0.1.2 · MOCKUP` | counts + last run + version | **PARTIAL.** `DARK` and `GUIDED TOUR` controls absent. Both are real bundle affordances; neither is specified anywhere in SP6. |

---

## B. Screen 1 — Triage (`View 1.1`), the `Pri 5` screen

### B.1 Card frame and header

| Element | Bundle declaration | SP6 | Verdict |
|---|---|---|---|
| Page frame | `background:var(--app); padding:26px 24px 40px; align-items:center`, card `max-width:1080px` | full-bleed, no max-width | **PARTIAL** |
| Card | `background:var(--surface); border:1px solid var(--brd); border-radius:10px; box-shadow:0 1px 2px …,0 8px 24px -16px …; overflow:hidden` | `Card` primitive, flat | **PARTIAL.** The bundle's two-layer shadow is the one `Card`'s single-consumer shadow was deferred over (SP2 "no shadow layer"). Now there is a second consumer. |
| Progress + order line | `1 OF 5` at `500 10px/1 Mono ls .14em` + `ORDER · AMBIGUITY FIRST` at `400 10px/1 ls .08em` | **MISSING entirely** | **MISSING.** ⚠️ `ORDER · {{ orderLabel }}` is a *label plus a value* — §7.10 already records this exact trap. The label is real; the ordering value is ours to supply, and V1's is deadline-first (D16). |
| Keyboard legend | right-aligned `I INTERESTED · P PASS · U UNDO` | keycaps on buttons + "U undo" | **DIVERGES.** Ours is arguably better placed; the bundle's is a single legend line. Cheap to match. |
| Source + tag chips | `IN · SUPPLIER PORTAL` on `--accbg`/`--acc`, then tags on `--chip`/`--text4`, both `500 10px/1 Mono ls .1em; padding:5px 8px; radius:4px` | one `Chip` for `kind` | **PARTIAL.** Source label chip absent; tag styling differs. |
| Title | `600 27px/1.24 Sans; ls -.012em; max-width:24ch; text-wrap:pretty` | `--type-heading-hero` | **CHECK.** Verify the token equals this declaration; `max-width:24ch` and `text-wrap:pretty` are not applied. |
| Buyer | `400 14px/1.5 Sans; color:var(--text4)` | `--type-body-buyer` | **MATCH (verify token)** |
| Buyer note | callout on `--warnbg`/`--warnbrd`/`--warntx`, `radius:5px; padding:6px 9px; display:inline-block` — *"Listed on Indiana's portal — the buyer is NY OGS, not Indiana."* | **MISSING** | **MISSING.** This is the entity-resolution disclosure surfacing on the card. We have the data (`org_id` resolution is in the timeline) and show it nowhere. |

### B.2 The three-up fact panel — **MISSING, and it is the card's spine**

Bundle: `grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; background:var(--brdsoft); border:1px solid var(--brdsoft); radius:8px`, each cell `--surface`, `padding:13px 15px`, with a `500 9.5px Mono ls .14em --text7` label, a `600 17px/1.1 Mono` value (deadline coloured by urgency), and a `400 11px/1.4 Sans --text5` sub-line.

- **DEADLINE** — `2026-08-27`, sub *"17 days out · 3:00 PM EDT"*
- **EST. VALUE** — `$12M+`, sub *"Multi-state, no ceiling stated"*
- **POSTED** — `2026-07-14`, sub *"No addenda"*

**SP6 shipped a flat text row: buyer, date, value, chip.** The SVRC calls these "the four facts that decide most items without anything else being read" and the bundle gives them a designed panel. **This is the single largest gap on the highest-priority screen.**

Data availability: deadline ✅, value ✅, posted ✅ (`posted_at`, though ⚠️ NULL on 1,724 SAM.gov rows). Sub-lines: "days out" is derivable ✅; "no ceiling stated" and "No addenda" need extraction we do not have ❌.

### B.3 Deadline disagreement panel — **MISSING, and this one carries a named risk**

Bundle:
```
◆ DEADLINE DISAGREEMENT — NOT RESOLVED     600 10px Mono ls .12em --bad
border:1px solid var(--badbrd); background:var(--badbg); radius:8px; padding:12px 14px
  two-up grid, each cell --surface / --badbrd2 / radius:6px / padding:9px 11px
    value  600 14px/1.2 Mono
    source 400 11px/1.4 Sans --text5
```

**SP6 shipped a plain `Callout` with the values as prose.** Region 1.1.1's rule — *show the disagreement rather than silently picking a winner* — **currently carries the FSSA near-miss risk alone**, because the Gated Items Drawer is parked. It has a designed two-up treatment in the bundle and we did not build it. Data is available today (`extracted_field` conflicts). **Buildable now.**

### B.4 Score strip — ⚖️ **CONFLICT, needs Matt's ruling**

Bundle renders `MACHINE SCORES — A READING AID` with an `EXPAND ALL` toggle and four rows at `grid-template-columns:96px 1fr 44px 14px`, each expanding to a citation.

**SP6's D13 ruled it does NOT render on the composed card**, reasoning that four dashes captioned as a reading aid mislead during a ten-second decision.

**Both positions are on the record and they contradict.** STATUS's 2026-08-13 decision ("the intelligence chrome is BUILT, inert — constructed and rendered") sides with the bundle; D13 sides against. `ScoreBar` already has the null/empty branch, so rendering it is cheap. **This is exactly the conflict class `CLAUDE.md` §1 reserves for Matt.**

### B.5 Cost panel — **PARTIAL, blocked on data**

Bundle: `COST TO PURSUE — FACTS, NOT A SCORE`, sub *"Counted from the bundle. The light/moderate/heavy call is yours."*, then a **2-column, 6-cell grid** (`gap:1px` on `--brdmid`), each cell a `600 16px/1.15 Mono` coloured value over a `400 11px/1.35 Sans --text5` label: *14 Required forms · Optional Pre-proposal conference · 5 References demanded · Yes Notarization required · None Page limit · 6 Sealed copies + USB*. Then a full-width `Open full detail →` button.

**SP6 shipped `FactPanel` with its empty state (D15).** The container is right; **none of the six facts is extracted**. Matching this means reopening extraction — currently parked with the labelling task. **Blocked on a scope decision, not on effort.**

⚠️ Also **MISSING: the `Open full detail →` button.** That is the bundle's route from queue to record, and ours has no visible route at all — only the `Enter` key.

### B.6 Decision bar — **DIVERGES structurally**

Bundle: `border-top:1px solid var(--brdsoft); background:var(--surface4)`, and it is a **mode machine**:
- default (`showDecide`): Pass and Interested as `flex:1` buttons, `padding:15px`, `600 14px/1 Sans`, `radius:8px`
- on Pass (`askReason`): the bar **swaps** to a reason panel — prompt + help text, **8 reason chips**, a free-text input placeholdered *"…or say it in your own words (this is the training signal)"*, then `Back` and a confirm button

**SP6 shipped a permanently-visible textarea beside the buttons.** Chips are correctly parked (SVRC ratified free-text-only for V1), but **the two-state bar is not a chip decision** — the *mode* is the bundle's structure and we flattened it. **Buildable now.**

---

## C. `View 1.3` Queue Cleared

Not audited against the bundle — D14 records that the SVRC calls its content undesigned and that SP6 invented three `ShortcutCard`s. **The bundle should be checked for an empty-state treatment before that deviation stands.** Not done in this pass.

---

## D. Screen 2 — Opportunity Detail

### D.1 Screen frame — **MISSING**

| Element | Bundle | SP6 | Verdict |
|---|---|---|---|
| Breadcrumb | `← BACK TO QUEUE   ALL OPPORTUNITIES` | absent | **MISSING.** No way back to the queue but the browser button. |
| Subtitle | `New York State Office of General Services · IN · SUPPLIER PORTAL · closes 2026-08-27` | buyer only | **PARTIAL.** Jurisdiction, source label and closing date all available today. |
| Card wrapper | content in a white card on `--app` ground | flat on the ground | **MISSING** |
| **Tabs** | `Brief · Scores & Evidence · Extracted Fields · Documents · Timeline` | all sections stacked down one page | **MISSING — structural.** Two tabs are parked for V1 (Brief, Scores) but the tabbed *shape* is the screen's organising principle. |

### D.2 `View 2.3` Extracted Fields — **MATCH, after the 2026-08-31 fix**

Columns `190px minmax(0,1fr) 110px 150px`, header on `--surface2` with `--type-microlabel` + `--tracking-label-tight`, rows `padding:12px 16px` separated by `--brdrow`, `--surface3` when absent, `--badbg2` when conflicted, confidence colour-coded, human labels. **Verified against the bundle and fixed.**

⚠️ One residual: the bundle's SOURCE column is document-attributed — `Scope.pdf §3`, `Terms.pdf §2`, `listing metadata`. **Ours says `document` / `listing`.** `extracted_field.document_id` already exists, so the filename is available today. **Buildable now, and it materially improves a citation's usefulness.**

⚖️ And the standing conflict: the bundle puts a conflict **inline in the value cell**; SP6 §6.1 puts it **beneath with its own origin and quote**. Currently built the spec's way with the bundle's colours. **Matt's ruling.**

### D.3 `View 2.4` Documents / `D.4` `View 2.5` Timeline

**Not audited in this pass.** D12 already records that the bundle's inline viewer is unbuildable (SP4 discards bytes), but the *list* treatment and the timeline's own bundle declaration were not compared. **Outstanding.**

---

## Summary — what to fix, in the order I would do it

### ✅ DONE 2026-08-31 — items 1–6, both screens deployed and screenshotted

1. ✅ **B.2** three-up DEADLINE / EST. VALUE / POSTED fact panel. `posted_at` threaded through the queue query to feed the third cell; deadline coloured by urgency with a human interval beneath it.
2. ✅ **B.3** deadline-disagreement two-up panel, header and all, on `--badbg` with `--badbrd2` cells. Both values with their sources, resolving nothing.
3. ✅ **B.6** two-state decision bar. Pass opens the reason step; chips stay parked, the mode does not.
4. ✅ **D.1** Screen 2 frame: `max-width:1180px`, `← BACK TO QUEUE` / `ALL OPPORTUNITIES` crumbs, card wrapper, `buyer · source · closes date` subtitle, and the five tabs. Two are parked and **disclose the parking rather than inventing content** — see the note below.
5. ✅ **B.1** progress/`ORDER` line, keyboard legend, source and tag chips, `max-width:1080px` page frame, buyer-note treatment.
6. ✅ **B.5** the `Open full detail →` label on the route to the record.

⚠️ **Two defects the first screenshot caught, both introduced by the fix itself and both since corrected:** the `.queue`/`.queue__inner` frame was written into the stylesheet and never wrapped around the markup, so the card spanned the viewport; and `.queue__keys` was silently dropped when `Queue.css` was rewritten wholesale, so the undo hint lost its type. **Neither had a failure mode — a dropped CSS rule degrades rather than errors, and no test would have caught either.** Only the screenshot did.

⚖️ **New conflict raised by item 4, for Matt.** The bundle shows five tabs; two of them (`Brief`, `Scores & Evidence`) are parked for V1. They are currently rendered and state plainly that they are parked. The alternative is to omit them, which would diverge from the bundle's tab bar. Recorded, not resolved.

**Still buildable now, no new data, no rulings:**
7. **D.2** document-attributed SOURCE column (`Scope.pdf §3` rather than `document`) — `extracted_field.document_id` already exists
8. **A.1.3** queue counter treatment; **A.1** triage "nav collapsed" affordance
9. **B.1** buyer-note callout for entity resolution *(the treatment now exists; the data is not yet wired to it)*
10. **B.6** the decision bar does not yet sit on `--surface4` behind its own top border as a distinct band

**Needs Matt's ruling:**
- **B.4** score strip: bundle renders it, D13 says no
- **D.2** conflict inline vs beneath
- **A.1** full seven-item nav vs two

**Blocked on data or scope:**
- **B.5** six cost facts — needs extraction currently parked
- **B.2** sub-lines *"no ceiling stated"*, *"No addenda"* — not extracted
- **B.2** POSTED — ⚠️ NULL on 1,724 SAM.gov rows

**Not yet audited:** `View 1.3`, `View 2.4`, `View 2.5`.
