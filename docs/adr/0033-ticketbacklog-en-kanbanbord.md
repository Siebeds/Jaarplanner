# ADR-0033 — A Markdown ticket backlog and a local kanban board

- **Status:** Accepted (project owner ruling, 2026-09-13)
- **Date:** 2026-09-13
- **Deciders:** Siebe De Saedeleir (projecteigenaar)
- **Supersedes:** nothing. The epic backlog (`backlog/E*.md`) and the `jaarplan-build` flow stay as they are.
- **Relates to:** the groepschat protocol (`.claude/skills/groepschat/SKILL.md`), whose claim directory this reuses;
  the `jaarplan-build` skill and the `technical-lead` agent, which learn to read tickets.

## Context

The owner asked on 2026-09-13 for a second way into the backlog:

- A **functional architect / tester**, not a developer and working with AI, logs new work as Markdown files in the
  repo, on `main`.
- Several Claude Code sessions pick those tickets up, and **update the ticket file** as they progress.
- The owner wants a **visual kanban board**, local to his PC, that reads only those files: the card shows a clear
  title, a click shows the details.
- When the owner starts an improvement himself that nobody logged, the agent must **first create a technical ticket**,
  shown in a different colour, so the board separates the owner's changes from the functional person's.

Two facts shaped the design. **The epic backlog cannot be the source for this.** Its stories are prose paragraphs in
shared files, and `backlog/README.md` records at length how its checkboxes and counts have drifted. **And sessions work
in worktrees on their own branches**, so a status an agent writes on its branch is not on `main` until the merge. A
board that reads only `main` could never show that anyone is working on anything. The owner was offered three
answers (the board also reads worktrees and branches; agents push small claim commits to `main`; main only) and
chose the first. He also ruled that tickets are **Dutch**, that the epics stay **side by side** with the tickets, and
that the board has the **full flow** of columns including a tester column.

## Decision

1. **Two folders, one file per ticket.** `backlog/functionele-backlog/FB-nnn-slug.md` is written by the functional
   architect, directly on `main`. `backlog/technische-backlog/TB-nnn-slug.md` is written by an agent session on the
   branch of the work itself. A file name never changes, because it is how a ticket is followed across branches.
2. **One fixed format, defined once.** A frontmatter block with twelve keys (all present, some may be empty) and a
   fixed list of `##` sections per kind, in a fixed order. The format lives in
   `tools/backlog-board/lib/format.mjs`; `backlog/TICKETS.md` describes it for people, and a test fails when the two
   drift. Anything that breaks the format is reported, never silently skipped: on the board as a red strip, in
   `tickets.mjs check`, and in CI.
3. **Statuses and columns.** The file holds one of `nieuw`, `klaar-voor-bouw`, `in-uitvoering`, `te-testen`,
   `klaar`. The board adds a sixth column, **In review**, that nobody writes: an agent writes its final status
   (`te-testen` for FB, `klaar` for TB) in the **last commit of its branch**, and while that status is visible on a
   branch or worktree but not on `main`, the card sits in In review. The merge moves it on without anyone having to
   remember to. Writing `in-review` into the file instead was rejected because the merge would carry it onto `main`,
   where nobody would ever move it again.
4. **What the board reads.** The local `main`; each local branch not merged into `main`, but only the ticket files it
   changed since its merge base (a file a branch never touched is `main`'s old copy and must not compete); and each
   worktree's uncommitted edits. Of all versions of a ticket, the newest `bijgewerkt` wins, and on a tie the one
   closest to the work (worktree, then branch, then `main`). The board never fetches, pulls, checks out or writes.
5. **The board is a development tool, not product.** A dependency-free Node server plus one static page in
   `tools/backlog-board/`, bound to `127.0.0.1` with a Host-header check, pushing changes over server-sent events.
   It sits outside `frontend/` on purpose: ADR-0024's design system, the `nl.json` rule (Art. II.3) and Art. XII's
   colour budget govern the app a teacher sees, not a tool only the team runs. It still follows their spirit: every
   hue also carries a text label, and Markdown from a ticket is escaped before it is rendered.
6. **Every write goes through one CLI**, `tools/backlog-board/tickets.mjs` (`nieuw`, `status`, `log`, `blokkeer`,
   `deblokkeer`, `pr`, plus `lijst`, `check`, `nummer`). It enforces the allowed transitions, sets `bijgewerkt`,
   appends the Werklog line, and refuses to touch or produce an invalid ticket. A new number is the highest number
   visible anywhere on this machine plus one, reserved for the moment of creation through the groepschat claim
   directory when it exists.
7. **No work without a ticket or a story.** A session that is asked to change files for work that has neither
   creates a TB ticket first, before the first edit. Three skills carry the procedures: `ticket-aanmaken`,
   `ticket-uitvoeren` and `ticket-testen`.
8. **Side by side with the epics.** Stories `E<n>-<nn>` are finished in their epic files through `jaarplan-build` and
   do not get tickets. New work comes in as tickets. The progress table in `backlog/README.md` keeps counting stories
   only.
9. **CI checks the tickets** on every push: the tool's tests and `tickets.mjs check`.

## Alternatives considered

- **GitHub Issues or Projects.** Rejected: the owner asked for Markdown in the repo that agents read and edit as part
  of the work. An issue lives outside the branch, so its status cannot travel inside the PR that does the work, and it
  would be a second system of record.
- **The board reads only `main`.** Rejected by the owner: *in uitvoering* would practically never be visible.
- **Agents push small status commits straight to `main`.** Rejected by the owner: many commits on `main`, and it
  bypasses the PR flow.
- **Tickets as entries in the existing epic files.** Rejected: not one item per file, prose that cannot be validated,
  and the shared files are exactly where this repo's merge conflicts and count drift happen.
- **A board inside `frontend/`.** Rejected: it would tie a team tool to the product's build, lint, i18n and design
  rules, and put team tooling in the bundle a school downloads.

## Consequences

**Positive**
- Parallel work is visible at a glance, including work not yet committed.
- The functional architect has a structured intake that a machine can check, so a half-filled ticket cannot land.
- Status changes are mechanical (one CLI call, one Werklog line) instead of hand-edited prose.

**Negative / trade-offs**
- **Two backlogs exist side by side** until the epics are finished, and the README's progress table does not count
  tickets.
- **The board only knows this PC.** A session on another machine or in the cloud is invisible until its branch exists
  locally; the board does not look at `refs/remotes`.
- **`bijgewerkt` decides.** A hand edit that forgets to update it can lose to an older version on another branch. The
  CLI prevents this for every write it makes; `TICKETS.md` says so for hand edits.
- **Merge detection assumes merge commits**, which is how this repo merges today. After a squash merge the branch tip
  is not an ancestor of `main`, so the branch keeps showing until it is deleted; its versions then lose on
  `bijgewerkt` unless they are newer.
- **The functional architect commits directly to `main`.** That needs push rights and no branch protection that blocks
  them; the owner has to arrange that or move them to PRs.
- **Tickets are Dutch**, where `CLAUDE.md` keeps backlog text in English. This is the owner's ruling for these two
  folders only: the readers are the functional architect and the owner.

## Compliance trace

- **Constitution:** Art. X (Definition of Done): ticket work runs the same gates as story work, and the tool has its
  own tests in CI; Art. XIII: the antagonist still audits every significant change, and a ticket grants no exemption;
  Art. VI: tickets are committed to the repo, so they never carry pupil data or secrets (stated in the skills and in
  `TICKETS.md`); Art. XIV and XI: a ticket never settles an open decision. One that needs one is blocked with the
  question and routed to the owner. The constitution, the functional analysis and the ADRs outrank a ticket exactly
  as they outrank a story.
- **Backlog:** all epics, unchanged; new work from 2026-09-13 onwards.
- **FR/NFR:** none. This is how the team works, not what the product does.
