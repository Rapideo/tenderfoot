# On-demand documents — design

**2026-09-05.** Implements **ruling D2** (Matt, 2026-09-04, ruling sheet option
A): *"Fetch the documents only when you open a listing."*

> ⚠️ **THIS SPEC BUILDS A MECHANISM, NOT A SOURCE.** There is no HigherGov
> adapter in this repo and this does not write one. Everything below is
> source-agnostic and is proven against the **existing SAM path**, where
> documents already flow and cost nothing. Wiring HigherGov in later is a
> document client plus a registry entry — see §10.

> ⚖️ **THE FIDELITY MANDATE APPLIES.** CLAUDE.md §1 / design spec §7.10. §8
> touches the record screen, and SP6's failure — a slice whose spec never named
> §7.10, and whose record screen was hand-rolled and broken — is the reason this
> line is here. The bundle is opened before any markup is written.

---

## 1. The problem this solves

**Everything needed to REJECT a notice is already in the listing. Documents are
only needed to ACCEPT one.** That asymmetry is CLAUDE.md §5.2's staged-retrieval
model, and D2 is the ruling that turns it into behaviour.

The measured facts it rests on, none of them quoted:

| | |
|---|---|
| Allowance | **10,000 records/month**, HigherGov |
| What the meter counts | **records RETURNED** — verified 2026-09-03, 478 → 489 on one call returning 1 opportunity + 10 documents |
| Errors and zero-result calls | **appear not to count** |
| Cost of one document fetch | **~11 records**, page one only |
| Page one | **10 of 19** — paging roughly doubles the price |
| A bulk document pass over Indiana | **93,000–176,000 records** = nine to seventeen months. Structurally impossible, not merely expensive |
| Consumption readable from the API | **No.** No quota field, no usage endpoint, no header. A person reading the account dashboard is the sole instrument |

**The consequence that shapes everything here:** because the vendor will not
tell us what we have spent, **we must keep our own count**, and it must be able
to answer *"what have we spent since the 1st"* rather than merely *"how many
documents do we hold"*.

## 2. What is being built

```
GET  /api/solicitations/:id            → instant, free, unchanged
POST /api/solicitations/:id/documents  → fetch page one · stamp · tally
```

The record screen paints immediately, then asks for documents once. A second
open of the same record spends nothing, forever.

**Spending is an explicit verb.** A `GET` that costs money is dangerous in a way
that has nothing to do with our intentions: browser prefetch, a retry, a
double-render and any crawler each trigger it, and none of those is a decision
anyone made. `POST` confines spending to something the application does on
purpose.

## 3. The spend model

| State | Meaning | Cost to open |
|---|---|---|
| `documents_fetched_at` NULL | Nobody has looked | **~11 records**, once |
| Set, documents present | We looked and found them | **0** |
| Set, zero documents | **We looked and there are none** | **0** |
| Fetch threw | Nothing recorded; retried on next open | **0** — errors do not meter |

**The third row is the whole design.** A listing that genuinely has no documents
must be as free to reopen as one that has twenty. Without the stamp, "no
documents" is indistinguishable from "not yet fetched", and spend would grow
with browsing rather than with data.

> 🔴 **THIS IS D3's DISTINCTION, ONE SUBSYSTEM OVER.** D3 (2026-09-05) fixed R9
> reading a probed absence identically to an unexamined source. This is the same
> shape: *checked-and-absent* is not *never-looked*. It follows the same
> instrument both times — migration 006's `health_checked_at`, and D3's own
> `watermark_probed_at`. A stamp means **we looked**, never **what we found**.

## 4. Schema

### 4.1 `solicitation.documents_fetched_at timestamptz`

Null means nobody has looked. Set means a fetch completed — whatever it
returned.

### 4.2 `api_spend`

```sql
CREATE TABLE api_spend (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       integer NOT NULL REFERENCES source(id),
  endpoint        text NOT NULL CHECK (endpoint IN ('opportunity', 'document')),
  records         integer NOT NULL,         -- what the METER counts, not rows we kept
  solicitation_id integer REFERENCES solicitation(id),
  called_at       timestamptz NOT NULL DEFAULT now()
);
```

> ⚠️ **THIS DEVIATES FROM CLAUDE.md §5.1, DELIBERATELY AND WITH MATT'S APPROVAL
> (2026-09-05).** §5.1 says an unattended spender must *"keep its own tally in
> `ingest_run`"*. It cannot: `ingest_run.artifact_sha256` is `NOT NULL UNIQUE`,
> an on-demand fetch has no artifact, and a synthetic hash would fight both the
> column's meaning and its uniqueness. Every existing reader of `ingest_run` —
> the admin screen's run history among them — would also start seeing rows that
> are not ingests. **CLAUDE.md §5.1 is amended when this lands**, per the rule
> that a ruling goes where a future reader meets it.

**`records` is what the vendor billed, not what we kept.** A call returning ten
documents of which we store three still cost eleven. Recording rows kept would
undercount precisely where the meter surprises.

**A row is written whenever a CALL WAS MADE**, including by a free source, where
`records = 0`. That is what lets the whole path be exercised against SAM before
it is ever trusted with money. **No call, no row** — a solicitation skipped
because it was already stamped, because the ceiling was reached, or because its
source has no document client writes nothing, because nothing was spent and
`api_spend` is a record of spending rather than of attempts.

**`endpoint` carries a CHECK rather than a comment**, matching
`source_health_valid` and `document.extract_status`: a vocabulary this project
relies on is pinned in the schema, not in prose beside it.

## 5. The service — `extract/fetch-documents-for.ts`

```
fetchDocumentsFor(solicitationId)

  stamp already set?        → { spent: 0, reason: 'already-looked' }
  monthly ceiling reached?  → { spent: 0, reason: 'ceiling' }        (§7)
  resolve source
    no document client?     → { spent: 0, reason: 'unsupported' }
  fetch PAGE ONE AND STOP                     ← §5.2, never page two
  ┌─ one transaction ──────────────────────┐
  │ write documents · stamp · write tally  │
  └────────────────────────────────────────┘
  → { spent: n, documents: [...] }
```

**Why a service rather than logic in the route.** `runDocumentsPass` already
dispatches per source (`idoa` vs SAM); this is its singular sibling. One place
owns *have we looked · spend · stamp · tally*, and both the batch pass and the
route become thin callers. Putting it in the handler would couple HTTP to
spending policy and leave it unreusable.

**Why one transaction.** A crash between writing documents and writing the stamp
leaves a solicitation that looks unfetched but has documents — and the next open
pays again. The stamp, the documents and the tally commit together or not at
all.

**`limit`, `budgetMs` and the refresh pass do not appear.** They are
batch concepts; `discoverAttachments` keeps them.

## 6. The route

`POST /api/solicitations/:id/documents` → `{ documents, spent, reason? }`.

Unauthenticated, like the rest of the triage surface. **Note for a future
slice:** this is the first endpoint in the project that can cost money, and
`PATCH /api/sources/:id` is already recorded as an unauthenticated gap. Both
belong in the same auth pass; neither is opened wider here.

## 7. The monthly ceiling

A constant in the service refuses to spend past **N records in a calendar
month**, returning `reason: 'ceiling'` rather than throwing.

**Why, given the standing budget is already 500.** The budget governs what an
agent may spend unasked; the ceiling governs what the *application* can spend
while somebody browses. They are different actors. Since consumption cannot be
read back from the vendor, a browsing session is otherwise unbounded, and the
first sign of trouble would be a dashboard read days later.

`SELECT sum(records) FROM api_spend WHERE called_at >= date_trunc('month', now())`
— which is the query `api_spend` exists to make answerable.

**The value of N is Matt's, not mine.** It ships as an `UNRATIFIED` constant in
the D5 style until he sets it.

## 8. The record screen

**The bundle region already exists** — `Record.tsx:302` renders
`BUNDLE — N FILES` and the document list. This adds no region. It adds:

1. **One call after render**, when `documents_fetched_at` is null.
2. **A fetching state** while it is in flight.
3. **A looked-and-none state**, distinct from not-yet-looked.

⚖️ **The V1.2 bundle is checked for both states before any markup is written.**
If it specifies them, they are matched. If it is silent, each becomes a
**numbered deviation** in `docs/admin-deviations.md` — the smallest thing that
works, not an invention, per the standing rule.

⚠️ **The call must fire once per record, not once per render.** React re-renders
and StrictMode's double-invoke are exactly the "a retry is a spend" hazard §2
avoids by using POST; the stamp makes a duplicate call free rather than harmful,
but the client should not rely on that.

## 9. Testing

TDD throughout. The load-bearing tests, each of which fails if the thing it
tests is deleted:

| | Test | What it protects |
|---|---|---|
| 1 | A second open spends nothing | The stamp guard — the whole design |
| 2 | A zero-document result still stamps, and reopening spends nothing | §3's third row, the one that bounds spend |
| 3 | A failed fetch leaves no stamp and no tally row | A failure must not be recorded as "looked" |
| 4 | A crash between write and stamp leaves neither | §5's transaction |
| 5 | The tally sums per calendar month, across a boundary | §7's ceiling depends on it |
| 6 | A source with no document client spends nothing | Dispatch |
| 7 | The ceiling refuses rather than throws | An operator sees a reason, not a stack trace |

**All provable against SAM at zero cost**, which is the point of building the
mechanism before the source.

⚠️ **A green suite is not a working screen** (CLAUDE.md §4). The record screen
is clicked through in a browser and the screenshot looked at before this is
called done — SP3.6 passed every server test with both its buttons broken.

## 10. Scope

**In:** the stamp, `api_spend`, the service, the route, the two client states,
the ceiling.

**Out, and deliberately:**

- **The HigherGov adapter** — client, field mapping, listing ingest. Its listing
  pull costs records and needs its own budget conversation. This spec makes that
  slice smaller: a document client plus a registry entry.
- **The Indiana backfill** — ~9,286 records, 93% of a month. A one-off research
  asset that must not share a billing period with operating use.
- **Any batch document pass** — structurally impossible per §1, and D2 ruled it
  out.
- **Authentication** — §6.

## 11. Open questions

1. **N, the monthly ceiling.** Ships `UNRATIFIED`.
2. **Does the batch pass adopt the stamp?** `discoverAttachments` has its own
   candidate query and does not stamp. Making both write it is right, but it
   changes batch behaviour and is not required by D2. **Proposed: the service
   stamps; the batch pass is left alone and the divergence is recorded here.**
3. **Re-fetch.** Nothing re-opens a stamped solicitation. An amended
   solicitation with new documents will not be noticed. That is correct for D2
   and wrong eventually; it belongs with the reliability test at ③, not here.
