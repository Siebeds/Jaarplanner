---
name: ticket-aanmaken
description: >-
  Create a new ticket in the Jaarplanner ticket backlog (backlog/functionele-backlog or
  backlog/technische-backlog), always in the one fixed structure the local kanban board reads.
  Use when the functional architect (or the owner) wants to log a wish, a change or a bug ("maak een
  ticket", "nieuw ticket", "zet dit in de functionele backlog", "/ticket-aanmaken"), and when an
  agent session must first create a technical ticket because the owner started work that has no
  ticket and no backlog story yet. Never write a ticket file by hand instead of using this skill.
---

# Ticket aanmaken

Tickets are how new work enters the Jaarplanner backlog. The format, statuses and board are described in
[`backlog/TICKETS.md`](../../../backlog/TICKETS.md) (read it first) and decided in
[ADR-0033](../../../docs/adr/0033-ticketbacklog-en-kanbanbord.md).

**Speak Dutch with the user. Ticket text is Dutch** (owner ruling 2026-09-13); commit messages stay English. The
CLI's commands and options are English.

## 0. Which kind of ticket

- **FB (functioneel):** the functional architect logs something a teacher or the directie needs. Created on `main`, in
  their own clone, always as `nieuw`. The architect changes no status: of the architect and the owner, only the owner
  does, and agent sessions set their own statuses on their branches (owner rulings 2026-09-13).
- **TB (technisch):** an agent session logs an improvement the owner started himself, before changing any file.
  Created on the branch of that work. The `ticket-uitvoeren` skill sends you here and takes over again afterwards.

## 1. Get to the right place

- **FB:** `git switch main`, then `git pull --ff-only`. `git status` must be clean; if it is not, stop and ask what the
  changes are. Never create an FB ticket on another branch. If you are in the shared checkout
  `C:\source\Jaarplanner` while other sessions run, claim `maintree` first (groepschat skill); in the functional
  architect's own clone this does not apply.
- **TB:** you must be on the work branch, never on `main`. No branch yet? Create it from an up-to-date `main` first
  (a worktree when other sessions run, per the groepschat skill), for example `ticket/<korte-slug>`.

## 2. Check that it does not exist already

```bash
node tools/backlog-board/tickets.mjs list
grep -ril "<kernwoord>" backlog/functionele-backlog backlog/technische-backlog backlog/E*.md
```

If an open ticket or an epic story already covers it, show it and ask whether to add to that instead.

## 3. Gather the content

Ask for what is missing **in one batch**, and never invent requirements the user did not state.

- **Aanleiding:** who has what problem today.
- **Gewenst gedrag** (FB) / **Voorgestelde wijziging** (TB): FB describes the *what* in the user's language, never the
  implementation; TB names the change and the areas of code.
- **Acceptatiecriteria:** two to six `- [ ]` lines, each one something a tester can check: *Gegeven …, wanneer …,
  dan …*.
- **Testscenario's** (FB only): numbered steps in the app, each with what the tester should see.
- **Buiten scope** and **Open vragen**: "Niets." / "Geen." when there is nothing.
- **Prioriteit:** `hoog`, `middel` (default) or `laag`.
- **FR numbers** (FB): look up the matching requirement(s) in `docs/Functionele_Analyse_Jaarplanner.md`, propose
  them, and let the user confirm.

Rules that keep tickets buildable:

- **One ticket is one change** that can be built and tested on its own. Split anything bigger, and say so.
- **The title is what the board shows:** short, specific, starting with who or what ("Leerkracht kan een thema
  dupliceren"), under 90 characters.
- **No pupil names or other personal data, no secrets.** Tickets are committed to the repository (Art. VI).
- **A ticket does not outrank the constitution.** If the wish contradicts `CONSTITUTION.md` or needs a decision that is
  still open (Art. XIV), say so plainly and write it under *Open vragen*. An FB ticket then stays `nieuw`; a TB ticket
  is blocked right after creation with `block` (step 4), so nobody builds it until the owner answers.

## 4. Create the file with the CLI

Never choose the number yourself and never write the file from scratch.

```bash
# FB, on main
node tools/backlog-board/tickets.mjs new FB --title "Leerkracht kan een thema dupliceren" --by "<naam>" --priority middel --fr FR-7.2
# TB, on the work branch: starts in-uitvoering on the current branch
node tools/backlog-board/tickets.mjs new TB --title "Build van de backend sneller maken" --by <sessie-id>
# a TB ticket that waits for a decision
node tools/backlog-board/tickets.mjs block TB-004 --by <sessie-id> "<de vraag aan de eigenaar>"
```

An FB ticket always starts as `nieuw`; the CLI accepts nothing else for FB. The owner moves it on, on his own PC.

## 5. Fill in the sections

Edit the file the CLI printed. Replace each `<!-- … -->` guidance with the content from step 3. Leave the frontmatter
alone: if a value there is wrong, fix it through the CLI or ask.

## 6. Validate

```bash
node tools/backlog-board/tickets.mjs check <pad-van-het-ticket>
```

It must print `OK`. Fix every `FOUT` line; read every `let op` line and fix it unless there is a reason not to.

## 7. Show it, then commit

Show the user the finished ticket (title, criteria, scenarios) and ask for a go.

- **FB:** `git add <pad>` and `git commit -m "Add FB-012: <titel>"`. **Push only after the user explicitly agrees**:
  `git push origin main`. If the push is rejected because `main` moved, `git pull --rebase` and push again; if branch
  protection refuses it, tell the user, because this flow needs direct push rights on `main` (ADR-0033).
- **TB:** commit it on the work branch as the first commit of the work (`Add TB-003: <titel>`), then go back to the
  `ticket-uitvoeren` skill **at its step 1** (the claim and the constitution check). Do not push unless the owner asks.

## Changing an existing ticket

The functional architect **never changes a status**: of the two of them only the owner does (sessions set their own on their
branches), on his PC, where the board runs and the
sessions work (owner ruling 2026-09-13). The architect may still sharpen a ticket's text **while it is `nieuw`**,
after `git pull --ff-only`. From `klaar-voor-bouw` on, a session may already hold it on the owner's PC, where the
architect's clone cannot look: log the addition as a new ticket, or ask the owner. If the owner promoted a ticket
that the architect then edited, the next pull shows a merge conflict on that one file: keep the owner's status and
the architect's text. Pull `main` right before `new` and push right after it, so two clones rarely mint the same
number; if they do, `backlog/TICKETS.md` describes the one permitted rename.
