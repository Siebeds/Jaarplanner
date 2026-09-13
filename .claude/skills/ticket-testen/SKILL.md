---
name: ticket-testen
description: >-
  Record the test of a functional Jaarplanner ticket that is in te-testen: close it or send it back
  with the finding, so the local kanban board stays truthful. The functional architect tests; the
  owner records the result on his own PC. Use when the owner says "FB-012 is getest", "wat staat er
  klaar om te testen", "keur FB-012 goed", "FB-012 werkt niet", "/ticket-testen".
---

# Ticket testen

A functional ticket reaches *Te testen* once its work is merged into `main`. **The functional architect tests it; the
owner records the result**, on his own PC, where the board runs (owner rulings 2026-09-13: the architect tests, only
the owner changes a status). Format and statuses: [`backlog/TICKETS.md`](../../../backlog/TICKETS.md). Speak Dutch
with the owner.

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

## 3. Get the test result

The functional architect walks the ticket's **Testscenario's** and reports, per **Acceptatiecriterium**, what they
saw. If the owner wants to look along, start the app with the `app-starten` skill. Ask for what is missing in the
report rather than filling it in yourself.

## 4. Record the decision

- **Everything works:**
  `node tools/backlog-board/tickets.mjs status FB-012 klaar --by eigenaar --log "getest door <architect>: alle criteria in orde"`
- **Something does not work** (a criterion fails):
  `node tools/backlog-board/tickets.mjs status FB-012 klaar-voor-bouw --by eigenaar --log "Bevinding van <architect>: <stap>, verwacht <x>, gezien <y>"`
  The ticket goes back to *Klaar voor bouw* and a session picks it up again.
- **A different problem that the ticket never asked for:** leave this ticket's status alone; the architect logs the
  new problem as its own FB ticket with the `ticket-aanmaken` skill.

## 5. Commit and push

```bash
node tools/backlog-board/tickets.mjs check
git add backlog/functionele-backlog
git commit -m "Test FB-012: klaar"          # or: "Test FB-012: back to klaar-voor-bouw"
```

Push to `main` only after the owner agrees: `git push origin main`.
