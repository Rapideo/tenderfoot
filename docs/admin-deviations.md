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

---

# Found in production — 2026-08-27

## D7 — a request that never completes says so, and frees the row

**Found by clicking Run on production, not by a test.** The click returned an
error, imported nothing, and the error text could not be recovered afterwards:
Vercel's runtime-log API answers `403` for the token available to this project,
so the only copy of the reason was on the screen. That is what made the screen's
own reporting the thing that had to be right.

**The non-2xx path was already correct** and had been since SP3.6's final
review: both `checkHealth` and `runSource` read the response body and surface
`data.error`, falling back to `Request failed (<status>)`. Nothing about that
changed.

**What neither handled is `fetch` REJECTING** — a dropped connection, a request
killed at Vercel's 300s function ceiling, an offline client. There was no `try`
anywhere in `Admin.tsx`, so the rejection escaped the handler and skipped the
`setBusy(..., false)` that every path is supposed to reach. The operator got
**no message and a row frozen busy**, because every control in the row is
`disabled={busy}`. A permanently disabled control with no explanation is the
same broken-looking button `isProbeable`'s own comment exists to prevent,
arrived at from the other direction — and it is strictly worse than the
swallowed-error case that review fixed, because the row cannot even be retried.

Both handlers now wrap the `fetch` in a `try`, clear `busy`, and report
`Request failed — <message>`.

**The message is the browser's own and is never composed here.** This screen
cannot diagnose why a request died, and inventing wording for it would be the
same second-registry mistake that the `since` derivation (`scrape/window.ts`)
and the source-name resolution (`routes/admin.ts`'s `resolveAdapterKey`) both
exist to refuse: a client-side rule about server conditions is a second copy of
knowledge, and two copies drift.

**The bundle has nothing to compare this to.** It is a static rendering with no
request behind it, so this is an addition, not a divergence — numbered here
because the frozen reference is silent, not because it disagrees.

**Two tests, and neither implies the other:** the message proves the reason
survived the failure, and the re-enabled button proves the row can be tried
again. Gate green at **301 tests / 43 files**.

---

# Ruled before it was built — SP4 T6, 2026-08-28

**Numbered `D8`, not `H4`.** The H1–H3 note above says the letter tells a
reader whether something was found by building or decided in advance; that
rule was scoped to SP3.6's health vocabulary, not to every future entry. `D`
is this file's continuous series across slices, `H` is that one series's own
name, and starting here the section header — "found by building" vs. "ruled
before it was built" — carries provenance instead of the prefix.

## D8 — nested archives are not traversed, and now say so

A `.zip` inside a `.zip` becomes a `document` row marked `failed` with
`source_note = 'nested archive not traversed'`. Depth 1 is the same limit the
2026-08-18 spike had — it listed `Att L - Bidders Library.zip` inside
`docs.zip` and logged `skipped: "not a parseable format"`, a wrong reason
that lived nowhere durable. A recorded failure is queryable; a wrong reason in
a throwaway artifact is not. Traversal is deferred rather than refused:
nothing here prevents depth 2 later.

---

# Found by building — SP4 T10, 2026-08-30

## D9 — a bundle's members are extracted where their bytes are, not later

Task 10's brief expanded a `.zip` into child `document` rows marked
`pending`, for a later batch to fetch and extract. **A member row cannot be
fetched by a later batch, ever.** Its bytes came from inside an archive, so
it has no `source_url`, and ruling 1 keeps no bytes anywhere — the design
says documents are fetched, parsed and DISCARDED, and migration 008's own
comment records that `path` is a dead column from the pre-Vercel filesystem
design. The spike reached 86 members across nine bundles; as briefed, every
one of them would have become a row that the next pass fetched from nothing,
failed, and stamped `download failed` — the network blamed for a design gap,
a wrong reason made durable, which is the exact thing [D8] exists to prevent
one paragraph up the same code path.

So a member is extracted at the only moment its bytes exist: inside the
parent's own iteration, by the same `absorb()` that handles a top-level
document, so a member cannot get quieter treatment than a file that arrived
on its own. Nothing else moves. The parent is still marked `extracted` with
no text of its own (design §5), members still carry `parent_document_id`
(§3.1), and a nested archive is still D8's recorded failure at depth 1 —
`expand` is a boolean parameter rather than a counter precisely so that
traversing deeper would require deleting it.

**Two consequences worth stating.** The parent is marked `extracted` AFTER
its members, so a run killed mid-expansion leaves the bundle `pending` and
the next run redoes it; the opposite order would mark the bundle done and
strand the members it had not written yet. And a `pending` row with no
`source_url` is now a recognisable thing — a member stranded by exactly that
kill — so it is failed with a reason that says so and says how to recover it,
rather than being reported as a download that failed.

**Not deviated from, though §4.3 words it as one:** `WHERE closes_at >=
now()`. The `ORDER BY` is what makes the first batch the useful batch, and it
is kept. The filter is not, for two reasons: a comparison against a NULL
`closes_at` yields NULL and WHERE reads NULL as false, which is Task 9's
Critical (b) verbatim; and a permanent filter makes the returned `remaining`
a lie, since documents on a since-closed solicitation would sit `pending`
forever under a counter that never reaches zero.

---

# Found by building — SP4 T12, 2026-08-30

## D10 — the two batch controls sit at the foot of the registry card

`Discover` and `Extract` act on the document queue, which belongs to no
source, so they cannot join the per-row controls the way Check and Run did.
The design bundle predates SP4 and has no control group for them at all.
Rather than invent a region, they sit at the foot of the Source Registry card
and reuse the row controls' own button classes — the same "native affordance,
not a designed one" posture D1 and D5 took, with the visual design of this
screen still deferred. They are placed AFTER the rows because that is the
order of the work: a source is run, which produces solicitations; discover
asks what is attached to them; extract reads what discover found.

**They carry their own busy flag, and that is not a detail.** The task brief
spelled both buttons `disabled={busy}` — but `busy` in `Admin.tsx` is a
`Record<number, boolean>` keyed by source id, and an object is always truthy,
so both controls would have shipped **permanently disabled**. A disabled
control with no explanation is the same broken-looking button D7 exists to
prevent, reached from a third side. `Admin.test.tsx` now asserts `.disabled`
is `false` before clicking, so it cannot come back.

**The readout does not flatten the two endpoints into one shape.** Extract
returns `processed`/`failed`/`remaining`; discover returns
`documents`/`solicitations`. The brief rendered `data.processed ??
data.documents ?? 0` into one sentence, which prints a zero for a key the
endpoint never sends — a number an operator cannot tell from a real zero.
The presence of `remaining` selects the wording instead.

## D11 — the bundle uses two different words for one health value, and this screen surfaces the one that doesn't say "failing"

*(SP6 T14 may renumber this if D11 collides with a number assigned elsewhere first.)*

`health: "failing"` is one database value, but the frozen V1.2 bundle names it
two different ways in two different places: the Source Registry row (via
`StatusDot`) reads "Failing" verbatim, while the persistent footer chrome
(`StatusBar`, index ~617384, the control SP6's `Shell` wires up) reads "N
DEGRADED" verbatim. Both were transcribed faithfully from their own bundle
location in SP2 (`StatusDot.tsx`, `StatusBar.tsx`) — this is not a case of two
words carrying different meanings, and it is not a deliberate semantic
distinction. It is the frozen bundle itself being inconsistent, and SP2's
"copy is specification" discipline preserved that inconsistency rather than
inventing a resolution for it.

SP6 T9's `Shell` composes `StatusBar` into the product's persistent chrome,
which means the word a user actually sees for this fault is "DEGRADED," not
"failing" — even though the health enum, the API, and the Source Registry row
all call it `failing`. `Shell.test.tsx` briefly asserted the word "failing"
would appear in `Shell`'s rendered output (an unverified assumption caught in
review); the test was corrected to assert the bundle copy `StatusBar` actually
renders instead of inventing a `Shell`-level translation to make that
assumption true. No production markup was added to reconcile the two words.

Harmonising "Failing" and "DEGRADED" into one word is a copy decision, not an
implementation one — it belongs to Matt, not to this slice.

---

# Ruled before it was built — SP6 design spec, 2026-08-30

**Same shape as H1–H3: five deviations decided in the SP6 design brainstorm
before a line of `triage`/`record` code existed**
(`docs/superpowers/specs/2026-08-30-sp6-triage-record-design.md` §1 names four
of them among the session's seven rulings), not found by building the screens
and hitting a mismatch. D11 (immediately above, SP6 Task 9) is this file's
most recent entry, so these continue the series as **D12–D16**.

## D12 — `View 2.4` shows stored text and a link out, not the bundle inline

The SVRC specifies the documents view as *"the bundle inline, with extraction
highlights pointing back into the source."* That is not buildable: migration
008 discarded the document bytes by SP4's own ruling — *"fetched, parsed and
DISCARDED — a citation quotes the extracted passage, so there are no bytes to
keep"* — so there is nothing to render inline. `Record.tsx`'s Documents view
renders, per document, the filename, media type, `extract_status`, a link out
to `source_url`, and the stored `extracted_text` itself in a plain `<pre>`.
Design spec §6.2.

**CORRECTED, SP6 final review fix wave.** This entry used to claim the
stored text rendered "with its cited passages" (plural), and `media_type`
was declared on the client's `Doc` type but never actually rendered — two
things this entry described that the code did not do. `media_type` is now
rendered, which makes that half of the claim true. The other half is not:
`extracted_text` renders as an undifferentiated block, with **no marking of
which passage was cited** — nothing highlights, underlines or otherwise
points at the quoted span inside the full stored text. That is a known gap,
recorded here rather than built, because the citation itself is already
readable where it needs to be: each field's own quote, in the fields section
above. That is what the SVRC's "citation" requirement actually needs, and
highlighting a passage inside the separately-rendered full document text is
not attempted.

## D13 — ~~the score strip does not render on the composed queue card~~ **REVERSED 2026-09-01: it renders, and it says it is not populated**

> ### ⚖️ REVERSED BY MATT, 2026-09-01. Read this before the original below.
>
> **The strip renders on the triage card.** The original ruling stands as a
> piece of reasoning and is kept in full underneath, because the reversal did
> not find it wrong — it found it **argued against the wrong alternative**.
>
> **What changed is the third option nobody had put on the table.** D13 was
> decided between *render four dashes captioned as a reading aid* and *render
> nothing*, and on those two D13 was right: four dashes under **A READING AID**
> read as a **result** — the machine scored this and found nothing. What the
> 2026-09-01 ruling picked instead is **render the bars as placeholders and say
> in words that they are not populated yet**, which answers D13's objection
> rather than overruling it. `ScoreStrip` gained a `note` prop for exactly
> this, and `Queue.tsx` passes:
>
> > Nothing is scored yet. These four rows show what will be judged, not a result.
>
> **What was also wrong is the premise about the bundle.** D13 weighed the SVRC
> against a STATUS line. It never weighed either against the **frozen V1.2
> bundle**, which draws the panel — because the fidelity mandate was not in
> view when D13 was decided (`CLAUDE.md` §3 records that neither SP6's spec nor
> its plan referenced §7.10 once). Under §7.10 the bundle is the authority, and
> a prototype/spec conflict is Matt's to rule. It was surfaced and it was ruled.
>
> **The four labels are the bundle's own — `Fit`, `Winnability`, `Value`,
> `Timing`** — read off the prototype rendered in a browser. An earlier draft of
> this work invented `Capability` and `Competition` from memory and would have
> shipped them; opening the prototype is what caught it. Copy is specification
> (§7.10), and that applies to a panel's row labels as much as to its title.
>
> **Nothing about V1 scoring changed.** Every value is still `null`, the
> assessment table is still empty by design (spec §1.1), `ScoreBar`'s RULING 13
> comment still stands, and D16's point — that two of the SVRC's three ratified
> orderings need a scorer — is untouched. This is a **placement** decision, as
> the original entry said it was. See **D17** for the note itself, which is a
> divergence from the bundle in its own right.

---

**The original entry, 2026-08-30, kept in full.**

Two dated rulings disagreed, and the disagreement would have surfaced the
moment a card was composed:

- **SVRC `Region 1.1.2` (2026-08-11):** *"V1 has no scores, so this region
  does not render… Nothing takes its place in the card… The row is shorter in
  V1, which is the honest consequence."*
- **STATUS (2026-08-13):** the intelligence chrome is *"constructed and
  rendered, none wired,"* because a build that omitted it *"would not be a
  subset of the product but a different one, with holes where screens were
  composed around content."*

**Matt ruled for the SVRC, 2026-08-30: the strip does not render on
`Queue.tsx`'s card.** The 08-13 ruling's own stated reason — holes where
screens were composed around content — does not apply here, because the SVRC
says explicitly that nothing takes the strip's place and the row is simply
shorter: there is no hole to leave. A panel captioned **MACHINE SCORES — A
READING AID** showing four dashes reads worse than absence during a
ten-second triage decision — it reads as *the machine scored this and found
nothing*, not as *this has not been scored*.

**A correction that matters, because it was gotten wrong once and caught in
review.** STATUS's line *"how 'vestigial' should look is undesigned and stays
that way until Matt specifies it"* is false, and STATUS has been corrected in
place rather than silently — see its own "Decided this week" entry. **SP2
built it.** `ScoreBar` takes `value: number | null`, renders `—` with no fill
under a `score-bar--empty` class, and its own comment records *"null is the
V1 case (assessment table empty by design, spec §1.1)."* The primitive is
fully built and stays on `/dev/gallery`; this deviation is only about it not
being **composed** into the queue card — a placement decision, not an
unbuilt look. Design spec §2.3.

## D14 — `View 1.3 : Queue Cleared` content, invented because the SVRC calls it undesigned

The SVRC's own words on the cleared state: *"'Nothing to review' is a dead
end; something pointing at the radars, or at what is coming, keeps the
session alive. Undesigned."* Design spec §7.

**CORRECTED, SP6 final review fix wave.** The version of this entry that
shipped described three `ShortcutCard`s that "kept the session alive rather
than dead-ending it" — but all three carried no `onClick`, and the screen
renders them inside `<Shell reduced>`, which hides the nav chrome. Nothing
on the cleared screen did anything; it was the dead end the SVRC's line
exists to prevent, with a claim of the opposite sitting next to it in this
file.

**What is actually built now:** two `ShortcutCard`s, both navigating to
`/admin` — there is no separate metrics view in the product, so "Metrics"
and "Admin" both land on the one screen that has something to show; a real
metrics view is future work, not this fix. **Draw another sample** is
removed rather than wired: there is no draw-a-sample UI anywhere in
`app/client/src`, only `POST /api/triage/samples`, so a card promising one
would be the same dead end reached from the other direction. The screen
states that fact plainly instead — `A new sample is drawn via POST
/api/triage/samples.`

## D15 — `Region 1.1.3` renders empty and states that its four facts are unextracted

The SVRC names four countable facts for the pursuit-cost panel: number of
required forms, whether a pre-proposal conference is mandatory, how many
references are demanded, whether anything needs notarizing. SP4 extracts six
fields, and `prebid_required`, `set_aside` and `value_cents` sit in
`fields.ts`'s `NOT_EXTRACTED` with no extraction logic at all — **zero of the
panel's four facts exist today.** `FactPanel` already carries a
populated/empty split; the empty state here reads *"Required forms,
conference, references and notarization are not yet extracted"* — the same
*we looked / we have not looked* distinction `View 2.3` enforces on fields,
rather than a blank panel or an invented value. Extending extraction to
produce these facts was considered and rejected for this slice: it reopens
SP4's cue-vocabulary work, which is parked with the labelling task. Design
spec §2.4.

## D16 — default order is deadline-soonest-first; the ratified `AMBIGUITY FIRST` default needs a scorer and cannot ship

The SVRC closed its ordering gap on 2026-08-12 by ratifying
`ORDER · AMBIGUITY FIRST` as the default, switchable between *ambiguity
first / score, highest first / deadline, soonest first*. **Two of the three
orderings require a scorer.** Ambiguity is a property of a borderline score,
and with the assessment table empty by design (§1.1) there is no ambiguity
signal to sort on. Only *deadline, soonest first* survives, so `queue.ts`
orders `closes_at ASC NULLS LAST`, and the switch has nothing left to switch
between. **When qualification is designed, the SVRC's ratified answer returns
intact** — nothing here argues against it. Design spec §4.2.

## D17 — the score strip says it is unpopulated, and the bundle has no such line

**Matt's ruling, 2026-09-01, and the load-bearing half of D13's reversal.**

The bundle's `MACHINE SCORES — A READING AID` panel carries a title, an
`EXPAND ALL` toggle and four rows. It carries **no note**, and it could not:
all four of its scores are populated, so it has nothing to disclose.

V1 has no scorer, so ours renders four empty bars. The ruling was *"show the
placeholder for the data bars; but indicate that they are not populated yet
until these judgements are made"* — so `ScoreStrip` gained an optional `note`,
styled from `.fact-panel__note` rather than invented, because FactPanel says
the same **kind** of thing one band over (D15) and the two must not read as
two different voices.

**The line is not decoration and must not be dropped as tidying.** Without it
the panel is exactly what D13 objected to. `Queue.test.tsx` asserts the note's
presence separately from the strip's, so a change that renders the panel and
loses the sentence fails rather than passing a laxer test.

**⚠️ The `EXPAND ALL` toggle is still absent**, unchanged from SP2's reasoning:
it exists to reveal per-row citations, and there are none to reveal. When
scoring arrives, the toggle and the citation rows arrive with it.

## D18 — a conflict renders inline, and the losing value's quote is dropped

**Matt's ruling, 2026-09-01.** The bundle writes a disagreement into the value
cell itself:

```
v:   "2026-09-18 · CONFLICT with Addendum 2 (2026-09-25)"
conf: "48%"    src: "listing + addendum"    bg: var(--badbg2)
```

SP6 design spec §6.1 specified the opposite — *"conflicts render beneath the
winner, with their origin, unresolved"* — on its own row, carrying its own
origin **and its own quote**. Both were defensible; `CLAUDE.md` §1 reserves
that call for Matt. **He ruled for the bundle, so the spec is amended rather
than quietly contradicted** — §6.1 now records the ruling and its date.

**⚠️ WHAT THIS COSTS, recorded because it is a real loss.** The losing value's
**quoted passage no longer appears anywhere on the screen.** The bundle's field
table has no per-row quote at all, and one cell cannot hold two citations. What
survives is both **values** and both **origins** (joined `A + B`, the bundle's
own connective). What does not survive is the loser's evidence.

**This bites hardest on exactly the case the display exists for.** A listing
-origin winner has no extracted passage, so when a document contradicts a
listing — the FSSA near-miss shape — the row now shows **no citation at all**.
The record's test fixture had this precise shape, and its only quote hung off
the conflict; a `qa_closes_at` row was added so the suite still proves a quote
renders somewhere, rather than losing that coverage silently.

**Nothing is lost in the DATA.** `resolveField` still returns
`{value, origin, conflicts}` with quotes intact, at read time. This is a display
decision and is reversible without re-extraction.

**⚠️ A SECOND CONSEQUENCE, found by screenshot and not by any test.** The SOURCE
column is a fixed 150px that truncates with an ellipsis (Matt's ruling,
2026-08-31, on the grounds that `title=` puts the full name one hover away). A
conflicted row now puts **two source names** in that cell. On real data it
renders as `Solicitation Amendment…` — so in practice **the losing value's
origin is hover-only**, which is thinner than "both origins survive" implies.
The `title` attribute carries the full joined string and is now pinned by a
test. **Whether that is good enough is Matt's call and is open**; the earlier
truncation ruling was made before any row had two sources in it.

## D19 — Pipeline is in the primary nav, and the SVRC says it should not be

**Matt's ruling, 2026-09-01: all seven nav entries, each to a stub.**

The bundle's shell carries seven: `Triage · Opportunities · Radars · Entities ·
Reports · Admin · Pipeline`. **The SVRC carries six.** Region A.1.2 lists
*"Triage, Opportunities, Radars, Entities, Reports, Admin"* and then says the
pipeline board *"joins this list when the management phase starts and not
before"*; Screen 7 is marked `PARKED`.

**The conflict was surfaced before the ruling, not after it**, and Matt ruled
for seven with it on the table.

**Two further notes, both consequences of the same ruling.**

**The first entry now reads `Triage`, not `Queue`.** Ours said Queue until
today. Copy is specification, the bundle says Triage, and the SVRC calls the
screen `View 1.1 : Triage`. The **route** is still `/` and the component is
still `Queue.tsx` — this is a label, not a rename.

**Every entry goes to a real screen, none is disabled.** The ruling was
specifically for stubs over inert entries, and the reason is on the record:
**D14 was corrected for exactly the cheap failure** — three `ShortcutCard`s
that looked like navigation and carried no `onClick`, which made the cleared
screen the dead end the SVRC's line exists to prevent. Five inert nav entries
would be that mistake five times, on the shell. Each stub's copy is the
**SVRC's own Overview** for that screen, compressed but not reworded into a
claim it does not make.

**⚠️ The bundle hides the nav entirely on the triage screen**
(`nav = navCollapsed ? [] : screens.map(…)`), and so do we, so this ruling
changes what is visible on the record, admin and stub screens — not on the
`Pri 5` screen.

## D20 — CONFIDENCE keeps a flat 0.6, knowingly

**Matt's ruling, 2026-09-01: *"For now, I say we keep it."* Recorded as a
provisional hold, not a settled answer, because it was ruled with the
objection in front of him.**

`fields.ts:211` sets `confidence: value !== null ? 0.6 : 0` — **a constant**.
Every document-extracted value in the product renders `60%`. It means *found*,
not *how sure*, and it sits under a column heading a reader will believe.

**The colour-coding cannot vary either.** `confColour()` in `Record.tsx` has
three real bands (`≥0.85`, `≥0.6`, below), and with a constant input every
found row lands in the same middle band, permanently. The machinery is built,
tested, and decorative by construction.

**The bundle designed the opposite.** Its own fixture runs 97 / 91 / 84 / 76 /
48 / `—` across four colour bands. Confidence there is a judgement.

**Why this is not simply a fidelity fix.** The heading `CONFIDENCE` is **the
bundle's own literal copy**, so relabelling the column would itself be a
divergence needing its own number. This is the one place in the five rulings
where the fidelity mandate and the honesty of the display genuinely pull
against each other.

**`fields.ts`'s own comment is straight about the value:** a non-flat score is
*"deferred pending the slice's accuracy instrument — ruled out for this round,
not overlooked."* The **value** is a known deferral; the **label** is what was
ruled on, and the ruling is *keep it, for now*.

**Two cheap exits remain open** whenever this is revisited: render `—` until
the number varies (the treatment already exists for absent rows), or relabel
the column. Neither needs new data or extraction work.

---

## D21 — the Interested step asks a different question from the bundle's, with an invented vocabulary

**Matt's ruling, 2026-09-02, taken as a gate question under `CLAUDE.md` §1 with
both options and their costs in front of him: replace the question.**

### What the bundle draws, in full

The frozen V1.2 bundle **already has an Interested branch** — this is not a
step we invented. `decide()` sets `askReason: "interested"`, and eight
rendered values branch off it:

```js
const YES_CHIPS = ["Strong fit", "Sub / teaming play", "Known buyer", "Watch only"];
reasonPrompt: askReason === "pass" ? "WHY NOT? — REQUIRED"  : "ANYTHING TO NOTE? — OPTIONAL",
reasonHelp:   askReason === "pass" ? "A rejection with…"    : "Skip it and the decision still records.",
confirmLabel: askReason === "pass" ? "Pass & next"          : "Save & next",
confirmStyle: …--baddk/--bad on pass, --accbrd/--acc otherwise
confirm() { if (kind === "pass" && !picked.length && !freeText.trim()) return; … }
```

That last line is the sharp end: **the bundle's Interested step is optional**,
and confirming it with nothing selected is allowed.

### What we ship instead

`WHERE ELSE WOULD THIS HAVE REACHED YOU? — REQUIRED`, over seven single-select
channels — `already_knew · indiana_email · portal · colleague · nowhere ·
not_sure · other` — which the server refuses to record a decision without
(400, `field: "discovery_channel"`).

**Three things change, and each is a separate cost:**

1. **The question.** "Anything to note?" is an open note about *fit*; ours is a
   closed factual question about *provenance*. Different question, so the
   bundle's four `YES_CHIPS` do not survive.
2. **The requiredness.** `ANYTHING TO NOTE? — OPTIONAL` and *"Skip it and the
   decision still records"* are literal bundle copy, and §7.10's copy clause
   makes copy specification rather than placeholder. Both are gone.
3. **The vocabulary is INVENTED, not derived** — see below.

**What is NOT a deviation, and should not be re-litigated as one:** the step
existing at all; its prompt/help/chip-row/input/Back/confirm frame; the label
`Save & next`; and the `--acc`/`--accbrd` confirm style. All of that is the
bundle's own Interested branch, which we had simply never built — we shipped
the Pass branch and a boolean where the bundle has a three-state mode.

### The vocabulary cuts against this project's own precedent, and that is the real cost

**SVRC Region 1.1.4 parked reason chips on exactly this reasoning:** *"the chip
vocabulary should be DERIVED from that hand-run rather than invented before
it"*, because pre-set categories flatten what a person would otherwise say in
their own words. **That parking is still live** — the Pass step ships with free
text and no chips, and this deviation does not reopen it.

**The argument for overriding it here is narrow, and must stay narrow:**

- A **reason** is an open-ended judgement. A **channel** is a closed factual
  set — an Indiana alert either exists or it does not.
- **Free text cannot be counted.** A derived-later vocabulary yields no
  discovery number *from the session it is needed for*, and that session is the
  GO/NO-GO gate.
- `other` and `not_sure` are the escape hatches. **If either dominates, the
  vocabulary was wrong, and the values themselves will say so** — which is a
  property the parked reason chips would not have had.

### Why the requiredness has no off switch, unlike `requireReasonOnPass`

That flag exists because a queue of forty items with three obvious junk rows
must not stall on a text field — a friction argument about the **common**
branch. Interested is the **rare** branch, and this is not a text field:
`not_sure` is a real option, so the prompt is always answerable in one tap.

Switching it off would not lose a corpus, as `requireReasonOnPass` does. **It
would lose the gate's only measure, silently, while every screen kept
working** — and a skipped answer would be indistinguishable from an
unanswerable one. That is precisely the defect that made the 12.5% recall
figure unusable: a denominator nobody can defend.

### What this costs that is worth naming

**The bundle's Interested step captured a note; ours does not ask for one.**
The free-text box is still there and still writes `reason`, and `other`'s
detail is specified to go in it — but nothing on screen now *invites* a note
the way `ANYTHING TO NOTE? — OPTIONAL` did. If the fit vocabulary
(`Strong fit`, `Sub / teaming play`, `Known buyer`, `Watch only`) turns out to
matter, it is a second question on this step, not a replacement for this one.

**Migration 013 carries the full argument** for channel-over-yes/no and for
allowing NULL; this entry carries the fidelity half.

---

## D22 — `Button` gains a `danger` variant, and the Pass confirm stops looking like a save

**Not ruled separately. Built 2026-09-02 as part of Matt's ruling to make the
Pass step match the bundle, and recorded here so it can be reversed in one
line if that reads as too wide.**

The bundle branches **one** button's style on `askReason`:

```
confirmStyle: "border:1px solid " + (pass ? "var(--baddk)" : "var(--accbrd)") +
  ";background:" + (pass ? "var(--bad)" : "var(--acc)") + ";color:var(--surface)" +
  ";border-radius:7px;padding:11px 18px;font:600 12.5px/1 'IBM Plex Sans'"
```

**We had built only the accent half.** `Confirm pass` rendered `--acc` — the
same colour as the Interested confirm — so the two branches of the decision
were visually identical at the moment of committing. STATUS already named
`Button` danger-primary as an SP2 gap *"gated on SP6 existing"*; this is the
first screen that needed it.

**Defined at `size="sm"` only**, because the bundle draws it nowhere else.
`variant="danger"` without `size="sm"` yields an unstyled button **on purpose**
rather than an invented large red control — there is no bundle declaration for
one.

`--baddk` (`--signal-neg-deep`) has exactly **one** use in V1.2 and this is it.
It is a real step darker than `--bad`, verified in the browser
(`rgb(140,50,38)` border on `rgb(163,58,46)` ground), so substituting `--bad`
would have flattened a distinction the bundle drew deliberately.

---

## D23 — undo was a `<span>` dressed as a button, and the bundle's real control is a toast

**Found by Matt on 2026-09-02, by clicking it.** *"The Undo button doesn't seem
to do anything… I don't even know if it's really meant to be a button."*

**He was right twice over.** It was not a button — `<span class="queue__keys">`
with a `Keycap` inside — and it was not meant to be there at all.

### What the bundle actually has

Undo is a real `<button>`, and it lives in a **toast** that appears after each
decision (V1.2 ~567748):

```html
<div style="display:flex;align-items:center;gap:12px;background:var(--ink);
     border-radius:7px;padding:9px 11px 9px 14px;animation:tfup .2s ease both">
  <span style="font:400 12px/1 Sans;color:var(--inktx4)">{{ lastDecision }}</span>
  <button on-click="{{ undo }}" style="border:none;background:var(--ink3);
     color:var(--inktx5);font:500 10px/1 Mono;letter-spacing:.08em;
     padding:6px 8px;border-radius:4px">UNDO · U</button>
</div>
```

It renders only while `lastDecision` is set, and `commit()` clears that after
**6000ms**. The label is the sentence naming what just happened —
`Interested · Nowhere` — so the control says what it would undo.

### Two tokens were purpose-named for this and had been spent elsewhere or not at all

- **`--ink-raised`**, whose own comment reads *"controls sitting on ink (Show
  menu, **UNDO**)"*.
- **`--type-body-decision`**, whose comment reads *"last-decision toast text"*
  with **1 use in V1.2**. We had spent it on the reason step's input, which is
  why that input measured 12px where the bundle is 13px — **logged as an
  unexplained discrepancy earlier the same day, and this is the explanation.**
  The input now uses `--type-body-plain` (400 13px/1 Sans), which is correct.

### What was removed, and why it is not a repeat of an old mistake

`.queue__keys` and its `<span>` are gone. **The bundle has no undo affordance in
the decision bar**, and its keyboard legend is the meta line at the top of the
page — `I INTERESTED · P PASS · U UNDO` — which we already render verbatim. So
the hint was a duplicate *and* a false affordance.

⚠️ **That CSS rule was dropped once before by accident**, in the fidelity
rewrite, while the element stayed — the hint silently lost its type, and the
rule was restored with a comment saying so. **This removal is the opposite
case:** the element is gone on purpose, so the rule has no consumer.

### The class of defect, stated plainly

**A rendered control that does nothing is indistinguishable from a broken one.**
This is the third instance in the project — D14's three `ShortcutCard`s with no
`onClick`, SP3.6's Run button that had never worked in any browser, and now
this. **No test could have caught it:** an inert `<span>` has no behaviour to
assert against, which is exactly why it survived. It took a person clicking it.

---

## Not a deviation — pass chips, ruled 2026-09-02

**Matt, on the Pass step's absent reason chips:** *"We do want chips in the pass
step at some point but not now."*

**Recorded so the parking is not mistaken for a decision against them.** SVRC
1.1.4 parks the vocabulary as needing to be **derived from a hand-run rather
than invented**, and D21 leans on that parking to justify the discovery
channel's narrow override. This confirms the parking stands *and* that chips are
wanted — the blocker is the hand-run, which sample 1 is the first opportunity to
produce. **Do not invent a pass vocabulary in the meantime.**

---

## D24 — the description panel, which the bundle has no equivalent of

**Found 2026-09-02 by Matt trying to use the product**, which is the only way this
class of thing gets found:

> *"There are no extracted fields. There are no questions due. None of those are
> available. There's no document. There's no timeline… I think we at least need to
> capture a summary of the posting or something we can get off that site. Until I
> can get more context, I'm not really going to be able to make judgment calls."*

### The bundle has nothing to be faithful to

Searched before designing: **zero** occurrences of `description`, `synopsis` or
`abstract`. The four `Summary` hits are `clearedSummary` (the queue-cleared line)
and `oppsSummary` (a count of rows). **There is no per-solicitation prose anywhere
in V1.2**, so this panel is an invention and takes a number rather than a parity
claim.

**Why the bundle could get away with it and we cannot.** Its five mock
opportunities are hand-written and instantly legible — *"Care-management workflow
redesign"*, *"External Quality Reviews for MCO Programs"*. Real SAM titles are
`16--MAST,HEATER DRAIN` and `KEYSIGHT N8487A POWER SENSOR`. A card designed
around titles a human wrote does not survive contact with titles a procurement
system generated.

### Placement — ruled by Matt

> *"I want it to the right of our machine scores."*

That is exactly where `COST TO PURSUE — FACTS, NOT A SCORE` sits in the bundle's
two-up grid (`minmax(0,1.15fr) minmax(0,1fr)`). **So it STACKS ABOVE the cost
panel rather than replacing it** — §7.10 clause 2 requires parked chrome to be
built and left inert, not trimmed. A test pins the cost panel surviving beside
it, because a regression that swapped them would still show the description and
would silently drop the bundle's own chrome.

### ⚠️ It is NOT called a summary, and that is the load-bearing half

Matt asked for a *machine summary*, and ruled the same day that it is **labelled
for what it holds until a model actually writes one**. Today the panel shows
**SAM's own prose** — boilerplate-heavy, frequently opening *"This is a combined
synopsis/solicitation for commercial items prepared in accordance with…"*.

Heading that `MACHINE SUMMARY` would repeat **D20's** mistake exactly: a label
claiming more than the data earns, under which a reader believes something a
machine did not do. **A test asserts `MACHINE SUMMARY` is ABSENT**, so the rename
cannot happen by accident before the summariser exists.

`SUMMARISE` is built and **disabled**, per §7.10 clause 2 — the intelligence
chrome is constructed and left non-functional until the thing behind it is
designed. Disabled is the honest state; a live-looking control that does nothing
is the D14 / D23 defect, which this project has now hit three times.

### What the data actually supports, measured rather than assumed

Backfilled on production 2026-09-02: **0 → 8,484 of 9,883** solicitations.

**The remaining 1,399 are not a miss, and this was checked rather than shrugged
at.** Of 400 sampled sightings behind SAM rows that still have no description,
**zero** carried usable text in the payload — 369 have no `descriptions` key at
all and 31 have an empty one. The other 201 are the two corpus imports, which
never had descriptions. **SAM does not publish one for roughly 12% of notices.**
Every row that has text got it.

So the empty state — *"This source published no description."* — is a statement
of fact that fires about one card in eight, and it says so rather than rendering
a blank panel that reads as a bug.

### The truncation is server-side, and that is a content decision

Matt: *"a machine summary that summarizes in 200 words what the contract is."*
The card truncates to ~200 words on a word boundary, preferring a nearby sentence
end; the Brief tab carries the whole thing. **One stored column, two renderings**
— a stored summary alongside a stored full text would be two columns that must
agree, and the shorter would drift the first time anything regenerated it.

### And the Brief is half-unparked

Its **judgement** half — why this fits, a recommended posture — is a call against
the Firm Profile and stays parked with qualification (design spec §1.1). What
arrived is the source's own description, a **fact** rather than a judgement,
which was never the parked part. The callout now says exactly that.
