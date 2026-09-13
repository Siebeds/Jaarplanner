---
name: ticket-testen
description: >-
  Test a functional Jaarplanner ticket that is in te-testen, then close it or send it back with the
  finding, so the local kanban board stays truthful. For the owner, who tests and closes functional
  tickets on his own PC: "test FB-012", "wat staat er klaar om te testen", "keur FB-012 goed",
  "FB-012 werkt niet", "/ticket-testen".
---

# Ticket testen

A functional ticket reaches *Te testen* once its work is merged into `main`. **The owner decides whether it is done**,
on his own PC, where the board runs (owner ruling 2026-09-13: only the owner changes a status). Format and statuses:
[`backlog/TICKETS.md`](../../../backlog/TICKETS.md). Speak Dutch with the owner.

## 1. Get the latest main

```bash
git switch main
git pull --ff-only
git status   # must be clean
```

In the shared checkout `C:\source\Jaarplanner`, with other sessions running, claim `maintree` first (groepschat
skill) before the switch and the pull.

## 2. Pick a ticket

```bash
node tools/backlog-board/tickets.mjs list --status te-testen
```

A ticket under *In review* is not testable yet: its code is not on `main`.

## 3. Test it

Read the ticket's **Acceptatiecriteria** and **Testscenario's**. Start the app with the `app-starten` skill and walk
through each scenario with the owner. For every criterion, note what the owner saw.

## 4. Decide

- **Everything works:**
  `node tools/backlog-board/tickets.mjs status FB-012 klaar --by eigenaar --log "getest: alle criteria in orde"`
- **Something does not work** (a criterion fails):
  `node tools/backlog-board/tickets.mjs status FB-012 klaar-voor-bouw --by eigenaar --log "Bevinding: <stap>, verwacht <x>, gezien <y>"`
  The ticket goes back to *Klaar voor bouw* and a session picks it up again.
- **A different problem that the ticket never asked for:** leave this ticket's status alone and log the new problem
  as its own FB ticket with the `ticket-aanmaken` skill.

## 5. Commit and push

```bash
node tools/backlog-board/tickets.mjs check
git add backlog/functionele-backlog
git commit -m "Test FB-012: klaar"          # or: "Test FB-012: back to klaar-voor-bouw"
```

Push to `main` only after the owner agrees: `git push origin main`.
