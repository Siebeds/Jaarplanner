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
which is how the board decides which version is newest, and it writes the Werklog line.

## 0. Is there a ticket?

- **The user names an FB or TB id:** go to step 1.
- **The user names a story `E<n>-<nn>`:** that is the `jaarplan-build` flow, not this one.
- **The user asks for a change that has neither:** look for a matching open ticket with
  `node tools/backlog-board/tickets.mjs lijst`. None? Create a **TB ticket first** with the `ticket-aanmaken` skill
  (branch first, then `nieuw TB`, which starts it `in-uitvoering`), commit it, and continue at step 4.
- **"Neem het volgende ticket":** `lijst --status klaar-voor-bouw`, highest priority first, skip blocked ones, and
  let the owner confirm your pick.

Exempt from the rule: answering questions, explaining, read-only investigation, and edits to ticket files themselves.

## 1. Check the ticket and claim it

- It must be `klaar-voor-bouw` (check with `lijst`, which sees every branch). `in-uitvoering` by someone else: stop and
  pick another. `nieuw`: it is not refined yet; ask the owner whether to move it to `klaar-voor-bouw` first.
- Join the groepschat (`groepschat` skill) and claim `ticket-<ID>` (for example `ticket-FB-012`). A refused claim means
  another session has it.
- Read the whole ticket, the FR numbers it cites and the constitution articles it touches. If it conflicts with
  `CONSTITUTION.md` or needs an open decision (Art. XIV), do not build: `blokkeer` it with the question (step 5) and
  tell the owner.

## 2. Branch

From an up-to-date `main`: a worktree when other sessions are running, otherwise a branch, named
`ticket/<ID>-<slug>` (for example `ticket/FB-012-thema-dupliceren`). One ticket per branch. The ticket file must exist
in that checkout; if it does not, your `main` is older than the ticket.

## 3. Move it to in-uitvoering, as the first commit

```bash
node tools/backlog-board/tickets.mjs status FB-012 in-uitvoering --door <sessie-id> --log "opgepakt"
git add backlog/ && git commit -m "Start FB-012: <titel>"
```

The board shows the card under *In uitvoering* as soon as the file changes, even before the commit.

## 4. While you work

- `node tools/backlog-board/tickets.mjs log FB-012 --door <sessie-id> "<één zin>"` at moments the owner would want
  to know: a decision taken, a part finished, a gate result. Not a diary.
- Waiting for the owner or directie: `blokkeer FB-012 --door <sessie-id> "<de vraag>"`, then ask. `deblokkeer` once
  it is answered.
- Tick an acceptance criterion (`- [ ]` to `- [x]`) only when you have the evidence (a test, a browser check), and
  say which in the log.
- Stay inside the ticket. Anything else you notice becomes a new TB ticket or a question, never silent extra work.

## 5. Gates

Unchanged from CLAUDE.md: the relevant tests, `dotnet format`, `pnpm lint`, a real browser for UI, and the
`antagonist` for every significant change. Log each verdict; long reports go to `backlog/worklogs/<ID>/`.

## 6. The final status goes in the last commit

```bash
# functional ticket: the tester closes it later
node tools/backlog-board/tickets.mjs status FB-012 te-testen --door <sessie-id> --log "<wat er gebouwd is, gates groen>"
# technical ticket
node tools/backlog-board/tickets.mjs status TB-003 klaar --door <sessie-id> --log "<wat er gebouwd is, gates groen>"
```

Commit it with, or right after, the last change. The card now sits under **In review** until the owner merges; after
the merge and a pull it moves to *Te testen* or *Klaar* by itself. Push and open a PR only when the owner asks (the
existing rule); if a PR is opened, record it with `pr FB-012 <nummer> --door <sessie-id>` and commit that.

**Stopping without finishing?** Give it back so another session can take it:
`status FB-012 klaar-voor-bouw --door <sessie-id> --log "teruggegeven: <waarom, en wat er al staat>"`, and commit.

## 7. Release

Release `ticket-<ID>` and your other claims, set your session file to `done`, and post `LEAVE` (groepschat skill).

## Rules

- Never set an FB ticket to `klaar`: that is the tester's decision (`ticket-testen`). The CLI refuses it anyway.
- Never edit another ticket's content. At most, add a Werklog line through the CLI.
- Never create or edit an FB ticket on `main` as an agent: the functional architect owns `main`'s tickets.
