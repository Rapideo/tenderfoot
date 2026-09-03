# The blacklist — KP's negative profile

**Template created 2026-09-03 for Matt to fill in. Everything below the worked
example is yours.**

This file feeds `firm_profile.negative_profile`, a column that has existed since
migration 002 and has always been NULL. Its note records why: *"lost its last
source when the hand-run was retired 2026-08-11."* **It is empty because its
source went away, not because anyone ruled it out** — unlike `past_performance`
next to it, which is empty by decision (§7.3).

You are its new source.

---

## Before you start: two rules and one trap

### 1. Everything here is FILED, never DELETED

Design spec §6.2. A gated item leaves the queue and stays inspectable.

**This is load-bearing, and the project has the scar to prove it.** The FSSA
*External Quality Reviews* RFP — the closest thing to a bullseye in the whole
corpus — ships three PDFs carrying two different deadlines. Fed the wrong one, a
hard gate would have **silently eliminated KP's best-fit opportunity three weeks
before it actually closed.** The only thing that makes that recoverable is that
gated items can be found again.

So *"very, very small chance"* is a perfectly good answer. It does not have to be
never.

### 2. A hard gate is not a score

| | **Hard gate** | **Negative signal** |
|---|---|---|
| Says | *We will never do this work* | *This looks worse, but read it* |
| Decided by | the machine, deterministically | **a person** |
| Status | **buildable now** — §6.1 Stage 0 | **PARKED** with qualification (ruling 1A) |
| Example | "We don't do DOT work" | "Sole-source language in the scope" |

**Put both in this file** — signals are worth capturing while they're in your
head. But they get recorded and *not wired*, because §7.10 clause 2 says a
control may never become an active filter or score without qualification being
designed first. Section B below is a parking space, not a backlog.

### ⚠️ 3. The trap: capacity is not eligibility

The system is **capacity-agnostic by design** (§1), and `firm_profile.hard_limits`
says so in its own note:

> *ELIGIBILITY THRESHOLDS ONLY. These answer whether KP can legally bid, never
> whether KP should take work on. The system is capacity-agnostic — and that rule
> binds the machine, not the user.*

So:

| ✅ Belongs here | ❌ Does not |
|---|---|
| "We can't bond above $X" — we *cannot* | "We're too busy for anything over $X" — we *choose not to* |
| "Requires a licence we don't hold" | "Not worth the effort under $Y" |
| "Prime-only, and we only sub" | "We'd rather do policy work than IT" |

The right-hand column is real and it matters — it just isn't the machine's to
know. **If you catch yourself writing one, put it in Section B.**

---

## Section A — HARD GATES

*Deterministic. The machine may act on these. Copy the block for each entry.*

### A1. Indiana Department of Transportation — WORKED EXAMPLE

> **Rule:** We would never engage DOT for anything. Just not the work we do.
> **Detect by:** `agency.agency_name = "Indiana Department of Transportation"`
> **Absolute?** Almost never — *"a very, very small chance"*. Gate it out of the
> queue; keep it findable.
> **Why:** Roadway design and construction services. Three of the five
> KP-sector rows missing descriptions in the 2026-09-03 sample were INDOT
> `541611` — the code is right and the work is not, which is exactly why
> codes are a signal and not a filter (§6.2).
> **Ruled:** 2026-09-03, Matt.

---

### A2.

> **Rule:**
> **Detect by:**
> **Absolute?**
> **Why:**
> **Ruled:**

### A3.

> **Rule:**
> **Detect by:**
> **Absolute?**
> **Why:**
> **Ruled:**

### A4.

> **Rule:**
> **Detect by:**
> **Absolute?**
> **Why:**
> **Ruled:**

*(Copy as many as you need. Don't worry about `Detect by:` — leave it blank and
I'll work out whether it's mechanically detectable and from which field.)*

---

## Section B — NEGATIVE SIGNALS (recorded, deliberately NOT wired)

*Things that make you lean against without deciding for you. Also the place for
anything that turned out to be a capacity judgement.*

**§6.4 already names five**, so you don't need to repeat them unless you'd
sharpen one:

- unusually short response window
- qualifications so specific only one firm holds them
- incumbent named in the scope
- no preceding RFI
- sole-source justification language

> 🔑 `sole_source_flag` **arrives from HigherGov pre-computed as a boolean.** It
> is the one §6.4 signal we could have for free, and there is currently no column
> for it (see `docs/2026-09-03-highergov-field-mapping.md`).

### B1.

> **Signal:**
> **Why it leans negative:**
> **Would it ever be decisive on its own?**

### B2.

> **Signal:**
> **Why it leans negative:**
> **Would it ever be decisive on its own?**

---

## Section C — PROMPTS, if a blank page is unhelpful

Answer whichever spark something; ignore the rest.

**Buyers**
- Agencies or buyer types you'd never work with, beyond INDOT?
- Any where the relationship is bad, or the procurement process is?
- Federal vs state vs local vs education — is any of those a no?

**Work**
- The 2026-09-03 sample was full of tile repair, snow removal, bridge structures,
  campus sewer design. Are all construction and grounds an automatic pass?
- Commodities and equipment — Polaris Rangers, CNC routers, bereavement books?
- IT hardware and systems integration? *(CMHW Case Management System and
  Community Supports IT Systems both scored as KP-shaped in the answer key —
  were they right?)*
- Clinical or direct service delivery, as opposed to advisory? *(DOC Correctional
  Health Services was my edge case — you never ruled it.)*

**Structure**
- Bonding, insurance, licensure you don't hold?
- Prime-only solicitations — bid, or skip?
- Set-asides you're ineligible for, or ones that make it worth bidding?
  *(WBE Indiana expires 2027-04; MBE is pending.)*
- Response windows too short to be real — and is that a gate or a signal?
- Geographies outside `IN` / `IL` / `OH` / `KY` / federal — hard no, or it depends?

**The one that is hardest and most valuable**
- Think of the last three solicitations you passed on in under ten seconds.
  **What did you see?** That is the fastest route to a real Stage 0 gate, and it
  is knowledge that exists nowhere else.

---

## What happens when you're done

1. Each Section A entry becomes a `negative_profile` entry with **your words
   attached as the evidence** — the same pattern §5.5.1 uses for legal posture,
   so the reasoning outlives whoever wrote it.
2. Anything mechanically detectable becomes a **§6.1 Stage 0 gate**, and gated
   rows are **filed, not deleted**.
3. Section B is recorded and **left unwired**, pending the qualification design
   that ruling 1A keeps parked.
4. Any rule that needs a field we don't collect gets flagged against the
   HigherGov mapping — `sole_source_flag` is already one.

> 📌 **This also settles the description-fetch ruling.** Gating INDOT alone drops
> the unreadable rows from ~34 per 100 to ~23, and the KP-sector unreadable ones
> from 5 to about 2 — which makes fetching documents on demand cost roughly 22
> records per hundred triaged. **The blacklist does more here than any
> document-fetch rule could**, because it removes the unreadable rows by removing
> work we'd never do rather than by paying to read it.
