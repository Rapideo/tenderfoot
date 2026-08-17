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
padding, type, borders, colours, copy and column order.

⚠️ This paragraph originally ended "…and the four-state health vocabulary."
**D6 falsified that** — the schema has a fifth value, `unknown`, and it is the
only one in production. The claim is corrected rather than deleted, because it
is a good example of what a fidelity write-up asserts before anyone runs it.

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

---

# Found by running it — 2026-08-16

The screen passed six unit tests and a green gate before it was ever
rendered. Both of the following survived that and were visible within
seconds of loading `/admin` against the real 13-row registry.

## D6 — `health` reads `unknown`, and it is the only value in production

**All 13 rows carry `health = 'unknown'`.** The column is
`health text NOT NULL DEFAULT 'unknown'` with **no CHECK constraint**, so the
schema's vocabulary and the bundle's four states (`Healthy` / `Rot suspected` /
`Failing` / `Not ingested`) were never the same set — and **nothing anywhere
writes it.**

This is the same shape of defect as D2's legal mismatch, and **the tests could
not have caught it**: the fixtures supplied the bundle's four words, so the
suite asserted a mapping over values production does not contain. Only real
data showed it.

**`unknown` is not collapsed into `Not ingested`**, and the difference is live:
SAM.gov has been ingested twice (530 and 57 rows on 2026-08-16) and still reads
`unknown`. *Nobody measured* and *measured, nothing there* are different facts,
and a registry that blurs them tells the operator a working source is dead.

It also does not borrow `StatusDot`'s `off` state, because that state's
**accessible name is hard-coded to "Not ingested"** — routing `unknown` through
it would put the falsehood into the accessibility tree while the visible label
avoided it. An unmeasured source gets a decorative grey dot and lets the word
carry the meaning, rather than a fifth `StatusDot` state invented from one
consumer.

**What fills this column: nothing yet — and that is exactly the work §6.4 A3
moved in front of the GO gate on the same day.** This column is the liveness
surface's output.

## The app has never loaded its own fonts

**Not a deviation and not caused by T14/T15 — a product-wide finding.**

`app/client/index.html` contains **no `<link>` to a font provider and no
`@font-face` rule**, and neither does any CSS in `app/client/src`. Every type
token in `type.css` names `'IBM Plex Sans'` or `'IBM Plex Mono'`; **nothing
ever fetches them.** The V1.2 bundle, by contrast, loads both from Google Fonts
with `preconnect` and a full `@font-face` block.

So every screen this project has ever rendered — including `/dev/gallery` at
the **SP2 sign-off gate** — has displayed in whatever the viewer happened to
have installed locally. On a machine with IBM Plex installed it looks correct;
on one without it, it falls back to a serif and looks nothing like the bundle.
`/admin` renders in Times here.

**Consequence for the record:** the SP2 visual sign-off was performed under an
unrecorded condition. It is not invalidated — the primitives' geometry, colour
and spacing are all unaffected — but "matched against the bundle" currently
means *matched given the right fonts are installed*, and nothing in the repo
guarantees that.

**Not fixed here, deliberately.** The fix is one line in `index.html`, but the
choice behind it is not mine: a Google Fonts `<link>` adds a third-party
request on every page load, and the alternative is self-hosting the woff2 files
in the repo. That is a privacy and dependency decision, and it belongs to
whoever owns the fidelity mandate.
