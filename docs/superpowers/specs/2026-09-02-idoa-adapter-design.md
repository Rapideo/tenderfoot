# The IDOA adapter, and the second source shape — design

**Written 2026-09-02.** Brainstormed with Matt the same day; every ruling below is his and is
attributed inline.

**Slice status: designed, not planned, not built.** The next step after this document is
`writing-plans`, not code.

---

## 0. What this settles, in one paragraph

Indiana IDOA cannot be ingested by the adapter framework as it stands, and that is a fact about
the **framework**, not about IDOA. `Adapter.fetchListing(since, until, cursor)` assumes a
filterable date, a `modifiedAt` on every item, and a resume marker derived from those dates. IDOA
has no dates at all except a response deadline. This design adds a **second source shape** —
`SnapshotAdapter` beside the existing windowed one — builds IDOA against it, and states what the
merge layer must carry so a synthesised date can never be mistaken for a published one.

---

## 1. The finding, because it is bigger than the adapter

`app/server/src/scrape/adapter.ts` today:

```ts
export interface ListingItem {
  externalId: string;
  modifiedAt: string;      // REQUIRED
  raw: unknown;
}

export interface Adapter {
  name: string;
  fetchListing(since: string, until: string, cursor: string | null): Promise<ListingPage>;
}
```

Three assumptions, all load-bearing, all documented in the file's own comments:

1. **Every adapter takes a date window** — *"this is what makes backfill and live the same code
   path (§3.1)."*
2. **Every item carries `modifiedAt`.** `run.ts` resumes by tracking the **minimum** `modifiedAt`
   written (`lowWater` → `nextUntil`), exploiting the fact that SAM pages newest-first.
3. **An item with no usable date is excluded** from `items` and counted in `undatedSkipped`
   rather than poisoning the marker.

**Applied to IDOA literally, all 50 rows land in `undatedSkipped` and nothing ingests.** The
framework does not fail loudly; it succeeds at importing nothing.

> This is why the slice is scoped as a framework change with an adapter attached, rather than an
> adapter with a workaround inside it.

---

## 2. Two source shapes

**⚖️ Ruled by Matt, 2026-09-02: recognise both shapes explicitly rather than making one pretend to
be the other.**

| | **Windowed feed** | **Open-set snapshot** |
|---|---|---|
| Example | SAM.gov | IDOA, City of Indianapolis |
| Filterable date | yes | **none** |
| History | reachable, backfillable | **open set only — no past** |
| Resume | lower the ceiling (`nextUntil`) | **none — see §4** |
| The clock | the source publishes it | **our own scrape** |

### 2.1 The type design

```ts
export type SourceShape = "windowed" | "snapshot";

export interface WindowedItem { externalId: string; modifiedAt: string; raw: unknown; }
export interface SnapshotItem { externalId: string; raw: unknown; }   // NO modifiedAt

export interface WindowedAdapter {
  shape: "windowed";
  name: string;
  fetchListing(since: string, until: string, cursor: string | null): Promise<WindowedPage>;
}

export interface SnapshotAdapter {
  shape: "snapshot";
  name: string;
  fetchSnapshot(cursor: string | null): Promise<SnapshotPage>;
}

export type Adapter = WindowedAdapter | SnapshotAdapter;
```

The two page types share everything the capture layer needs and differ only in their items and
in one field that is meaningless without dates:

```ts
interface PageBase {
  nextCursor: string | null;   // opaque; null means no more pages
  requestUrl: string;
  httpStatus: number;
  payload: string;             // the response body exactly as received
}

export interface WindowedPage extends PageBase {
  items: WindowedItem[];
  undatedSkipped?: number;     // a dated source that returned an undated row
}

export interface SnapshotPage extends PageBase {
  items: SnapshotItem[];
  // NO undatedSkipped -- there is no date to be missing, so the counter would
  // always be 0 and would read as "we checked and found none", which is false.
}
```

`payload` and `requestUrl` are unchanged on both, so `artifact.ts` and the capture path need no
knowledge of the shape.

**`SnapshotItem` omits `modifiedAt` rather than allowing it to be null.** That is the point of
the whole change: it makes fabricating a date **structurally impossible** rather than merely
discouraged. A snapshot adapter has nowhere to put one.

**Rejected: option C, "make snapshot a degenerate window"** — have IDOA accept `since`/`until`,
ignore them, and stamp `modifiedAt` with the run timestamp. Zero framework change and it works
today. It is also a fabricated date flowing straight into `posted_at` and the volume metric,
indistinguishable from a published one. Recorded here so it is visibly rejected rather than never
considered.

**Rejected: option A, one interface with an optional second method.** Cheaper than the union, but
nothing stops an adapter implementing both or neither, and every consumer must remember to branch.

---

## 3. IDOA as observed

**⚠️ Every fact in this section was observed on 2026-09-02 and is a claim about a live web page.
Re-verify before building.** The page carries no version or API contract.

- **URL:** `https://www.in.gov/idoa/procurement/current-business-opportunities/`
- **Static HTML.** No JS rendering required, no login, no CAPTCHA, no API.
- **Columns:** `Event Name` · `Agency` · `Event ID` · `Event Description` · `Response Due By` ·
  `Contact`
- **71 open solicitations across TWO tables** — 70 in the main `events-table` plus **1** in a
  separate *"Additional Business Opportunities"* section (`table05781`) with identical headers.
  > ⚠️ **CORRECTED 2026-09-02 by Task 1. This line read "~50 in the largest table" and was
  > wrong** — the page's DataTables config sets `pageLength: 50` and drops off-page rows from the
  > DOM, so a count taken in a browser sees 50 of 70. The raw HTML has all of them. **The
  > undercount was exactly the risk §3.1 was written to catch, and it was real.**
- **Event ID:** 15 digits, e.g. `002300000087895`, `007000000088051`.
- **Due date format:** `09/02/2026 3:00:00PM EST` — US-order, 12-hour, named zone.
- **Documents:** one ZIP per row, linked from the Event Name cell, e.g.
  `https://www.in.gov/idoa/proc/solicitations/files/002300000087895.zip`
- **No posted date anywhere.** Only **3 of 50** descriptions contain a long-form date, and all
  three are *addendum* notices — not postings.

### 3.1 ✅ ANSWERED 2026-09-02 by Task 1 — and both answers changed the build

Findings recorded in `docs/2026-09-02-idoa-page-facts.md`, against a committed fixture.

**Three `<table>` elements, and TWO of them hold solicitations.**

| Table | Section | Rows | Verdict |
|---|---|---|---|
| `events-table` | main listing | **70** | solicitations |
| `table05781` | *"Additional Business Opportunities"* | **1** | **solicitations — same headers, genuinely distinct section** |
| — | *"Pre-Proposal Conference"* | 3 | **not** solicitations; a schedule referencing rows listed elsewhere |

**Total: 71.** An adapter that parses only the biggest table silently drops a whole category.

> 🔴 **The one row in `table05781` is not a rendering artifact and not an Indiana agency.** It is
> **RFP 23420 Group 71022 — Business Consulting Services**, a **NASPO ValuePoint cooperative**
> RFP issued by the *State of New York Office of General Services*, and its **Event ID is the
> literal string `NA`**, not a 15-digit number. See §3.2.

**The ordering is settled, and it is the dangerous answer.** The main table is sorted
**ascending by `Response Due By`**, with zero violations across all 69 adjacent pairs — and
explicitly **not** by Event ID. Confirmed by exhaustive per-row extraction, not by the two-row
anecdote that raised the question.

> **So §8's trap is live, not hypothetical: position in this table encodes DEADLINE, not
> recency.** No order-derived signal may be recorded. The adapter derives nothing from row
> position.

### 3.2 🔴 Two facts that break the obvious parser

**Not every row has a document.** **66 unique ZIP hrefs for 71 rows** — five rows have no Bid
Documents link at all. A parser that assumes an anchor per row throws on the first one that
lacks it.

**Event ID is not always numeric.** 70 rows carry a 15-digit ID; `table05781`'s row carries
`NA`. So `external_id` cannot be "the Event ID" unconditionally — `NA` is neither unique nor
stable, and two such rows would collide into one solicitation.

---

## 4. What `run.ts` does, per shape

**The windowed path does not change.** `since`/`until`, `lowWater`, `nextUntil`, and the
tie-block livelock guard are untouched. A snapshot source never enters that code.

**The snapshot path:**

| | Windowed | Snapshot |
|---|---|---|
| `since` / `until` | required | **absent** |
| `lowWater` | tracked | **not computed** |
| `nextUntil` | a date | **`null`** |
| `done` | when the window is walked | when `nextCursor` is `null` |
| Cross-invocation resume | yes | **no — deliberately** |

**Cursor paging is permitted; date windowing is not.** These are separable concerns and
conflating them is part of what made the current interface unfit. IDOA is one page today; a
future snapshot source that pages by cursor works without change.

### 4.1 Why snapshots do not resume across invocations

A windowed source can resume because **the past does not change**. A snapshot of *"what is
currently open"* shifts between runs, so a cursor saved from a previous invocation may skip rows
or duplicate them, and **neither failure is visible in the result**.

**So a snapshot run that exhausts its budget reports partial and starts over next time.** At 50
rows that costs nothing. If a snapshot source ever grows large enough for that to hurt, it will
say so loudly — repeated partial runs — rather than silently miscounting, and that is the signal
it needs a different treatment.

---

## 5. The row limit

**⚖️ Matt, 2026-09-02:** *"It would be nice to have some manual controls where I can say, 'Just
grab me 1,000 records.'"*

`limit` is added to the run request and applies to **both shapes**. It counts items **written**,
is reported in the result, and is orthogonal to the time budget.

**Why both, rather than replacing the budget.** `run.ts`'s own comment: *"the ceiling that
matters is Vercel's 300s function duration, which is time, not rows."* That remains true — the
budget is a **safety rail against the platform**. `limit` is an **operator intent**. They fail
differently and both are wanted: hitting the budget means "the platform stopped us"; hitting the
limit means "you asked for this much."

**This also replaces a clumsy idiom.** Production's two real ingests were expressed as a
"12-hour" and a "seven-day" window — which is a way of saying *a manageable amount* in the only
vocabulary available. For a snapshot source that vocabulary does not exist at all.

---

## 6. The document pass

**⚖️ Matt, 2026-09-02: scrape listings first, fetch documents on a separate pass.** Adopted, with
one distinction made explicit:

- **A separate PASS** — its own code, own budget, own failure modes. This is the ruling.
- **A separately INVOKED pass** — someone must remember a second action. This is *not* the ruling;
  it is an accident of how SAM was built.

> 🔴 **That accident is measurable.** After two slices, **12 of 9,883** SAM solicitations have
> documents — **0.1%**. Every document-derived field (`qa_closes_at`, `prebid_at`,
> `prebid_required`) therefore exists for 12 rows. A second pass nobody invokes does not happen.

**So: separate pass, chained by default.** One operator action runs listings then documents.
`--listings-only` and `--documents-only` exist for when exactly one is wanted. The passes remain
independent code with independent budgets.

**IDOA makes this nearly free.** SAM's separation is load-bearing because documents are a
per-notice API call across 9,883 rows. IDOA is ~50 rows, one ZIP each. The argument that forced
separation at SAM's scale does not apply at this one.

### 6.1 Two details that are cheaper to state than to discover

**Use the scraped `href`; do not construct the URL.** The ZIPs are predictably named by Event ID,
which makes construction tempting. A constructed URL is a guess about a pattern, and when the
pattern changes it 404s **silently across every row at once**.

**D8 gets its first real exercise.** Nested archives are not traversed, and say so. IDOA's
attachments are bid *packages*, so a ZIP containing a ZIP is plausible here in a way it was not
for SAM.

---

## 7. Provenance, and the one thing merge must carry

**⚖️ Matt, 2026-09-02:** *"Adapters return what they can, and the merge layer sorts out what's
trustworthy."* The stricter alternative — adapters declaring capabilities, the framework refusing
to infer beyond the declaration — was tabled and rejected **for now**, on flexibility: a
declaration maintained before the shapes are known is a guess with ceremony attached.

**⚖️ Matt, 2026-09-02:** `first-seen` stands in for `posted_at` on IDOA, **labelled distinctly**.

> 🔴 **THE CONSEQUENCE THAT MAKES BOTH RULINGS WORK, and it is not optional.**
>
> Merge can only decide what is trustworthy **if provenance travels with the value.**
> `extracted_field` already carries origin and confidence. **Listing-level fields —
> `posted_at`, `closes_at`, `value_cents` — are merged bare.** A first-seen-derived `posted_at`
> written into the same column with no marker is indistinguishable from SAM's published one,
> and the distinction is lost silently. That is the shape of every field-level defect this
> project has already paid for (`posted_at` dropped by merge; `kind`/`codes`/`set_aside` null
> while the payload carried them).

**So this slice must add a provenance marker to listing-level dates before IDOA writes one.**
Minimum viable: distinguish `published` from `observed`. `sighting` already records
first-observation and SP3.5 merged sightings into canonical records, so the datum exists — what
is missing is the label on the derived value.

**Consequence for the gate, stated plainly:** IDOA's volume-per-week can only count **from the
day we first scrape**. There is nothing to backfill. Unlike SAM, where history came free because
SAM publishes `posted_at`, **every day before the first IDOA run is volume data that can never be
recovered.**

---

## 8. 🔴 The inference trap

Raised by Matt, and written down before anything can be built on it.

Position in a table is often a proxy for recency and occasionally fiction. **IDOA's first two
rows share a due date (`09/02/2026 3:00:00PM EST`) but carry unrelated Event IDs
(`0023…87895`, `0070…88051`)** — so the table is *probably* ordered by **due date**, not by
insertion.

**Assume insertion order and we manufacture a posting sequence that is pure invention and looks
entirely plausible on screen.** Nothing downstream would flag it; the queue would simply be
ordered by a fiction.

**The rule for this slice: the ordering must be verified before anything depends on it, and the
finding recorded on the source row.** This is `verified_facets` (§5.4) applied one level up —
that field exists precisely because SAM accepted an `is_active` parameter and silently ignored it.

**If the ordering cannot be established, the adapter records no order-derived signal at all.**
That is the default-out posture of §5.5.1 applied to data rather than to legality.

---

## 9. Testing

- **Fixture-driven parsing.** A captured copy of the live page is committed, as the SAM adapter's
  fixtures are. The fixture is the contract; a live-site change breaks a test rather than
  production.
- **The type change is the main assertion.** A test that a `SnapshotAdapter` cannot be passed a
  `since` is a compile-time guarantee, not a runtime one — so the meaningful runtime tests are
  that `run.ts` dispatches on `shape`, and that a snapshot run returns `nextUntil: null`.
- **Mutation-prove the ones that matter**, whole file, no `-t` filter (lesson 2.23): removing the
  shape dispatch, removing the `limit` enforcement, and removing the document-pass chaining must
  each fail a test that names the behaviour.
- ⚠️ **A test that only proves 50 rows parse is not enough.** §3.1's third table means a test must
  also assert **how many rows the page yields in total**, so an undercount fails.

---

## 10. Demo criterion

Run against the live site, with the numbers written down:

1. `npm run scrape -- --source "Indiana IDOA solicitations"` returns **N** rows, and **N matches a
   count taken by hand from the page on the same day**.
2. The listing pass writes sightings; **no row carries a `posted_at` presented as published.**
3. The document pass runs **in the same operator action**, fetching one ZIP per row, and at least
   one ZIP parses to an `extracted_field`.
4. `--listings-only` and `--documents-only` each do exactly one half.
5. `--limit 10` returns 10, and says so in the result.
6. **The free correctness check:** IDOA's live table includes *"General Supervision-State
   Complaint Corrective Act"*, which is **already in production** from the
   `Corpus import — Indiana open (2026-08-04)`. That corpus was taken from this page, so the
   adapter's output can be diffed against it — an answer key this project rarely gets.

---

## 11. What this deliberately does not do

- **No screen.** The admin surface for adapters is pinned separately
  (`docs/Pinned-Scraping-Console.md`) and is explicitly *not* in this slice — folding a screen
  into a non-screen slice is how SP6's record screen got hand-rolled (`CLAUDE.md` §3).
- **No scheduling.** Unattended ingestion remains deferred to SP7.
- **No other adapter.** City of Indianapolis is a separate shape-mate but a separate build, and
  it is mid-migration to OpenGov, so anything built against today's page is disposable.
- **No capability declaration on adapters.** Tabled by ruling (§7); revisit when a third shape
  appears.

## 11.1 On the fidelity mandate

`CLAUDE.md` §1 requires every slice spec to name §7.10, and §3 records what happened to the slice
that did not. **This slice renders nothing**, so pixel parity has no surface to apply to here.
Naming it anyway, because the rule is that a spec which does not name the mandate is a spec that
will not follow it — and because the *pinned* console this work makes necessary **is** governed
by it, including the unverified question of whether the bundle draws anything adapter-shaped.

---

## 12. Open questions carried into planning

1. **What is the third table?** (§3.1) — blocking, and task one.
2. **What is the row ordering?** (§8) — blocking for any order-derived signal; non-blocking for
   ingestion itself.
3. **What shape does the provenance marker take?** (§7) — a column, an enum, or a join. Smallest
   thing that distinguishes `published` from `observed` wins.
4. **Does IDOA list anything under $75,000?** The state's own guidance says solicitations over
   $75,000 are posted centrally and smaller ones are handled at agency level. If true, IDOA's
   coverage has a **floor**, and the gate's volume number for Indiana means "over $75k" rather
   than "everything" — which must be said in those words wherever it is reported.
