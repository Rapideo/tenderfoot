# Methodology Playbook

> A repeatable, written-down approach for taking a software project from "we want to build something" to "we have a detailed task-by-task plan ready to execute" — and then executing it without surprises.

---

## 1. Purpose

This document describes the planning and execution methodology used on the IMPACT Internship Assessment Portal production rebuild, generalised so it can be applied to a new project. It is intended for the project lead (or a successor) who is starting a fresh codebase and wants the same outcome as IMPACT produced: every architectural decision committed in writing before code is written, a fully-decomposed implementation plan checked into the repository, and an execution flow that produces small reviewable PRs at a predictable cadence.

The methodology is opinionated and procedural. It assumes you are working with Claude (or a similarly capable coding agent) and have access to the Superpowers skill library — those skills are referenced by name throughout. If you are working without an agent, the same four-stage structure still applies; you do the typing yourself instead of delegating, and the tooling references become "prompt yourself with these questions" rather than "invoke this skill."

> **Read alongside [`docs/case-study-2026-08-02.md`](case-study-2026-08-02.md).** This
> document says what to do; the case study reports what happened when it was done, and
> amends it. Two corrections matter enough to apply from the start: build design
> primitives before features (case study §9.1), and get a real user in at the first
> demo-able milestone rather than at launch (§9.7).

---

## 2. When to apply this methodology

The methodology is overkill for short, exploratory, or throwaway work. It is most valuable when the cost of a wrong architectural turn is high and the project will be reviewed by people who were not in the original conversation.

**Apply it when:**

- The project is multi-week or longer in scope.
- More than one stakeholder cares about the outcome (e.g. a client, a non-technical manager, an external reviewer).
- The code will have longevity — it is production software, not a one-off script.
- Multiple sub-systems interact (auth + database + UI + integration) and the interactions deserve thinking through.
- Reviewers (technical or non-technical) will need to audit your decisions later.

**Skip it when:**

- The task is a one-day bug fix or a focused refactor with a clear scope.
- The code is exploratory or experimental and will be thrown away.
- The work is purely operational (infra tweak, dependency bump, doc edit).
- A spec or plan already exists and the work is straightforward execution against it.

The dividing line is roughly: if you can hold the entire change in your head at once and the cost of getting it wrong is "redo a few hours of work," skip the formal methodology. If you cannot, apply it.

---

## 3. The four stages

The methodology has four stages. Each stage produces a written, version-controlled artifact. The hand-off between stages is explicit — you do not start stage 3 until stage 2's spec is committed.

### Stage 1 — Brainstorming

**What you do.** A structured Q&A conversation with the agent (or with yourself in writing) that clarifies intent, scope, constraints, and success criteria. The agent asks the questions you would otherwise forget to ask: "What does success look like? Who is the user? What are you explicitly *not* building? What constraints does the deployment environment impose?" You answer; the agent reflects back; you iterate.

**Tool / skill.** `superpowers:brainstorming` — invoked at the start of any non-trivial feature or project conversation. The skill enforces a question-first posture and resists premature jumping-to-code.

**Inputs.**
- A rough problem statement ("we want to build a portal that does X").
- An idea of the stakeholders and constraints.
- Awareness of what already exists (prior prototypes, existing systems to integrate with).

**Outputs.**
- A shared understanding, in the conversation transcript, of *what* is being built and *why*.
- The seeds of the design spec (stage 2) — open questions resolved, scope boundaries identified, success criteria articulated.

**"Done" criteria.**
- You can answer: "What are we building? Who is it for? What is *not* in scope? What does success look like? What are the load-bearing constraints?"
- Open questions have been surfaced and either answered or explicitly deferred.
- You can write the design spec without further questions to the stakeholders.

**Common pitfalls.**
- Skipping stage 1 because the answer "feels obvious." If you cannot write the answers down in two paragraphs, the answer is not obvious.
- Confusing brainstorming with design. Brainstorming surfaces questions; design answers them. Both happen, but the questions come first.
- Letting the conversation drift into implementation detail before scope is locked.

---

### Stage 2 — Design Spec

**What you do.** Capture the architectural decisions in a single markdown document. This is the durable artifact of stage 1, plus the next layer of detail: technology stack, data model, permission model, environment topology, non-goals, open questions, and the rationale for each significant choice. The spec is written as if a competent stranger needs to understand the project end-to-end without access to the original conversation.

**Tool / skill.** Still `superpowers:brainstorming` — the spec is the durable artifact of the same skill. The conversation produces the document; the document is then committed.

**Inputs.**
- The brainstorm conversation (in your scrollback or saved).
- Any prior art (existing prototypes, legacy systems, vendor docs you need to honour).

**Outputs.**
- A single markdown file at `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
- Committed to git on `main` (or via a PR for review-gated repos) before stage 3 begins.

**"Done" criteria.**
- The spec is the authoritative answer to "what are we building?"
- Every load-bearing technology choice has a one-sentence rationale (not "because it's nice").
- Non-goals are listed explicitly.
- A non-technical reviewer can read it and understand the shape of the project.
- A technical reviewer can read it and identify what to push back on.

**Common pitfalls.**
- Padding with implementation detail. Spec answers *what* and *why*; plan (stage 3) answers *how*.
- Glossing over the boring parts (env vars, secrets, deployment topology). They are where the real bugs hide.
- Letting the spec grow into a 4000-line monster. If it exceeds ~600 lines, the project probably needs to be split into sub-projects (see §5).

---

### Stage 3 — Implementation Plan

**What you do.** Take the spec and decompose it into bite-sized, executable tasks. Each task should be small enough that a fresh agent can complete it in 2–5 minutes without needing to re-read the entire plan. Tasks include exact file paths, complete code samples (not pseudo-code), and per-task verification steps. The plan is structured as a sequence of phases; each phase ends with something demo-able.

**Tool / skill.** `superpowers:writing-plans`.

**Inputs.**
- A committed design spec from stage 2.
- The current state of the codebase (or the empty repo if you are starting fresh).

**Outputs.**
- One markdown file per sub-project at `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`.
- Each task is a checkbox bullet (`- [ ] Task description with exact file path and code sample`).
- Per-phase verification commands so the executor knows when a phase is "done."

**"Done" criteria.**
- The plan is the authoritative answer to "how are we building this?"
- Every task names the exact file(s) it touches.
- Every code sample is complete enough to paste in — no placeholders.
- Verification steps are concrete commands (e.g. `npm test` or `curl localhost:3000/api/health`), not vague advice ("check it works").
- The plan is committed to git before execution begins.

**Common pitfalls.**
- Tasks too big — "implement the auth flow" is not a task; it is a phase. A task is "create `src/lib/auth/session.ts` with the contents below and verify with `npm test src/lib/auth/session.test.ts`."
- Pseudo-code instead of real code. If the executor has to make up syntax, the plan failed.
- Missing verification steps. Without them, the executor cannot tell when they are done.
- Writing the plan without re-reading the spec. The plan must be traceable back to spec sections.

---

### Stage 4 — Execution

**What you do.** Take one task at a time. Implement it. Open a PR. Run a two-stage review (spec compliance first, code quality second). Squash-merge once green. Move to the next task.

**Tool / skill.** `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` (for inline execution; see §7).

**Inputs.**
- A committed plan from stage 3.
- A working CI pipeline and branch-protected `main`.

**Outputs.**
- A stream of small PRs, each closing one or more plan tasks.
- The plan file's checkboxes flip from `- [ ]` to `- [x]` as tasks complete.

**"Done" criteria.**
- All plan checkboxes are checked.
- CI green on `main`.
- Production deploy reflects the plan's "Definition of Done."

**Common pitfalls.**
- Drifting from the plan. If you find yourself doing something not in the plan, stop and amend the plan first.
- Batching tasks into one giant PR. The point of small tasks is small PRs.
- Skipping the review pass because "it's just me." The review is where you catch the bug you would have shipped.

---

## 4. Project structure conventions

The methodology produces a predictable set of files. Stick to these conventions so the artifacts are discoverable and the naming reflects chronology.

```text
docs/
  methodology.md                                    <- this file
  superpowers/
    specs/
      YYYY-MM-DD-<topic>-design.md                  <- one per design spec
      YYYY-MM-DD-<topic>-design.md
    plans/
      YYYY-MM-DD-<topic>.md                         <- one per sub-project plan
      YYYY-MM-DD-<topic>.md
```

**File-naming rules:**

- Always prefix with `YYYY-MM-DD` — the date of creation, not the date of the work it describes. Dating by creation gives you chronological listing in a file explorer.
- Use lowercase, hyphen-separated topic slugs (`production-rebuild`, not `Production_Rebuild`).
- Spec docs always end in `-design.md`. Plan docs do not have a suffix. This visually distinguishes the two when scrolling a directory listing.
- One spec per architectural domain. One plan per sub-project.

**Why this matters:** chronological listing makes the history of decisions skimmable. The `-design.md` suffix on specs makes it impossible to confuse a spec with a plan even at a glance. The single-directory layout (rather than nested-by-topic) keeps the navigation flat.

---

## 5. A worked example

Here is a compressed walk-through of the methodology applied to a small fake project: a "Team Standup Bot" that posts a daily prompt to a Slack channel, collects responses, and emails a digest to the team lead.

### 5.1 Stage 1 transcript (compressed)

> **Agent:** What is this for?
>
> **Me:** Async standups. The team is distributed across three time zones and synchronous meetings hurt.
>
> **Agent:** Who is the user?
>
> **Me:** Two roles. Team members reply to the bot's daily prompt; the team lead reads the digest.
>
> **Agent:** What is not in scope?
>
> **Me:** No replacement for the existing project-management tool. No GitHub or Jira integration in v1. No reaction-based "thumbs up to skip today" — too cute, can come later.
>
> **Agent:** What does success look like?
>
> **Me:** The team has used it daily for a month. The team lead says it saved them at least 30 minutes a day.
>
> **Agent:** What are the load-bearing constraints?
>
> **Me:** It must work via Slack's webhook + Events API. Email is via the company's existing SES account. Storage must be cheap — a single tiny DB at most.

### 5.2 Stage 2 design spec (sketch)

```markdown
# Team Standup Bot — Design Spec

## 1. Overview
Async daily standup bot. Slack-resident; emails a digest to the team lead each
morning at 10am local time of the lead.

## 2. Locked decisions
- Stack: Node 20 + TypeScript + Fastify + better-sqlite3.
- Hosting: a single Fly.io machine, free tier.
- Slack: Events API for incoming, Web API for outgoing.
- Email: company SES via the existing `email-utils` package.
- Persistence: single SQLite file mounted on Fly's volume.

## 3. Data model
- `users(id, slack_id, tz, role)`
- `prompts(id, sent_at, message)`
- `responses(id, user_id, prompt_id, text, received_at)`
- `digests(id, sent_at, recipient, summary)`

## 4. Non-goals
- No web UI in v1.
- No multi-team support.
- No analytics or trend reports.

## 5. Open questions
- Resolved: prompt time of day → 9am local-to-recipient.
- Deferred: do we summarise responses with an LLM? — out of v1.
```

### 5.3 Stage 3 plan tasks (excerpt)

```markdown
## Phase A — Project scaffold

- [ ] Initialise `package.json`. Run `npm init -y`. Set `"type": "module"`, add
      `"engines": { "node": ">=20" }`. Add scripts: `"dev"`, `"build"`, `"test"`.
      Verify: `node --version` prints v20+; `cat package.json` shows the fields.

- [ ] Install runtime deps: `npm i fastify better-sqlite3 @slack/web-api`.
      Verify: `npm ls fastify` shows `fastify@4.x`.

- [ ] Install dev deps: `npm i -D typescript tsx vitest @types/node`.
      Verify: `npx tsc --version` prints 5.x.

- [ ] Create `tsconfig.json` with strict mode (full contents inline below).
      Verify: `npx tsc --noEmit` exits 0 on the empty src tree.

## Phase B — Slack inbound

- [ ] Create `src/slack/verify.ts` implementing Slack's signing-secret check
      (full code below). Verify: `npm test src/slack/verify.test.ts`.

- [ ] Create `src/routes/slack-events.ts` — Fastify route at POST /slack/events
      that verifies the signature, handles `url_verification` challenge, and
      forwards `event` payloads to a handler stub (full code below).
      Verify: `curl -X POST localhost:3000/slack/events -d '{ "type": "url_verification", "challenge": "abc" }'` returns `abc`.
```

The pattern: every task has a verification step, an exact file path, and (in the real plan) the complete code as a fenced code block. A fresh agent who has never seen the project can do these tasks in order without asking questions.

### 5.4 Stage 4 execution

The standup-bot plan runs the same way as the IMPACT plan: branch, implement task(s), commit with Conventional Commits, open PR, CI runs, review pass, squash-merge, repeat. Phase boundaries become natural PR boundaries — Phase A lands as one PR, Phase B as the next.

---

## 6. Multi-sub-project decomposition

Single-plan projects work fine up to roughly fifty tasks. Past that, the plan becomes hard to navigate and the execution graph becomes hard to track. The fix: decompose into sub-projects.

**Rule of thumb for splitting:**

- A single plan would exceed roughly fifty tasks.
- The project contains multiple independent sub-systems that could each be built end-to-end on their own.
- Different stakeholders care about different parts (e.g. infra team owns one chunk, product team owns another).
- The phasing has a natural "demo-able milestone" structure where each milestone is itself substantial.

**Structure for split projects:**

- **One project-level design spec** at `docs/superpowers/specs/YYYY-MM-DD-<project>-design.md`. This is the architectural source of truth for the whole project.
- **One plan per sub-project** at `docs/superpowers/plans/YYYY-MM-DD-sub-project-N-<name>.md`. Each plan covers a cohesive slice — infra, foundation, a specific feature subsystem, etc.
- **Sub-projects depend on each other** in a directed graph. Document the dependencies in the spec (or in a "Phasing" section of each plan).

**How IMPACT did it:**

- `2026-05-10-production-rebuild-design.md` — the architectural design covering stack, data model, RLS, environment topology. Spans the whole project.
- `2026-05-11-development-workflow-design.md` — a separate spec for the workflow / SDLC / infrastructure layer, because it is a different concern from "what the app does."
- Seven implementation plans:
  - Sub-project 0 — Project Infrastructure (~52 tasks, ~half a sprint)
  - Sub-project 1 — Foundation (60 tasks, ~2 sprints)
  - Sub-project 2 — Admin Core (37 tasks, ~1.5 sprints)
  - Sub-project 3 — Question Engine (38 tasks, ~1.5 sprints)
  - Sub-project 4 — Assessment Forms (31 tasks, ~1 sprint)
  - Sub-project 5 — Employer Shell (38 tasks, ~1.5 sprints)
  - Sub-project 6 — Polish & Launch (52 tasks, ~2 sprints)

Total: 256 tasks across seven plans. Each sub-project's "Definition of Done" is something demo-able; sub-project N depends on sub-project N-1.

---

## 7. Execution modes

Stage 4 (execution) can run in two modes. Both are supported by the Superpowers skill library.

### 7.1 Subagent-driven (recommended for most cases)

A fresh agent is spawned for each task (or each small batch of related tasks). The main session orchestrates: it picks the next task, dispatches a subagent with just the context needed for that task, reviews the result, and merges. The subagent does not see the previous turns of the main session.

**Why it works.** Each task is self-contained in the plan — the subagent reads the task description, executes it, and reports back. The main session keeps a clean context across many tasks, avoiding the "long-running session goes stale" problem.

**Skill.** `superpowers:subagent-driven-development`.

**Best for.** Projects with many small, independent tasks. The IMPACT plans are designed for this mode.

### 7.2 Inline (single-session execution)

The same agent executes all tasks in one continuous session. Simpler operationally; suitable when the project is small enough to fit in one session's context, or when tasks depend on rich context built up in earlier turns.

**Skill.** `superpowers:executing-plans`.

**Best for.** Smaller plans (under ~20 tasks) or projects where the tasks are tightly coupled and benefit from shared context.

**Trade-off.** Inline mode is simpler but more vulnerable to context drift. Subagent mode is more reliable for long projects but has a slightly higher orchestration cost.

---

## 8. Live amendment patterns

A plan is a model of the future. Reality will diverge. The methodology handles divergence in three ways, in increasing order of severity.

### 8.1 PR-description deviation notes

The smallest amendments — "I had to install one extra dependency that the plan didn't mention" — go in the PR description under a `### Deviations from plan` section. The deviation is captured in git history but does not modify the plan or spec.

**When to use.** The deviation is small, project-local, and unlikely to affect downstream tasks.

### 8.2 Inline spec or plan amendments

For larger deviations that change the canonical "what we're building" or "how we're building it," append an `## Amendment YYYY-MM-DD — <topic>` section to the bottom of the relevant spec or plan. The original body stays intact (so the historical decision is preserved); the amendment overrides.

**Pattern:**

```markdown
## Amendment 2026-05-11 — Use three Supabase environments, not two

The original spec (§2.3) called for two Supabase projects (dev + prod).
After scoping the CI integration tests we are switching to three:
impact-dev, impact-test, impact-prod. See PR #12 for the affected code
changes; see Tab 4 of the dashboard for the management-facing summary.

The original two-environment rationale (§2.3) is preserved for context.
This amendment supersedes it.
```

**When to use.** The deviation changes a load-bearing decision and the spec or plan is now misleading without the amendment.

### 8.3 Project-memory updates

For deviations that change how *future* projects should be approached — lessons learned that should outlast this project — capture them in `MEMORY.md` (or your equivalent personal-memory file) under a dedicated key. These do not affect the current spec/plan but inform the next project's stage 1.

**When to use.** "We learned X; next time we should default to doing it differently."

**Examples from the IMPACT project itself:** the spec was amended three times during sub-project 0 — once when the repo was made public instead of private (changing the secrets-management section), once when the two-Supabase plan became three (CI testing needed isolation), and once when the one-Netlify-project plan became two (preview-vs-prod isolation). All three amendments live at the bottom of the relevant spec docs with dated headers.

---

## 9. What this is NOT

This methodology is a structure, not a substitute for judgement.

- **It is not a substitute for thinking.** Following the four stages does not guarantee good architectural decisions. The decisions are still yours; the stages just make sure they are written down.
- **It is not a process for every PR.** A typo fix does not need a brainstorm-spec-plan-execute pipeline. Most maintenance work is direct execution against an already-existing plan or against the codebase itself.
- **It is not a guarantee that the plan will survive contact with reality.** It almost certainly will not. The methodology includes amendment patterns precisely because plans are models, and models are wrong.
- **It is not a replacement for code review, testing, or operational rigour.** It is the front-end of the development pipeline. Quality gates downstream (CI, review, deploys) are still required.
- **It is not a marketing methodology.** The artifacts are technical communication, not sales material. If you need a sales pitch, write one separately.

What it *is*: a structured way to bring intent and execution into alignment on projects where the cost of misalignment is high.

---

## 10. References

### Superpowers skills used

- `superpowers:brainstorming` — stages 1 and 2. Q&A-driven scope and design discovery; produces design spec.
- `superpowers:writing-plans` — stage 3. Decomposes a spec into bite-sized executable tasks.
- `superpowers:subagent-driven-development` — stage 4 (recommended mode). Per-task subagent dispatch with review gates.
- `superpowers:executing-plans` — stage 4 (inline mode). Single-session execution of a plan.

Other Superpowers skills that complement the methodology:

- `superpowers:writing-skills` — for creating your own skills if you find yourself repeating the same prompt pattern across projects.
- `superpowers:verification-before-completion` — the "evidence before assertions" discipline used at PR-completion time.
- `superpowers:systematic-debugging` — when reality diverges from the plan in confusing ways.
- `superpowers:requesting-code-review` and `superpowers:receiving-code-review` — both sides of the review gate at the end of stage 4 tasks.

### Concrete examples in this repository

- Architectural design spec: [`docs/superpowers/specs/2026-05-10-production-rebuild-design.md`](superpowers/specs/2026-05-10-production-rebuild-design.md)
- Workflow / infrastructure design spec: [`docs/superpowers/specs/2026-05-11-development-workflow-design.md`](superpowers/specs/2026-05-11-development-workflow-design.md)
- Sub-project 0 implementation plan: [`docs/superpowers/plans/2026-05-11-sub-project-0-project-infrastructure.md`](superpowers/plans/2026-05-11-sub-project-0-project-infrastructure.md)
- All six sub-project plans (1 through 6): [`docs/superpowers/plans/2026-05-10-sub-project-*.md`](superpowers/plans/)

### The methodology applied, assessed honestly

- [`docs/case-study-2026-08-02.md`](case-study-2026-08-02.md) — the post-mortem on this
  methodology's first full run. Where this document is prescriptive and generalized, the
  case study is descriptive and specific: real figures from git history, what the process
  caught, and what it missed.

  **Read §9 before applying this playbook again.** It amends the methodology in one
  load-bearing way: stage 4 execution as run here was *function-first*, which cost an
  entire sub-project to correct. The revised order builds design primitives from the
  prototype before any feature work. The case study also argues for a stage the four
  stages omit entirely — putting a real user in front of the product at the first
  demo-able milestone rather than at launch.

### Management-facing artifact

- Project dashboard at [`docs/dev-portal/index.html`](dev-portal/index.html) — see the "Planning Process" tab for a one-page management summary of this methodology applied to IMPACT.
