# Admin screens — deviations from the V1.2 bundle

**SP1 T14/T15, built 2026-08-16.** `View 6.1 : Firm Profile` and
`View 6.2 : Source Registry`, matched against `prototype/PROTOTYPE/Tenderfoot
UI Mockups V1.2.html`.

> **Why this file exists.** The frozen V1.2 bundle renders **both admin
> screens completely read-only.** Verified across the whole 700 KB: no
> `<select>`, no `<textarea>`, no checkbox, two `<input>`s (neither on these
> screens), and the ten "toggle" matches are all `toggleTheme` / `toggleDrawer`
> handlers. There is no on/off switch, no posture editor, no profile input,
> and no scrape trigger anywhere in it.
>
> That collides with three things in the record: T14/T15 require both screens
> **editable**; the SVRC scores `View 6.2` one of only **two `Pri 5` nodes**
> and calls it *"V1's entire control surface — switching a source on or off is
> the only lever there is"*; and **§9.6** put the scrape trigger on this
> screen. Strict fidelity would have shipped a control surface with no
> controls.
>
> **Ruled 2026-08-16: build the fidelity, add the smallest controls that meet
> the requirement, and number every invented affordance here** — the same
> discipline SP2 used for D5/D6 — so nothing designed-by-improvisation passes
> as matched-to-the-bundle.

Everything **not** listed below is reproduced from the bundle: grid tracks,
padding, type, borders, colours, copy, column order, and the four-state health
vocabulary.

---

## D1 — the `ENABLED` column

**No bundle evidence of any kind.** The lever the SVRC calls the only one
there is has no rendered form in V1.2.

A sixth grid track (`92px`) appended to the bundle's five; the five are
unchanged. The control is a **native checkbox with a text label**,
deliberately plain — nothing here should look like a designed affordance when
it is a placeholder for one.

**For the design pass:** what this looks like, whether enabling is
confirmable, and whether a disabled source should be visually distinct in the
row rather than only in its own cell.

## D2 — `LEGAL` became an editable `<select>`, and the vocabulary does not match

Two separate deviations that arrive together.

**The vocabulary mismatch (a T13 finding).** The bundle's LEGAL column reads
`ToS OK` / `Rate-limited` / `EXCLUDED`. The schema stores a posture: `in` /
`manual-only` / `out`. **These are not the same axis.** `EXCLUDED` maps to
`out` and `ToS OK` to `in`, but `Rate-limited` describes a *constraint* while
`manual-only` describes a *posture* — a rate-limited source can still be `in`.
The bundle's three strings blend posture with rationale, and the rationale
half already has a home in `legal_note`.

**Not resolved by inventing a mapping.** The screen renders the real enum,
because T15 makes this editable and an editor must write what the column
holds. The bundle's three-tone colour treatment is kept exactly.

**The posture-change note.** The API requires a *new* `legal_note` whenever
posture changes — the existing note documents the previous posture, so reusing
it leaves a row that looks documented and is not. The screen collects it with
`window.prompt`. That is the smallest thing that satisfies the rule and is
plainly not a designed interaction.

**For the design pass:** whether the column shows posture, rationale, or both;
and what collecting the evidence note should actually look like.

## D3 — profile fields became `<textarea>`

The bundle renders each profile field as a **display box**. T14 requires an
editable form, so the box became a textarea **carrying the bundle's exact
border, radius, padding and type** — the control changed, the surface did not.
Saves on blur.

The bundle greys the empty `PAST PERFORMANCE LIBRARY` row and captions why.
That treatment is applied to **any** empty field here rather than hard-coded
to that one, since emptiness is the thing being signalled.

**For the design pass:** save affordance (blur is invisible), validation, and
the JSON-valued fields — `certifications`, `geography`, `hard_limits` are
`jsonb` and are currently edited as raw JSON text, which is honest but hostile.

## D4 — the card is flat, and `Card` could not be used

The admin cards read
`background:var(--surface);border:1px solid var(--brd);border-radius:10px;overflow:hidden`
— **no box-shadow.** The `Card` primitive is the *elevated* triage card and
carries a shadow unconditionally with no variant prop; its own CSS header
records that a second, flatter pattern exists in the bundle and that "this
interface cannot express both."

So `Card` is deliberately not used, and a local flat surface is.

> **This is the trigger SP2 was waiting for.** The sign-off gate deferred the
> spacing and shadow token layers with a named condition: *"extract when a
> composed screen shows which values are systematic … `Card`'s shadow still
> has one consumer."* **There is now a composed screen, and it wants the same
> surface without the shadow.** That is the second consumer, and it argues for
> a `Card` variant rather than a shadow token — the difference is elevation,
> not a scale.

## D5 — the scrape trigger is still unhoused

**§9.6 ruled that the manual scrape trigger lives on this screen.** It is not
built here. T14/T15 do not mention it, and inventing a second undesigned
control alongside D1 would compound the guesswork rather than contain it.

**Consequence, stated plainly:** running a scrape is still `npm run scrape` or
`POST /api/admin/scrape` with a secret. The screen §9.6 designated as its home
does not yet offer it.

---

## Not a deviation

**The screen is a product route (`/admin`), not a dev-only route**, departing
from SP1's plan text. That wording dates to 2026-08-12 and gave its own
reason: *"SP2 owns the design system and carries the sign-off gate; styling
here would pre-empt it."* SP2 has shipped and signed off, so the reason
expired. A `Pri 5` control surface behind `import.meta.env.DEV` is not a
control surface.

⚠️ **It is unauthenticated.** The endpoints behind it already were — this adds
no exposure that did not exist — but it makes the exposure clickable, and
production is gated only by Vercel Deployment Protection. **"Auth in V1" is an
open question on Matt's list, and this screen is a reason to answer it.**
