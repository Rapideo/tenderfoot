# Admin screens — deviations from the V1.2 bundle

**SP1 T14/T15, built 2026-08-16.** `View 6.1 : Firm Profile` and
`View 6.2 : Source Registry`, matched against `prototype/PROTOTYPE/Tenderfoot
UI Mockups V1.2.html`.

**Scope note, final review, 2026-08-18:** this opening line describes only
the file's origin. The file itself has grown past it -- it now also houses
D6 (found running SP1's own build), and SP3.6's rewritten D5 plus the new
H1-H3 -- so "SP1 T14/T15" above should be read as when this file started,
not as what it currently scopes.

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

⚠️ **A second correction, same shape, added at Task 13 review 2026-08-18:**
"the only one in production" above is **still literally true today** — SP3.6
(D6's own resolution note, and H1–H3 further down) adds a `source_health_valid`
CHECK and a real second value, `excluded`, but only on `sp3.6-source-health`,
not on `main`. Production, checked directly at review time, is **13 rows, all
`unknown`**. Left as written rather than edited, for the same reason the first
correction stayed rather than being silently fixed: it is accurate for right
now, and the moment it stops being accurate is the moment this branch merges
— see D6's own note for what changes then.

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

## D5 — the scrape trigger, finally housed (rewritten 2026-08-18, SP3.6)

**§9.6 ruled that the manual scrape trigger lives on this screen. It is now
built here.** A **Run** button appears only on `in`-posture rows — the four
excluded/manual-only sources get no button at all, per design spec §4's rule
that `legal_posture` governs CONTACT (the same rule `Admin.tsx`'s
`isProbeable` implements for the Check control; D2 is a secondary nod, since
it is the deviation that first made posture a gate on this screen, though its
own text is about the LEGAL column's vocabulary, not about probing) — and, on
those rows, is **disabled with a stated reason** where no adapter exists yet
rather than hidden: an absent control is a mystery, a disabled one is an
explanation. Clicking it calls
`POST /api/admin/run?source=<name>`, gated by
`requireAdminSecret` the same way the pre-existing `/api/admin/scrape` and
the new `/api/admin/health` (the Check control's endpoint) are.

**CORRECTED 2026-08-18: there is no `&since=` on that URL, and the version
of this paragraph that said there was described a control that could never
work.** The client used to append `&since=${s.since_default}` -- and
`since_default` is an ISO-8601 DURATION (`P7D`), where the route's
`validateRun` requires a DATE, so every click of Run answered `400 since
must be an ISO-8601 date (YYYY-MM-DD[T...]), got: P7D` and `last_run_at`
never moved. Found by clicking the button, which had never been done. The
window is now derived server-side from the row
(`app/server/src/scrape/window.ts`), following the rule
`003_seed_source_registry.sql` already stated: `since = last successful
run`, with `since_default` as the seed for a source that has never run. An
explicit `?since=` is still honoured -- §9.6 rules that the operator sets
the scope of each run -- it is only its ABSENCE that now means "derive"
rather than "refuse".

**What it does: scrape, import and merge, as one action.** `/run` runs
`runScrape` -> `importArtifact` -> `mergeSightings` inside a single request
and stamps `last_run_at` on completion — what an operator used to need three
separate commands for (`npm run scrape`, `npm run import`, `npm run merge`).
See `app/server/src/routes/admin.ts`'s `/run` handler and design spec §6.

**The artifact lives only inside the request, and that is what keeps SP4's
blob-provider decision parked.** The scrape writes its SQLite transport
artifact to a temp directory (`mkdtempSync`), import and merge read it from
there, and the directory is removed in a `finally` on every exit path —
success, a scrape failure, an import or merge failure. Nothing persists past
the response. Because the artifact only has to survive **within one
request**, no storage decision was required to ship the button, and SP4's
blob-provider question (Vercel Blob / S3 / R2) is exactly as open as it was
before this task.

**`POST /api/admin/scrape` is unchanged, and deliberately so.** Streaming the
`.db` back as the response body remains the right shape for a terminal
operator who wants the artifact itself — it was never the right shape for a
button. Clicking "Run" and receiving a SQLite download is not "running a
scrape" from an operator's point of view; they would still have to
`npm run import` and `npm run merge` by hand, which is precisely the gap this
deviation used to describe. The two endpoints now serve two different
operators (a script vs. a person at the screen) rather than one endpoint
standing in for both.

**Auth, stated plainly, because it is easy to overstate:** Check and Run are
both behind `requireAdminSecret` — a shared bearer secret the screen prompts
for once and holds in `sessionStorage`, not authentication (design spec §7).
This is unchanged and unrelated to the ENABLED toggle's own exposure — see
"Not a deviation" below, which that control still falls under.

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

**RESOLVED 2026-08-18, SP3.6.** Migration 006 adds a `source_health_valid`
CHECK constraint pinning `health` to `ok` / `failing` / `rot` / `excluded` /
`unknown`, and an operator-invoked probe subsystem writes it via the screen's
new Check control. `Healthy` / `Rot suspected` / `Failing` / `Not ingested`
never become database values — see H1 and H2 below for what replaced them,
and why they are a different set from `StatusDot`'s own vocabulary rather
than the same one. **Once 006 is applied, the six rows its own backfill
excludes give the column a second value** (`excluded`, alongside `unknown`)
— but this branch is not merged, and production, checked directly, still
reads **13 rows, all `unknown`**, exactly as this section originally
described. "Resolved" above is a claim about the code and the migration, not
yet a claim about what production shows.

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

---

# Ruled before it was built — SP3.6 design spec §12, 2026-08-17

D1–D6 above were found by building V1.2's admin screens and, in D6's case, by
running them against real data. **H1–H3 are the opposite shape: three
deviations from the bundle's health vocabulary that were RULED in the design
spec before a line of SP3.6 code existed**
(`docs/superpowers/specs/2026-08-17-source-health-design.md` §12) — D6 had
already established that the bundle's four states and the schema's real
column were never going to be the same set, and closing that gap meant
deciding the real vocabulary on purpose rather than discovering it by
accident a second time. Numbered `H` rather than continuing `D`, so a reader
can tell "found by building the screen" from "decided while designing the
column" without re-deriving it from dates.

## H1 — `off` is not a health value

The bundle's Source Registry vocabulary is four states — `Healthy` /
`Rot suspected` / `Failing` / `Not ingested` — the last of which is
`StatusDot`'s `off` state, whose accessible name is hard-coded to
"Not ingested". Under *health = is it up* (design spec §1), `off` is
meaningless: a disabled source can be perfectly reachable. That information
already lives in the ENABLED column and `last_run_at`, and keeping `off` in
the health vocabulary would make one column answer two different questions
depending on the row.

**`StatusDot` itself is unchanged — it still renders all four states.** This
is only about which values the HEALTH **column** may hold, not about the
primitive; `off` stays available to any other consumer that wants it.

## H2 — `excluded` is a fifth value the bundle does not have

Required by the ruling in design spec §2. Four rows are refused a probe
outright because their own terms forbid contact — GovWin IQ, BidNet Direct
and BidPrime (`legal_posture=out`), plus Ohio OhioBuys (`manual-only`,
CAPTCHA-gated) — and two more have no endpoint to probe at all, the
`Manual import` corpus rows: fixed snapshots, not feeds. Both reasons
collapse into the one value, because both are already visible in an adjacent
column (LEGAL for the first four, PLATFORM/ARCHIVE for the corpus pair) — a
sixth `StatusDot` state invented for this would only duplicate information
the row already shows.

**It renders as a word beside a decorative, `aria-hidden` dot — never through
`StatusDot`.** Same reasoning as D6's `unknown`: routing it through `off`
would put "Not ingested" into the accessibility tree for a row that was never
measured, which is the exact falsehood `ea798e9` ruled out. The bundle's
four-state primitive is unchanged; `excluded` simply never reaches it.

## H3 — HEALTH shows a timestamp the bundle does not show

Justified in design spec §3: **a verdict with no timestamp is the
stale-green trap.** Health is only measured when an operator asks, so a
value can be arbitrarily old, and without a visible "checked when" a
three-week-old green dot reads as current — silently rebuilding the exact
failure shape A3 exists to catch. `health_checked_at` renders as a
relative-time label (`checked 3 hours ago`) beside the dot and word,
non-null rows only — an unmeasured row shows no timestamp at all rather than
a misleading "never" or a blank.

**The bundle has nothing to compare this to.** Its HEALTH column is a static
four-state display with no measurement behind it at all, so this is an
addition rather than a rendering of anything the bundle omits.
