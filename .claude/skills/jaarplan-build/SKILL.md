---
name: jaarplan-build
description: >-
  Drive the Jaarplanner build forward by the backlog, one story (or wave) at a time,
  using subagents. Picks the next unblocked story, claims it in the backlog, spawns an
  implementer in an isolated worktree, then gates the result through the test-runner and
  the antagonist in parallel, looping fixes back until PASS + COMPLIANT, then merges and
  checks the story off. Use when the user says "build the next story", "continue the
  build", "work the backlog", "/jaarplan-build", or asks to implement a specific E<n>-<nn>.
---

# Jaarplan build orchestrator

You are the **orchestrator**. You own the backlog state and the build loop. Subagents
cannot spawn other subagents or coordinate each other — **all fan-out, gating, and the
fix-loop run from here.** Keep the user informed and **pause after each completed story**
(current autonomy setting) for review before starting the next.

## Roles (who does what)
- **You (orchestrator):** read backlog → pick & claim work → spawn agents → merge verdicts → loop fixes → mark done → report. The only place with the `Agent` tool.
- **`implementer`** (`.claude/agents/implementer.md`): builds one story in a worktree, writes its worklog. Spawn with `isolation: "worktree"`.
- **`test-runner`** (`.claude/agents/test-runner.md`): verifies acceptance criteria (unit/integration or Playwright MCP).
- **`antagonist`** (`.claude/agents/antagonist.md`): audits the change against `CONSTITUTION.md`. Read-only.

## Source-of-truth order
`CONSTITUTION.md` > `docs/Functionele_Analyse_Jaarplanner.md` (scope) > `backlog/` > `CLAUDE.md`. On conflict, the higher one wins — and fix the lower document.

## The loop (run per story)

### 1. Pick the next story
- Read `backlog/README.md` (progress table + open-decision gates) and the relevant `backlog/E<n>-*.md`.
- If the user named a story, use it. Otherwise pick the **lowest-numbered epic with remaining work**, then the first story that is:
  - `[ ]` Todo (not `[~]` in-progress, not `[x]` done),
  - **not `[!]` blocked** on an open decision, and
  - **dependency-ready** — its prerequisites are `[x]`. Respect intra-epic order (e.g. `E0-01` structure before `E0-04` backend bootstrap) and the epic build order E0→E1→…→E6.
- If the only remaining stories are blocked or depend on an open decision (Art. XIV), **stop and ask the user** to decide — do not hard-assume an answer.

### 2. Claim it (prevents double-assignment)
**Before spawning**, edit the story's checkbox to `[~]` in its epic file. The claim is yours, made here — never rely on the agent to claim it. Create the worklog folder path `backlog/worklogs/<story-id>/` (the implementer writes into it).

### 3. Implement
Spawn the **`implementer`** with `isolation: "worktree"`, passing: the full story text + *Done when* criteria, the cited FR/Article, and the worktree expectation. It returns a report (branch `story/<id>`, files, gates, how to verify).

> **Scaling later:** when autonomy is raised to per-epic/autonomous, pick a *wave* of stories that are mutually independent **and touch disjoint files** (avoid two agents both editing `.sln`, `nl.json`, DI, or the same migration), and spawn one implementer per story **in a single message** so they run concurrently — each in its own worktree.

### 4. Gate: verify + audit in parallel
In **one message**, spawn both:
- **`test-runner`** — give it the story criteria, the implementer's report, and the worktree path.
- **`antagonist`** — point it at the worktree diff / branch for the change.

### 5. Decide
- **PASS + COMPLIANT** → go to step 6.
- **FAIL or VIOLATIONS FOUND** → spawn the **`implementer` in FIX mode** with the consolidated findings (defects + cited violations). Then re-run step 4. Cap at **3 fix rounds**; if still red, **stop and surface to the user** with the open findings — do not silently loosen criteria or waive a constitution finding (only the user waives, per the antagonist's contract).

### 6. Land it
- Merge the worktree branch `story/<id>` into the current working branch (local only — **do not push, do not open a PR** unless the user asks).
- Flip the story checkbox `[ ]`/`[~]` → `[x]` in the epic file.
- Update the **progress table in `backlog/README.md`** (Done count + Status + the Totaal row/percentage).
- Confirm the worklog folder has `implementation.md`, `test-report.md`, and `antagonist.md`.

### 7. Report & pause
Tell the user: story done, what was built, gate results (tests + antagonist verdict), files merged, and what the next ready story would be. **Wait for the user** before starting the next story (current setting: pause after each story).

## Worklog convention
Everything lands under `backlog/worklogs/<story-id>/` — one folder per story, named by its backlog id, so the trail is ordered per use case alongside the backlog:
- `implementation.md` (implementer), `test-report.md` (test-runner), `antagonist.md` (paste the antagonist verdict here).

## Hard rules
- **You claim and check off the backlog**, not the agents — they can't safely coordinate the shared file.
- **Never mark `[x]` without PASS + COMPLIANT.** A red gate means the story is not done (Art. X).
- **Never hard-assume an open decision** — block the story `[!]` and ask.
- **No secrets, no pupil data, AI keys server-side only** — these are CRITICAL; an antagonist CRITICAL is a hard stop.
- Keep changes small and reviewable; honour the Dutch domain language + i18n rules.
