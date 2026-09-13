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
   branch or worktree but `main` does not have it yet, the card sits in In review. The merge moves it on without
   anyone having to remember to. The column is decided by **main's status**, not by where the newest copy lives, so a
   commit the branch gains after its merge (a PR number, say) does not pull the card back; and a checkout on `main`
   with an uncommitted edit counts as `main`. Writing `in-review` into the file instead was rejected because the merge would carry it onto `main`,
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
6. **Every write goes through one CLI**, `tools/backlog-board/tickets.mjs` (`new`, `status`, `log`, `block`,
   `unblock`, `pr`, plus `list`, `check`, `next-id`). It enforces the allowed transitions, sets `bijgewerkt`,
   appends the Werklog line, and refuses to touch or produce an invalid ticket. **Every write is made on the
   newest copy.** When a newer copy exists elsewhere, the CLI adopts it into the current checkout first and applies
   the write on top, so nothing on it is lost. It refuses instead when another session holds the ticket (only that
   session changes it), when the two copies have **diverged**, and when the newer copy is on the checkout's own
   upstream (pull first); and it never lets a **blocked** ticket be picked up, because a block is how a ticket waits
   for an open decision (Art. XIV). Divergence is decided on the Werklog, which only grows: a copy descends from
   another exactly when every Werklog line it has is also in the other. *Why this design, after two that failed:* the
   first guard let a write on a stale copy win, so a Werklog line on `main` undid a pickup (audit round 1). The second
   refused whenever the texts differed and froze tickets for the tester and the next session (round 2). The third
   compared status only and silently dropped blocks and give-back notes (round 3). Adopting the newest copy keeps
   every field without freezing anyone. The guard reads local branches, worktrees and remote-tracking branches as of
   the last fetch; a branch that exists only on another PC is invisible to it. That gap is closed by a process rule,
   not by code: the functional architect, working in their own clone, pulls first and changes an existing ticket only
   while it is `nieuw` (`TICKETS.md`). A new number is the highest number
   visible anywhere on this machine plus one, reserved for the moment of creation through the groepschat claim
   directory when it exists.
7. **No work without a ticket or a story.** A session that is asked to change files for work that has neither
   creates a TB ticket first, before the first edit. Three skills carry the procedures: `ticket-aanmaken`,
   `ticket-uitvoeren` and `ticket-testen`.
8. **Side by side with the epics.** Stories `E<n>-<nn>` are finished in their epic files through `jaarplan-build` and
   do not get tickets. New work comes in as tickets. A new story is filed only as a follow-up inside an epic that is
   still open, for work that epic needs to be finished. The progress table in `backlog/README.md` keeps counting
   stories only.
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
  CLI always updates it and always writes on the newest copy; `TICKETS.md` says so for hand edits. A hand edit that
  adds no Werklog line is also invisible to the divergence check.
- **A remote branch deleted on the server lingers** as `origin/...` until `git fetch --prune`, and while it holds a
  ticket the CLI refuses a pickup with that remedy in its message. An abandoned local branch that holds a ticket is
  freed by deleting it.
- **The stale-copy guard only sees this machine** plus what it last fetched. Agents push only when the owner asks,
  so from the functional architect's clone an in-progress branch is usually invisible; the `nieuw`-only rule for
  editing existing tickets carries that case. Two clones can also mint the same FB number; the board flags both
  files and `TICKETS.md` gives the one permitted rename.
- **`bijgewerkt` is local time without a zone.** Everyone writing tickets today works in Belgian time. A writer whose
  clock is in another zone (a cloud session, a CI runner) would produce versions that win or lose by the offset.
  Nothing in the current flow writes tickets from such a place; if one ever does, store an offset.
- **Merge detection assumes merge commits**, which is how this repo merges today. After a squash merge the branch tip
  is not an ancestor of `main`, so the branch keeps showing until it is deleted; its versions then lose on
  `bijgewerkt` unless they are newer.
- **The functional architect commits directly to `main`.** That needs push rights and no branch protection that blocks
  them; the owner has to arrange that or move them to PRs.
- **Tickets are Dutch**, where Art. II.6 kept the backlog English. The owner ruled it for these two folders and their guide (`TICKETS.md` and the two folder READMEs) only,
  because their readers are the functional architect and the owner, and it is recorded as an amendment to Art. II.6
  in the constitution's ratification log. The tool's command and option names stay English (Art. II.2). Its messages
  and the board are Dutch for the same readers, and they sit outside the product, so the `nl.json` catalogue
  (Art. II.3, X.3) does not bind them. The three skill names stay Dutch, like `groepschat` (owner ruling, recorded in
  II.6).

## Compliance trace

- **Constitution:** Art. II.6 (amended with this ADR: ticket text is Dutch) and II.2 (the tool's identifiers and
  command names stay English); Art. X (Definition of Done): ticket work runs the same gates as story work, and the tool has its
  own tests in CI; Art. XIII: the antagonist still audits every significant change, and a ticket grants no exemption;
  Art. VI: tickets are committed to the repo, so they never carry pupil data or secrets (stated in the skills and in
  `TICKETS.md`); Art. XIV and XI: a ticket never settles an open decision. One that needs one is blocked with the
  question and routed to the owner. The constitution, the functional analysis and the ADRs outrank a ticket exactly
  as they outrank a story.
- **Backlog:** all epics, unchanged; new work from 2026-09-13 onwards.
- **FR/NFR:** none. This is how the team works, not what the product does.
