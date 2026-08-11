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
