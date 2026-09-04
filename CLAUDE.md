# Tenderfoot — standing instructions

## 1. THE FIDELITY MANDATE IS THE FIRST THING TO READ, AND IT BINDS EVERY UI SLICE

**The authority is `docs/superpowers/specs/2026-08-03-tenderfoot-design.md` §7.10.** Read it before writing or planning any screen. It is not summarised here to avoid a second copy drifting from the first — but its core sentence is:

> **The frontend MUST look and behave exactly like the prototype. Pixel-for-pixel parity is the non-negotiable success criterion. Every other consideration — abstraction reuse, component elegance, developer ergonomics — is subordinate to it.**

**Parity is against the frozen `prototype/PROTOTYPE/Tenderfoot UI Mockups V1.2.html`.** Not "the prototype", which iterates. Re-pointing that version is a deliberate act taken with the `Proto` audit, never an automatic consequence of a new file appearing.

### What this means in practice, and it is not optional

- **Open the bundle before designing a screen.** Every SP2 primitive carries a comment citing the bundle declaration it was matched against; that is the standard. A screen invented from scratch and *then* checked is already the wrong shape.
- **Prefer the primitives, and prefer extending them over hand-rolling markup.** If a screen needs a row, a panel, or a chip, the bundle almost certainly has one and SP2 probably built it. Hand-written `<div>`/`<span>` with ad-hoc CSS is the failure mode — see §3 below.
- **Copy is specification, not placeholder.** `COST TO PURSUE — FACTS, NOT A SCORE` and its siblings each carry an argument. Do not paraphrase, and distinguish literal labels from mock *values* (§7.10 records the `ORDER · AMBIGUITY FIRST` correction, where a value was mistaken for copy).
- **Tokens and type come from `app/client/src/tokens/`**, which is verified byte-identical to the prototype's own. There is deliberately **no spacing scale**; existing component CSS uses literal pixels matched to the bundle. Do not invent tokens — `npm run check` verifies the round-trip.

### ⚖️ When the prototype and a spec conflict, the USER decides — added 2026-08-31 by Matt's ruling

**Do not resolve a prototype/spec conflict silently in either direction.** Not by quietly following the spec, and not by quietly matching the prototype. **Surface it as a gate question and let Matt rule**, then record the ruling where a future reader meets it — a numbered deviation in `docs/admin-deviations.md` if the prototype loses, an amendment to the spec if it wins.

A real example, live at the time of writing: the prototype renders an extraction conflict **inline in the value cell** with a warning background (`"2026-09-18 · CONFLICT with Addendum 2 (2026-09-25)"`), while the SP6 spec §6.1 specifies the losing value **beneath the winner with its own origin and quote**. Both are defensible — the prototype is more compact, the spec carries more evidence. That is exactly the shape of conflict this clause exists for.

---

## 2. Where things live

`STATUS.md` — current state, read first. `DOOGIE - TENDERFOOT.md` — Matt's hand-written session log; **AI-written entries must be marked as such.** `docs/Tenderfoot-Plan-of-Action.md` — the slice sequence and its reasoning. `docs/Proto2PRD.md` — the reusable playbook; `docs/Proto2PRD-Lessons.md` — lessons staged for it, **folded in continuously rather than at the end.** `docs/superpowers/specs/` and `docs/superpowers/plans/`. `reference/Tenderfoot SVRC.md` — the frozen screen outline. `docs/admin-deviations.md` — the continuous deviation series.

**The two operator commands, neither of which is reachable from any screen.** `npm run fitness` measures the data floor and scores every source from recorded evidence — read-only, no arguments. `npm run contracts:ingest` loads the Indiana EDS contract register (~205k rows, 86 seconds). **Both act on whatever `DATABASE_URL` names**, so check which branch you are pointed at before the second one — ingesting production is a deliberate act and never a default.

## 3. What SP6 got wrong, kept here because it is the cheapest way to not repeat it

**SP6 was the first slice to compose real screens, and neither its spec nor its plan referenced §7.10 even once.** The consequence is visible: the queue screen, assembled from SP2's bundle-matched primitives, looks like the product. The record screen, hand-rolled from bare `<div>`/`<span>` with CSS invented in the plan, did not — its field rows were a `display: grid` with no `grid-template-columns`, so four values stacked as four unlabelled lines while `TableRow`, whose entire interface is a column template, sat unused.

**The mandate does not enforce itself.** A slice spec that does not name it is a slice that will not follow it.

## 4. Verification habits this project has paid for

- **`npm run check` is the gate.** It must exit 0.
- **A green server test does not mean the screen works.** SP3.6 passed every server-side test with both its buttons broken in a browser. **Click through it.** The Claude Chrome extension works here (confirmed 2026-08-31); CDP also works.
  - ⚠️ **Two extension traps, both cost time on 2026-09-02.** It can report *"Browser extension is not connected"* at session start — **restarting Chrome fixes it**, so ask before falling back to CDP. And its **click coordinates are screenshot-space, not CSS pixels**: a click computed from `getBoundingClientRect()` lands short and hits whatever is up-and-left, *silently*, which reads exactly like a dead button. Calibrate with a capturing `click` listener that records `e.clientX/clientY`, then compare asked-for against landed. When synthetic input will not land at all, a DOM `.click()` on the real rendered element still exercises the real handler — say which method you used.
- **Look at the screenshot.** Reading the DOM for the right strings proves the content exists, not that the page is legible. That distinction cost this project a broken record screen that passed its own review.
- **Ask of every test: would this still pass if I deleted the thing it tests?** Prove the important ones by mutation, running the whole file — a `-t` filter skips the others and proves nothing about isolation.

---

## 5. 🛑 PAID SOURCES — the HigherGov API costs money per record, and two rules bind

### 5.1 NEVER call the HigherGov API without Matt's explicit approval

**Ruled 2026-09-03 by Matt**, after 489 records went out on Claude's initiative in a single session:

> *"do NOT do any testing with that API unless explicitly approved. We only have about 9500 calls left for this month, and we need to be frugal with them."*

**This covers everything** — testing, verification, a "quick check", re-running something that already worked. **Propose the call, say what it will cost in records, and wait.** The allowance is **10,000 records per month**, and it is the only metered thing in this project.

> **⚖️ STANDING BUDGET, granted by Matt 2026-09-03: 500 records.**
> Inside that budget, calls may be made without asking each time — but every one
> is still **counted, reported, and justified in the same breath**. The budget is
> a ceiling on unasked spending, not permission to stop counting.
>
> **When it is exhausted, the §5.1 rule resumes in full**: propose and wait.
> Do not top it up, round it up, or treat a new session as a fresh 500.
> **Consumption as of 2026-09-03: 490 spent before this grant** (verified against
> the account dashboard at 489, then 490), so the grant runs from there.

⚠️ **Consumption cannot be measured from the API.** There is no quota field, no usage endpoint, no header — `meta` carries only `{pagination}`. **Only the account dashboard shows it** (gear icon → API, admin only), which means **a person reading a number is the sole instrument.** Anything unattended must keep its own tally in `ingest_run`, because the vendor will not tell us and a run cannot ask how much is left before it starts.

**The meter counts records RETURNED** — verified 2026-09-03 by an isolated test: 478 → 489 on a call returning 1 opportunity + 10 documents. Errors and zero-result calls appear not to count. Filtering therefore protects the allowance, and **paging is a real cost**: the first document page returned 10 of 19, so pulling the rest nearly doubles the price.

### 5.2 Stage retrieval so that rejection is free and only acceptance costs

**Matt's framing, 2026-09-03:** *"stage retrieval based on identifying validity in the fewest calls possible."*

The asymmetry that makes it work: **everything needed to REJECT a notice is already in the listing record. Documents are only needed to ACCEPT one.**

| Stage | Cost | What it decides |
|---|---|---|
| 0. Listing pull | 1 record/notice, already paid | carries `due_date`, `pop_state`, `opp_type`, NAICS, PSC, `set_aside`, `val_est`, and a description **66% of the time** |
| 1. Mechanical gates | **0** | deadline passed · wrong geography · not biddable · already awarded |
| 2. Human triage on the card | **0** | decidable for every row that has a description |
| 3. Documents | **~11**, page one only | ONLY for items surviving 0–2 that still need more |

**A bulk document pass is structurally impossible, not merely expensive** — 9,286 Indiana opportunities at 10–19 documents each is 93,000–176,000 records, nine to seventeen months of allowance. **Documents are fetched on triage demand and never as a backfill.**

**The open design question, unruled:** ~34% of rows carry no description at all — 58% among sub-state buyers, which is the segment this source is bought for. Those cannot be triaged from the listing, so they either trigger a document fetch or sit deferred. **That is where the quota actually goes, and it needs Matt's ruling before an adapter is written.**

**Also budget the backfill separately.** A full Indiana archive pull is ~9,286 records — 93% of one month — leaving nothing for operating. The archive is a one-off research asset; the operating cost is single digits a day. They must not compete in the same billing period.

### 5.3 The API key is a URL parameter, and it leaks through the response

**A live key was leaked into a session transcript on 2026-09-03 and rotated the same hour** (revocation proved: the burned key answers `403` where a live one answers `400`). Three rules follow, and they bind any code written against this API:

1. **`document_path` is a CREDENTIAL, not a URL.** Every opportunity response embeds the api_key inside it. **Never print it, log it, or write it to the database.** Use it and discard it inside the request.
2. **Scrub at the boundary, never at the call site.** One recursive redactor that walks every value before anything is printed. The leak happened because a `scrub()` helper covered every *error* path while field *values* printed raw — the key was thought of as something in the request, not something that comes back.
3. **Never build the URL inline in a shell command.** `curl` with the key in the argument list puts it in shell history and process listings. Build it inside a script from `process.env.HIGHERGOV_API_KEY`.

**Full evidence and the measured findings: [`docs/2026-09-03-platform-comparison.md`](docs/2026-09-03-platform-comparison.md) §R0–R11.**
