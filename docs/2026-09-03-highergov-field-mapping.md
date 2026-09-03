# HigherGov → Tenderfoot field mapping

**Written 2026-09-03, from their published OpenAPI schema at
`https://www.highergov.com/api-external/schema/` and from records already pulled.
ZERO API calls were made to produce this file.**

Matt's direction, 2026-09-03:

> *"Once we have both our reliable upstreams defined, we can then flesh out the
> rest of the app with real data and analysis methods, instead of just hoping
> that the source meets our criteria."*

This is the "what can we reliably map back" half of that. It answers three
questions per field: **does it land**, **is it a fact or a guess**, and **is
there anywhere to put it**.

---

## 0. The three provenance classes, and why they are not optional

Every field below is one of:

| Class | Meaning | Rule |
|---|---|---|
| **SOURCED** | The buyer published it; HigherGov relayed it | May be stored as fact |
| **DERIVED** | HigherGov computed, modelled or inferred it | **Must carry its own origin. Never stored beside sourced facts** |
| **CREDENTIAL** | Contains the api_key | **Never stored, never logged** |

**This is not bookkeeping.** `extracted_field.origin` and `precedence.ts` exist
because this project already decided that what a source *claimed* and what we
*concluded* are different facts. A modelled value range written into
`value_cents` beside a published award amount destroys that distinction
permanently, and nothing downstream could ever tell them apart again.

> ⚠️ **`val_est_low` / `val_est_high` are DERIVED.** Ten records returned only
> six distinct `val_est_low` values — `1500000` three times, `250000` and
> `350000` twice each. SAM publishes no estimate for open notices, settled by our
> own payload audit, so HigherGov cannot be relaying one. It is modelling it.
> **Useful for §8.5, which asks for weighting rather than accounting.** Not a
> value.

---

## 1. `/opportunity/` → `solicitation` — 39 fields

### Lands directly

| HigherGov | → column | Class | Note |
|---|---|---|---|
| `source_id` | `external_id` | SOURCED | **Verified: for Indiana this IS IDOA's own 15-digit Event ID**, which is what made exact-match recall possible |
| `title` | `title` | SOURCED | ⚠️ carries a scraping artifact — anchor text glued on, e.g. *"…WW Removal**Bid Documents**"*. Repairable: our own `parseIdoaPage` takes the first anchor correctly |
| `description_text` | `description` | SOURCED | **66% feed-wide, 42% for sub-state buyers.** Where present, median 579–930 chars |
| `posted_date` | `posted_at` + `posted_at_origin='listing'` | SOURCED | migration 016 exists for exactly this |
| `due_date` | `closes_at` | SOURCED | 100/100 on Indiana |
| `agency.agency_name` | `org_id` via `org-chain.ts` | SOURCED | Needs a fifth case in `org-chain.ts` — the module D27 found had no tests |
| `naics_code.naics_code` | `codes.naics` | SOURCED | Nested object, not a string |
| `psc_code.psc_code` | `codes.psc` | SOURCED | Nested object |
| `set_aside` | `set_aside` | SOURCED | 100% on Indiana; `"NONE"` is a value, not a null |
| `pop_state` | `place_of_performance` | SOURCED | **100% vs our own 36% from SAM** |
| `opp_type` | `kind` | SOURCED | ⚠️ **NESTED OBJECT, not a string.** Printed as `[object Object]` on first read |

### Lands, but needs a column that does not exist

| HigherGov | Class | Why it matters | Proposed |
|---|---|---|---|
| **`sole_source_flag`** | SOURCED | 🔴 **Design spec §6.4 names sole-source justification as an explicit NEGATIVE winnability signal** — *"qualifications so specific only one firm holds them, incumbent named in the scope, sole-source justification language."* It arrives here as a **boolean**, pre-computed. We have nowhere to put the one signal the spec asks for by name | `solicitation.sole_source boolean` |
| `opp_key`, `version_key` | SOURCED | **The duplicate problem.** Several `source_id` lookups returned `count=2` — versioning. Without these we cannot dedup, and re-import is not idempotent | `solicitation.source_version text` |
| `source_path` | SOURCED | The URL on the **originating portal**, not HigherGov's page. The only way to verify a record against its buyer | `solicitation.source_url text` |
| `captured_date` | SOURCED | Their watermark, and our resume key. `sighting.seen_at` is *when we saw it*, a different concept | on `ingest_run` or `sighting` |
| **`val_est_low` / `val_est_high`** | **DERIVED** | §8.5's value weighting, which is otherwise uncomputable — `value_cents` is 0 of 9,883 | **NOT `value_cents`.** Either `extracted_field` rows with `origin='derived'`, or `value_est_low_cents` / `value_est_high_cents` named so they cannot be mistaken |
| `ai_summary` | **DERIVED** | 65/69 on Indiana. Their model's words, not the buyer's | If stored at all, never in `description` |

### Lands nowhere, deliberately

| Fields | Why |
|---|---|
| `pop_city`, `pop_zip`, `pop_country` | Migration 017 stored the state alone on purpose: *"it is the field that decides, the rest is detail for a record view that can read the payload directly, and a column nobody reads is the fourth instance of a defect this project already logged four times today"* |
| `primary_contact_email`, `secondary_contact_email` | Nested contact objects. **No contact table exists.** Deferred with the management phase (§9) |
| `product_service`, `vehicle`, `opp_cat` | `vehicle` measured 0/25. No consumer |
| `nsn`, `dibbs_status`, `dibbs_quantity`, `dibbs_days_to_deliver`, `dibbs_fast_award_flag`, `dibbs_aidc_flag`, `dibbs_tech_docs_flag`, `dibbs_delivery_fob` | DLA parts procurement — 1,525 of 5,266 records a day, and **irrelevant to a consultancy**. Filter `source_type` rather than store these |
| `path` | HigherGov's own web page. Convenience, not evidence |
| `source_type` | **A filter, not a field.** `sam · dibbs · sbir · grant · sled` plus the undocumented `sled_forecast` |
| **`document_path`** | 🔴 **CREDENTIAL.** Contains the api_key. Use inside the request, discard. Never stored, never logged (CLAUDE.md §5.3) |

---

## 2. `/document/` → `document` — 7 fields

| HigherGov | → column | Class | Note |
|---|---|---|---|
| `file_name` | `filename` | SOURCED | |
| `file_type` | `media_type` | SOURCED | `.docx`, `.xlsx`, `.pdf` — leading dot, ours does not have one |
| `file_size` | `bytes` | SOURCED | |
| **`text_extract`** | **`extracted_text`** | SOURCED | 🔑 **Already extracted by them.** 8,884 / 22,190 / 3,687 chars observed on `.docx`. **NULL for `.xlsx`** — which is where cost proposals live |
| `posted_date` | — | SOURCED | No column on `document` |
| `summary` | — | **DERIVED** | Their model. Not `extracted_text` under any circumstance |
| **`download_url`** | ⚠️ **NOT `path`** | CREDENTIAL-ish | **Expires in 60 minutes.** `document.path` means "where the bytes live"; storing an expiring URL there fills the column with dead links that look valid |

### Two schema problems this surfaces

**1. `produced_by` has no value for this.** The column is
`CHECK (produced_by IN ('mechanical','smart') OR produced_by IS NULL)`. HigherGov's
extraction is **neither** — it is a third party's, and recording it as
`mechanical` would corrupt the §8.4 comparison that column exists to make
possible. Needs a third value, or NULL with the fact recorded elsewhere.

**2. `extract_status` maps cleanly and usefully.** `text_extract` present →
`'extracted'`; NULL on an `.xlsx` → `'absent'`, **not `'pending'`**. The column's
own comment already draws that distinction: *"We looked and it is not there is a
different fact from we are unsure."*

---

## 3. `/sl-contract/` → `contract` — 25 fields

**The core maps almost one-to-one**, and unlike the opportunity endpoint the
value here is a **published fact**, not a band.

| HigherGov | → column | Class | Note |
|---|---|---|---|
| `source_id` | `external_id` | SOURCED | |
| `awardee_raw` / `awardee` | `vendor_id` | SOURCED | **Vendor resolution is unimplemented.** `vendor_alias` anticipates it; a vendor name is dirtier than an agency name |
| `agency_raw` / `awarding_agency` | `org_id` | SOURCED | |
| `start_date` | `starts_at` | SOURCED | |
| `end_date` | `ends_at` | SOURCED | 🔑 *"the highest-value field in the system"* — `002_entity_graph.sql:137` |
| `award_amount` | `value_cents` | SOURCED | **A real figure.** Contrast Indiana EDS, where `amount` is a per-amendment delta that goes negative and the true total lives only inside the PDF |
| **`solicitation_key`** | 🔴 **no column** | SOURCED | **This is §4.3's Solicitation → Award → Contract chain, pre-built by the vendor**, and there is nowhere to put it |
| `description`, `award_type`, `po_flag`, `url`, `state_abr`, `awardee_hq_state`, `awardee_hq_city`, contacts ×6 | — | SOURCED | No columns. `awardee_hq_*` would be genuinely useful for a local-preference read |
| — | `renewal_options` | — | **We have a column they do not fill.** Stays NULL |

> ⚠️ `captured_date` is **documented for this endpoint and rejected by it** —
> `400 "At least one valid parameter must be included."` `start_date` works. Their
> documented parameter set and their real one differ.

---

## 4. What this exercise concludes

**Nothing important fails to land.** Every field that decides a triage outcome —
deadline, geography, capability codes, set-aside, description, documents — maps
to a column that exists or a column worth adding.

**Five gaps are worth closing, and they are small:**

1. `sole_source_flag` → a column. **The spec asks for this signal by name and we
   have never had it.**
2. `opp_key` / `version_key` → a column. Without it, dedup is impossible and
   re-import is not idempotent.
3. `val_est_*` → columns **named as estimates**, or `extracted_field` rows with a
   derived origin. Never `value_cents`.
4. `solicitation_key` on `contract` → the entity chain, handed to us.
5. `produced_by` needs a third value, or a documented NULL.

**Two things must never be stored:** `document_path` (contains the key) and
`download_url` (expires in 60 minutes).

**And one field changes what a slice costs.** `text_extract` arrives already
extracted for `.docx`. SP4 built a mechanical extraction stack to produce exactly
that. For HigherGov-sourced documents it becomes a field read — **except for
`.xlsx`, which is where cost proposals live**, so the extraction stack is not
retired, only relieved.
