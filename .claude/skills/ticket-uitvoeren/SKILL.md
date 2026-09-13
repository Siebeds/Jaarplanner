---
name: ticket-uitvoeren
description: >-
  Work a Jaarplanner ticket (FB-nnn or TB-nnn) as an agent session and keep its card on the local
  kanban board truthful: claim it, move it to in-uitvoering on its own branch, log progress, block
  and unblock, run the gates, and write the final status in the last commit. Use when the user says
  "pak FB-012 op", "werk TB-003 af", "neem het volgende ticket", "/ticket-uitvoeren", and ALWAYS
  before changing any file for work that has no ticket and no backlog story yet: then this skill has
  you create a technical ticket first.
---

# Ticket uitvoeren

**The rule (CLAUDE.md, ADR-0033): no file changes without a ticket or a story.** The board reads the ticket files on
`main`, on every unmerged branch and in every worktree, so what you write in the ticket is what the owner sees.
Format and statuses: [`backlog/TICKETS.md`](../../../backlog/TICKETS.md). Talk to the owner in Dutch; ticket text is
Dutch; commits stay English.

Change a ticket's frontmatter **only through the CLI** (`node tools/backlog-board/tickets.mjs …`). It sets `bijgewerkt`,
which is how the board decides which version is newest, and it writes the Werklog line. Before every write it checks
for a newer copy elsewhere (one that has every Werklog line yours has, and more; a copy that split off only
counts while it holds the ticket or carries a block, and a copy on `main` always counts). If that copy says a different status, holder or block,
it refuses and names the git command that fixes it (`git merge main`, `git pull`, `git fetch --prune`, or wait for
the merge). It never adopts another copy itself. Do not work around a refusal.

## 0. Is there a ticket?

- **The user names an FB or TB id:** go to step 1.
- **The user names a story `E<n>-<nn>`:** that is the `jaarplan-build` flow, not this one.
- **The user asks for a change that has neither:** look for a matching open ticket with
  `node tools/backlog-board/tickets.mjs list`. None? Create the branch (step 2), then a **TB ticket** with the
  `ticket-aanmaken` skill. It starts `in-uitvoering` and its creation commit is your first commit, so after it go to
  **step 1** and then skip step 3.
- **"Neem het volgende ticket":** `list --status klaar-voor-bouw`, highest priority first, skip blocked ones, and
  let the owner confirm your pick.

Exempt from the rule: answering questions, explaining, read-only investigation, edits to ticket files themselves, and
bookkeeping (the coordination state under `.claude/coordination/`, epic checkboxes, the progress table and the technical
lead's backlog corrections), exactly as in CLAUDE.md.

## 1. Check the ticket and claim it

- It must be `klaar-voor-bouw` (check with `list`, which sees every branch and shows blocks), or `in-uitvoering` by
  you because you just created it. `in-uitvoering` by someone else: stop and pick another. Blocked (`geblokkeerd` in
  `list`): stop too; it waits for an answer from the owner. `nieuw`: it is not refined yet; ask the owner whether to
  move it to `klaar-voor-bouw` first.
- Join the groepschat (`groepschat` skill) and claim `ticket-<ID>` (for example `ticket-FB-012`). A refused claim means
  another session has it.
- Read the whole ticket, the FR numbers it cites and the constitution articles it touches. If it conflicts with
  `CONSTITUTION.md` or needs an open decision (Art. XIV), do not build: write the question under *Open vragen*,
  `block` the ticket with it (step 4), and tell the owner.

## 2. Branch

From an up-to-date `main`: a worktree when other sessions are running, otherwise a branch, named
`ticket/<ID>-<slug>` (for example `ticket/FB-012-thema-dupliceren`). One ticket per branch. The ticket file must exist
in that checkout; if it does not, your `main` is older than the ticket.

## 3. Move it to in-uitvoering, as the first commit

Skip this step for a TB ticket you just created: it is already `in-uitvoering`. A pickup starts from `main`'s
latest copy of the ticket: if `main` has moved on for it, the CLI refuses until you `git merge main`.

```bash
node tools/backlog-board/tickets.mjs status FB-012 in-uitvoering --by <sessie-id> --log "opgepakt"
git add backlog/ && git commit -m "Start FB-012: <titel>"
```

The board shows the card under *In uitvoering* as soon as the file changes, even before the commit.

## 4. While you work

- `node tools/backlog-board/tickets.mjs log FB-012 --by <sessie-id> "<één zin>"` at moments the owner would want
  to know: a decision taken, a part finished, a gate result. Not a diary.
- Waiting for the owner or directie: `block FB-012 --by <sessie-id> "<de vraag>"`, then ask. `unblock` once it is
  answered. While it is blocked you keep the ticket: the CLI will not let you give it back, because a block left on
  an unmerged branch would be invisible to whoever picks the ticket up next.
- Tick an acceptance criterion (`- [ ]` to `- [x]`) only when you have the evidence (a test, a browser check), and
  say which in the log.
- Stay inside the ticket. Anything else you notice becomes a new TB ticket or a question, never silent extra work.

## 5. Gates

Unchanged from CLAUDE.md: the relevant tests, `dotnet format`, `pnpm lint`, a real browser for UI, and the
`antagonist` for every significant change. Log each verdict; long reports go to `backlog/worklogs/<ID>/`.

## 6. The final status goes in the last commit

```bash
# functional ticket: the functional architect tests it, the owner records the result
node tools/backlog-board/tickets.mjs status FB-012 te-testen --by <sessie-id> --log "<wat er gebouwd is, gates groen>"
# technical ticket
node tools/backlog-board/tickets.mjs status TB-003 klaar --by <sessie-id> --log "<wat er gebouwd is, gates groen>"
```

Commit it with, or right after, the last change. The card now sits under **In review** until the owner merges; after
the merge and a pull it moves to *Te testen* or *Klaar* by itself.

Push and open a PR only when the owner asks (the existing rule). If you do, record the number **before the merge**:
push, open the PR, run `pr FB-012 <nummer> --by <sessie-id>`, commit and push that too. Once `main` (or the
fetched `origin/main`) has your final status, the CLI refuses any write on your branch: the ticket then lives on
`main`.

**Stopping without finishing?** Give it back so another session can take it:
`status FB-012 klaar-voor-bouw --by <sessie-id> --log "teruggegeven: <waarom, en wat er al staat>"`, and commit. The
next session sees your note when it picks the ticket up. A blocked ticket cannot be given back: keep it and tell the
owner. A TB ticket lives on its branch until that branch is merged, so whoever takes it next continues on that same
branch; an FB ticket's next session starts from `main`, and your branch's copy then no longer counts.

## 7. Release

Release `ticket-<ID>` and your other claims, set your session file to `done`, and post `LEAVE` (groepschat skill).

## Rules

- **Never set an FB ticket to `klaar`:** that is the owner's decision, after the functional architect's test
  (`ticket-testen`). The CLI cannot tell who is calling, so it will not stop you; this rule is yours to keep.
- The owner does not change a ticket you hold: he asks you (owner ruling 2026-09-13). If he asks you to block it or
  give it back, do so. If you stop without giving it back, he frees it with `release`.
- Never change another session's ticket, not even with a Werklog line. If something about it needs saying, ask that
  session or the owner.
- Never create an FB ticket, and never change one on `main` on your own initiative: FB tickets are the functional
  architect's to create and the owner's to move. When the owner asks you to record a test result with him
  (`ticket-testen`), you act as his hands, with `--by eigenaar`.
