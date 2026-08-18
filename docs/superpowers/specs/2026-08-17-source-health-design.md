# Source health and the run trigger — design (SP3.6)

**Written 2026-08-17. Brainstormed with Matt the same day; every decision below was ruled by him in that session and is recorded with its reasoning.**

This designs the slice that **§6.4 A3** ruled must land before SP6, and it houses **D5** — the manual scrape trigger §9.6 assigned to this screen and `docs/admin-deviations.md` records as still unbuilt.

**Status: designed, not built.** No implementation plan yet — that is the next step.

---

## 0. What this settles, in one paragraph

`source.health` becomes a statement about **whether a source is reachable right now**, written by an **operator-invoked probe**; `source.last_run_at` stays a separate statement about **when we last ran it**, written by a run. Probes bind to **platform**, mirroring adapters, so coverage does not depend on an adapter existing. Of the thirteen registry rows, **seven are probeable**: four are refused before any network call because their own terms forbid contact, and two are fixed snapshots with no endpoint to probe. The screen gains a **Check** control and a **Run** control, the latter doing scrape → import → merge in one action with the artifact living only inside the request — which keeps SP4's blob decision parked.

---

## 1. What health means, and what it deliberately does not

A3's wording — *"is each source up, when did it last run"* — is ambiguous between two different facts, and the ambiguity had to be resolved before anything could be built.

**Ruled: health is about the SOURCE, not about our last run of it.** A live probe answers *"is SAM.gov up?"* It is not derived from run history.

**Ruled: `last_run_at` remains its own separate fact.** Health says *is it up*; `last_run_at` says *when we last ran it*. Both are written by this slice; neither is computed from the other.

> This split is the schema's existing grain, not a new idea. `source.health` and `source.last_run_at` have been two columns since migration 002, and `005_ingest_runs.sql` already argues the same distinction one level down: *"'When we last ran' and 'what we have through' are different facts; conflating them reopens the gap."*

**What was rejected, and why it is worth recording.** Deriving health from run history is cheaper — `RunResult` already returns `done`, `rows`, `undatedSkipped` and `noProgress`, and every one of those signals is currently discarded. It was rejected because it can only speak about sources we have run. **Twelve of the thirteen rows have never been scraped**, and they would have stayed `unknown` forever, which is precisely the gap A3 exists to close.

---

## 2. The state vocabulary

Five values. `health` gets a `CHECK` constraint for the first time.

| Value | Means |
|---|---|
| `ok` | The probe answered, and the answer was well-formed |
| `failing` | Unreachable, timed out, non-2xx, or threw |
| `rot` | **Answered, and the answer was wrong** — a real query that returned nothing where it must return something |
| `excluded` | Not probeable by rule. Never measured, and never will be |
| `unknown` | Never checked yet |

**`rot` is the state that earns this slice.** `ok` and `failing` catch a source that is plainly down, which is the easy case. `rot` catches a source that answers 200 and serves nothing — the class of failure that produced the `is_active=false` run, where 307 rows came back from a five-million-record archive and every signal said success. **Only the adapter probes can produce `rot`; `genericUrlProbe` structurally cannot.** That limitation is recorded in `health_method` rather than hidden, so a green dot from a URL check is never mistaken for a green dot from a real query.

**`off` is retired from this column** (Deviation H1 below). Its accessible name in `StatusDot` is *"Not ingested"* — an ingestion fact. Under *health = is it up*, it has no meaning: a disabled source can be perfectly reachable. That information already lives in the ENABLED column and `last_run_at`, and keeping `off` here would make one column answer two different questions depending on the row.

**`excluded` covers two reasons**, both already visible in adjacent columns, so the screen still explains itself without a sixth state:

- the three `out` rows and Ohio's `manual-only` — the LEGAL column shows why
- the two corpus imports — platform reads `Manual import`, archive reads *"Fixed — a snapshot, not a feed."* There is no endpoint to probe

**Neither `unknown` nor `excluded` may render through `StatusDot`.** `ea798e9` already settled the principle for `unknown`: routing it through `off` would put *"Not ingested"* into the accessibility tree while the visible label avoided it. Both keep the decorative `aria-hidden` dot and let the adjacent word carry the meaning.

---

## 3. Data model — migration 006

```sql
ALTER TABLE source ADD COLUMN health_checked_at timestamptz;
ALTER TABLE source ADD COLUMN health_method     text;
ALTER TABLE source ADD COLUMN health_note       text;
ALTER TABLE source ADD COLUMN probe_url         text;
ALTER TABLE source ADD CONSTRAINT source_health_valid
  CHECK (health IN ('ok','failing','rot','excluded','unknown'));
```

| Column | Why it exists |
|---|---|
| `health_checked_at` | **A verdict without a timestamp is the stale-green trap.** Health is only measured when asked, so a value can be arbitrarily old; without this, a green dot from three weeks ago reads as current — rebuilding the exact silent-failure shape A3 exists to catch |
| `health_method` | *Which* probe ran. `generic-url` and `sam` are different strengths of claim |
| `health_note` | *Why* — `connect ETIMEDOUT`, `HTTP 503`, `query returned 0 rows`. Without it, `failing` is a red dot with no lead |
| `probe_url` | The generic probe's target. Null where a platform probe exists |

**The CHECK constraint is overdue and closes a live hole.** `legal_posture` has had one since 002. `health` never did, and `PATCH /api/sources/:id` writes the field **unvalidated** today — `legal_posture` is checked against a set, `health` is passed straight through. Any string at all can currently be stored. The constraint and the endpoint validation land together.

**Backfill:** the migration sets `health = 'excluded'` for the six rows that qualify under §4 — the four in the table there, plus the two `Manual import` corpus rows. Everything else keeps `unknown`.

**Excluded and unknown rows carry `health_checked_at = NULL` and `health_method = NULL`**, because nothing measured them. A timestamp on a row nobody probed would be the same lie the timestamp exists to prevent. `health_note` on an excluded row names the rule that excluded it (`legal_posture=out`, `manual-only`, `no endpoint`), so the reason survives even if the row is read without its neighbouring columns.

---

## 4. Eligibility — and it is fail-closed on the thing that matters

**Ruled: `legal_posture` governs CONTACT; `enabled` governs INGESTION.** A liveness probe is contact, not ingestion, so it keys off posture.

A source is probeable when **both** hold:

- `legal_posture = 'in'`
- `platform <> 'Manual import'`

`enabled` is deliberately **not** consulted. It controls whether we take data from a source, and twelve of thirteen rows are disabled — inheriting `resolve-source.ts`'s enabled-check would leave exactly one row (SAM.gov) with a health value and destroy the coverage this design was chosen for.

**Stated plainly, because it is a posture decision rather than a technical one:** this means making outbound requests to sources that are switched off. One request each, operator-initiated, never scheduled.

### The four rows that must never be probed

| Row | Posture | What the registry already records |
|---|---|---|
| GovWin IQ | `out` | *"Excluded by its terms of service (§5.5). Not accessed."* |
| BidNet Direct | `out` | same |
| BidPrime | `out` | same |
| Ohio OhioBuys | `manual-only` | *"CAPTCHA-gated… Bot detection was NOT worked around. A person may read it; a scheduled adapter cannot."* |

GovWin's own note is the precedent for §5.5.1: **"terms are respected even where access is technically possible."** A liveness probe is exactly the case that tests that rule — it is cheap, it is technically trivial, and it would falsify a standing *"Not accessed"* commitment. Ohio is worse than a terms question: probing it means automated requests against `/bas/browser_check`, the bot detection this project deliberately did not work around.

**These are refused in code, before any network call is constructed** — not by convention, and not by remembering. The test asserts the refusal happens at the call site, not that the result came back empty.

---

## 5. The probe subsystem

`app/server/src/health/probes/registry.ts` mirrors `scrape/adapters/registry.ts`: a plain synchronous map, no database access, importable by tests without a connection.

**Keyed by PLATFORM**, per §5.7 — *"adapters bind to PLATFORM + config, not jurisdiction."* Probes follow the same rule rather than inventing a second binding scheme.

```
SAM          → samProbe          real minimal query
USASpending  → usaSpendingProbe  real minimal query
*            → genericUrlProbe   probe_url, 2xx
```

**The payoff for binding to platform rather than to source:** `CGI Advantage VSS` covers **both** Kentucky eMARS and Michigan SIGMA from one entry, and a probe can exist for a platform long before anyone writes an adapter for it. Binding to the `Adapter` interface instead would have limited coverage to the two sources that already have adapters — the same gap this design rejected in §1.

```ts
interface ProbeResult {
  state: "ok" | "failing" | "rot";
  method: string;          // -> health_method
  note: string | null;     // -> health_note
}
```

The result is deliberately not a boolean. A boolean cannot express *"answered, and the answer was wrong."*

**Every probe carries a hard 10s timeout**, and probes run concurrently through `allSettled`, so one hanging source cannot stall the others or the request. A probe that throws is `failing` with the error text in `note`.

---

## 6. The run trigger — D5, finally housed

**Ruled: the control does scrape → import → merge as one action.**

`POST /api/admin/run?source=<name>` runs all three phases in one request. The artifact is written to a temp file and deleted in `finally`; nothing persists. `last_run_at` is written on completion.

**This does not touch the parked SP4 blob decision, and that is the point.** The existing `POST /api/admin/scrape` streams the `.db` back as the response body precisely to defer blob storage — a shape that is right for a CLI operator and wrong for a button. Clicking "Run" and receiving a SQLite download is not *running a scrape* from an operator's point of view; they would still have to `npm run import` by hand, which is the state D5 describes. Because the artifact only has to survive **within one request**, no storage decision is required to fix that.

**`POST /api/admin/scrape` is unchanged.** Artifact-out remains correct for the terminal.

**§9.6 is preserved exactly.** Nothing runs unless a human asks. There is no schedule, no cron, and no background probe — a timed health check would be precisely the unattended ingestion §9.6 defers to SP7.

---

## 7. Auth

Both new endpoints live under `/api/admin` and inherit `requireAdminSecret`, including its fail-closed 503 when `ADMIN_SCRAPE_SECRET` is unset.

**The screen prompts for the secret once and holds it in `sessionStorage`.**

This is honest about what it is: a shared bearer secret typed into a browser tab, not authentication. It is recorded here as a compromise rather than presented as a solution.

- It is **strictly better than the alternative** — an open endpoint that triggers outbound traffic and writes to production.
- It **keeps the fail-closed posture** the admin router already has.
- The auth slice (priority item 3) **upgrades it cleanly** later; nothing here has to be unwound.

⚠️ **The pre-existing inconsistency is not fixed by this slice and should not be forgotten:** `PATCH /api/sources/:id` — the Enable toggle — sits outside the admin router and is unauthenticated today. This design does not change that, and does not pretend the screen is protected because two of its controls are.

---

## 8. The screen

`View 6.2 : Source Registry` gains:

- **HEALTH** shows state **and when it was checked**. The timestamp is not decoration; see §3.
- **Check** — probe this row. A Check-all runs the eligible set.
- **Run** — scrape → import → merge. Present only where an adapter exists (two rows today), and **disabled with a stated reason rather than hidden**, so the absence is legible instead of mysterious.

---

## 9. Testing

- **Probes are unit-tested against fixtures, not the network** — `scrape/adapters/fixtures` already establishes the pattern.
- **The eligibility refusal is asserted at the call site**, not on the result: the test proves no network call is *constructed* for the four excluded rows. A test that only checked the returned state would pass just as happily if the request had been made and thrown away.
- **Timeout and `allSettled` behaviour** get a test with a deliberately hanging probe.
- **The CHECK constraint** gets a test that a bad `health` value is refused by the database, and one that `PATCH` refuses it at the endpoint.
- `health_checked_at` is asserted to move on a probe, because a probe that silently fails to record when it ran reintroduces the stale-green trap.

---

## 10. Demo criterion

An operator opens `/admin`, enters the admin secret once, and clicks **Check**. The seven eligible rows show real health with a timestamp; the four excluded rows read `excluded`; the two corpus rows read `excluded`. They then click **Run** on SAM.gov and watch `last_run_at` move and the row's counts change.

---

## 11. What this deliberately does not do

- **No alarms, no alerting, no notification.** A3 ruled the surface read-only, and this is that surface plus the trigger §9.6 already assigned to it.
- **No schedule.** Deferred to SP7 with the rest of unattended ingestion.
- **`Region A.2 : Status Bar` is not built.** A3 already flagged it as likely unbuildable — it is a shell region, and A1 makes the shell a hard dependency of the views it contains. The registry column carries health before the status bar does.
- **No probe for the five adapterless platforms beyond the generic URL check.** Writing a `CGI Advantage VSS` probe is a later, cheap increment the registry is shaped to accept.

---

## 12. Deviations from the frozen bundle

**H1 — `off` is not a health value.** The bundle's Source Registry vocabulary is four states including *"Not ingested"*. Under *health = is it up*, `off` is meaningless, and its information lives in ENABLED and `last_run_at`. `StatusDot` keeps all four states — this is about which values the health **column** may hold, not about the primitive.

**H2 — `excluded` is a fifth value the bundle does not have.** Required by the ruling in §2. It renders as a word with a decorative dot, never through `StatusDot`, so the bundle's four-state primitive is unchanged.

**H3 — HEALTH shows a timestamp the bundle does not show.** Justified in §3: without it the column is actively misleading between checks.
