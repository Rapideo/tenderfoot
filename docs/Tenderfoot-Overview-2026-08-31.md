# Tenderfoot — where the machine actually stands

**Written 2026-08-31 by Claude, for Matt, to be listened to rather than read.** It is grounded in the repository as it sits today: the status file, the design specs, the migrations, and the server and client source. Where a document in the repo and the code disagree, the code wins and the disagreement is named.

---

## Before anything else: five things that are probably not what you remember

You asked what the AI is doing. The honest answer, and the first thing to get out of the way, is that there isn't any. There is no model anywhere in Tenderfoot's extraction. Not a large language model, not a small one, not an API call to one. Extraction is regular expressions and a short list of cue words. Every single row the extractor writes carries a column that says so in as many words: `produced_by` is set to the literal string `mechanical`, on the document row and on every extracted field row. That is a deliberate design decision, written into SP4's spec at section two on the twenty-eighth of August under the heading "Mechanical only — regex, structure, and position — no model", and the reason the schema carries that column at all is so that if a smart mode ever exists, the two can be compared on the same data rather than retrofitted into a schema that never told them apart.

There is a good reason you might believe otherwise, and it is not your memory failing. The original design specification, from the third of August, says in section two point two that document-centric modelling is "rejected as a core model but adopted as a layer: LLM extraction is how Documents become structured fields." That was the plan. It was overtaken by measurement. The extraction spike on the eighteenth of August parsed all one hundred and ten corpus files with plain Node libraries, zero failures, and its own recommendation was that smart mode "stays available and unbuilt — the corpus gave it nothing to fix, which is the honest reason not to build it yet." So the spec's sentence is still on the page and the build went the other way.

Second: the confidence number on every extracted field is a constant. In the extraction file, `fields.ts`, the line reads `confidence: value !== null ? 0.6 : 0`. If a value was found, it gets nought point six. If it wasn't, it gets zero. That is the whole of it. It is a flag meaning "found", wearing the costume of a measurement. A non-flat score was explicitly deferred, and the comment in the file says so — it is deferred pending the accuracy instrument, "ruled out for this round, not overlooked." Listing-derived values get one point nought, which is honest in a different way: those are a straight copy of a column the portal gave us, so there is nothing to be uncertain about.

Third: matching, scoring and qualification are parked. Not broken, not half-built, not behind schedule — parked, by your decision on the eleventh of August, and the reasoning is recorded in the design spec at section one point one. Version one returns everything every active source returns, ranks nothing, filters nothing, suppresses nothing. The sub-project that was going to build the matching engine, SP5, was removed from the sequence rather than reordered, because it is undesigned rather than pending. The assessment table exists in the database and is empty on purpose. When you see a score strip absent from a screen, that is the design working.

Fourth: the twelve-and-a-half percent recall figure is not a measurement and must not be quoted as one. It is two divided by sixteen, and the sixteen assumes every one of fourteen misses was ours — that every one of those documents actually states a deadline that we failed to read. Nobody has checked. A first skim of the worksheet suggests several of them genuinely never state a deadline at all, in which case the true denominator is smaller and the real recall is materially higher. It is a lower bound on an unvalidated denominator. The worksheet that would settle it is built, committed and parked.

Fifth: volume per source per week — one of the two numbers the gate exists to produce — cannot currently be computed for SAM.gov. One thousand seven hundred and twenty-four SAM.gov solicitations carry a null `posted_at`, and SAM.gov is the only enabled source, so the series has nothing to plot. The other gate number, Interested-per-hundred, is unaffected and does work. This is an ingestion gap, not a bug in the metrics code — the metrics code was verified against its own predicate and found correct, with zero malformed-but-present values. I will come back to this in the analysis section, because the underlying reason is worse and more interesting than the symptom.

---

# Part one — what the mechanism is, as it sits today

## The shape, in one breath

A government portal is scraped by an adapter into a small SQLite file. That file is imported into Postgres as *sightings* — raw, immutable, one per "source X showed us this listing on day Y". A merge step turns sightings into canonical solicitations, resolving the buyer organisation and the deadline as it goes. A discover step asks the portal what attachments each solicitation has and writes a pending document row per attachment. An extract step downloads each document, parses it, pulls fields out of the text with regular expressions, writes those fields with the sentence they came from, and throws the bytes away. A queue screen shows the resulting solicitations one card at a time, deadline soonest first. You press a key. A decision row is appended. Nothing is ever overwritten.

Every one of those steps is triggered by a human pressing a button or running a command. Nothing in Tenderfoot runs on a schedule. There is no cron, no worker, no background job. That is a ruling from the fifteenth of August — ingestion runs on Vercel, invoked by hand, with the operator setting the scope of each run — and it was chosen precisely because it turns the platform's function-duration ceiling from a constraint into a parameter. Unattended ingestion is deferred to SP7 and does not exist before then. The direct consequence is on the risk register in plain language: sources go stale between hand-run scrapes.

## Sources are rows, not code

Before any of it runs, there is a registry. The `source` table is seeded by migration 003 with eleven rows, and two more appear when the corpus is loaded — thirteen in total. Each row carries a jurisdiction, a platform, an adapter tier, a legal posture, a legal note explaining that posture, an archive depth, a set of verified facets, a default ingestion window, a health state, and an enabled flag. That is not decoration. It is the mechanism by which no source name appears anywhere in the code — one of the three portability rules from the design spec.

The distinction that matters most on those rows was ruled on the seventeenth of August and it is easy to get backwards: **legal posture governs contact; the enabled flag governs ingestion.** A liveness probe is contact, not ingestion, so the health system keys off posture and deliberately ignores whether a source is enabled. If it consulted the enabled flag instead, twelve of the thirteen rows would be invisible to it and only SAM.gov would ever have a health value.

## Step one — the scrape

The command is `npm run scrape`, or the Run button on the admin screen, which does more than scrape and I will come to it. An adapter is resolved from the registry by platform. Today there are two real adapters — SAM.gov and USASpending — plus a fake one for tests.

The scraper refuses a disabled source *before* fetching anything. That is the fail-closed posture the spec always demanded and which nothing had implemented until SP3.

The loop runs against a time budget rather than a row count, because the ceiling that matters on Vercel is seconds, not rows. It writes into a SQLite file — and this is worth being precise about, because it looks like a contradiction with "Postgres is the only system of record". SQLite here is a *transport artifact*, one file per run, self-describing, holding what was asked for and how far the run got. Vercel has no writable persistent filesystem, so inside the HTTP handler the file lives in a temporary directory that a `finally` block deletes unconditionally. That design is what made the twenty-seventh of August misfire harmless: a failure before the import cannot touch Postgres at all.

The resume mechanic is the subtle part and it is documented at length in the source. SAM pages newest-first, so a marker that tracks the newest record seen reaches its final value on page one and never moves — resuming would send the adapter back to the top of the window forever. The loop instead tracks the *oldest* record actually written and lowers the ceiling rather than raising the floor. That marker is inclusive on purpose, because an exclusive bound silently skips any record sharing the boundary timestamp, and a skipped record is worse than a duplicate one.

There is a live, unfixed hazard in that mechanism and it is on the risk register. SAM's modification timestamps are second-precision, and a bulk re-index can tie many records to one second. If a run's budget cannot walk past a whole tie block, the marker never moves and every subsequent run re-fetches the identical prefix forever, reporting progress it is not making. The build *detects* this and reports `noProgress` rather than handing back a marker that promises movement — but detecting it is not solving it. The real fix is a secondary tiebreak, which is design work nobody has done.

One thing worth knowing about how the SAM adapter got aimed correctly. It originally carried `is_active=false`, inherited wholesale from a corpus-gathering Python script where that value was correct. In the search API it does not mean "do not filter on active" — it means *inactive only*. The first live run returned three hundred and seven notices, none of them active, two hundred and seventy-four already past their deadline, and reported complete success. A working scraper pointed at the archive is indistinguishable from a working scraper. It was caught by varying one parameter against the live API — five point five million matching records with `false`, forty-nine thousand with `true` — and the finding is now recorded on the registry row itself. That is why the registry has a verified-facets column at all: an adapter must not trust a parameter it did not verify.

## Step two — the import

`npm run import` takes an artifact file and writes its rows into the `sighting` table. Sightings are append-only and never modified afterwards. They carry the source, the external id, when we saw it, and the entire raw payload as received. That raw payload matters more than it sounds, and I will return to it twice.

The import is one statement using Postgres `UNNEST` rather than a row per insert. That took it from twelve rows a second to one thousand and thirty-eight, measured on both sides on the same machine and the same branch. `UNNEST` rather than a multi-row values list, deliberately: both collapse the round trips, only `UNNEST` collapses the bind parameters, and a seven-column values list hits Postgres's parameter cap at about nine thousand three hundred sightings — which is under a real day's federal register.

## Step three — the merge

`npm run merge` turns sightings into canonical solicitation rows. This is the first point at which the system can tell one opportunity from two. Sightings are grouped by external id; the canonical row takes its values from the most recent sighting, so an amendment reads as a change while the earlier observation survives.

There is a documented, unresolved assumption sitting in that grouping and it is written at the top of the file. Grouping by external id alone is only correct if external ids are globally unique across every source that ever writes a sighting. That holds today for SAM's opaque identifier and USASpending's generated internal id. It does not hold for the state portals next in line, which emit human-assigned numbers like "RFP-2024-001". Two states colliding on that string would fuse two unrelated opportunities into one canonical row, and nothing would error — it would report one solicitation with two sightings, which reads as corroboration rather than corruption. That is the dangerous shape: it looks like the system working. The file says plainly that resolving this is a blocking prerequisite for onboarding the first human-id source, not a someday cleanup.

The merge also resolves the buyer. SAM hands over a ready-made five-level organisation chain that was being discarded until the sixteenth of August; the schema had already anticipated it, with a self-referencing parent column commented "State to FSSA to Division", and nobody had noticed. The canonical row anchors the *deepest* node, so that DLA Aviation Richmond and DLA Land and Maritime are distinguishable — anchoring at the top would have read "Department of Defense" for ninety-six percent of a day's federal notices and told a triage queue nothing. Rolling up through the parent chain is always possible; losing the office is not.

And on the twenty-ninth of August the merge learned to read the deadline out of the payload it had been holding all along. Until then, `merge.ts` read exactly one field out of the raw payload — the title — and the corpus loader was the only thing anywhere that ever set a close date. That is why two hundred and one hand-loaded corpus rows had deadlines and not one of nine thousand six hundred and eighty-two SAM.gov rows did. A small new module reads it now, and it deliberately reads the *local* field rather than the UTC one: they are the same instant, the column stores a bare date, and on thirty-nine of one thousand three hundred and thirty-eight rows they disagree — every one an evening deadline rolling past midnight in UTC, so reading the UTC field would record deadlines a day late. Late is the worst direction of error this product has.

**Here is the fact to carry forward, because most of part four depends on it.** The merge writes exactly four columns onto a solicitation — external id, title, source id, and close date — plus the organisation link. Nothing else. Not the posting date. Not the notice type. Not the set-aside. Not the value. Those columns exist in the schema, the SAM payload demonstrably carries at least the posting date, the type, the set-aside and the product-service codes, and all of it is sitting unread in the sighting's raw JSON.

## Step four — discover

`POST /api/admin/discover` asks SAM.gov, for each candidate solicitation, what attachments it has, and writes one pending document row per attachment carrying its filename and download URL. It is cheap — one API call per solicitation, no downloads.

It does one other thing at the same time, and it is the load-bearing half. For each solicitation it walks, it writes six *listing* rows into the extracted-field table: a row per field in scope, copying whatever the portal's own structured metadata says. Those rows are the ground truth that document extraction is later measured against. Without them the accuracy query joins against an empty set forever.

Two defects in this step are worth knowing because they were both invisible to every test that existed. The attachment endpoint was originally written from memory and returned four-oh-four on every id, so discover inserted zero documents, ever — and the only test pinning it asserted that the URL had a non-zero length, which is equally true of the wrong host. And the candidate query filtered on the close date being in the future, which yields NULL for a null close date, and Postgres reads NULL in a WHERE clause as false — so every SAM.gov solicitation was silently excluded, because at that moment none of them had a close date at all. The rule that came out of it is now enforced: a test that composes the same constant the implementation composes moves with the bug instead of catching it. URLs are literals in tests now.

A third one is subtler and shows how a stuck pipeline can look like a working one. The only thing retiring a candidate was the existence of a document row, so a notice that legitimately carries no attachments re-qualified on every run, forever. Ten such notices at the head of the queue stall discovery completely. The fix is a column stamped only after SAM.gov has actually answered — not the cheaper "retire once listing rows exist", because those rows are written *before* the fetch, so a request that merely timed out would retire the notice permanently.

## Step five — extract, and why the documents are then thrown away

`POST /api/admin/extract` walks pending documents in priority order, downloads each one, parses it, writes the extracted text and the extracted fields, and marks the document extracted, absent or failed. Then it discards the bytes.

That discarding is a ruling, not an oversight, and it is the most consequential single decision in SP4. The question was whether the original document has to be kept at all — for citation, for provenance, for re-display. You ruled no, on the twenty-eighth of August, on the grounds that **a citation quotes the extracted passage rather than opening the original.** One ruling closed a chain of questions that had been open for weeks: no document retention, therefore no blob storage, therefore no blob provider, therefore no storage decision in the slice at all. Vercel Blob had already been chosen as the provider back on the eighteenth; it was never provisioned, and now does not need to be. The migration records the reason in the schema itself so that a future reader does not conclude the document viewer was forgotten.

What is kept is the extracted plain text, on the document row, and a set of field rows each carrying the value, the origin, the document it came from, and the quoted passage that justified it. So a citation is checkable — you can read the sentence — but you cannot open the PDF from inside Tenderfoot. There is a link out to the portal's own download URL, which is a different and weaker promise: it works until the portal deletes the resource.

The error handling in this step is deliberately paranoid and it is worth understanding why, because it is the direct scar tissue from the twenty-seventh of August. There is no transaction around the batch. Each document commits on its own. On that date one large transaction was killed at the platform's function ceiling and rolled back roughly nine thousand rows, recording nothing at all — the only way it was ever reconstructed was by reading gaps in a Postgres sequence. The document status column is already a checkpoint, and wrapping the batch is the only way to waste it.

Beyond that: one bad document must not kill a batch. A download failure, a parse failure, an unsupported type — that row is marked failed with the reason in a note, and the loop continues. Never mark a document extracted without text, because an empty extraction claiming success scores every field as a miss against a document nobody actually read. And a rate-limit response stops the batch cleanly rather than retrying harder, leaving the document *pending* rather than failed, because a rate limit is the most transient failure there is and this project has already burst-probed a host into a defensive posture once.

The first live run found something no fixture could have. A real SAM.gov drawings PDF parses to text containing a NUL byte, which Postgres `text` cannot store — and it is the only character with that property. Two defects, not one: the text was not sanitised, and the throw came from the update statement, which sat *outside* the try-catch around the parser, so it escaped and took every remaining document in the batch with it. The test named "one bad document does not kill the batch" stayed green throughout, because all of *its* bad documents fail at parse time and never reach a write. The NUL is now removed rather than replaced, before extraction so quotes are clean by construction, and the removal is recorded in a note next to the text it changed.

What that run cost, measured: seventy-nine documents processed, nine of them failing permanently — eleven point four percent. All nine now explain themselves. Four were four-hundreds that turned out, when probed by hand, to say "the resource has been deleted" — permanent, never worth retrying, and previously indistinguishable from SAM.gov being down. The rest were PDFs with pages but no text layer, which is to say scans — and three of those "scans" are photograph attachments, which OCR would not help with at all, because they are pictures of buildings rather than pictures of text.

One limit on the parsers that is easy to miss. The parser table handles PDF, DOCX, XLSX and XLSM, and ZIP. It does not handle DOC, XLS, or PPTX — and the corpus holds three legacy XLS files and one PowerPoint. The extraction spike parsed all of those successfully, but the shipped dispatcher does not route them anywhere, so today they would be marked "unsupported type" and filed as failures. The spreadsheet library is pinned from SheetJS's own CDN rather than npm, because the npm package is frozen with two high-severity advisories and no fix available; that was your ruling on the twenty-eighth.

Archives expand exactly one level. A ZIP inside a ZIP becomes a row that says it was not traversed, rather than recursing — and the depth limit is a boolean parameter rather than a counter, specifically so that a future "improvement" would have to delete an argument to break it. A bundle's members are extracted at the moment their bytes are in hand, inside the parent's own pass, because a member has no download URL of its own — its bytes came from inside an archive and nothing keeps bytes. Marking a member pending for a later batch would guarantee it is later fetched from nothing, fails, and records "download failed", blaming the network for a design gap.

## Why extraction conflicts are kept rather than resolved

This is the part of the design I would defend hardest, and it exists because of one real bundle.

The FSSA External Quality Reviews RFP is the closest thing to a bullseye in the whole corpus — an Indiana health-services procurement squarely in KP's strongest sector. It ships three boilerplate PDFs carrying two different submission deadlines. The file named with the actual solicitation number carries the stale date, the twenty-sixth of August. The correct date, the seventeenth of September, matching the portal, lives in the file with the *least* specific name. Prefer the file whose name matches the solicitation number: wrong. Take the first alphabetically: wrong. Take the most specifically named: wrong.

Why that is more than annoying: the funnel design includes a deterministic hard gate for "deadline passed". Fed the twenty-sixth of August, that gate would have silently eliminated the single best-fit opportunity in the corpus on the twenty-seventh — three weeks before it actually closed. That is exactly the silent-recall failure the whole system exists to prevent, and it is documented rather than hypothetical.

So three rules follow, all of them built. The portal listing outranks document text for dates. Precedence is applied at *read* time rather than write time, so nothing is discarded at ingest and the rule can change without re-extracting anything. And the losing values stay, with their quotes and their document pointers, on the explicit ground that a rejection you cannot inspect is a bug you will never find.

There is one more thing about this bundle that you should know, because it changes what the near-miss means. The shipped extractor, run against those three PDFs today, states the seventeenth of September and nothing else. That is the right answer reached by the wrong route. It is not preferring the correct date over the stale one — it cannot *see* the stale one. The cover pages read "Submission Due Date and Time:" on one line and "August 26, 2026" on the next, and the extractor clamps its backward look at a line boundary, so the cue falls outside the window and the date is never classified at all. The schedule tables put cue and date on one line, which is why the September date is found. **The system is safe here by accident**, and the day that clamp is relaxed — a natural-looking improvement — these documents begin stating the stale date and precedence becomes load-bearing for real. Which is why the regression test is in two parts, and why it deliberately does *not* pin the absence of a conflict: pinning an accident makes a future improvement look like a regression.

And on the thirty-first of August, on the test branch, the shape of that near-miss occurred in live data and a person saw it for the first time. Record four fifty-nine, "Building 333 — Roof Repair": a pre-bid date of the seventeenth of August quoting "To move the Site Visit day and time…", with the thirteenth of August preserved beneath it quoting "Site Visit: A site visit is scheduled for August 13, 2026 at 1:00 PM Central". An original date and the amendment moving it, both kept, the disagreement shown rather than resolved.

## Step six — the screens

The route table is short. Slash is the queue. Slash-solicitation-slash-id is the record. Slash-health is the old health page, moved off the root by SP6. Slash-admin is the source registry and firm profile. There is a dev-only gallery of the seventeen design primitives that does not ship to production, enforced by a check in the build gate that greps the real output for a marker string.

The queue shows one card at a time, deadline soonest first, nulls last. A solicitation is in the queue when it has no decision yet — no pursuit row, or a latest row still in the default state "New" — and it has not closed. Items with no deadline at all still enter, because a missing deadline is not a reason to hide an opportunity, and they sort last rather than first, because sorting unknown-as-urgent is how a null becomes a false alarm.

The default order is a documented departure. The screen outline ratified "ambiguity first" as the default on the twelfth of August, switchable between ambiguity, score, and deadline. Two of those three require a scorer, and ambiguity is a property of a borderline score, so with the assessment table empty by design there is nothing to sort on. Only deadline-soonest survives, so the switch has nothing left to switch between. When qualification is designed, that ratified answer returns intact.

The record screen shows six field rows, each with its value, its confidence, its origin, and the quoted passage — and three visually distinct states, which the outline insists on: found with a confidence, *absent* meaning "we looked and it is not there", and *not yet looked for*. Collapsing the last two is how a missing ceiling quietly becomes a guessed one. Conflicts render beneath the winner with their own origin and quote, unresolved. There is a timeline showing every sighting in order plus the organisation resolution as an event, because entity resolution is the least visible thing the system does and the easiest to get silently wrong, and this is the only place a person watches it happen.

That record screen is where SP4's two deferred demo bullets finally landed. SP4 could prove a citation was *stored*; it could never prove one was *readable*, because no slice before SP6 built a record view. The cost of that deferral is written into SP4's own spec and left there deliberately: the expensive part is that whether these citations are *useful* — quote long enough, confidence meaningful, six fields the right six — was first tested at the GO/NO-GO gate, which is the costliest place to learn that a citation is unreadable.

Fidelity is a live thread on these screens rather than a closed one. SP6 was the first slice to compose real screens, which is the moment the pixel-for-pixel mandate becomes operative, and neither its spec nor its plan referenced that mandate once. The consequence was visible: the queue, assembled from bundle-matched primitives, reads like the product; the record, hand-rolled from bare divs with CSS invented in the plan, did not — its field rows were a CSS grid with no column template, so four values stacked as four unlabelled lines while the table-row primitive, whose entire interface is a column template, sat unused. An audit ran on the thirty-first, six of its findings are fixed and deployed, three items are explicitly waiting on your ruling, and three more are blocked on data that does not exist. There is uncommitted work in the tree right now on the documents tab.

## Step seven — the decision

You press `I` for interested, `P` for pass, `U` for undo, `Enter` to open the record. Pass is a two-step: the key opens a reason panel, and the decision is only recorded on confirm. A reason is mandatory on pass by default and optional on interested, and the setting that enforces it is switchable and says plainly what turning it off gives up — the corpus a reason vocabulary would later be derived from. Chips are parked with qualification; free text only, because a preset vocabulary would flatten exactly the signal it exists to capture.

**Decisions are append-only.** Every decision inserts a new pursuit row. Undo does not delete — it appends a reversal, and both rows survive with the latest winning. There is no time limit on undo; it is simply "decide it again".

The reason for that is consistency with everything else in the system, and it is stated in the spec. Precedence keeps rejected values. Conflicts are rows rather than a flag. Gated items are filed rather than deleted. A decision that silently overwrote its predecessor would be the one place this project discards evidence — and it would do it to the data the GO/NO-GO number is computed from. It also makes a real question answerable: was this "interested" reversed to "pass" on second look? Append-only can answer that. Mutation cannot even be asked. The cost is named too: every read needs latest-row-per-solicitation, which is the kind of query that is wrong silently, so it lives in one shared fragment that the queue and the metrics both embed rather than two hand-written copies, and it has its own test.

Every row records who decided, set once per session. Two people scoring cannot be merged into one ground truth without knowing whose is whose. That was very nearly lost: the whole-branch review found, as a Critical, that the client never actually sent it — so every row the gate counted would have been written null, unbackfillable, with the demo writing real rows immediately afterwards. The server accepted it and had tests; one task built the parameter, another built the keypress, and the wire between them was nobody's scope.

The write is gated behind the shared admin secret. Reads are open. That is not ceremony: production is publicly readable by your ruling of the twenty-eighth of August, and a stranger clicking Pass would corrupt the gate's own measurement.

## Why the gate's sample is materialised rather than recomputed

The gate does not measure by triaging the queue as far as a day reaches. It triages a per-source random sample, and that sample is stored in the database as rows rather than regenerated from a seed.

The reason is a denominator. A seeded ordering is a deterministic permutation of *the eligible set*, and eligibility is "not closed and not yet decided" — a set that moves underneath the session as deadlines pass and ingests land. A re-seeded draw is reproducible only against a population that no longer exists. The gate's number has to outlive the gate session: six months from now, "Interested-per-hundred was three point two for SAM.gov" needs a denominator somebody can reconstruct.

So drawing a sample is an explicit operator action that counts the eligible population, records that count as a stored fact at draw time, selects rows by seeded permutation, and writes the header and the items in one transaction. How many were asked for is stored separately from how many were actually drawn, because a source with forty eligible rows and a request for a hundred draws forty, and those are different facts that one number cannot carry.

The edges were designed rather than discovered. A drawn item whose deadline passes mid-session *stays in the sample*, marked closed, rather than vanishing — dropping it would move the denominator, which is the exact failure the materialised draw exists to prevent. A second draw for the same source is a new sample with its own population size; samples are never edited. And the metrics deliberately report one row per sample rather than aggregating per source, because two draws carry two different population sizes and summing them would recreate exactly the denominator error the table exists to prevent.

Sampling is a measurement protocol, not a filter. It selects what a human reads in order to measure, never what the product returns. On the thirty-first the queue said so on screen — "SAMPLE, 25 of 1,018, SAM.gov, seed gate-2026-08-31" — while the ordinary queue stayed a separate, larger thing at one thousand and forty.

## What runs by itself, and what does not

Nothing runs by itself. To be exact about it: there are five things a human triggers and no scheduler anywhere.

Check probes a source for liveness and stamps its health. Run does scrape, import and merge as one request, with the transport artifact living only inside that request. Discover asks for attachments. Extract downloads and parses them. And drawing a sample is a POST that, as of today, **has no button anywhere in the product** — the queue's cleared screen says so in as many words, offering the endpoint name rather than promising a control that does not exist.

The platform ceiling is now three hundred seconds and it is tied to the code by a test. It was thirty for a long time, in a config file, while three separate budget constants in the route reasoned throughout about "the platform's roughly three-hundred-second ceiling" — eight times, six times and ten times the real value respectively. None of them could ever fire; the function always died first. That included a guard shipped hours earlier the same day, which inherited the wrong figure from the very comments that were wrong and shipped inert. The fix that matters is not the number: it is that a test now reads the config file and asserts the constant equals it, because the actual root cause was two numbers in two files with nothing tying them together.

There is also a pre-flight guard that refuses to run an import that cannot finish. It is pure — both its inputs are parameters rather than clock reads — and it carries a deliberate factor of two beyond the measured rate, because both rates come from a five-hundred-row run and extrapolating them to nine thousand rows as though they were linear is precisely the assumption that left this unguarded. So it is pessimistic at scale and will sometimes refuse a run that would have completed. That is the correct direction to be wrong in: a refusal is legible and costs one narrower re-run, while an overrun discards every fetched row silently. Zero rows always passes, deliberately, because a run that found nothing must still reach its timestamp stamp — stranding that stamp would widen the next window and manufacture the very condition the guard exists to prevent.

And the merge is mildly superlinear, now measured rather than suspected: four point eight six milliseconds a row at one thousand two hundred rows, eight point five three at nine thousand. About one and three-quarter times the per-row cost for seven and a half times the scale.

## What exists versus what is deliberately parked

Built and working: the source registry with health probing, the scrape-import-merge path, discovery, extraction with citations, the queue, the record, append-only decisions, the sample, and both gate metrics as endpoints.

Parked by decision, with the reasoning recorded: the matching engine in its entirety; the four machine scores and their evidence view; the gated-items drawer, because V1 has no gates so nothing is gated; the score strip on the composed card; saved views, because sampling now does the carving for the only session that needed it; the Brief, because two of its six parts are fit judgments against the firm profile and building them would be the back-door reintroduction the sequence warns against; the pipeline board, deferred by phase rather than by the V1 scoring decision; the radars and reporting, which are SP8 and conditional on a GO; addendum diffing; the document viewer, because there are no bytes to view; chips on the reason capture; authentication, which remains open on your list; and the deadline labelling worksheet.

The pursuit-cost panel is a special case worth naming. The screen outline names four facts for it — how many required forms, whether a pre-proposal conference is mandatory, how many references, whether anything needs notarising. Zero of the four are extracted. The panel renders empty and says why. That matters more than a missing panel usually would, because the outline's own argument for the whole screen is that "V1's triage queue earns its login on the pursuit-cost panel, the extracted facts, and being a system of record" — and one of those three legs is empty at the gate that judges the argument. Extending extraction to produce them was considered and rejected, because it reopens the cue-vocabulary work that is parked and its accuracy would be unmeasured at the moment the gate read it. If the gate session repeatedly wants a fact this panel cannot give, that is a finding the gate should produce rather than one the slice should pre-empt.

---

# Part two — what we can scrape today

## The registry, counted

Thirteen rows. Seven are eligible for contact. Six are excluded. **One is enabled.**

That one is SAM.gov, switched on in production on the sixteenth of August and left on. Every other row is `enabled = false`, which is how they were seeded — every source in migration 003 arrives disabled, and SP3 turned the first one on deliberately.

## The rule that decides posture, and why it defaults to no

The standing rule was adopted on the twelfth of August, prompted by Michigan, and it is a workflow rather than a legal opinion: **ambiguous or restrictive terms default a source to `out`; documented permission moves it to `in`, and the evidence is recorded on the row.**

Default-out because the costs are asymmetric. Wrong in the *out* direction costs a source you could have had and is fully recoverable — you switch it on, as Michigan was. Wrong in the *in* direction means systematic automated access to something you should not have touched, at volume, on a schedule, for months before anyone notices — which is not recoverable, and is the version that ends access permanently rather than temporarily. It also puts the burden where it belongs: whoever is adding a source wants that source, so the motivated party goes and gets the yes.

Recorded on the row because the reason has to outlive the person who established it. Someone reading "in" six months from now needs the date, the name, and the reading that was applied — otherwise a decision nobody wrote down is indistinguishable from one nobody made.

There are three postures rather than two. `in` means adapters may run on a schedule. `manual-only` means a person may read it and no automated access is permitted. `out` means not accessed at all.

## The seven that are legally in

**SAM.gov.** Federal, tier one, a real anonymous search API with no credentials. Its legal note reads: "Public federal system. Anonymous search API, no credentials required. Verified 2026-08-04." This is the only enabled source and the only one that has ever produced a row into production. Its verified-facets record names what works — the NAICS and product-service-code filters, the notice type, and sorting by modification date — and, more usefully, what is accepted and silently ignored: four separate spellings of a date parameter, and sorting by publish date. Archive depth is documented as a clean split: the API serves the latest active version only, and bulk CSV through Data Services goes back decades, refreshed weekly. It has a real health probe that asks a genuine one-record question and can distinguish "answered but returned zero rows" — which it reports as rot suspected — from a straightforward failure.

**USASpending.** Federal, tier one, anonymous, awards and contracts rather than solicitations. An adapter exists and was characterised against the live API. It has a real health probe. It is disabled and has never run into production. Archive depth is deep — fiscal year 2008 through the Award Data Archive, 2001 through custom download, with period-of-performance dates present, which is what makes the entity chain reachable.

**Indiana IDOA solicitations.** Tier three, a plain HTML table, anonymous-readable, verified on the fourth of August. No RSS, no API, no bulk download. Its coverage floor is documented rather than unknown: only solicitations expected to exceed seventy-five thousand dollars are publicly posted. It has no archive at all — closed solicitations are simply not published — which is why Indiana cannot be backtested on the solicitation side. There is a health probe URL, added on the eighteenth of August, and the note explains that the URL the repo had recorded was dead, four-oh-three from two separate networks, and the current page had to be found.

**Indiana EDS contract register.** Tier one, a public anonymous JSON endpoint, no account, verified on the tenth of August. Archive depth is full — two hundred and four thousand contracts back to 2005. This is where Indiana's Phase 0 and the expiration radar actually run, since the solicitation side has no archive. Its row carries a warning worth repeating: the amount field is a per-amendment delta that goes negative, and it is not a contract value; the running total exists only inside the PDF. The probe URL for it is honest about its own limit — a bare GET returns an empty object, because the real search is a POST, so the probe verifies the route responds, not that the search serves results.

**Illinois BidBuy.** Tier three, running Periscope, public browse and advanced search with no login, verified on the twelfth of August. This was the find of that day: deep archive, two thousand one hundred and fifty-five closed solicitations back to February 2018, with awarded vendor on the row. It overturns the working assumption that solicitation-side backtesting is federal-only, and Illinois sits inside the firm profile's secondary geography. It is also the one platform confirmed to *pass* the silent-failure test: holding one parameter and setting status to Closed moved the count from a hundred and twenty-seven to zero — an empty intersection, so the parameter is genuinely honoured — and then returned two thousand one hundred and fifty-five unconstrained.

**Michigan SIGMA VSS.** Tier three, CGI Advantage. Cleared by you on the twelfth of August, and the legal note records exactly why, in full, including the banner text: the system says it is "intended for government authorized users only… Disconnect immediately if you do not have express written authorization to access SIGMA." Your reading was that authorisation derives from holding a vendor account, which KP has or has had, which is the reading that makes sense of a *Vendor* Self Service system. The note also records the consequence: the adapter should authenticate rather than read anonymously, which moves the governing text from that banner to KP's own account terms — a different document, and the usual home of automated-access clauses. Archive depth is none; only open solicitations are listed.

**Kentucky eMARS VSS.** Same platform, cleared on the same reading, and the row says plainly that it is **not independently verified**: "INFERRED FROM PLATFORM, not tested. Everything here is Michigan's behaviour assumed to repeat. Verify before relying on it." That is the platform-leverage claim in its purest form — one CGI Advantage adapter intended to cover both states — and it is untested.

## The six that are out

**Ohio OhioBuys** is manual-only. It is CAPTCHA-gated: the public solicitation URL redirects to a browser check and fails automated navigation. Bot detection was not worked around. A person may read it; a scheduled adapter cannot. You marked it for manual review on the twelfth of August, noting that KP does little work in Ohio.

**GovWin IQ, BidNet Direct and BidPrime** are out — paywalled aggregators excluded by their own terms of service, and the note on each says "Not accessed." GovWin's row carries the standing precedent: terms are respected even where access is technically possible.

**Two corpus imports** are excluded for a different reason entirely. They are the Indiana open-solicitation set from the fourth of August and the federal calibration set from the tenth, loaded from files on disk so that the sighting path was exercised by the first data in the system. Their health note reads "no endpoint — fixed snapshot, not a feed." They are not adapters and never will be.

## What health actually tells you

Health is a live statement about whether a source is reachable, written by an operator-invoked probe. It has five states — ok, failing, rot suspected, excluded, unknown — pinned by a database constraint since migration 006, because before that any string at all could be stored through an unvalidated PATCH.

Two of the seven eligible rows have real adapter-backed probes, SAM.gov and USASpending, and those are the only ones that can ever report rot, because they are the only ones that know what a good answer looks like. Three have a generic URL probe against a listing page rather than a home page, because a portal home page can serve happily while the search behind it is broken. And two — Michigan and Kentucky — have **no probe target at all**, deliberately. Both expose the same session-bootstrap landing screen at the same path shape, and that page returns two hundred while telling you nothing about whether the solicitation search works. The note says it plainly: an unverifiable URL that lies is worse than an honest gap. So those two rows stay unknown and unstamped, and the screen says "Not checked — no probe target" rather than showing a dead button.

Two things follow that are worth holding onto. First, health is only measured when someone asks, so every verdict carries a timestamp beside it — a green dot from three weeks ago reads as current otherwise. Second, the status bar's "zero degraded, zero rot suspected" means "nothing we probed came back failing", counted across seven non-excluded rows, two of which have never been probed at all.

And there is a source that structurally cannot be health-checked by this project's own method. Michigan withholds totals — it reports "1 to 20 of 20+ Records" — so the vary-a-parameter check has no number to watch move. That fact is recorded on the row, because it means health there has to be inferred another way and nobody has designed how.

---

# Part three — what we are looking to scrape, and what blocks each

Nothing is blocked on legal posture. Every source the project wants is already ruled in. What blocks them is adapter work, a known technical hazard, or the fact that live and scheduled ingestion is itself a post-gate slice.

## The one prerequisite that applies to almost all of them

The merge groups sightings by external id alone, and that is only safe while external ids are globally unique. SAM's opaque identifier and USASpending's generated internal id are. **The state portals are not.** They emit human-assigned identifiers like "RFP-2024-001", and two different states reusing that exact string is plausible rather than exotic. If it happens, two unrelated opportunities fuse into one canonical row, and the failure reads as corroboration — "two sources independently saw this" — rather than as corruption. The source file says in as many words that resolving this is a prerequisite for onboarding the first human-id source, not a someday cleanup. So Illinois, Indiana, Michigan and Kentucky are all sitting behind one piece of design work that has not been done.

## USASpending

The adapter is written, characterised against the live API, and has a real health probe. It is disabled and has never run. What blocks it is not engineering — it is that it is an *award* source rather than a solicitation source, so it feeds the entity chain and the expiration radar rather than the queue, and the radar is SP8, behind the gate. Switching it on today would add rows nothing currently reads.

## Illinois BidBuy

Probably the highest-value un-onboarded source, and the only non-federal place a solicitation-side backtest can run against real outcomes. What blocks it is an adapter that does not exist. Periscope is tier three — HTML — but a comparatively friendly tier three, because it exposes real query parameters that have been verified to actually filter. One adapter would also cover Arkansas and Montana. Plus the external-id prerequisite above.

## Indiana EDS contract register

Tier one, a real JSON endpoint, and its whole dataset is already sitting in the repository under the Indiana contracts folder. What blocks it is sequencing rather than difficulty: its output is the expiration radar's input, and the radar is scheduled for SP8. That placement was questioned in the plan on the tenth of August — the feature that most directly answers "finding out too late" is scheduled last, behind a gate, and its data is the easiest to get — and you resolved it: the radar stays behind the gate, because "it's not likely, but it is possible, especially for Medicaid-related RFPs" is not a case for moving post-gate work in front of the gate. Two consequences were written down. The radar must be sector-weighted rather than global, or it produces two thousand leads a year and gets muted in a week. And there is a live instance waiting for it — two hundred and thirty-one contracts across a hundred and forty-nine vendors, including the managed-care capitation book, all expiring on the thirty-first of December, inside KP's single strongest sector.

## Indiana IDOA solicitations

Tier three, a plain HTML table, low complexity. What blocks it is an adapter, plus the external-id prerequisite, plus the honest fact that its coverage floor is seventy-five thousand dollars and it has no archive, so it can only ever tell you about live work.

## Michigan SIGMA and Kentucky eMARS

These are the expensive ones, and the hazard is technical rather than legal. All traffic is a form POST to a single endpoint with server-side session state, unlike Periscope which exposes real parameters — so it is genuinely tier three, postback-driven, materially more expensive per adapter. Totals are withheld, so the project's own vary-a-parameter health check cannot run there at all and health needs a different signal nobody has designed. Michigan is a documented silent-failure instance in its own right: setting the "Show Me" filter to All and to Recent Awards returned byte-identical result sets to Open — same twenty rows, same dates, every status Open. And your own clearing carries an engineering consequence that has not been acted on: if authorisation derives from the account, the adapter should authenticate, which moves the governing document to KP's account terms. Kentucky adds one more caveat: everything on its row is Michigan's behaviour assumed to repeat, and the platform-leverage claim is untested there.

## Ohio

Blocked on posture and on feasibility together, and neither is likely to move. CAPTCHA-gated, marked manual-only, and KP does little work there.

## The aggregators

Permanently out. Not a blocker to be cleared — a decision.

## And the thing that gates all of it

Live ingestion is SP7, and SP7 is conditional on a GO at SP6. Scheduled runs, the state portals flowing, and health alarms firing are all in that slice. Vercel Cron is not exercised in version one at all — the platform can do it, so the closed-laptop risk is retired in principle, but nothing uses it and SP7 must.

---

# Part four — what analysis we are actually doing

This is the section that matters most, so I am going to be blunt in it. There is a version of this answer that sounds impressive and is false. The true answer is that Tenderfoot performs very little analysis, that most of what it does perform is *instrumentation* rather than *judgment*, and that even the instrumentation is currently thinner than the design intends — in two cases because a column nothing writes is being read by something that needs it.

It helps to split "analysis" into three layers, because they are in completely different states.

## Layer one — extraction. This is the only thing the system can be right or wrong about

With no scores in version one, extraction accuracy is the entire surface on which Tenderfoot can be correct or incorrect. That is the design spec's own framing and it is worth taking literally.

### What extraction actually is

Six fields are in scope: the close date, the Q&A close date, the pre-bid date, whether a pre-bid is required, the set-aside, and the value in cents. **Three of the six have no extraction logic at all.** Pre-bid-required, set-aside and value are listed in a constant called `NOT_EXTRACTED` and each gets a row saying "not extracted". That is deliberate and it is honest — a row saying "we did not look" is a different fact from a row saying "we looked and it isn't there" — but it means half the field list is decorative.

The three that are attempted are all dates, and here is the whole of the mechanism.

A regular expression finds dates. It matches exactly one shape: a full English month name, a space, one or two digits, a comma, and a four-digit year. "August 26, 2026". **That is the only date format the extractor can see.** It does not match "8/26/2026". It does not match "26 August 2026". It does not match "2026-08-26" or "Aug. 26, 2026" or "August 26th, 2026". I want to state that plainly because it is not in any summary document I found, and it bounds everything downstream: whatever the recall number turns out to be, it is a recall number over documents that happen to write dates in American long form.

For each date found, the extractor looks backwards — at most a hundred and twenty characters, and never past a block boundary — for a cue word. There are three cue groups, tried in a fixed priority order. Q&A wins on "questions", "inquire" and its relatives, or "clarification". Pre-bid wins on "pre-bid", "pre-proposal", or "site visit". The close date wins on "due", "deadline", "closing", "submitted by", or "received by". **That is five phrases for the highest-consequence field in the system.** The first cue that matches and is not already claimed by an earlier date wins the field. No cue means no field. It is not proximity-based — a lower-priority cue far away still beats a higher-priority cue nearby, as long as both are inside the window.

The block boundary logic is more careful than the cue list, and the asymmetry is telling. It has to handle the fact that the DOCX converter emits zero newlines across all fifty-two corpus DOCX files, so without HTML tokens the DOCX path would have no clamp at all; and it has to pair table open and close tags rather than count them, because a bare counter would let one stray tag suppress paragraph boundaries for the rest of a document. Real thought went into the clamp. The vocabulary it clamps around is five words.

Then the value is round-tripped through a date constructor to reject calendar dates that do not exist, because the shape regex would happily accept "February 31" and JavaScript would normalise it to the third of March — a fabricated value nothing downstream would catch. A measurable miss beats an invented value.

And the confidence assigned is nought point six, always, for any value found.

### So the honest description of layer one

It is a cue-and-date matcher over three fields, blind to every date format but one, with a five-phrase vocabulary for the deadline. It is deliberately conservative — the comment says so, and the reasoning is that a wrong deadline is a missed bid. It is well tested, with mutation testing on the parts that matter. And it is a much smaller thing than "extraction" makes it sound.

## The accuracy instrument, and what it can and cannot see

The measurement is a SQL query rather than a harness, and its ground truth is the portal listing rather than a hand-labelled set — which is the substitution that makes accuracy computable today, for free, on every ingested solicitation. That was ruling three of SP4.

It reports four numbers per field, and **two of them do not sum with the other two**, which is stated in the code in capital letters because it is exactly the kind of thing that gets averaged together six months later. Agreed and disagreed count *document statements* — a bundle of three PDFs all quoting the deadline contributes three. Missed and opportunities count *solicitations* — that same bundle contributes one. Agreed over agreed-plus-disagreed is a precision rate. Missed over opportunities is a miss rate. Anything mixing them is meaningless.

An "opportunity" is defined tightly and correctly: one solicitation-and-field pair where the listing states a value *and* at least one of that solicitation's documents was actually processed. Failed and pending documents are excluded deliberately, because a document we never managed to read is a missed *fetch*, not a missed extraction, and conflating them would blame the extractor for the network.

### The first live reading, and what it is worth

Seventy-nine documents, on the test branch, nothing left pending. For the close date: agreed two, disagreed zero, missed fourteen, opportunities sixteen. Precision one hundred percent. Recall twelve point five percent.

**Precision of one hundred percent over two agreements is two data points.** Both matched the portal exactly, and the clearer of the two quotes "Proposals are due no later than: August 31, 2026 at 10:00 AM Central". That is encouraging and it is not a rate.

**Recall of twelve point five percent is an unvalidated lower bound and must not be quoted as recall.** The denominator of sixteen assumes all fourteen misses were the extractor's fault. The instrument structurally cannot tell a document that states the deadline and was misread from a document that genuinely never states one — the difference is invisible to any query. A first skim of the worksheet suggests several are clean true negatives, in which case the real denominator is smaller and the real recall materially higher. The status file makes the point sharply: this is the same class of error the corpus calibration rules already ban, a figure whose base rate is wrong by construction. That rule bans the *flattering* version. This is the unflattering one, which is easier to leave standing because it feels like caution, and is just as untrue.

The misses do describe themselves, which is the instrument working. Of sixty-nine document rows, fifty-three carry no note at all — no date anywhere in the text, which means Q&A sheets, wage determinations and forms, clean true negatives. Sixteen carry the note "a date was present but no cue placed it in this field". Those sixteen are the actionable recall signal.

And there is a correction on the record about those sixteen that is worth repeating, because it is the shape of error this project keeps catching in itself. I claimed the label-above-value blindness — the FSSA cover-page problem, cue on one line and date on the next — "very likely explains much of" them. Measured against those sixteen documents: **it explains zero of sixteen.** Not one of them carries a deadline cue near a date at all, on the same line or across one. The blindness is real, the FSSA bundle proves it, and it is simply not what the live misses are made of.

What the misses actually are is a vocabulary gap. Two of them say, in plain English, "completed solicitation package must be returned **no later than** 7:00 a.m. Central Time on August 31, 2026." That is a deadline, well inside the lookback window, missed because "returned no later than" is not in a five-word cue list. Widening the vocabulary against real phrasings is the cheap, high-yield change. Relaxing the clamp is the expensive one and now has to justify itself separately. Several of the sixteen are genuine true negatives that should stay missed — a date in a drawing's title block, a FAR clause effective date of January 2030, a date in an address block. The instrument scoring those as misses is the known cost of counting per solicitation rather than per statement.

### Three things about the accuracy instrument that are worse than they look

**One: it can only ever measure one field, and the reason is upstream.** The ground truth rows are copied from the solicitation's own columns. The merge writes four columns. So for every SAM.gov solicitation, the listing states the close date and states nothing else — and the accuracy query requires a stated listing value, so the other five fields drop out of the result entirely. That reads as "the portal does not carry them". **The portal does carry at least one of them.** The SAM listing payload in the repository's own fixture contains the publish date, the notice type, a set-aside block, and product-service codes. All of it is sitting in the sighting's raw JSON, unread, because the merge learned to read the title and, on the twenty-ninth of August, the deadline, and nothing else. The set-aside is measurable today and is not being measured, because a copy step nobody has written does not exist.

This is not a hypothetical risk — it already caused the single largest near-miss of the SP4 build. The first live smoke run worked perfectly and every ground-truth row it wrote said ABSENT, on all six fields, across all nine thousand six hundred and eighty-two production SAM.gov rows. The accuracy query would have reported *zero* fields, not the one field we had already reduced it to. Green tests over an empty premise, for the whole slice. The generalisation from that day is the one worth keeping: tests prove the code does what it says, and say nothing about whether the data can support what the code is *for*.

**Two: the instrument has no surface.** `accuracyByField` is exported from `precedence.ts` and is called from exactly one place in the repository: its own test file. There is no HTTP route. There is no CLI command. There is no screen. To read the accuracy of the system today, somebody has to open a Node process or a psql prompt. That is the whole reporting story.

**Three: there is no threshold, and setting one is yours.** The design deliberately measures without judging — the build does not fail on accuracy, because no threshold has been ruled and inventing one would be a design decision made by omission. That was correct while there was no number. There is now a number, and the status file lists setting the threshold as newly actionable and unowned.

## Layer two — the gate's instrumentation

The gate is supposed to produce two numbers, and nothing else in the project can produce them. They are in very different health.

### Volume per source per week — currently unproducible for the one enabled source

The series is computed on the *posting* date and never on when we saw a row, and the reasoning is right: nothing ingests unless a human asks it to, so sightings cluster on the days somebody ran a scrape, and a weekly series built on sighting dates measures operator behaviour. It would show a source surging or dying when all that changed was who was at the laptop.

The predicate that decides whether a posting date is usable is unusually careful — it range-checks the month and day rather than merely checking digit shape, because a value like "9999-99-99" matches a shape check and then crashes a date cast, taking the whole report down for every source on account of one row. It is deliberately not anchored at the end, so full ISO timestamps are admitted. It casts only the first ten characters, so trailing garbage cannot reach the cast. And it names its own remaining hole: a calendar-invalid but range-valid date like the thirtieth of February would still crash it, and the fix if that ever fires is a real date-parsing guard rather than a wider regex.

None of that care matters right now, because **one thousand seven hundred and twenty-four SAM.gov solicitations carry no posting date at all**, and SAM.gov is the only enabled source. Measured on the test branch with the product's own predicate: a hundred and forty parseable, one thousand seven hundred and eighty-five excluded, and — this is the important part — **zero malformed-but-present**. The exclusion is entirely absence. The metrics code is correct; there is nothing for it to plot.

The underlying reason is structural rather than incidental, and I have not seen it stated anywhere in the repository. **The only writer of a posting date anywhere in the server is the corpus loader.** The merge does not write one. The import does not write one. So the only rows in the entire system that will ever have a posting date are the hundred and forty federal calibration rows loaded by hand from files on disk in August. Every row that arrives through the live ingestion path lacks one, by construction, on every branch, including production. Production's exact count is not recorded in the repo, but the mechanism guarantees the same gap there.

That is the identical shape as the close-date gap that was fixed on the twenty-ninth of August: the data was never missing, it was sitting unread in the sighting's payload. The SAM listing carries `publishDate`. Reading it would be a small, well-precedented change of the same form as the deadline reader — same file shape, same pure-function pattern, same "source named explicitly" discipline. It has not been done. So the gate's first number is one merge fix away, and it does not have it.

### Interested-per-hundred — this one works, and ran

Computed against the materialised sample, per sample rather than per source, counting solicitations at their *latest* pursuit state — so an "interested" later reversed to "pass" counts once, as pass, and the reversal is still inspectable. Three numbers ship together on purpose, because any one alone misleads: what the sample represents, how many were drawn, and how many have actually been decided. A half-triaged sample then reads as a half-triaged sample rather than as a rate. And the rate is null rather than zero when nothing has been decided, because a rate over zero decisions is unknown, not zero.

It ran on the thirty-first, on the test branch: population one thousand and eighteen, drawn twenty-five, decided five, interested three, rate sixty. That is a working instrument reporting a number over five decisions. It is not a finding about the market; it is proof the instrument reports.

### Two smaller gaps in the instrumentation

There is a third measurement that exists and is not wired in. Per-source yield — sightings, canonical records, and unique-to-source counts per source — is implemented and is reachable only from the merge CLI's printed output. The SP6 design spec says it "is reused rather than reimplemented" by the metrics work. **It is not.** The metrics module imports nothing from it. That is a spec claiming something the code does not do, and it is worth correcting in one place or the other.

And there is no metrics screen. The endpoint exists and returns both numbers. Nothing in the client fetches it. The queue's cleared screen offers a card labelled "Metrics — volume and Interested-per-hundred", and clicking it navigates to the admin page, which does not display either number.

## Layer three — judgment. There is none, and that is the design

No scoring. No ranking. No filtering. No gating. No suppression. The assessment table is created empty and stays empty. The score strip primitive exists, handles a null value by rendering a dash with no fill, and is deliberately not composed onto any product screen. The pursuit-cost panel renders empty and says why.

The standing guard that goes with it is worth quoting because it is the thing most likely to be violated by accident: **a rendered control may never become a live filter or score until qualification is designed — artifact permitted, data flow forbidden.** Sampling is explicitly not an exception, because it selects what a human reads in order to measure, never what the product returns.

There is one more rule in this layer that is easy to lose and expensive to rediscover. The system is capacity-agnostic, and that binds the machine rather than the person. A user is entitled to pass on something because it is too big for the firm right now, and the record should capture that in their own words. What is forbidden is the *machine consuming it*. The design spec found a real instance of that defect in its own earlier text: an earlier section proposed that every recorded no-bid reason automatically become a few-shot example, which applied to a capacity reason silently converts a human judgment about this quarter into a standing machine preference against large contracts. The defect was the automatic pipe, not the reason.

## What the GO/NO-GO gate is actually asking — and whether it can answer

The question changed when matching was parked. It used to be "is the scorer's top N precise enough?" It is now: **does reading everything from active sources surface work KP would pursue and had not otherwise seen?** That is a fairer test, arguably, since it asks whether the sources and the collection are worth anything before any judgment layer can flatter them.

A negative result is a valid result, and the shape of the negative changed with the question. The old failure was "the scorer cannot separate fits from non-fits". The new one is "everything the active sources return, read exhaustively, contained almost nothing worth pursuing" — a finding about the market rather than about the software, reached faster and with less machinery.

> ### ⚠️ SUPERSEDED 2026-09-02 — the paragraph below is no longer true of the first clause
>
> **"Had not otherwise seen" IS captured now.** Migration 013 added
> `pursuit.discovery_channel`; the Interested step requires one of seven values
> and refuses without it; the metric reads it back. Live on production, verified
> by behaviour. So the headline number has a data path — what it does not yet
> have is **answers**, because no one has triaged the sample.
>
> **The second clause below still stands unchanged.** Value weighting remains
> impossible, and the 09-01 payload audit closed that by evidence rather than
> leaving it pending: SAM publishes no estimate for open notices.
>
> The rest of this section — the two supporting numbers, and the honest reading
> that they support a headline the system could not produce — was accurate when
> written and is the reason the capture was built.

Now the unflattering part. **The gate's own question has a clause the system cannot currently measure.** "Would pursue" is captured — that is the pursuit row and its reason. "Had not otherwise seen" is not captured anywhere. There is no column, no prompt, no field, and no code path in the client or the server that records whether an opportunity was already known through another channel. The acceptance-criteria table defines discovery as "qualified opportunities surfaced that would not have been seen, weighted by value" — and the second half is unmeasurable too, because the value column is null on every ingested row for the same reason the posting date is. So the two numbers the gate actually ships are volume and base rate, which the design correctly calls *supporting* numbers, and the headline number they support has no data path.

That is not a reason to distrust the gate session. A person paging through a sample can say "I already knew about this one" out loud, and that judgment is exactly what the session is for. But it will be an impression rather than a figure, and if you want it as a figure the smallest honest change is one more state or one more field captured at decision time — which is a design decision, and yours.

## The finding that most predicts what the gate will feel like

One day of open SAM.gov notices was five hundred and thirty. Five hundred and seven of them were Department of Defense. The titles are overwhelmingly part-number micro-purchases — "53, RETAINER, SEAL"; "59, SWITCH, FLOW". That is roughly three thousand seven hundred a week from one source, mostly parts orders a professional services firm cannot bid.

The old risk was "volume is unmeasured". It is measured now and it is loud. A queue that is ninety-five percent defence-logistics parts will read as noise whatever the triage interface does. That is not an argument for a filter — qualification stays parked — but it is the strongest evidence that the gate needs its numbers before it can mean anything, and it was the evidence that moved source health in front of the gate in the first place.

Three volume observations exist and they do not agree with each other: five hundred and thirty in a day, fifty-seven the next day, and around one thousand seven hundred in a twelve-hour window later. Three observations, no pattern. Any capacity or base-rate figure taken from one window is standing on one number.

## The honest summary of layer-by-layer analysis

Extraction: a mechanical cue matcher over three date fields, one date format, five deadline phrases, a constant confidence, measured against one field of ground truth, with a recall figure that is not a measurement and an instrument nothing can call from outside a test.

Instrumentation: two gate numbers designed, one working and demonstrated on five decisions, one structurally unproducible for the only enabled source because a column nothing writes is being read by the thing that needs it. A third measurement built and not wired in. No screen for any of them.

Judgment: none, on purpose, and the guard that keeps it none is written down.

Everything in that list is either a deliberate parking with the reasoning recorded, or a gap the repository already names somewhere. None of it is a surprise to the project. What it is not, under any reading, is a system doing sophisticated analysis of solicitations — and if anyone outside the project has formed that impression, it did not come from the code.

---

# Where that leaves things

Six slices are merged and deployed. SP6, the gate slice, merged on the thirty-first and its criterion was met on production — a real sample drawn, keyboard triage, a decision appended and reversed with both rows surviving, a citation read on screen, and a real conflict rendered beneath its winner. Production has documents for the first time in its history. The test gate stands at five hundred and twenty tests across sixty-eight files at the last recorded run, with a sixty-ninth file added by today's fidelity work.

What is genuinely undone, in rough order of what it would buy:

The gate session itself, on production, with enough decisions that Interested-per-hundred means something. Everything is built for it.

A posting date read out of the payload the merge is already holding, which is the difference between having one gate number and having two. It is the same three-line change that was made for the deadline two days ago.

The deadline labelling worksheet, which is the highest-value thing a human can do for the extraction question, and which is parked by your ruling. Nothing is pre-specified about it; when it comes back it starts from the worksheet as built.

A wider cue vocabulary in the extraction file, which the parked worksheet would aim, and which today is five phrases.

The external-id design work, which is the gate on every state portal.

And three fidelity rulings that are waiting on you rather than on anyone else: whether the score strip renders on the composed card when the bundle shows it and the SP6 deviation says no; whether an extraction conflict renders inline in the value cell as the prototype does or beneath the winner with its own quote as the spec does; and whether the navigation shows all seven of the bundle's entries with the unbuilt ones inert, or the two that lead somewhere.
