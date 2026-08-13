# DOOGIE - TENDERFOOT

August 3, 2026:

1. Initiated Project ; No special setup or prep. Provided with my concept outline and asked to brainstorm about expansion. Was asked several clarifying questions, most scope and intent related. 

2. SPBS created a plan. docs/superpowers/specs/2026-08-03-tenderfoot-design.md

3. BREAK FOR DOC REVIEW. Generated Gemini Notebook Podcast, Video, and IG. 

August 4, 2026:

*[AI-GENERATED ENTRY — written by Claude at my request. I normally do these by hand.]*

1. Read the design doc. Approved it, no real issues. Asked what questions were still open — got five back.

2. Corrected two things that ran deep. First: the doc framed the whole project around "is there enough work to justify a BD hire." Wrong emphasis. It's about utilization — finding work for the team when projects slow down. Hires follow won work, not the other way around. Second: we've only competitively bid one contract (small IU job), so there is no bid history to validate scoring against. That assumption was load-bearing through the entire validation section and had to come out.

3. Authorized portal research. Indiana does email solicitations to registered bidders — but filters them by UNSPSC code, which is exactly the kind of filter we'd decided not to use. Also only posts bids over $75K, and doesn't archive closed solicitations at all. Contract data is good though, so Indiana comes in through there instead.

4. Best finding of the day: states mostly don't build their own portals, they license about five platforms. Illinois is Periscope, Ohio is Ivalua, Michigan and Kentucky are both CGI Advantage. So adapters get written per platform, not per state. Makes the "portable to other firms" idea a lot more real.

5. Spec updated for all of it — 14 edits across 9 sections. Commit 518bb72.

6. Rewrote my concept outline as a build inventory: 49 components with dependencies and a marker for what Phase 0 actually needs. Original preserved as OLD - Tenderfoot Concept Outline.md. Commit cdffda8.

7. NEXT: break the inventory into slices and phases. Still owe a capacity calendar — when current engagements wind down. Timing scoring and the Phase 0 coverage report both read from it.

8. SCOPE CORRECTION, same day. [Entries 8-13 also AI-generated.] Struck the capacity angle entirely — it was overthought. KP's calendar, headcount, and how much work we can absorb are NOT the system's business. Only goal right now: deliver the most accurate, most likely prospects for consideration. Kept the distinction that eligibility facts (a bid requiring 50 employees) stay as hard gates, while capacity judgments (do we have bandwidth) aren't modeled at all. Also deferred pursuit management — pipeline board, won/loss tracking, ownership — to a later phase. Contract seeking now; seeking AND management later. Item 7 above is superseded: no capacity calendar needed. Spec and inventory both updated.

9. Dropped the methodology + case study docs into the repo and asked how that process would apply here. Good discussion. Main thing: for IMPACT the screens basically WERE the product, so the prototype specified almost everything. Tenderfoot's hard part is the engine — a pretty triage queue full of fake opportunities proves nothing about whether the ranking is any good. Prototype still worth doing though, because it settles the data model before there's a migration to fight.

10. Asked how we actually built the IMPACT prototype — I remembered a screen outline and reference images but couldn't remember the tooling. Turned out the docs don't record it. Went digging in the old repo instead.

11. That dig was worth it. Confirmed Claude Code (CLAUDE.md was in the very first commit; no co-author trailers in git so history alone would never show it). Also found something neither the methodology nor the case study mentions: the first commit had THREE competing design directions — warm-editorial, civic-minimal, modular-dashboard — each built across the same three screens. Civic-minimal won; losers were archived, not deleted. And the logo pixel-sampling happened AFTER picking a direction, not before. Both existing docs imply otherwise.

12. Also found the prototype phase ran real spec/plan pairs — a 1,002-line plan on day one, and one 207-line spec that produced a 1,771-line plan. Same subagent execution skills as production, and the commit messages were written into the plan before the work. Explains why that log reads so cleanly.

13. Wrote all of it up as docs/Proto2PRD.md — merges methodology + case study and adds the prototype phase neither one documents. Every claim marked by source with an evidence table. Then docs/Tenderfoot-Plan-of-Action.md: ordered stages, nine dev slices, hard go/no-go gate at SP6. Corrected one thing I'd gotten wrong — the doc read our divergence from the reference images as deliberate philosophy, but my actual intent was to match them closely. Reframed as a warning: brand artifact and content type both override references.

14. Claude collected the corpus: 76 real solicitations, 61 from Indiana and 15 federal, each banded A/B/C as a guess at whether we could plausibly bid it. Noise ratio is brutal — 9 of 61 Indiana ones are even arguable, the rest is walleye, toilet paper, stone, dog food. Good news for the design though, since it's exactly what the hard gates are for. One genuine bullseye: FSSA External Quality Reviews for MCO Programs. Medicaid managed care quality review, basically our service line verbatim.

15. Had Claude pull the actual bid documents for the band A entries — 8 Indiana bundles, 2 federal, ~40MB. Opened the FSSA Medicaid EQR one first (our best fit) and it immediately broke: the bundle ships THREE boilerplate PDFs with TWO different deadlines. The correct one (Sept 17, matching the portal) is in the file with the least specific name; the file named with the actual RFP number has a stale Aug 26. Every obvious rule for picking the right file picks wrong. Worse — the hard gate for "deadline passed" would have silently killed our best opportunity three weeks early. That's the exact silent-recall failure the system is supposed to prevent, and now it's a real documented case instead of a hypothetical. Addendum 1 doesn't even mention the date change, so change detection has to diff rather than trust the summary.

16. Committed the documents rather than relying on re-fetching, because Indiana doesn't archive closed solicitations — several of these close within days and then they're gone.

17. Didn't care for the SHELL/SCREEN/VIEW outline format, so we scrapped the template and Claude's test version. I'll do my own: area outline with descriptions, effort/impact, priority, plus a full set of user stories. Also owe a tech stack outline, which closes the last open question in the spec.

18. DECISION: Tenderfoot is NOT branded as KP. Own name, own identity, own design language — even as an internal tool. Turns out this is actually more consistent with the portability rules we already wrote (no KP facts in the product), and a KP-branded interface was the biggest remaining violation of that.

19. That broke one of the IMPACT mechanisms though — their palette worked because it was measured from a logo that already existed, so colour stopped being a preference. We have no logo. Resolution: what matters isn't where the artifact came from, it's that you NAME one before sampling and then don't revisit it. Someone chose IMPACT's logo too. Also means the wordmark becomes something the bake-off produces rather than something we feed it.

20. Told Claude to keep BOTH visual inputs as permanent optional slots — design conventions AND palette source — rather than collapsing them because we might not need one this time. Playbook narrowed to fit the current project stops being a playbook. Same note applies generally: log and generalize as we go, don't reconstruct at the end. IMPACT's bake-off brief is the cautionary tale — it worked, nobody wrote it down, it's gone.

21. NEXT: I write the area outline + user stories + tech stack, and find inspiration images. The hand-run (scoring the 24 band A/B rows in corpus/manifest.md) blocks on nothing and is the one thing that can cheaply tell us this whole idea doesn't work.




August 10, 2026:

*[AI-GENERATED ENTRY — written by Claude at my request. I normally do these by hand.]*

1. Cleaned up first. That NotebookLM infographic from Aug 3 was built on the pre-correction spec — still says Phase 0 exists to justify a BD hire, still defines Timing as whether current staff can survive the window. Both things we struck. Archived rather than deleted; the delta between it and the current spec is the clearest record of what the scope correction actually changed.

2. Asked for more calibration examples since only 5-10 of the 76 are plausible yeses. Got 3,357 archived federal solicitations over 24 months, split into two sets that must never be mixed — 80 enriched for teaching the adjudicator my voice, 60 random for measuring. A precision number off the enriched set would be fiction; its base rate is wrong by construction.

3. But the real finding was the opposite of what I asked for. Across all 3,357 federal solicitations in our own service-line codes, ZERO have an Indiana place of performance. It's all DC, Maryland, Virginia, plus USAID. The thin positive class isn't a collection problem, it's the market. More federal archive would not have helped.

4. So Claude probed Indiana's contract search. This is the find of the week. Undocumented JSON API behind the public search page — 204,439 contracts back to 2005, no credentials, and every record carries the contract END DATE. That's the field the spec calls the highest-value one in the system. Pulled 2,160 contracts expiring within 18 months across our sectors, every one with a PDF.

5. 231 contracts across 149 vendors all expire 2026-12-31 — including the Medicaid MCO capitation book, Anthem and MDwise and Coordinated Care. Same programme the FSSA EQR RFP exists to review. That re-procurement is visible right now, four months out, from a public endpoint.

6. Two traps in that data worth remembering. The end-date filter is an upper bound only, so an expiry window has to be bracketed client-side. And `amount` is EDS field 6, "total amount this action" — a per-amendment delta that goes NEGATIVE. Summing it double-counts. The running total is field 7 and only exists inside the PDF.

7. Also: the PDFs open with State Form 41221, which publishes method of source selection AND M/WBE status for the prime and the sub with percentages. Incumbent WBE status is public for every contract the state holds. That turns the teaming question from guesswork into a query.

8. Third government API in a row that silently ignores parameters it doesn't recognise. SAM.gov ignores `q=`, ignores every spelling of a date filter, and ignores `sort=-publishDate` while honouring `sort=-modifiedDate`. Indiana ignores `description` and `vendor`. Rule now: vary one parameter, watch the total move. Two requests, catches all of it.

9. Claude drafted the SVRC in the IDE8 format. I'm adopting it — might have small edits but it's good. Worth noting it was used to generate the prototype BEFORE I adopted it, which is the real argument for it: precise enough to build from.

10. Cut past-performance citation from the brief. I don't have access to those records. That was the brief's strongest claim — connecting an RFP to our past projects is the tedious part of every bid/no-bid call, and it's the clearest answer to why open an app instead of reading the RFP. Gone. What's left is a well-organised summary. The app's case now rests on the triage queue's reason capture, which was always the bigger claim anyway.

11. Built the prototype in Claude Design straight from the SVRC. It turned out freaking amazing — nearly every screen, and it carried decisions we made hours earlier: the past-performance cut, sector-match and renewal columns on the expiration radar, a legal column on the source registry. It even produced a TENDERFOOT wordmark, which we'd defined as a Phase 0 output.

12. Claude pulled it apart. Real mock data in there — cited scores, gate reasons, a modelled deadline conflict. But zero comments, zero tokens, 342 inline styles, ten different radius values. Lesson generalised into the playbook: Claude Design buys you the direction, not the specification. The extraction is real work on the far side of the handoff.

13. Extracted the mock layer and the palette into src/, with the business rules written in as comments — that's the part a generator can't do, because it can't know a field exists because a real bundle shipped two deadlines and the wrong one nearly killed our best opportunity. Wrote the whole procedure up as ClaudeDesign_Proto_Cleanup.md so we don't rediscover it.

14. Claude got two things wrong tonight and corrected both in place rather than quietly. Said nothing planned a past-performance library (the spec does plan it). Said the prototype had no mock layer — that one came from counting markup instead of opening the generator's script, where the data actually was. Second one is now a method note in the playbook.

15. DECISION: no inspiration images. The prototype establishes the design language, so slot 3 closes unfilled. Slot 4 is the loose end — the palette came out of the generator and was never measured from a named source, which means colour is still a preference and still arguable. Either designate the frozen bundle retroactively or make a mark from the direction and sample it.

16. NEXT: updated prototype tomorrow. I still owe user stories and the tech stack. Open: does the rendering get rebuilt in the repo or do we keep iterating in Design and re-extract each round; the radius scale; and the reason chips, which have to come from the hand-run rather than the generator. Claude can test whether Periscope/Ivalua/CGI retain closed solicitations without me.

17. V1.1 of the prototype landed a couple of hours after Claude extracted V1, which answered an open question by accident. Re-extraction isn't one-off — every Design iteration invalidates it. But it's narrower than I feared: the generator ADDED a 67-token CSS layer on its own, so Claude's hand-built tokens.css is already superseded. It also went from 10 radius values to 12, so it fixes what's mechanical and never fixes what needs a decision. Still zero comments in 70KB of script. That's the real line — a generator produces better data every round and never produces a rule, because rules are things only someone in the room knows. So the comments are the one artifact that accumulates instead of being replaced, and re-extraction means carrying them forward onto shapes that moved.

18. Also asked for a possible-immediate-opportunities writeup. 23 open band A/B rows with direct document links, plus the Medicaid cliff. Best single row in it: Milliman's FSSA contract, a professional services engagement for service delivery modelling on the fee-for-service to managed care transition, expiring 12/31 with everything else. That's our service line almost word for word, and it's visible 143 days early.

August 11, 2026:

*[AI-GENERATED ENTRY — written by Claude at my request. I normally do these by hand.]*

19. Closed the three prototype questions V1.1 left open. Radius scale: keep all twelve. Turns out that wasn't sloppiness — the values track element size almost monotonically, 1px on an 8x8 mark up to 12px on a 540px modal, so a five-step scale would have destroyed a real logic. Named them for the element instead, so a new component picks its radius by asking what it is. Tokens: renamed all 67 by role, kept the generator's names as aliases so the frozen bundle still renders. And the prototype stays in this repo — argument for splitting it out was put to me explicitly and I declined.

20. Two things fell out of the token extraction that I didn't ask for. Ninety colour pairs are below the just-noticeable-difference threshold, including a hover state that's 0.44 dE from a resting surface — which means it can't read as feedback. And the negative red is doing three unrelated jobs at once: data-conflict flag, destructive action, and low score. So the interface can't say "this is wrong" and "this is bad news" differently. Both recorded, neither fixed, because cleanup doesn't change a colour.

21. Claude's verifier caught its own generator emitting 67 CSS declarations with no colons. Invalid file that looked completely fine. That's the second time this week the same lesson has come up: the check has to be different code from the thing being checked.

22. DECISION, and it's the big one. We are NOT determining smart matching now. V1 returns ALL results from every active source — no scoring, no ranking, no filtering. Once ingestion is actually running we'll re-imagine qualification from scratch. I don't want it half-designed in the docs where it can quietly become the design.

23. What that means: SP5 comes out of the slice sequence entirely, not reordered. SP6 stays the go/no-go but the question changes — it's no longer "is the scorer precise enough," it's "does reading everything surface work we'd pursue and hadn't seen." Precision stops being a measure of anything, since returning everything means the Interested rate is just the base rate of the sources. Discovery is the whole measure now.

24. The part I like: nobody actually knows what these sources return per week. Volume, composition, duplication rate — all guesses. So V1 is the instrument that measures the problem qualification exists to solve, and that measurement is the input to designing it. Designing matching first would have been designing against fiction.

25. Accepted cost, stated plainly: problem #3, the noise problem, is untouched in V1. If the sources turn out to be loud then reading them is real work and the tool will feel like the portal alerts it was supposed to replace. That's the finding, and I'd rather measure it than assume it.

26. Side effect I didn't expect — the hand-run stops being a precursor and becomes what the application DOES. Read what arrived, mark a verdict, give a reason. It's no longer a feasibility test for a scorer that doesn't exist in V1, and it no longer blocks anything. Still worth doing for what it says about the market.

27. Also dormant rather than fixed: the Capacity chip that contradicts our capacity-agnostic rule. Nothing consumes reasons now, so nothing learns a capacity judgment. It wakes up the moment reasons feed a model again. Written into the prototype comments so it isn't mistaken for resolved.

28. Hand-run is dead. Permanently, not deferred. Every job it did got parked with qualification or moved into SP6, and rehearsing a loop we're about to build isn't worth a day. Two things die with it and I'm not pretending otherwise: the negative profile now has no source at all — past proposals were already out, the hand-run was the fallback — and inter-rater agreement never gets measured, so we'll never know the ceiling on achievable precision. Both recoverable later since the corpus is still sitting there, neither happens by default. Also means SP6 is now the only place my judgment enters the project, and it sits behind all the build work rather than in front of it.

29. Clarified for Claude: the intelligence indicators stay in the prototype. The prototype is the FINAL released product and it's what we demo from — it's the destination, not the first milestone. V1 builds a subset of it. Nothing in there gets trimmed back to match V1's scope, and a future Design iteration adding more intelligence surface is on-plan.

30. Also for the record: prototype/ is reference ONLY. We copy code out of it as a starting point, we never edit anything in it. Stronger than the frozen-bundle rule we had. One sharp edge Claude flagged and I'd rather know about now — the rule-bearing comments in src/app.js are the one artifact in the cleanup that's supposed to ACCUMULATE, and a read-only directory can't accumulate anything. So those comments move out with the first copy into the production tree, and that hand-off needs to be deliberate rather than something we notice afterwards.

31. Corrected Claude on the capacity thing, and it was worth correcting. §1 is a mandate on the SYSTEM — the machine never infers, scores, ranks, or learns from whether we can absorb the work. It says nothing about the user. A person looking at a $5M RFP can absolutely decide it's too big for us right now, and the record SHOULD capture that, because it's frequently the real reason and a system of record that can't hold it is misrepresenting why we passed. So the chip was never the problem. The problem was §4.5's pipe — every recorded reason automatically becoming a training example, which turns one honest judgment about this quarter into a standing machine preference against big contracts. Rule is now about data flow, not vocabulary: a recorded capacity judgment is a journal entry, never model input. Surfacing a count is fine and probably useful. Acting on it isn't.

32. NEXT SESSION, two things queued. First, finish the source question — do Periscope / Ivalua / CGI Advantage retain closed solicitations. Got as far as confirming Illinois BidBuy has a public Advanced search over bid solicitations but only exposes "Open Bids" from the landing page, so the whole answer turns on whether that advanced search has a status filter admitting closed ones. Two or three more probes on Illinois, then the same against Ohio and Michigan. One answer covers four states (§5.7) and it's the last unexplored source question.

33. Second, I want a ~10 page explainer PDF with screenshots — main views, how it works, written to sell it to a user rather than to spec it. Prototype is the demo artifact by definition so that's where the screenshots come from. Three things to settle first: whether we're selling the finished product (prototype scope) or V1 (subset), who the reader is since internal buy-in and external pitch read completely differently, and how the PDF actually gets generated on this machine.

34. Also asked Claude to write me a prompt for a side project — a glossary of the terms of art it uses when we talk about building software, ~100 terms, built by a team of specialist agents and pulled together. Saved to the Desktop, to run in its own folder. Came out of the "chip" conversation. The category I care most about is what Claude called false friends — words where the everyday meaning actively misleads.

35. Still owed by me: tech stack outline, user stories, small SVRC edits. And Imp/Pri in the SVRC is now overdue rather than pending — those columns feed slice ordering and slice ordering changed materially today when SP5 came out.

36. Had Claude build the explainer PDF. Ten pages, real screenshots driven out of the frozen V1.1 bundle in headless Chrome, typeset in the actual IBM Plex faces pulled from the bundle's own manifest so it matches the product instead of approximating it. Sells the finished product rather than V1, since we'd already established the prototype IS the demo artifact. Written for us internally — me and whoever signs off.

37. Every number in it is real and traceable: 9-of-61, the 38-day margin, 231 December expiries, 2,160 expiring contracts, the 204,439-row register. Page 7 is the strongest page in the document and it's strongest because none of it is hypothetical. Page 10 says plainly what isn't built and why judgment comes last — that page is the one not to cut, because a deck that oversells becomes a liability the first time someone opens the real thing.

38. It's regenerable — one command, and it refuses to emit a PDF if any page overflows its box, so a copy edit that pushes content off a page fails loudly instead of silently truncating.

39. Building it caught a documentation error I'd have shipped. The plan of action claimed the wordmark had "now been delivered." It hasn't — the prototype literally labels it WORDMARK — PLACEHOLDER, and it shows up in the header of all six screenshots. A placeholder that says it's a placeholder is not a delivered mark. Corrected, and it's on my V1.2 punch list. Sequence is: V1.2 with a real mark, re-run the build, then it can go outside the firm. Until then it stays internal.

40. Claude walked me through the SVRC Imp/Pri thing and I want to give it proper answers rather than fast ones, so we pinned it as three_open_questions.md at the root. Short version: Eff, Vol and Conc are Claude's to judge; Imp and Pri are business calls about us and they're mine. It filled them in anyway when drafting because the format forbids a half-filled grid, flagged them as placeholders — and then adoption quietly turned twenty guesses into the input to build order. Which is exactly what the "·" convention exists to stop, except the no-half-grid rule pushed harder.

41. Useful thing that fell out: the parked-node question is much smaller than it looked. Grids only sit at levels 1-2, so of the three parked nodes only View 2.2 carries one. One decision, not three. The contrast Claude drew is the clear one — View 2.2 (Scores and Evidence, can't ship for a year) and View 2.3 (Extracted Fields, ships in V1 and is arguably the most important thing in it) currently carry near-identical grids. You can't tell them apart from the numbers, and that's the actual problem.

42. Its argument that Saved Views is the most under-scored node in the document is probably right and I hadn't seen it. It was scored Imp 2 / Pri 2 back when a matching engine was going to make the volume manageable. With V1 returning everything and ranking nothing, saved views are the only way anyone carves the firehose at all. That's not a convenience feature any more.

43. Claude scored the Proto column against V1.1. Mean 84%, twelve of twenty at 90 or above, nothing below 55. I guessed high and was right, but the interesting part isn't the number — it's that the prototype closed six gaps this document had written down, from a doc that only NAMED them. Queue ordering: the outline argued against ranking by score and proposed nothing; the prototype shipped "ambiguity first." Cleared state: the gap literally said "undesigned" and pointed at wanting something that keeps the session alive; the prototype points at the expiration radar. Sector matching on the radar, scorer versioning on the scores, "Indiana is not the buyer" on the org row, GovWin marked EXCLUDED with legal posture as a column. All six.

44. And the three lowest scores are all the same thing and it isn't a defect — the prototype refuses to invent a decision. The document viewer literally renders DOCUMENT RENDER — PLACEHOLDER and prints the open question on the screen. That's the right behaviour and it scores worst on any fidelity measure, which is worth knowing before someone reads a 55% as sloppy work.

45. This is why I like this phase and I asked Claude to write it into the playbook properly. The prototype fleshes out details that aren't specified. Sometimes it's wrong, sometimes it's right — and the review is what sorts them. New section 4.7.5. The sharp version, which I hadn't articulated: the risk isn't a wrong answer, it's an UNRATIFIED one. A wrong decision on a screen gets argued with because you can see it. A right one gets adopted without anyone noticing a decision was made, and then the record shows an open question that was never closed sitting next to an implementation that closed it.

46. Live example of exactly that: View 1.2 asked outright whether saved views are a queue filter or a first-class object, and noted the second is a much bigger commitment. The prototype drew a first-class object. Good answer. Nobody chose it. That one needs ratifying rather than inheriting.

47. Also added a (T) provenance marker to Proto2PRD — validated on Tenderfoot. Weaker than (R) recovered-from-a-shipped-build, stronger than (N) untested. We'd accumulated two mechanisms where (N) had stopped being honest.

48. Went through the twelve prototype decisions Claude surfaced and ruled on nine. SVRC is now 0.4.0.

49. Ratified four where the prototype answered a question we'd asked: queue ordering (and the switchable part is the good bit — we were trying to pick one order and would have picked wrong for somebody), scorer version stamped on every score, Drafting added to the pipeline, and reason-on-Pass demoted from law to default. That last one I decided to keep as a toggle. A queue of forty where three are obvious junk shouldn't stall on a required text field. The cost is real and it's written down — switch it off and you silently lose the corpus a chip vocabulary would come from.

50. Promoted four net-new things nobody asked for. The best is incumbent retention per buyer — 9 OF 11 — because it answers whether a buyer ever actually switches vendors before any scoring happens. That's a stronger winnability input than anything in our scoring model and it's computed, not judged. Procurement cycle alongside it generalises the expiration radar to buyers we hold no contract for. Both need data-model work that doesn't exist yet and that's flagged in the node rather than assumed.

51. Left three unratified on purpose — saved views as a first-class object, rot suspicion in the status bar, the cleared state pointing at the radar. All good answers nobody chose, and the whole point of 4.7.5 is that the unratified answer is the dangerous one. They're listed in the preamble so silence can't adopt them.

52. Opened prototype/PUNCH-LIST.md. One item on it: the wordmark. The review produced no other prototype changes, because we adopted its answers rather than overturning them — the work went into the SVRC, not back into the artifact. Also recorded what is NOT a punch item, so nobody "fixes" the three low Proto scores: those are low because the prototype refused to invent a decision, and they resolve when we answer the question, not when the pixels change.

53. Going to pick the tech stack myself. Claude wrote up docs/Stack-Requirements.md while I do — deliberately names no technology, it's just the constraint list pulled from decisions we've already made so I can hold a candidate against something instead of arguing about it.

54. The useful framing in there: parking matching made this a much smaller problem. No vector store, no LLM on the critical path for scoring, no job queue, and assessment versioning is a schema column rather than machinery. What's left is a database, a scheduled fetcher, a document parser, and a web app. That's a stack I can choose confidently rather than hedge on.

55. Two things it flags that I hadn't been weighing. Document parsing is now the highest-stakes item in the whole stack decision — with no scores in V1, extraction accuracy is the ONLY thing the system can be right or wrong about, and PDF-only coverage gets us about half of what matters because the scope of work is usually a .docx. And the Source Registry stops being a config file: with nothing filtered or ranked, switching a source on or off IS the product's entire configuration, so it has to be runtime-editable by a person without a deploy.

56. Biggest open question it surfaces, and it's a real fork: does extraction use an LLM or rules? It changes cost, latency, determinism, and whether our accuracy measurement is even stable between runs. A rules extractor at 80% is measurable and improvable; a model averaging 90% that varies per run is harder to hold to a number. Deciding that on purpose rather than by accident.

57. Reviewing the prototype I went looking for where we configure what we're actually scraping and had to hunt for it. The front end is so user-focused that the mechanical layer ended up behind everything — which was fine when matching was going to do the work, and isn't now that the Source Registry is V1's ONLY control surface. Pinned the brainstorm rather than designing it on the spot: docs/Pinned-Ingestion-Scaffolding.md.

58. Four things in there. Scaffolding for the mechanical layer, which Claude points out isn't a new concept at all — it's the Source Registry in its first file-based form, config file then settings screen then the real thing. A candidate scrape rather than a full one. A per-source ingestion window. And mechanical vs smart as first-class modes in the app.

59. Two of those turn out to fill holes we already had. Parking the scorer quietly removed §5.3's fetch-depth governor — "fetch depth follows score" doesn't mean anything without a score — so nothing was bounding how deep we pull, and bundles hit 21MB. A candidate scrape stopping at the listing hop replaces it. And Claude corrected my window idea in a way I hadn't thought about: a fixed 7-day lookback and "since the last successful run" are identical right up until a run fails, and then the fixed one silently loses that day forever. §3.1 already says every adapter takes a "since" parameter. So a week is the seed, not the rule, and we get backfill for free.

60. The modes idea is the one I like most and Claude sharpened the condition it depends on: the mode has to be recorded IN THE DATA, not just set in config. Every extracted field already carries confidence and a source pointer; add which mode produced it and we can actually measure mechanical against smart on the same hand-labelled set. Without that field it's a preference toggle. With it, it's an experiment — and it's the only thing that could ever justify what the smart path costs.

61. One hard rule out of all this that doesn't wait for the brainstorm: the ingestion window has to exist in code before the first real scrape, and it fails closed. A source with no window refuses to run rather than defaulting to everything. That's how a first run accidentally pulls 24 months of Indiana.

62. Brought Claude the ideate/IDE8 stack to see if it fits here — React 19, Vite 6, Zustand + Immer, dnd-kit, Express 4, better-sqlite3 local-first, tsx. I want to keep the two projects common if we can. Verdict: appropriate, with one real gap. Assessment written into docs/Stack-Requirements.md.

63. Drop dnd-kit — the only screen that would want drag is the pipeline board and the prototype already moves cards with arrow buttons, which is the better call for a keyboard-first product anyway. Add a router, which IDE8 doesn't have: seven screens and a detail with five tabs, and without routes there's no URL that opens one opportunity. For a system of record whose whole job is "what did we decide and why," not being able to point at a record is a real loss.

64. SQLite local-first is actually a BETTER fit here than a server database — one user, batch ingestion, no uptime requirement, nothing about this is a scale problem. Documents go on disk with paths in the DB, not as blobs. Two deferred caveats: a closed laptop doesn't scrape, which eventually forces a hosting decision at SP7; and single-file local-first has no story for a second reader. Neither bites yet.

65. The gap is document extraction and it lands on the highest-stakes requirement we have. With no scores, extraction accuracy is the ONLY thing V1 can be right or wrong about — and Node is the weakest major runtime for parsing .pdf/.docx/.xlsx/.pptx/nested .zip. IDE8 has never had to parse a 22-file government bundle so the stack simply hasn't answered this. Three options: Node libraries and fight it, a Python sidecar confined to extraction, or extraction as a smart-mode action. This is exactly where the mechanical/smart modes idea stops being decorative — mechanical mode needs real parsers, smart mode needs a request.

66. On my framework question, the answer is no framework, and the plan already agreed with me before I asked. The prototype isn't a sketch to flesh out — 67 role-named tokens, a 12-step radius scale, all verified byte-identical to the bundle. A CSS framework would arrive with its own opinions and we'd spend the time overriding them. What I actually want is SP2, which already exists as a slice with a sign-off gate. The finalized prototype doesn't argue for a framework, it argues SP2 is mostly transcription.

67. Claude ran the last source question and it came back better than expected. Illinois/Periscope retains 2,155 CLOSED solicitations, anonymously, back to February 2018 — with awarded vendor on the row. That overturns the assumption we'd been carrying that solicitation-side backtesting is federal-only. Illinois is in our secondary geography, and one Periscope adapter also covers Arkansas and Montana.

68. It verified it properly rather than trusting the dropdown, which matters given what we've learned about these APIs. The status filter existing proves nothing. So: hold openBids=true, set status=Closed, count moves 127 to 0 — empty intersection, so the parameter is genuinely honoured. Then drop the open-bids constraint and get 2,155. That's our own §5.4 method applied to a portal instead of an API.

69. Michigan browses anonymously too — published solicitations and award history both render with no login, 3,762 award records. Closed retention is indicated but not proven; there's no explicit Closed option, just "All" which we didn't test. Same platform as Kentucky so that's two states.

70. Ohio is a different story and it's a real finding rather than a failure. OhioBuys sits behind a CAPTCHA browser check. Claude correctly refused to work around it. So Ohio isn't a tier-3 scrape candidate as things stand — a person can read it, an adapter can't. That belongs in the registry as legal posture rather than getting rediscovered by someone six months from now wondering why their adapter fails.
