# ADR-0037 — A lighter agent process: groepschat retired, antagonist bounded, governing documents trimmed

- **Status:** Accepted (owner, 2026-09-15)
- **Date:** 2026-09-15
- **Deciders:** Siebe De Saedeleir (projecteigenaar)
- **Amends:** `CONSTITUTION.md` Art. X.7 and Art. XIII; adds Art. XI.4. **Retires:** the groepschat protocol (`.claude/skills/groepschat/`). **Relates to:** [ADR-0033](0033-ticketbacklog-en-kanbanbord.md), whose ticket-number reservation keeps using the claim directory.

## Context

On 2026-09-15 the owner observed that the agent process had started to cost more than it protected:

- **Antagonist rounds did not converge.** Every finding, a MINOR included, made the verdict *VIOLATIONS FOUND*, and the build loop answered every such verdict with a fix and a full new audit. The auditor was told to leave no stone unturned and to treat "looks fine" as a failure, and it audited the consistency of documents outside the diff (the ADR index, FA pointers, backlog wording). Each fix therefore touched new documents and produced new findings. E6-02 ran 23 audit rounds, with 7 MAJOR, 61 MINOR and 15 QUESTION findings; its antagonist worklog is 123 KB. Every round read the whole constitution (99 KB) and `CLAUDE.md` (45 KB).
- **The groepschat duplicated what the ticket flow already does.** A ticket's `in-uitvoering` status with `opgepakt-door` is a claim, and every session works in its own worktree. The chat log had grown to 945 lines that each session read on joining. The file claims serialised work that git merges anyway: the claim on `nl.json` held sessions up for hours over conflicts that take a minute to resolve.
- **`CLAUDE.md` and the constitution had become archives.** `CLAUDE.md` is loaded into every session and every subagent, and its status paragraph and working agreements were mostly dated corrections of earlier text. The constitution carried a 29 KB ratification log and, inside its articles, the history of each amendment next to the rule it produced.

## Decision

1. **The groepschat is retired.** The skill, the chat log, the session files, `BOARD.md` and every claim go. Parallel sessions stay apart by working in their own worktree under `.claude/worktrees/`; a ticket's status is its claim, and a story's `[~]` is its claim. **Shared files (`nl.json`, `backlog/README.md`, the DI registration, the `.sln`) may be edited by any session**, and conflicts are resolved at merge. The one real hazard is two unmerged branches that each add an EF migration: whoever merges second regenerates theirs. A dev-server port is chosen by checking which port answers, not by claiming it. `tools/backlog-board/tickets.mjs` keeps reserving a new ticket number in `.claude/coordination/claims/` for the instant it writes the file; that needs no protocol.
2. **The antagonist is bounded** (Art. X.7 and XIII amended):
   - it audits the **diff** of one finished story or ticket, **once**, not per slice or per commit; documents outside the diff are out of its scope unless the diff makes them false;
   - only **CRITICAL** and **MAJOR** findings block; MINOR findings are reported, fixed when cheap or listed in the worklog, and never trigger another round;
   - a re-audit checks **only** the blocking findings still open; there are **at most two rounds**, and a blocking finding still open after the second goes to the owner;
   - it reports at most ten findings, with no list of checks that found nothing. It stays on Opus.
3. **The technical lead runs only on request.** It has no claims to police, no `BOARD.md` and no chat; when the owner asks, it sweeps worktrees, branches, blocked work, tickets and backlog truth. It is never proposed proactively.
4. **`CLAUDE.md` and the constitution hold the rules in force.** The ratification log moves to [`docs/constitutie-log.md`](../constitutie-log.md). The dated amendment notes, the *why* and *surfaced by* paragraphs and the list of resolved open decisions leave the articles; every rule in force stays, in its ratified wording (Art. XI.4). The text before this change is in git at `f5804bc`. Status belongs in `backlog/README.md`, not in `CLAUDE.md`.

## Alternatives considered

- **Keep the groepschat and drop only the file claims.** Rejected: the chat log and the session files were the larger cost, and the ticket status already answers "who works on this".
- **Antagonist on request only, or only CRITICAL blocking.** Offered to the owner, who chose MAJOR-and-up blocking with two rounds: the audit has caught real rights and pupil-data defects, and those are MAJOR or CRITICAL.
- **Move the antagonist to Sonnet.** Offered. The owner kept Opus: the number of rounds, not the model, was the cost.
- **Also rewrite the constitution's rules shorter.** Offered. The owner chose to keep the ratified wording and remove only the history.

## Consequences

**Positive**
- A story or ticket gets one audit and at most one re-audit of a known list, instead of an open-ended loop.
- Every session starts with far less to read: no chat log, a `CLAUDE.md` about a quarter of its former size, and a constitution without its archive.
- No session waits on another for a file lock.

**Negative / trade-offs**
- MINOR drift that used to be forced into the same branch can now land and accumulate; the worklog list is its only trace.
- Nobody announces a new migration or API change to the other sessions any more; the merge is where they meet.
- On a machine without `.claude/coordination/claims/`, two sessions creating a TB ticket at the same moment can still take the same number; the one that merges second renames (the rule in `backlog/TICKETS.md`).

**Follow-ups**
- Sessions already running keep the old instructions in their context until they restart.

## Compliance trace

- **Constitution:** Art. X.7 and Art. XIII amended, Art. XI.4 added, Art. XI's ratification log moved without change. No other principle changes.
- **Backlog:** TB-021.
- **FR/NFR:** none; team process only.
