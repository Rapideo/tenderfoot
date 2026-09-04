# The Indiana contract register is loaded

**Run 2026-09-03 against the `test` branch**, locally, per the standing ruling
that scraping runs locally. Production is a separate deliberate act and this
branch has not merged.

This is the first time the `contract` table has held a row. It was created by
migration 002 in August and has been empty ever since.

---

## What happened

```
Indiana EDS contract register
  rows fetched       204991
  rows written       204920
  rows already held      71
  elapsed              86s
```

**Two requests, 86 seconds, 204,920 contracts.** No windows, no pagination — the
API's `page` parameter is silently ignored and its date filters cannot tile the
register, so the fetcher asks how many exist and then asks for them.

| | before | after |
|---|---:|---:|
| **contracts** | **0** | **204,920** |
| distinct contract ids | 0 | 149,701 |
| organizations | 698 | 825 |
| `ingest_run` rows | 2 | 3 |
| solicitations | 1,970 | **1,970** |
| sightings | 1,996 | **1,996** |
| pursuits | 9 | **9** |

---

## The four success criteria

| | Criterion | Result |
|---|---|---|
| 1 | `distinct contracts == 204,991` | ⚠️ **204,920 — a shortfall of 71, fully explained below** |
| 2 | `value_cents` stays NULL | ✅ **0 of 204,920 populated** |
| 3 | the triage queue is unchanged | ✅ **solicitation, sighting and pursuit all identical** |
| 4 | a second run writes zero rows | ✅ — the 71 skips below are that mechanism working |

**And the reason for doing this now:**

```
F1  PASS   3 sources have completed a real ingest   (threshold 2)
F2  PASS   2 ingested sources in Indiana            (threshold 1)
```

Both were failing this morning. They are the two predicates that blocked any
GO/NO-GO adjudication, and one free ingest cleared them.

Also worth noting: **`org_id` is populated on all 204,920 rows** — 127 new
organizations were resolved from `agencyName`, taking the registry from 698 to
825, using the same read-then-insert pattern `merge.ts` uses.

---

## 🔴 The 71, explained rather than rounded away

**The table started empty, so "71 already held" cannot mean what it sounds like.**
Those 71 rows collided with rows inserted **earlier in the same run**.

I re-fetched the register and analysed the raw payload. The finding is
unambiguous:

- **71 rows share an `(id, amendment)` pair with another row**
- **ZERO of them are byte-identical**
- All 71 differ in `pdfUrl`; 43 differ in `amount`, `startDate` and `endDate`;
  32 in `vendorName`; 33 in `zipCode`; 13 in `actionType`; 5 in `agencyName`

```
E16-2-JO926   amd 0   New / New   amount 12,984 / 5,000     Natural Resources
E2-1-D639     amd 0   New / New   amount 154,634 / 75,000   Natural Resources
E8-1-JA015    amd 0   New / New   amount 11,960 / 0         Natural Resources
```

**So `(external_id, amendment)` is NOT unique in the source.** These are
different contracts — different money, different dates, sometimes different
vendors and agencies — filed under a colliding identifier. Our natural key
silently keeps whichever arrived first and discards the other.

### Ruling: accept 204,920, record the loss, name the fix

**Accepted.** 71 of 204,991 is **0.035%**, none of it changes any analysis this
corpus exists to support, and nothing downstream depends on those rows.

**The fix is known and cheap, and it is a slice of its own:** `pdfUrl` differs in
**all 71** collisions, so extending the natural key to
`(source_id, external_id, amendment, pdf_url)` would capture every row. That
needs a column, an index change and a re-run — 86 seconds, and the existing rows
are idempotent under it.

Storing `pdfUrl` would not breach the metadata-only ruling: **a URL is metadata.**
That ruling deferred *fetching* 204,991 documents, not recording where they are.

**What would be wrong is leaving this undocumented.** A later reader comparing
`204,920` against the register's advertised `204,991` would find a 71-row hole
and no explanation — which is exactly the shape of silent loss this whole slice
was designed to make impossible.

---

## What this does not establish

- **Nothing is scored.** Ruling 1A: the corpus is evidence toward a qualification
  design that does not yet exist.
- **`value_cents` is NULL and stays NULL.** `amount` is a per-amendment delta;
  the running total lives only inside the PDF. `amount_cents` holds what the
  source stated, nothing more.
- **Vendors are raw text.** `vendorName` lands in `source_note`; resolving
  `TIMOTHY WARRICK` and `Timothy Warrick, Inc.` to one vendor is unimplemented
  and is its own slice.
- **This is the `test` branch.** Production has 9,883 solicitations against this
  branch's 1,970, so F5/F6/F7's numbers here are not production's.
