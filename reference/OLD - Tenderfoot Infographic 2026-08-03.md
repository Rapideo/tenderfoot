# OLD — Tenderfoot Infographic, 2026-08-03

Companion note for `OLD - Tenderfoot Infographic 2026-08-03.png`.

**What it is.** A NotebookLM-generated infographic, *"Tenderfoot: Turning Procurement Noise into
Strategic Intelligence."* Produced during the Aug 3 doc-review break (DOOGIE entry 3, the "IG" in
"Podcast, Video, and IG"), from the design spec as it stood at commit `183df06` — i.e. **before**
the Aug 4 scope correction.

**Why it is archived rather than deleted.** The delta between this image and the current spec is
a clean, legible record of what the Aug 4 correction actually changed. Read side by side with
`docs/superpowers/specs/2026-08-03-tenderfoot-design.md`, it shows the old shape of the project
better than any prose summary of the change would.

---

## Superseded claims

Three statements on this image are no longer true of the project.

**1. Phase 0 is not a hiring-justification exercise.**

> *"Phase 0: The Backtest — Proving the Market Before Hiring. The system runs 'backwards' over 24
> months of data to determine if the volume of winnable work justifies hiring new business
> development staff."*

Corrected twice. First to utilization — finding work for the team when engagements slow down,
with hires following won work rather than preceding it. Then struck entirely: KP's headcount and
absorptive capacity are not the system's business. Phase 0 measures **recall against real
history** — how many eligible opportunities existed, how many we saw. See spec §3.1, §8.2.

**2. Timing is not a staffing question.**

> *"Timing — Is the response window survivable for current staff?"*

Timing is now **opportunity-intrinsic**: how much runway the response window leaves, independent
of who is available to work it. Capacity judgments are not modelled at all. The surviving
distinction is that *eligibility* facts (a solicitation requiring 50 employees) remain hard
gates, while *capacity* judgments do not exist. Spec §6.3.

**3. Learning from wins and losses is deferred, not delivered.**

> *"The Missing System of Record — … preventing the firm from learning from past wins and losses."*

Pursuit management — pipeline board, won/loss tracking, ownership — moved to a later phase.
Contract *seeking* now; seeking *and* management later. Spec §9. There is also almost no bid
history to learn from: one small competitively-bid contract to date.

## Still accurate

The four adapter tiers; the matching funnel and its four stages; hard gates as deterministic
pre-filters; Fit / Winnability / Value as defined; human-in-the-loop triage feeding a feedback
loop; the Expiration Radar reading contract end dates 6–18 months ahead; the Teaming Radar
matching large solicitations against WBE status.

## Two other reasons not to reuse the file as-is

- The rendered text is garbled in places — *"bld decisions"*, *"criterlo"*, *"Plausible
  llrregin"*, *"redistic edds"*, *"HTMI scraping"*. Generation artifacts, not transcription
  errors in the source.
- It carries no Tenderfoot brand. Per the Aug 4 branding decision, Tenderfoot has its own
  identity and design language, and the wordmark is an output of the design bake-off rather than
  an input to it. Any replacement should wait for that.
