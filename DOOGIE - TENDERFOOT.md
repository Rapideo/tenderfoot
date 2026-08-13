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

71. Asked Claude to finish the Michigan question and it stopped partway through, correctly. SIGMA displays a banner saying the system is "intended for government authorized users only for use in conducting government business ONLY" and "disconnect immediately if you do not have express written authorization to access SIGMA." That's a legal-posture fact and it outranks whatever the filter would have told us, so it stopped probing on sight.

72. Worth being precise about what's ambiguous here. The wording is unambiguous, the SCOPE isn't. VSS literally stands for Vendor Self Service and exists for vendors to use, so that banner may be boilerplate inherited from the wider SIGMA financial system rather than a restriction aimed at the public vendor pages. But that's a question for a person, possibly for the State, and not something to settle by assuming the reading that happens to be convenient. Kentucky is the same platform so this covers two states.

73. Also learned Michigan withholds result totals — the grid says "1 - 20 of 20+ Records" rather than a number. So even setting the legal question aside, our vary-one-parameter verification method can't run there. No total, nothing to compare. Closed-solicitation retention for Michigan stays unproven and will stay that way until the access question is answered first.

74. Net position on sources: Illinois is a genuine win and verified properly. Ohio is out for now on bot detection. Michigan and Kentucky are blocked on a legal question rather than a technical one. That's a cleaner picture than I had this morning even though two of four came back negative — a "no" you can point at is worth more than an assumption.

75. Cleared Michigan and Kentucky — we read the banner as meaning you need an account, and we have or have had one. Recorded, revisit if challenged. Claude flagged one consequence I hadn't thought about: if the authorisation is the account, the adapter should authenticate rather than read anonymously, which moves the governing document from that banner to whatever account terms we agreed at signup. Different text, and that's where automated-access clauses usually live. Worth pulling up sometime.

76. Adopted a standing rule for legal posture so we stop re-arguing this per portal: ambiguous or restrictive terms default a source to OUT, documented permission moves it to IN, evidence recorded on the row. The reasoning that convinced me is the asymmetry — being wrong toward "out" costs a source we could have had and we just switch it on, like today. Being wrong toward "in" means we've been pulling from something we shouldn't, at volume, on a schedule, for months. Also three postures not two, which came out of my Ohio call: in / manual-only / out.

77. Then Claude finished the Michigan question and the answer is no. Only open solicitations are listed. Setting the filter to "All" or to "Recent Awards" returns the IDENTICAL twenty rows as "Open" — same records, same dates, everything still marked Open. So that's a fourth silent-failure instance and a third platform. The control changes and the result set doesn't. Exactly what SAM.gov does with sort and Indiana does with dates.

78. It also corrected itself on something from earlier today. The 3,762-record "Award History" is GRANT disbursements — counties, conservation districts, nursing loan repayment — not procurement awards. So it isn't the contract-side dataset Indiana's Phase 0 runs on and doesn't substitute for one. Good catch, and I'd have taken that number at face value.

79. Net: Michigan and Kentucky are live sources for CURRENT solicitations only, tier 3 and genuinely expensive — everything is a form POST to one endpoint with server-side session state, versus Illinois which exposes real search parameters. Neither can do solicitation-side backtesting. Illinois remains the win of the day.

80. TECH STACK IS DECIDED: the ideate/IDE8 stack. React 19, Vite 6, Zustand 5 + Immer, Express 4, better-sqlite3 local-first, tsx. Dropping dnd-kit — the pipeline board moves cards with arrows and that's the better call for a keyboard-first product anyway. Adding a router, which IDE8 doesn't have, because seven screens and a five-tab detail need deep links and problem #4 is literally "be able to point at a record and say what we decided."

81. Three things still open INSIDE that choice, and they're mine: where the 21MB bundles live (disk with paths in the DB, I think), whether it's one SQLite file per firm or one shared database, and whether V1 has auth at all. The extraction question — Node libraries vs a Python sidecar vs a smart-mode API call — is the real one and it ties straight into the mechanical/smart modes idea.

82. Big day. Explainer PDF built and opened. SVRC went 0.3.1 to 0.4.0 with eight prototype decisions adopted and Proto filled at a mean of 84%. Proto2PRD gained 4.7.5 on auditing what the prototype decided for you, plus a (T) provenance marker. Three open questions pinned for me on Imp/Pri. Ingestion scaffolding and mechanical/smart modes pinned for brainstorming. Stack requirements written and the IDE8 stack assessed against them. And the source research finished — Illinois is a genuine win, Michigan and Kentucky are current-only, Ohio is manual-only.

83. NEXT: Stage B. B2 is the workflow spec and it's unblocked now that the stack is defined — it closes §10.3, the last open question in the design spec. Then B3, implementation plans per slice, and Proto2PRD is clear that everything gets committed before any application code. The first three slices aren't in dispute regardless of the Imp/Pri reconciliation, since SP0 infrastructure, SP1 entity graph and SP2 design system are dependency-ordered rather than priority-ordered. So building can start there while I settle the rest.

84. Claude drafted B2, the workflow spec. §10.3 is closed — that was the last open question in the design spec. What I like about it is that it's honest about being thin: one developer plus an AI, local-first, no hosting. Importing team ceremony would have produced a document nobody follows. It says so out loud rather than padding.

85. Three things in it I hadn't considered. First, the deployment story has a KNOWN EXPIRY DATE — SP7 is scheduled ingestion and a closed laptop doesn't scrape, so that's exactly the IMPACT auto-pause failure waiting to happen, except we can see it coming. Second, our secret surface is currently almost empty — no DB password, no API credentials anywhere, every source is anonymous — and the two things that will populate it are both already-open decisions: authenticating to Michigan, and whether extraction calls a model. Third, it codified our commit style rather than inventing one, which is right; we've been doing prose-explaining-why with no conventional-commits prefixes and that suits a project where the why matters more than the what.

86. The platform-properties section inverts for us and that's the sharpest part. Proto2PRD wants it because IMPACT went down thirteen days after launch on a documented Supabase property nobody wrote down. We have no hosting platform to have properties. What we have is four source platforms belonging to other people, and FOUR confirmed instances across THREE of them of a parameter being accepted and silently ignored. That's our version of the auto-pause failure and we found it before launch instead of after. Every new adapter now runs the vary-one-parameter check as part of being added, and where a source withholds totals — Michigan — that gets recorded too, because it means the check isn't available and health has to be inferred another way.

87. It also closed a loop from earlier today: the rule-bearing comments in the prototype's app.js move to app/shared/ on the first copy-out. That was flagged as a named transfer point in the cleanup doc and now it has an address.

88. B1 done — fidelity mandate at spec §7.10, platform properties at §5.9. Claude flagged that it had put platform properties in the workflow spec yesterday when Proto2PRD says architectural spec, and fixed the split rather than leaving it in two places.

89. The mandate needed three clauses IMPACT's didn't. It has to NAME A VERSION — parity is against V1.1 specifically, not "the prototype," because the prototype iterates and an unversioned parity requirement can't be falsified. Re-pointing it when V1.2 lands is a deliberate act taken alongside the Proto audit, not something that happens because a file appeared. Parity applies only to what V1 builds, and the parked nodes aren't built — but when they are, they must match. And the wordmark is exempt until it exists.

90. Best catch in it is a hole it names rather than trips over later: the prototype specifies DESKTOP ONLY. It was designed and captured at 1600px. But §7.1 says triage has to work on a phone and the SVRC repeats it. So responsive behaviour has no reference to be faithful to — meaning the mobile layout gets designed during the build by whoever writes the component, silently, with nobody deciding it. That's the unratified-answer problem from 4.7.5 showing up in advance for once. Two cheap ways to close it: put mobile breakpoints on the prototype punch list so a reference exists, or say here that mobile is the developer's call within the token system. Haven't picked yet.

91. Also liked that the mandate pre-authorises routes as an acceptable deviation. We're adding a router the prototype doesn't have, so without that clause every routed screen would technically be a deviation requiring paperwork.

92. Mobile breakpoints go on the V1.2 punch list. I could genuinely see people triaging from a phone. Also floated a mobile-only triage app and Claude made an argument for it I hadn't thought of: we have seven screens and exactly ONE of them is a habit. Triage is the daily driver, the other six are reference work you do at a desk. So the split isn't desktop-vs-mobile, it's habit-vs-reference — and that line already exists, because §7.1 collapses the nav during triage on the grounds that the queue should be the only thing on screen. A mobile triage app is that idea taken to its end. Pinned, not decided. Breakpoints first either way.

93. Admitted I'd lost track of the to-do structure and asked for an overview. Fair diagnosis came back: the plan of action IS supposed to be the status document but a week of decision history buried the status. So we now have STATUS.md at the root — one screen, what's done, what's next, what's blocked on whom. The decision history stays where it is, which is right, it just isn't the thing I have to read to orient.

94. Which gave me an idea I've pinned: a proper status dashboard. Claude Code updates a JSON file, a local webpage reads it, and at a glance I can see where any project stands. Claude's point is that STATUS.md is already the v0 and the data model falls out of it rather than needing inventing — stages, slices, owed items with what they block, decisions with links to the reasoning, risks with their triggers. The framing I liked: task trackers are bad at orientation because they show leaves and hide the tree. Cross-project by design, so it has to work for IDE8 too.

95. Also now understand what B3 means. It isn't a task list — the plan CONTAINS the code. Exact file paths, complete paste-able code, a real verification command per task, and all of it committed before any application code gets written. Design happens in the plan where it's cheap; execution is mechanical. That's why IMPACT's biggest plan was 6,105 lines for one sub-project.

96. B3 for SP0 is written — docs/superpowers/plans/2026-08-12-sp0-infrastructure.md. Twenty-three tasks, three preconditions, complete paste-able code for every file, a real verification command on each. Execution should be mechanical now.

97. Two things in it that are decisions rather than typing. There's no git remote, so a GitHub Actions file would be aspirational — instead the gates live in "npm run check" which is real today, and the CI file just calls that same script when a remote shows up. Keeps them from drifting. And SP0 creates exactly ONE table, app_meta, which is infrastructure rather than domain — so it doesn't pre-empt SP1's eleven objects but still gives the slice something real to read and write.

98. One flag I need to answer: Claude specified Vitest as the test runner because the stack list I gave it didn't include one, and the workflow spec requires unit tests. If IDE8 already uses something else I should change it — commonality is worth more than the choice itself. Need to go look.

99. The part I like most is the last section — what SP0 will teach us about the workflow spec. Does "npm run check" stay fast enough to actually run every time, because a skipped gate is worse than none. Is a three-package workspace worth its ceremony at this size. Does proxy-not-CORS hold, and if nothing ever needs cors do we drop it. That's the slice being used to test the plan while correcting it is still cheap, which is the whole reason we did SP0 first.

100. Renamed master to main and merged SP0. Infrastructure is real: client on 5175, API on 3003, SQLite with WAL and foreign keys, idempotent migrations, and a check gate that runs typecheck, tests, build and token drift in a few seconds.

101. SP0 found three defects through its own verification steps and all three would have shipped silently. The one worth remembering: the migration CLI did NOTHING on Windows because the entry guard compared import.meta.url against a backslashed argv path. Exit code zero, no output, no migrations — and the unit tests passed the whole time, because they call migrate() directly. It was caught only because the plan said the second run must PRINT "no pending migrations." An expectation about output, not exit status. "Check it works" would have sailed straight past it.

102. Third one was quietly nasty too: the database landed in a different place depending on how you invoked it, because resolve() is cwd-relative and npm sets cwd to the workspace. That's how data goes missing. Anchored to the repo root now.

103. SP1 plan drafted — the entity graph. This is the expensive slice: it writes the migration everything else assumes, and §2.2 is explicit that retrofitting entity FKs is THE mistake. Eleven objects plus two alias tables, in one transaction, foreign keys enforced and tested.

104. Two things in it I like. The source registry seed is where today's research finally becomes executable rather than prose — Illinois in with archive depth to 2018, Michigan and Kentucky in with the account reading recorded in legal_note, Ohio manual-only with the CAPTCHA recorded, aggregators out by their terms. And the API will REJECT a legal_posture change that arrives without a legal_note, because a rule that says "evidence is recorded on the row" is unenforceable if the field can be left blank.

105. It's honest about two tasks it can't pre-write: re-extracting the mock layer against V1.1 with the comments carried forward by hand, and the minimal admin UI. Both would be inventing. And it flags the real test — does the schema survive that re-extraction, or does V1.1's dataset contain fields the spec's §4 never mentioned? Nobody has checked whether those two agree.

106. Good day. Finished with the source registry seeded from the day's research — eleven sources, each carrying its legal posture, the evidence for it, and the record of which parameters were verified to actually work. None enabled; SP3 turns the first one on deliberately.

107. Two brittle tests surfaced and both were the same mistake in different clothes: asserting a count or a hard-coded list that is SUPPOSED to grow. The migration test broke when SP1 added a migration, and the source count broke because earlier tests insert their own rows. Both now assert by name. Worth remembering as a pattern rather than two incidents.

108. Asked for a 7,500-word overview to present to management and to check my own understanding. Came in at 7,100, no tables, no code blocks, written to be listened to. Twelve parts: what it is, the problem, where we stand, how we got here and why the order mattered, the seven decisions, what the prototype decided for us, what the research turned up, what's built, what's next, the risks, what's open, and the takeaways.

109. The part I most wanted captured is in there — the arc. Specify, outline, generate, audit, refine, build. And why the obvious order is worse: show someone a screen and they react to the screen, so the questions that actually decide whether the project succeeds never come up because nobody can see them. Writing the spec first forces those while they're cheap. Every one of our seven decisions was made in a document, not in code. Two of them removed work; one removed an entire subsystem.

110. It also says plainly that the same sequence is now running on the second project, which is the difference between a method and an anecdote. That's why the playbook lives outside both projects.

111. NEXT: finish SP1 — profile seed, the three API routes, corpus loader, and the mock-layer re-extraction. Claude offered to draft user stories the same way it drafted the SVRC, for me to react to and edit rather than starting from a blank page. Worth doing; a draft to argue with beats a blank page.

112. Asked for a lessons-learned document to improve the playbook at the end of this project. Claude made the case for keeping it SEPARATE from Proto2PRD rather than just adding to it, and I agree: we've been folding lessons in continuously, but not everything is ready. A playbook full of one-off observations stops being trustworthy. So this is the holding pen — things arrive when noticed and leave when they earn it.

113. The promotion bar is the useful part: seen twice, OR seen once with a stated mechanism explaining why it MUST recur. Not a feeling that it will. And anything that hasn't earned promotion by the end of the project gets deleted rather than quietly kept, because an observation nobody could confirm across a whole project probably isn't a lesson.

114. Seeded with ten candidates. The ones I'd bet on: never assert a count or list that's supposed to grow (already bit us twice in two days); a fidelity mandate has to NAME A VERSION or it's unfalsifiable; and instrument for silent failure in every external dependency, which is our four-instances-three-platforms finding generalised. That last one is held back only because all four were government procurement systems — one commercial API doing the same thing would settle it.

115. Also five watch items, which are questions about the METHOD rather than lessons. The honest one: was parking the intelligence layer right? If volume turns out low and the first release is pleasant, that call looks wise. If volume is high and it's unpleasant for a month, it looks like a mistake that happened to be well argued. Worth writing down which, either way.

116. Had Claude take a first shot at user stories, the same way it drafted the SVRC — something to react to rather than a blank page. 93 stories, 81 in V1, built into a clickable map I can filter by area, role, release, or which of the four problems each one serves. It used our own tokens and our own typefaces, pulled out of the frozen bundle, so it looks like part of the product rather than a generic doc. https://claude.ai/code/artifact/ab00430d-4d6c-4104-b104-bae00b317416

117. The granularity it picked: one story per thing a person wants that has value on its own. Not tasks, not epics. Three roles — Triager, Analyst, Administrator — all the same human wearing different hats, and Analyst is the biggest at 35, which tells me more of this system is research than triage. Worth sitting with. The filter I didn't expect to find useful: stories with NO problem tag. Those serve the workflow rather than a stated pain, and that's exactly where scope quietly accumulates.

118. Then finished SP1 through T11 and merged it. 201 real solicitations in the real schema, each with a sighting, reachable through the API. Eleven objects with enforced foreign keys, the registry seeded, KP as an ordinary vendor row with the profile attached. 33 tests green.

119. Five defects, every one caught by a verification step rather than by anyone reading the code. The one to remember: the corpus parser silently dropped the NASPO row — the single record the alias table exists for, a New York award listed on Indiana's portal — because its ID is "*(NASPO)*" and the pattern wanted digits. The import said "loaded 60 Indiana" and looked perfectly healthy. Only caught because the check named a specific expected row instead of a count. Same lesson as SP0's silent migration, different costume: a plausible number is not evidence.

120. Two more in the same area. NY OGS STILL resolved to an Indiana org after the parser was fixed, because the alias lookup only matched when the source already used the canonical name — which is precisely when you don't need it. And every federal agency came in tagged Indiana because the default jurisdiction was hard-coded. Sixty-two orgs mislabelled and nothing downstream would ever have contradicted it.

121. Also committed once with a red gate. Vitest doesn't typecheck, so 25 passing tests hid a tsc failure. Fixed next run and left in the plan's record rather than quietly amended, because "tests pass" and "the gate passes" turn out to be different claims.

122. NEXT, first thing: I bring answers to the three open questions and the SVRC Imp/Pri review, then we start SP3. One prerequisite Claude flagged and I agree with — the ingestion scaffolding brainstorm is still pinned, and SP3 is the first slice touching a live source. Twenty minutes on that first or we'll be designing the candidate scrape while building it. Outstanding in SP1: the mock-layer re-extraction and the minimal admin UI.

August 13, 2026:

*[AI-GENERATED ENTRY — written by Claude at my request. I normally do these by hand.]*

123. Caught a real mistake overnight. Listening back to the progress summary, it clicked that I'd let SQLite get written down as the database when I've been planning on Vercel hosting the whole time. Two decisions a day apart that can't both be true. Vercel has no writable persistent filesystem, so a SQLite file doesn't survive a request there — the hosting choice decides the database, and I'd been treating them as separate questions. Going with Neon Postgres through the Vercel marketplace.

124. Best news: no data lost, and not by luck. *.db has been gitignored since SP0 and tenderfoot.db was never committed. The research lives in corpus/ as files and in the two seed migrations, and the database is rebuilt from those with one command. So the DB has never been a source of truth. That was a deliberate property of SP0 and it's the reason this reversal cost almost nothing.

125. Cost is about 600 lines of server code and four migration files, all inside the slice we just merged. The real work isn't the SQL — every SQLite construct we used has a direct Postgres equivalent — it's that better-sqlite3 is synchronous and every Postgres driver isn't. So every query site and every handler that calls one becomes async. Mechanical, unavoidable, bigger than the translation.

126. Timing was lucky and worth noticing. SP2 is the design system and touches no persistence. SP3 is where adapters start writing to the database in volume. One slice later this costs several times as much; after SP4 it's a rewrite. Claude flagged this as the last cheap moment and I agree.

127. Two things actually get better. Foreign keys become unconditional — our SQLite version depended on a PRAGMA set in application code, which any second connection would silently lose, and §2.2 calls entity FKs THE expensive mistake. And the date columns stop being text, which matters because closes_at and ends_at carry the expiration radar and the highest-consequence extracted field in the system. Date comparison stops being string comparison.

128. Two risks I'd written down as future problems are now closed. "Deployment expires at SP7, a closed laptop does not scrape" — Vercel Cron. And "a second reader means a second copy" — managed Postgres. Both were filed as deferred yesterday and both are gone today.

129. But the other half of the ledger is real and I want it recorded honestly. Everything the local-first answer made vanish is back: connection limits, cold starts, no filesystem, function duration caps, a deploy pipeline that can break. Three have deadlines. Where long ingestion actually runs blocks SP3 — §5.3 fetches in three hops and was written assuming a process that could run for minutes, which a capped function invocation may not allow. Which blob provider blocks SP4, and thousands of 21MB bundles is now a bill instead of free disk. And the plan limits themselves need measuring.

130. That last one is the uncomfortable part. We're now on a serverless database that suspends when idle, behind functions with plan-dependent limits. That is exactly the IMPACT failure — production down thirteen days after launch because free-tier Supabase auto-pauses, "a documented property of the plan, never written down." It's not an analogy anymore, it's the same shape on the same kind of platform. So workflow spec §10.1 is now a table of empty cells with a rule attached: those numbers get measured and dated, never recalled from memory. I'd rather have the blank table than a confident guess.

131. Two lessons staged for the playbook and I think both are good ones. First: a deferred caveat that names its own trigger deserves one more question — what if the trigger fires early? Both of yesterday's caveats named their trigger, both were reasoned correctly, both were filed under deferred, and one of them was the reason the choice was wrong. Writing down a trigger creates the illusion the risk is handled. Second: assess a stack against where it runs, not only against what it has to do. Yesterday's assessment was valid — every claim in it still holds — and its conclusion was unusable, because the requirements list never had a row for the deployment target. The fix is one line in the template.

132. Kept the superseded sections in place with strikethrough rather than deleting them. The reasoning was sound given a premise that didn't hold, and that's the part worth learning from. Our own commit convention says to say so plainly rather than quietly fixing it, so this seemed like the case it was written for.

133. Scope discipline on the port: it swaps the driver and deploys, nothing else. Express-versus-route-handlers, the blob provider, and where ingestion runs all stay open. Claude recommended deciding Express after the port rather than with it, so the two changes stay reviewable separately, and that's right — conflating them would quietly design three things nobody decided.

134. NEXT: SP1.5 is the port and it goes ahead of SP2. Plan first, per the standing rule. Still outstanding from before and not forgotten — my answers to the three open questions and the SVRC Imp/Pri review, SP1's T12-T15, and the ingestion scaffolding brainstorm before SP3.

135. SP1.5 plan written, 16 tasks. Driver swap and deploy only — Express stays. Claude surfaced the counter-argument before I ruled: since the async conversion rewrites every handler anyway, moving to route handlers now would touch them once instead of twice. Took the second touch on purpose. About 180 lines if we ever switch, and that's cheaper than a diff that swaps the driver and restructures the API at the same time, which nobody can review as either. The Express question stays open on its own merits instead of getting decided by momentum.

136. CORRECTION to entry 127. I said the date columns become timestamptz and called it a clean win. Half of that is wrong and it's the half that matters. Machine timestamps convert for free. But the corpus carries MM/DD with no time and no zone, and casting '2026-08-15' to timestamptz gives midnight UTC — which displays as August 14, 8:00 PM in Eastern. A deadline showing the previous day is a real defect, and closes_at is the highest-consequence extracted field we have. Right model is probably date for contract dates and timestamptz for deadlines, but that's a decision about timezone semantics, not a driver swap. Domain dates stay text through SP1.5 and change before SP4. Good catch by the plan against the doc I'd committed an hour earlier.

137. Made the point that scraping is a background process and could never have run locally anyway — that IS the closed-laptop problem. Worth separating two things I'd been treating as one: the host solves WHEN ingestion runs. It does not solve HOW LONG it may run, because function invocations are capped. So §9.6 isn't one of six equal open questions, it's the one the hosting decision created and didn't answer, and it sits right in front of SP3.

138. Three things in the plan I want to remember. value_cents has to become bigint — a contract over about $21M overflows 32 bits and we have them in the corpus, and nothing fails, the numbers just come back wrong. upsertOrg has to join the transaction rather than using the pool, or a rollback leaves orphan organizations with nothing reporting it — that's the one place the synchronous version couldn't be wrong and the async one can. And the json_valid test gets DELETED, because jsonb makes it unable to fail: a test that can't fail isn't a test.

139. NEXT: I provision Neon through the Vercel marketplace, then we execute. That's precondition P3 and it's the one step Claude doesn't do since it creates billable resources on my account.
