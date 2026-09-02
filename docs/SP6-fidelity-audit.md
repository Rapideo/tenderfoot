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

> ### ✅ ANSWERED 2026-09-01, and the answer is yes. **The bundle designs it.**
>
> Found while extracting evidence for the score-strip ruling, not by a pass of
> this section. The bundle's `isCleared` branch renders:
>
> - a **64px mono `0`** in `--acc`, `letter-spacing:-.02em`
> - **`Queue cleared.`** at `600 22px/1.3 Sans`, then a `clearedSummary` line at
>   `400 14px/1.6` `--text4`, `max-width:44ch`, centred
> - **two cards** in a `1fr 1fr` grid, each `--surface` / `1px --brd` / radius 9 /
>   `16px 18px`, left-aligned text — *"3 contracts expire inside your sectors"* over
>   *"Expiration radar — re-competes, months early"*, wired to `goRadars`; and
>   *"Next ingest at 06:00"* over *"4 sources · last run clean"*, wired to `goReports`
> - a `resetQueue` control beneath
>
> **This does not overturn D14.** D14's correction was about *our* three cards
> carrying no `onClick`, and both of the bundle's lead to screens we have not
> built. But **D14's premise — that the cleared state is undesigned — is false
> about the bundle**, whatever the SVRC says, and that premise is why three cards
> were invented in the first place. Worth reading before `View 1.3` is rebuilt.
>
> 💡 Note also that both bundle cards now have **real destinations in our product**
> — `/radars` and `/reports` are stub screens as of the 2026-09-01 nav ruling. The
> dead-end objection that forced D14's correction no longer applies to them.

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

✅ **RESOLVED 2026-08-31.** The SOURCE column is now document-attributed: the endpoint joins `document` on `extracted_field.document_id`, a document-sourced value names its file, and a listing-sourced one reads `listing metadata` as the bundle words it. Section anchors (`§3`) remain unavailable — nothing extracts them — so the filename is the honest granularity.

⚖️ And the standing conflict: the bundle puts a conflict **inline in the value cell**; SP6 §6.1 puts it **beneath with its own origin and quote**. Currently built the spec's way with the bundle's colours. **Matt's ruling.**

### D.3 `View 2.4` Documents — ✅ **AUDITED AND REBUILT 2026-08-31**

Bundle: **two panes**, `grid-template-columns:300px minmax(0,1fr); gap:20px`. Left, a bordered list (`--brdmid`, radius 9, `align-self:start`) headed `BUNDLE — N FILES` on `--surface2`, each row `flex; gap:10px; padding:10px 14px` over `--brdrow`, carrying a **coloured uppercase extension tag** (`500 9px Mono`, `--surface` text on the tag colour, radius 3) beside an ellipsised filename. Right, a reader on `--surface3`, `padding:22px; min-height:420px`.

**Shipped first as a flat vertical list** of every file's text at once. Now two panes, with selection driving the reader.

💡 **The bundle agrees with D12 more than it looked.** Its own right pane is a **placeholder** — *"DOCUMENT RENDER — PLACEHOLDER … Whether .docx / .xlsx render inline or download is undecided and materially changes effort."* The prototype declines to design the viewer; SP4 then ruled the bytes are discarded. So the stored extracted text goes exactly where the prototype left a hatched rectangle, and the deviation is smaller than D12 implies.

### D.4 `View 2.5` Timeline — ✅ **AUDITED AND REBUILT 2026-08-31**

Bundle: `grid-template-columns:112px 20px minmax(0,1fr); gap:14px` — a right-aligned mono date, then a **rail** (a 9px dot over a 1px `--brdctl2` connector), then a title/body pair.

**Shipped first as a flat `date | text` flex row.** Now the rail, with the dot colour carrying the SVRC's own distinction: `--acc` for a sighting (what the documents did) against `--warn` for entity resolution (what the *system* decided — "the least visible thing the system does and the easiest to get silently wrong").

⚠️ **NOT built, deliberately: the bundle's `diff` block** (`--badbg`, mono, for an addendum's real changes). SVRC View 2.5's own known gap records that *"the timeline shows a diff, not a summary-of-changes, and the diffing does not exist yet"* — it still does not. Rendering the container for data nothing produces would promise something the system cannot deliver. **Build it the day anything diffs addenda.**

---

## Summary — what to fix, in the order I would do it

### ✅ DONE 2026-08-31 — items 1–6, both screens deployed and screenshotted

1. ✅ **B.2** three-up DEADLINE / EST. VALUE / POSTED fact panel. `posted_at` threaded through the queue query to feed the third cell; deadline coloured by urgency with a human interval beneath it.
2. ✅ **B.3** deadline-disagreement two-up panel, header and all, on `--badbg` with `--badbrd2` cells. Both values with their sources, resolving nothing.
3. ✅ **B.6** two-state decision bar. Pass opens the reason step; chips stay parked, the mode does not.
   - ✅ **COMPLETED 2026-09-02 — the bar is now the bundle's full THREE-state mode machine.** The 08-31 pass built `askReason` as a **boolean**, which looked like a simplification and was actually half a state machine: the bundle branches **eight** rendered values off that one field, and `askReason: "interested"` was never built. Interested now opens its own step (D21), and the four pieces of the bundle's per-branch ternary that we had hardcoded to the Pass values are branched: `reasonPrompt`, `reasonHelp`, `reasonAccent` (a **constant `--bad`** in our CSS — it would have rendered the discovery prompt in the rejection colour) and `confirmStyle`/`confirmLabel`.
   - ⚠️ **The 08-31 pass also invented the Pass step's copy, and nobody noticed** because this audit recorded the panel's *structure* ("prompt + help text") without transcribing its *strings*. Four divergences, all now corrected on Matt's ruling of 2026-09-02: `WHY ARE YOU PASSING?` → **`WHY NOT? — REQUIRED`**; the help line → **`A rejection with no reason is the one event that teaches nothing.`**; `Confirm pass` → **`Pass & next`**; and the input placeholder regained its dropped tail, **`(this is the training signal)`**. §7.10 makes copy specification, not placeholder — **an audit that checks shape and not strings will keep missing this class.**
   - ✅ `Button` gained the `danger` variant it needed (**D22**), so the Pass confirm is `--bad`/`--baddk` rather than the same accent as the Interested confirm.
   - ✅ **The last-decision toast, built 2026-09-02 (D23)** — the bundle's real undo control, which we had replaced with an inert `<span>` keycap hint in the decision bar. **Found by Matt clicking it.** The audit had never listed the toast at all, because §B.6 audited the decision bar and the toast is a sibling of the card, not part of that bar — a reminder that an audit organised by region will miss anything that falls between two regions.
4. ✅ **D.1** Screen 2 frame: `max-width:1180px`, `← BACK TO QUEUE` / `ALL OPPORTUNITIES` crumbs, card wrapper, `buyer · source · closes date` subtitle, and the five tabs. Two are parked and **disclose the parking rather than inventing content** — see the note below.
5. ✅ **B.1** progress/`ORDER` line, keyboard legend, source and tag chips, `max-width:1080px` page frame, buyer-note treatment.
6. ✅ **B.5** the `Open full detail →` label on the route to the record.

⚠️ **Two defects the first screenshot caught, both introduced by the fix itself and both since corrected:** the `.queue`/`.queue__inner` frame was written into the stylesheet and never wrapped around the markup, so the card spanned the viewport; and `.queue__keys` was silently dropped when `Queue.css` was rewritten wholesale, so the undo hint lost its type. **Neither had a failure mode — a dropped CSS rule degrades rather than errors, and no test would have caught either.** Only the screenshot did.

⚖️ **New conflict raised by item 4, for Matt.** The bundle shows five tabs; two of them (`Brief`, `Scores & Evidence`) are parked for V1. They are currently rendered and state plainly that they are parked. The alternative is to omit them, which would diverge from the bundle's tab bar. Recorded, not resolved.

**Still buildable now, no new data, no rulings:**
7. ✅ **DONE 2026-08-31 — D.2** document-attributed SOURCE column. The record endpoint now joins `document` on `extracted_field.document_id`, so a value names the FILE it came from (`SCOPE OF WORK.docx`) rather than the bare word `document`, and a listing-sourced value uses the bundle's own wording, `listing metadata`. Section numbers (`§3`) are not extracted, so the filename is the granularity that can be stated truthfully. Mutation-proven: removing the attribution fails exactly one test, for the right reason.
8. **A.1.3** queue counter treatment; **A.1** triage "nav collapsed" affordance
9. **B.1** buyer-note callout for entity resolution *(the treatment now exists; the data is not yet wired to it)*
10. **B.6** ~~the decision bar does not yet sit on `--surface4` behind its own top border as a distinct band~~ — **HALF STALE, corrected 2026-09-02 by looking at it in a browser.** `.queue__decision` **does** carry `border-top: 1px solid var(--brdsoft)` and `background: var(--surface4)`. **`.queue__reason` does not** — measured live: `background-color: rgba(0,0,0,0)`, `border-top-width: 0px`. So the band **disappears the moment either step opens**, which the bundle does not do: there the bar is one band whose *contents* swap. Visible in the 2026-09-02 screenshot, where the reason panel sits on white beneath a tinted cost panel. **The fix is two declarations on `.queue__reason`**; left unbuilt because it was outside what was ruled, not because it is hard.

**~~Needs Matt's ruling~~ — ✅ ALL FIVE RULED 2026-09-01. None is open.**

| # | Ruling | Where it landed |
|---|---|---|
| **B.4** score strip | **Render it**, bars as placeholders that state they are unpopulated | D13 **reversed**, new **D17** |
| **D.2** conflict inline vs beneath | **Inline**, as the bundle draws it | spec §6.1 **amended**, new **D18** |
| **A.1** seven-item nav vs two | **All seven, each to a stub** | new **D19** |
| **D.1** parked tabs disclosed vs absent | **Five, parking disclosed** — already built, no change | recorded in `Record.tsx` `TABS` |
| **CONFIDENCE** on a flat `0.6` | **Keep it, for now** — a provisional hold | new **D20** |

Two fidelity corrections landed alongside them, neither of which needed a ruling
because both move *toward* the bundle:

- **`PURSUIT COST` → `COST TO PURSUE — FACTS, NOT A SCORE`.** The short form was
  a **paraphrase** introduced by the SP6 plan (`plans/2026-08-30-sp6-triage-record.md:2806`),
  not by the bundle and not by any deviation. `FactPanel.tsx`'s own header comment
  had quoted the correct string the whole time, which is how the two drifted apart
  without anything failing. Copy is specification (§7.10).
- **The first nav entry reads `Triage`, not `Queue`.** The bundle's word, and the
  SVRC's (`View 1.1 : Triage`). Route and component unchanged.

⚠️ **And one coverage gap the ruling exposed:** the primary nav went from two
entries to seven with **every existing test still green** — it had no coverage
beyond "it disappears when reduced". Two tests added, pinning the seven labels
in the bundle's order and that every entry has a destination.

**Blocked on data or scope:**
- **B.5** six cost facts — needs extraction currently parked
- **B.2** sub-lines *"no ceiling stated"*, *"No addenda"* — not extracted
- **B.2** POSTED — ⚠️ NULL on 1,724 SAM.gov rows

**Not yet audited:** `View 1.3`, `View 2.4`, `View 2.5`.
