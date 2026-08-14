# SP2 — Design system

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this task-by-task. Steps use checkbox syntax for tracking.

**Plan date:** 2026-08-13 · **Slice:** SP2, after SP1.5 · **Standard:** `Proto2PRD.md` §5.4
**Goal:** every primitive the application needs, extracted from frozen prototype V1.2, rendered on a dev-only route, and signed off by Matt before any feature is built on them.
**Spec:** `docs/superpowers/specs/2026-08-03-tenderfoot-design.md` §7 and **§7.10 the fidelity mandate** · `reference/Tenderfoot SVRC.md` v0.5.0 · workflow spec `2026-08-12-tenderfoot-workflow.md`
**Tech stack:** React 19 · Vite 6 · `react-router-dom` 7 *(already installed)* · hand-written CSS against extracted tokens · **no CSS framework** · vitest

> **Demo criterion** (plan of action §6): *every primitive on a dev-only route.* **Ends in a sign-off gate — Matt's, roughly an hour.**

---

## Why this slice comes before any feature

**Getting this order wrong cost IMPACT an entire unplanned sub-project** (plan of action §7.1). Tenderfoot's primitives are unusually load-bearing: the four-score display and the evidence/citation pattern appear on **every** surface, so getting one wrong once means getting it wrong in fifteen places.

**And this is the only place Matt's judgment enters before SP6's go/no-go**, since the hand-run was retired. The gate is the point of the slice, not an epilogue to it.

---

## What changed since this slice was first costed

The stack assessment called SP2 *"unusually cheap — mostly transcription."* **That was costed against V1's subset. Two things have since made it bigger, and one has made it more certain.**

**Bigger — the intelligence chrome is built.** Matt, 2026-08-13: *"I want us to keep those in as we build the application and build them into the UI even though they're not active… They will be vestigial until we activate them."* Score strips, assessment panels, smart-filter controls and their settings are **all constructed and rendered, none wired.** Design spec §7.10 clause 2 was superseded to say so. **A build that omitted them would not be a subset of the product — it would be a different product**, with holes where screens were composed around content.

**Bigger — typography has no token layer.** `tokens.css` carries 67 colours and 13 radii, both verified byte-identical to the bundle. **It carries no type.** The bundle uses **37 distinct `font:` shorthands and 7 letter-spacings**, and the mandate requires typography parity. Task 1 fixes that with the same discipline.

**More certain — the prototype is fully ratified.** SVRC 0.5.0. The three answers that sat provisional for two days are decided, so **no primitive here is built against an open question.**

---

## Scope

**IN:** a type-scale extraction with a verifier, a dev-only route, and every primitive rendered on it with its states.

**OUT — and each has a home:**

| | Where |
|---|---|
| Any screen, view, or feature | SP6 and later. **A primitive gallery is not an application** |
| Wiring anything to the API | SP6 |
| Making intelligence controls *function* | Parked with qualification (§1.1) |
| Responsive behaviour | **Desktop-only by decision, 2026-08-13.** Do not add breakpoints |
| Re-extracting the mock layer | SP1 T12, still outstanding, unaffected by this slice |

> **The guard that binds this slice.** §1.1 parks matching as **undesigned**, not pending. Building inert filter and score chrome puts a wired-up switch one small commit away. **A rendered control may never become an active filter, ranking, or score until qualification is designed** — same shape as the Capacity rule: the artifact is permitted, the data flow is forbidden.

---

## Global constraints

- **Parity is against `prototype/PROTOTYPE/Tenderfoot UI Mockups V1.2.html`**, the frozen bundle. Not "the prototype."
- **Never hardcode a colour, radius, or font.** Every value comes from a token. `npm run tokens` fails the gate if `tokens.css` drifts from the bundle, and the same must become true of type.
- **Copy verbatim.** `ORDER · AMBIGUITY FIRST`, `MACHINE SCORES — A READING AID`, `COST TO PURSUE — FACTS, NOT A SCORE`, `GATED ITEMS — FILED, NOT DELETED (§6.2)` are **specification, not placeholder text.** Several carry an argument.
- **Do not seed fake scores.** The `assessment` table is empty by design. Score surfaces render from genuine emptiness; fixtures would quietly become what everyone demos.
- **Desktop-only.** No `@media`, no `clamp()`, no breakpoints.
- **`npm run check` stays green** — typecheck, tests, build, token drift.
- **Comments describing a mechanism must stay true.** Judge by tense: past-tense contrast explaining why code has its shape stays; a present-tense claim about something that moved is a defect.

---

## File structure

| File | Responsibility |
|---|---|
| `prototype/tools/extract-type.py` | **New.** Emits `src/type.css` from the bundle, same shape as `extract-tokens.py` |
| `prototype/tools/verify-type.py` | **New.** Independent round-trip check. **Must not reuse the generator's data structures** |
| `prototype/PROTOTYPE/src/type.css` | **New, generated.** The type scale |
| `app/client/src/tokens/` | `tokens.css` + `type.css` copied in, plus the copy-in script |
| `app/client/src/primitives/*.tsx` | One file per primitive. Small, focused |
| `app/client/src/primitives/index.ts` | Barrel export |
| `app/client/src/dev/Gallery.tsx` | The dev-only route. Every primitive, every state |
| `app/client/src/router.tsx` | Routes. `/dev/gallery` mounted only outside production |
| `app/client/src/primitives/*.test.tsx` | Per-primitive tests |

---

## Preconditions

- [ ] **P1.** `main` clean, `npm run check` green. *Verify:* `git checkout main && git pull && npm run check`
- [ ] **P2.** On a branch. *Verify:* `git checkout -b sp2-design-system`
- [ ] **P3.** Read design spec **§7.10** before writing any component. It defines what "matching" means and lists the deviations that need no paperwork.
- [ ] **P4.** Open the frozen bundle in a browser and **look at it.** Every task below says "match the bundle"; that is unusable if nobody has seen it.

---

## Tasks

### Task 1 — extract the type scale, and verify it independently

**Files:** Create `prototype/tools/extract-type.py`, `prototype/tools/verify-type.py`, `prototype/PROTOTYPE/src/type.css` *(generated)* · Modify root `package.json`

**Interfaces produced:** `src/type.css` defining every distinct `font:` shorthand and `letter-spacing` in the bundle as a custom property, plus a `tokens` npm script that runs both verifiers.

**Why this is first.** Colours and radii were extracted and verified; **typography never was.** The mandate requires it, and 37 distinct declarations is too many to hold in anyone's head.

- [ ] **Step 1.** Read `prototype/tools/extract-tokens.py` end to end. **This task copies its shape deliberately** — path-relative, derives its version label from the bundle filename, emits provenance comments recording where each value came from and how many times it was used.

- [ ] **Step 2.** Write `extract-type.py`. It finds every `font:\s*(\d+)\s+([\d.]+)px/([\d.]+)\s+'([^']+)'` and every `letter-spacing:\s*([\d.]+em)`, counts uses, and emits `type.css`. **Name by role, not by number** — the same decision taken for colours on 2026-08-11. A declaration used 33 times on uppercase mono labels is `--type-microlabel`, not `--type-9`.

- [ ] **Step 3.** Write `verify-type.py`. **It must parse `type.css` and the bundle independently and compare** — do not import anything from `extract-type.py`.

> **This is not pedantry.** On 2026-08-11 the token generator emitted 67 CSS declarations *without colons* — invalid CSS that looked fine — and it was caught only because the verifier did not share the generator's data structures. **A verification that shares a bug with the thing it verifies confirms it every time.**

- [ ] **Step 4.** Run both. Expected: a count of type tokens, and `PASS`.
- [ ] **Step 5.** Extend the root `tokens` script to run all four tools, so drift in either layer fails the gate.

```json
"tokens": "python prototype/tools/verify-tokens.py && python prototype/tools/verify-type.py"
```

- [ ] **Step 6.** `npm run check` green. Commit.

```bash
git add prototype/tools/extract-type.py prototype/tools/verify-type.py prototype/PROTOTYPE/src/type.css package.json
git commit -m "Extract the type scale and verify it independently"
```

> **Report the number of distinct type tokens in your report.** If it is close to 37, say so plainly rather than rationalising — a 37-step type scale is a finding about the prototype, not a success. **Do not rationalise it away by merging near-identical values:** that breaks pixel parity, and the mandate is explicit that parity outranks elegance. Record it and let Matt decide at the gate.

---

### Task 2 — the token layer reaches the client, and cannot silently drift

**Files:** Create `app/client/src/tokens/` (copied `tokens.css`, `type.css`), `scripts/sync-tokens.mjs` · Modify `app/client/src/main.tsx`, root `package.json`

**Interfaces produced:** both stylesheets imported at the client root; a `sync:tokens` script; a check that the copies match their sources.

- [ ] **Step 1.** Write `scripts/sync-tokens.mjs` copying both files from `prototype/PROTOTYPE/src/` to `app/client/src/tokens/`.

> **Copy, never import across the boundary.** Workflow spec §2: *"`prototype/` stays read-only forever. Production copies out of it; nothing points back into it at runtime."* A build that imports from `prototype/` makes the frozen reference a runtime dependency.

- [ ] **Step 2.** Add a comparison step to the `tokens` gate script that fails if a copy differs from its source. **A copy that can drift silently is worse than an import**, because the verifier still passes against the source.
- [ ] **Step 3.** Import both in `main.tsx` before any component styles.
- [ ] **Step 4.** Verify: change one value in the client copy, run `npm run check`, confirm it **fails**. Revert. **Paste that output** — a guard nobody tested is a guard nobody has.
- [ ] **Step 5.** Commit.

---

### Task 3 — the dev-only route, and the mechanism that keeps it out of production

**Files:** Create `app/client/src/router.tsx`, `app/client/src/dev/Gallery.tsx` · Modify `app/client/src/main.tsx`

**Interfaces produced:** `<Router />` with `/dev/gallery` mounted only when `import.meta.env.DEV`.

- [ ] **Step 1.** Create the router with one real route (the existing `Health`) and the gallery route behind `import.meta.env.DEV`.

```tsx
/* The gallery is a DEV-ONLY route. It exists so every primitive can be seen
 * and signed off before any feature is built on it (plan of action §6, SP2's
 * gate). It is not a product surface and must not ship: Vite statically
 * replaces import.meta.env.DEV with false in a production build, so the
 * branch and everything it imports are dropped by tree-shaking.
 *
 * Verified by Task 3 step 4 rather than assumed -- a dev-only route that
 * quietly ships is a route someone eventually links to. */
{import.meta.env.DEV && <Route path="/dev/gallery" element={<Gallery />} />}
```

- [ ] **Step 2.** Create a minimal `Gallery.tsx` that renders a heading. Primitives arrive in later tasks.
- [ ] **Step 3.** `npm run dev`, visit `/dev/gallery`, confirm it renders.
- [ ] **Step 4.** **Prove it does not ship.** Run `npm run build`, then grep the built assets for a string unique to the gallery.

Run: `npm run build && grep -rc "dev-gallery-marker" app/client/dist/assets/ || echo "ABSENT — correct"`
Expected: `ABSENT`. **Paste the output.**

- [ ] **Step 5.** Commit.

---

### Task 4 — the atoms: micro-label, keycap, chip, status dot

**Files:** Create `app/client/src/primitives/MicroLabel.tsx`, `Keycap.tsx`, `Chip.tsx`, `StatusDot.tsx`, and one test file per primitive · Modify `Gallery.tsx`, `primitives/index.ts`

**Interfaces produced:**
- `<MicroLabel>{children}</MicroLabel>`
- `<Keycap>{'I'}</Keycap>`
- `<Chip tone="neutral" | "accent">{children}</Chip>`
- `<StatusDot state="ok" | "degraded" | "rot" | "off" />`

**These four carry the product's voice.** The uppercase letter-spaced mono micro-label appears 33 times in the bundle and is the single most characteristic element in the design.

- [ ] **Step 1.** For each, find its exact declaration in the bundle. **Do not eyeball from a screenshot** — read the style string.
- [ ] **Step 2.** Write the failing test first. For `MicroLabel`:

```tsx
import { render, screen } from "@testing-library/react";
import { MicroLabel } from "./MicroLabel";

test("renders its text uppercase-styled via the type token, not inline values", () => {
  render(<MicroLabel>order · ambiguity first</MicroLabel>);
  const el = screen.getByText(/order/i);
  /* The point of the assertion: NO hardcoded font or colour. If a future edit
   * inlines `font: 500 9.5px...` this fails, which is the whole guard. */
  expect(el.getAttribute("style")).toBeNull();
  expect(el.className).toMatch(/micro-label/);
});
```

- [ ] **Step 3.** Run it, confirm it fails.
- [ ] **Step 4.** Implement each primitive with a CSS class referencing tokens only.
- [ ] **Step 5.** Add all four to the gallery **with every state** — `StatusDot` in all four states side by side, labelled.
- [ ] **Step 6.** Tests pass, `npm run check` green. Commit.

---

### Task 5 — button, in every variant the bundle contains

**Files:** Create `app/client/src/primitives/Button.tsx`, `Button.test.tsx` · Modify `Gallery.tsx`, `index.ts`

**Interfaces produced:** `<Button variant="primary" | "secondary" | "ghost" keycap?={string} disabled?={boolean}>`

**The bundle contains 49 `<button>` elements.** They are not all the same. Read them before deciding the variant list — **if you find a variant this task does not name, add it and say so in your report** rather than forcing it into an existing one.

- [ ] **Step 1.** Enumerate every distinct button style in the bundle. Report the list.
- [ ] **Step 2.** Failing test covering: each variant renders, the keycap suffix renders when passed, `disabled` is conveyed to assistive tech rather than by colour alone.

> **Colour-only state is a real risk here.** `tokens.css` records that **ninety colour pairs sit below the just-noticeable-difference threshold**, one of them a hover state 0.44 ΔE from a resting surface. A disabled button distinguished only by colour may be indistinguishable in practice. Use a token *and* an attribute.

- [ ] **Step 3.** Implement. **Match the bundle's padding, radius, and font exactly** — `Pass` and `Interested` in the decision bar are the highest-traffic controls in the product.
- [ ] **Step 4.** Gallery: every variant, plus disabled and hover states, labelled.
- [ ] **Step 5.** Commit.

---

### Task 6 — surfaces: Card, FactTile, FactPanel, Callout

**Files:** Create `Card.tsx`, `FactTile.tsx`, `FactPanel.tsx`, `Callout.tsx` + tests · Modify `Gallery.tsx`, `index.ts`

**Interfaces produced:**
- `<Card>{children}</Card>`
- `<FactTile label={string} value={string} sub?={string} emphasis?={boolean} />`
- `<FactPanel title={string} note?={string}>{FactTile[]}</FactPanel>`
- `<Callout>{children}</Callout>`

**`FactTile` is the deadline/value/posted trio** and `FactPanel` is `COST TO PURSUE — FACTS, NOT A SCORE`. **That title is an argument, not a label** — the panel exists to present facts the user judges, explicitly not a computed score. Keep the copy verbatim and keep the distinction visible.

`Callout` is the amber note — *"Listed on Indiana's portal — the buyer is NY OGS, not Indiana."* **That is the entity-resolution finding surfaced to a human**, and it is one of the six gaps the prototype closed by itself.

- [ ] **Step 1.** Failing tests. For `FactPanel`, assert the title renders **exactly**, including the em-dash.
- [ ] **Step 2.** Implement against the bundle's grid definitions.
- [ ] **Step 3.** Gallery: a populated `FactPanel`, and **an empty one** — absence is a distinct state from low confidence (SVRC View 2.3) and the empty case will be common in V1.
- [ ] **Step 4.** Commit.

---

### Task 7 — the intelligence chrome, built inert

**Files:** Create `ScoreBar.tsx`, `ScoreStrip.tsx`, `GatedDrawer.tsx` + tests · Modify `Gallery.tsx`, `index.ts`

**Interfaces produced:**
- `<ScoreBar label={string} value={number | null} />`
- `<ScoreStrip scores={{label: string, value: number | null}[]} />`
- `<GatedDrawer count={number} />`

> ### Read this before writing anything in this task
>
> **These are built and rendered. They are not wired, and they must not become wired.** Matt, 2026-08-13. Design spec §7.10 clause 2 was superseded to require it.
>
> **`value` is nullable and null is the V1 case.** The `assessment` table is empty by design (§1.1) and **stays empty**. A `ScoreBar` with `value={null}` must render as a real, deliberate empty state — not a zero, not a skeleton, not a hidden element. **Do not seed fake scores anywhere**, including the gallery: fixtures quietly become what everyone demos.
>
> **`MACHINE SCORES — A READING AID` is the panel title and it is an argument.** The scores are explicitly not a decision. Copy verbatim.
>
> **Nothing in this task may sort, filter, threshold, or rank.** If you find yourself writing a comparator, stop — that is qualification, it is parked as undesigned, and building it here would be the unratified-decision failure `Proto2PRD` §4.7.5 names.

- [ ] **Step 1.** Failing test: `ScoreBar` with `value={null}` renders the empty state and **does not render a number**; with `value={43}` renders `43` and a bar at the bundle's proportions.
- [ ] **Step 2.** Implement. The bar's fill colour comes from a signal token.

> **`--signal-neg` carries three unrelated jobs** — data-conflict flag, destructive action, and low score (recorded in `tokens.css`). **Use it for the low-score case and note in a comment that the overload is known and handed back, not discovered.** Do not invent a fourth colour to disambiguate; that breaks parity.

- [ ] **Step 3.** Gallery: a full `ScoreStrip` with values, **and one with every value null**, labelled *"V1 renders this state."*
- [ ] **Step 4.** Commit.

---

### Task 8 — rows and chrome: TableRow, StatusBar, HeaderLockup

**Files:** Create `TableRow.tsx`, `StatusBar.tsx`, `HeaderLockup.tsx` + tests · Modify `Gallery.tsx`, `index.ts`

**Interfaces produced:**
- `<TableRow columns={string} background?={string}>{cells}</TableRow>` — `columns` is a `grid-template-columns` value
- `<StatusBar sources={number} degraded={number} rotSuspected={number} lastRun={string} />`
- `<HeaderLockup />`

**`StatusBar` renders a ratified decision.** `4 SOURCES · 1 DEGRADED · 1 ROT SUSPECTED` in persistent chrome was confirmed on 2026-08-13: **rot suspicion belongs in chrome because V1's entire failure mode is a source quietly returning less than it used to.** Persistent chrome says *this interrupts you*; a settings screen says *this is administration*.

**`HeaderLockup` is the mark plus `TENDERFOOT`.** As of V1.2 there is no placeholder line beneath it. The mark is a 22×22 rounded square, 1.5px accent border, containing an 8×8 accent square. **Do not restyle it** — it is finished and was nearly redesigned away once already.

- [ ] **Step 1.** Failing tests, including that `StatusBar` renders the counts in the bundle's exact separator format.
- [ ] **Step 2.** Implement.
- [ ] **Step 3.** Gallery: `StatusBar` in a healthy state (`0 DEGRADED`) and a degraded one.
- [ ] **Step 4.** Commit.

---

### Task 9 — the gallery becomes a review instrument

**Files:** Modify `app/client/src/dev/Gallery.tsx`

**This task has no new primitives. Its job is making the gate possible.**

- [ ] **Step 1.** Organise the gallery so every primitive appears with **every state, labelled**, grouped as atoms / surfaces / intelligence / chrome.
- [ ] **Step 2.** Above the intelligence group, render a standing note in the page: **these are built and not wired; V1 renders the empty state; a rendered control may never become a live filter until qualification is designed.** The gate reviewer should not have to remember that.
- [ ] **Step 3.** Add a side-by-side comparison affordance: each group links to the frozen bundle so a reviewer can check parity without hunting.
- [ ] **Step 4.** `npm run check` green, `npm run build` green, gallery still absent from the bundle.
- [ ] **Step 5.** Commit.

---

### Task 10 — the fidelity audit, written down before the gate

**Files:** Create `docs/SP2-fidelity-audit.md`

**Do not skip this and do not let it become a formality.** The mandate says parity is the non-negotiable success criterion; a slice that claims parity without evidence has claimed nothing.

- [ ] **Step 1.** For each primitive, record: the bundle element it derives from, and any deviation.
- [ ] **Step 2.** **Every deviation needs an explicit `Deviation:` entry with justification** (§7.10). The acceptable-without-paperwork list is: real data replacing mock data, routes replacing in-page state, framework form components, working interactions where the prototype's are inert, and non-visual accessibility additions. **Anything else is paperwork.**
- [ ] **Step 3.** Record what the audit could **not** verify, and why. A parity claim covering only what was easy to check is worth less than an honest partial one.
- [ ] **Step 4.** Commit.

---

## Exit criteria

- [ ] `npm run check` green — typecheck, all tests, build, **and both token verifiers**.
- [ ] `npm run build` produces a bundle with **no trace of the gallery**, proven by grep.
- [ ] Every primitive renders on `/dev/gallery` with every state, labelled.
- [ ] **No hardcoded colour, radius, or font anywhere in `app/client/src`.** Verify:

```bash
grep -rnE "#[0-9a-fA-F]{3,6}|rgba?\(|hsla?\(|font:\s*[0-9]|border-radius:\s*[0-9]|box-shadow:" \
  app/client/src --include=*.tsx --include=*.css
```

returns only token definitions.

> **⚠ Corrected 2026-08-13 during execution — the original pattern could not see half of what it claimed to check.** It was `#[0-9a-fA-F]{3,6}|font:|border-radius:`, which **cannot match `rgba(20,24,28,.05)`** — so a colour living in a `box-shadow` passed a scan reporting zero hardcoded colours. Found when Task 6's implementer flagged that its own shadow literal was unchecked.
>
> **This is the second instance today of the same failure in my own work**, after a `letter-spacing` regex that required a leading `.` and silently excluded three negative tracking values. **A pattern that cannot match a category reports zero of it without saying so**, and the report looks identical to a genuine pass.
>
> **The general fix is the one Task 1 adopted: a conservation check.** Where a count feeds a decision, verify what the pattern *cannot* match, not only what it returns.
- [ ] `ScoreBar` with `value={null}` renders a deliberate empty state, and **no fixture anywhere supplies a fake score.**
- [ ] `docs/SP2-fidelity-audit.md` exists, with a `Deviation:` entry for every departure.
- [ ] **Matt's sign-off.** This is the gate; the slice is not done without it.

---

## What to watch

**The type scale may be absurd.** 37 distinct font declarations is a finding. **Report it; do not fix it by merging values** — that breaks parity, and the mandate ranks parity above elegance. It is Matt's call at the gate.

**The gallery is not an application.** If a task starts adding navigation between screens, state management, or data fetching, it has left the slice. SP6 builds screens.

**Colour-only state distinctions.** Ninety colour pairs sit below the just-noticeable-difference threshold and one hover state is 0.44 ΔE from its resting surface. **A state conveyed only by colour may not be conveyable at all.** Pair it with an attribute or a shape.

**The inert-chrome guard is the one that will erode.** Every task after this one will have a reason to make a filter work. The rule is in the spec, in the SVRC, and in Task 7 — and it will still need saying again.
