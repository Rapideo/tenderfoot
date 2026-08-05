# Tenderfoot — UI Outline

> **Status:** TEMPLATE — scaffold only. Screens are pre-listed from the design spec §7;
> the VIEW breakdowns and elements are yours to fill in.
>
> This is Phase 0 input #2 (`docs/Proto2PRD.md` §4.2.2). It is the document the design
> bake-off consumes, and CLAUDE.md will name it as **authoritative for component
> composition**, with the design spec authoritative for rules and permissions.

---

## How to write this

**Four levels, and only four.**

| Level | Meaning |
|---|---|
| `# SHELL:` | Anything global — appears on or over many screens |
| `# SCREEN: <name>` | A top-level destination |
| `## VIEW: <name>` | A distinct state or sub-page within that screen |
| `ELEMENT IN CAPS` | A bare UI element, one per line |

**Rules.**

1. **Composition only. No styling.** Say `DEADLINE FIELD`, not "red urgent deadline badge in
   the top right." The whole point is to leave the design directions genuinely free to differ —
   if this document decides the look, the bake-off has nothing to decide.
2. **Elements in CAPS**, one per line, no bullets. Connectives can stay lowercase:
   `LOGO and CONTENT`.
3. **Qualify by role or condition in parentheses:** `DELETE BUTTON (ADMIN)`,
   `RESUME BANNER (IF DRAFT EXISTS)`.
4. **Modals live in SHELL**, not inside the screen that opens them — they get reused.
5. **A VIEW is a state, not a component.** "Empty state" and "detail" are views. A card is an
   element.
6. **Don't design the data model here.** That is the spec's job (§4). Name what appears on
   screen; the mock layer will connect it.
7. **Terse beats complete.** IMPACT's ran 283 lines for 36 screens. If a line needs a sentence
   of explanation, it probably belongs in the spec instead.

**Naming:** use `Title Case` for SCREEN and VIEW names. (IMPACT's original drifted between
`## VIEW: Assessment Detail` and `## VIEW: ASSESSMENT DETAIL` — pick one and hold it.)

---

## Worked example — the convention, fully applied

This is what a finished screen looks like. **Delete this section when you're done**; it is here
so the format is unambiguous, and the elements below are guesses, not decisions.

```markdown
# SCREEN: Triage Queue

## VIEW: Queue
PERIOD SELECTOR
SOURCE FILTER
SCORE SORT TOGGLE
OPPORTUNITY CARD
  TITLE
  BUYER NAME
  DEADLINE
  FIT SCORE
  WINNABILITY SCORE
  VALUE SCORE
  TIMING SCORE
  SOURCE BADGE
  FRESHNESS INDICATOR
INTERESTED BUTTON
NOT INTERESTED BUTTON
REASON FIELD
BULK DISMISS BUTTON (SELECTION ACTIVE)

## VIEW: Empty Queue
EMPTY STATE MESSAGE
LAST RUN TIMESTAMP
RUN NOW BUTTON

## VIEW: Queue Cleared
CONFIRMATION MESSAGE
COUNT TRIAGED
NEXT SCHEDULED RUN
```

Note: indented sub-elements under `OPPORTUNITY CARD` are fine where a component has obvious
internal parts. Don't nest more than one level.

---

## Scaffold — fill these in

Screens derived from design spec §7, with the management-phase items excluded per §9.

---

# SHELL:

## NAVBAR:

## MODAL:

## MODAL:

## TOAST / NOTIFICATION:

---

# SCREEN: Triage Queue

*The daily driver. "Clear the queue" is the habit the whole system depends on (§7.1).*

## VIEW: Queue

## VIEW:

---

# SCREEN: Opportunity Detail

*The brief, the fact panel, the cost-to-pursue ingredients, source documents, sighting
history (§7.3). Every extracted field carries confidence and a pointer to source text — decide
here how that appears, because it recurs everywhere.*

## VIEW: Brief

## VIEW:

---

# SCREEN: Adjudication

*Reading a ranked list and marking would-bid / would-not / unclear (§8.2). Worth deciding
whether this is genuinely its own screen or just Triage Queue in a different mode — it is the
same motion, and building it once was one of the findings in the plan of action.*

## VIEW:

---

# SCREEN: Expiration Radar

*Contracts approaching end date, as predicted re-competes (§4.6). The lead-time advantage.*

## VIEW:

---

# SCREEN: Teaming Radar

*Who wins work KP could sub on (§4.6).*

## VIEW:

---

# SCREEN: Entity Browser

*Organizations, Vendors, Awards, Contracts (§7.5).*

## VIEW:

---

# SCREEN: Saved Views

*Was "Custom Queries" in the original outline (§7.7).*

## VIEW:

---

# SCREEN: Reports

*Market sizing, source yield (§7.6).*

## VIEW:

---

# SCREEN: Firm Profile

*The only home for KP-specific facts (§4.2) — capabilities, codes, certifications, geography,
hard limits, past performance, negative profile. This is the long-form archetype for the
bake-off, so it needs every form element the app will ever use.*

## VIEW:

---

# SCREEN: Source Admin

*Source Registry management, adapter health (§7.8).*

## VIEW:

---

## Notes / open questions

*Anything you're unsure about — put it here rather than guessing in the outline.*

-
