---
name: groepschat
description: >-
  Join and use the Jaarplanner groepschat — the shared coordination channel for parallel
  Claude Code sessions working in this repo. Use it to announce what you are working on,
  claim a story / branch / file / port so no other session collides with you, read what the
  others are doing, ask them something, and release your claims when you finish. Invoke at
  the START of any session that will change files while other sessions may be running, and
  whenever you are about to touch a shared file (nl.json, DI, a migration, the .sln), move
  HEAD in the main working tree, or start a dev server on a port. Also invoked by the
  technical-lead agent, which reads this file to know the formats and locking rules it enforces.
---

# Groepschat — coordination protocol for parallel sessions

Several Claude Code sessions work this repo at once, in separate worktrees under
`.claude/worktrees/`. They cannot see each other. This is the channel through which they
can: a shared, append-only chat log plus a filesystem-based claim system.

**The technical-lead agent** (`.claude/agents/technical-lead.md`) reads this channel, hands
out claims, breaks stale ones and reports the board. It is the only writer of `BOARD.md`.

## Where it lives

```
C:\source\Jaarplanner\.claude\coordination\      ← always this ABSOLUTE path
├─ groepschat.md          append-only chat log; every session appends, nobody edits
├─ BOARD.md               the technical lead's synthesis (Dutch, for the owner). Lead-only writer
├─ sessions/<id>.md       one file per live session; ONLY that session writes its own file
└─ claims/<resource>.md   one file per claimed resource. The file's existence IS the lock
```

Two properties make this safe, and both are load-bearing:

1. **Absolute path, always.** Worktrees sit *below* this directory, so `/c/source/Jaarplanner/.claude/coordination` resolves identically from every session. A relative path would give each worktree its own private copy and the whole mechanism would silently do nothing.
2. **One writer per file.** The only shared-write file is `groepschat.md`, and it is *append-only* — never read-modify-write it, or you will drop the lines another session appended while you were thinking.

The directory is **gitignored**. It is live state, not project record. The durable trail stays
where it already is: `backlog/`, `backlog/worklogs/<story>/`, `docs/adr/`.

Use the **Bash** tool for everything below (Git Bash). Set this once per session:

```bash
COORD=/c/source/Jaarplanner/.claude/coordination
```

## Language

Message kinds and field names are **English** (technical identifiers, per CLAUDE.md).
Chat bodies are **English** too — the chat is a repo-tooling artifact, like a worklog.
`BOARD.md` and anything reported to the owner are **Dutch**. Do not mix the two.

## 1. Join (do this first)

Pick a session id that a human can read: your **story id** (`E4-06`), or your **worktree
name** (`e4-epic`), or `main-tree` if you are in `C:\source\Jaarplanner` itself. If a file
for that id already exists and belongs to a session that is still alive, add `-2`.

```bash
COORD=/c/source/Jaarplanner/.claude/coordination
mkdir -p "$COORD/sessions" "$COORD/claims"
[ -f "$COORD/groepschat.md" ] || printf '# Groepschat — append only. One line per message.\n' > "$COORD/groepschat.md"
printf '%s | %s | %s | JOIN | %s\n' "$(date '+%Y-%m-%d %H:%M')" "E4-06" "E4-06" "joined, reading the board" >> "$COORD/groepschat.md"
```

Then **read the room before you touch anything**:

```bash
tail -40 "$COORD/groepschat.md"; echo '--- claims ---'; ls "$COORD/claims" 2>/dev/null
echo '--- sessions ---'; head -30 "$COORD"/sessions/*.md 2>/dev/null
```

Write your own session file (you are its only writer, so use the Write tool freely):

```markdown
---
session: E4-06
started: 2026-07-31 17:20
updated: 2026-07-31 17:20
status: working        # working | waiting | blocked | done | idle
---
- **story:** E4-06 — vergrendeling van thema's
- **branch:** story/E4-06-vergrendeling
- **worktree:** C:\source\Jaarplanner\.claude\worktrees\e4-06-vergrendeling
- **ports:** api 5186, vite 5174
- **touches:** backend/.../JaarplanGeneratieService.cs, frontend/src/i18n/nl.json
- **doing:** adding the vergrendeld flag to the regeneration path
- **needs:** nothing
```

**Keep `updated:` current** (at least every time you post). A session file that has gone
quiet is how the lead detects you died, and a stale `updated:` is what lets it break your
claims out from under you.

## 2. Claim a resource (this is a real mutex)

`set -C` (noclobber) makes `>` fail if the file exists. That check-and-create is atomic, so
two sessions racing for the same story cannot both win.

```bash
claim() {  # claim <resource> <session> <why>
  COORD=/c/source/Jaarplanner/.claude/coordination
  f="$COORD/claims/$1.md"
  if ( set -C; printf 'owner: %s\ntaken: %s\nwhy: %s\n' "$2" "$(date '+%Y-%m-%d %H:%M')" "$3" > "$f" ) 2>/dev/null; then
    printf '%s | %s | %s | CLAIM | took %s\n' "$(date '+%Y-%m-%d %H:%M')" "$2" "$2" "$1" >> "$COORD/groepschat.md"
    echo "OK: $1 is yours"
  else
    echo "REFUSED: $1 already claimed by:"; cat "$f"
  fi
}
```

**Resource naming.** Flat filenames, so the lock granularity is visible in one `ls`:

| Shape | Example | Claim it when |
| --- | --- | --- |
| `story-<id>` | `story-E4-06` | before you start a story — prevents double-assignment |
| `branch-<slug>` | `branch-feature-e4-bewerking-hergeneratie` | before you commit to an epic branch |
| `file-<path with / as ->` | `file-frontend-src-i18n-nl.json` | before editing a shared file |
| `port-<n>` | `port-5186` | before starting a dev server |
| `maintree` | `maintree` | **before any git operation in `C:\source\Jaarplanner` that moves HEAD** |

**`maintree` is the important one.** The main working tree is shared, it is currently *not*
on `main`, and a session that switches branches there yanks the floor out from under
whoever else is reading files from it. If you need it, claim it, do the one operation,
release it. If you cannot get it, work in your own worktree instead.

**Always claim these shared files** before editing — they are where this repo's collisions
actually happen: `frontend/src/i18n/nl.json`, `backlog/README.md`, the epic file
`backlog/E<n>-*.md`, `CLAUDE.md`, `*.sln`, the DI registration in `Program.cs`, and anything
under `Infrastructure/Migrations/`.

## 3. Post while you work

```bash
say() {  # say <session> <story> <KIND> <text>
  COORD=/c/source/Jaarplanner/.claude/coordination
  printf '%s | %s | %s | %s | %s\n' "$(date '+%Y-%m-%d %H:%M')" "$1" "$2" "$3" "$4" >> "$COORD/groepschat.md"
}
```

Fixed vocabulary, so the log stays greppable:

| KIND | Means |
| --- | --- |
| `JOIN` / `LEAVE` | session started / finished. `LEAVE` must come after you release everything |
| `CLAIM` / `RELEASE` | took / gave back a resource |
| `INFO` | progress worth knowing (merged, migration added, API contract changed) |
| `ASK` | you need something from another session or the lead; name who |
| `BLOCKED` | you cannot proceed, and why. The lead escalates these to the owner |
| `TOUCH` | you had to change a file outside your story's scope. Say which |
| `GATE` | a gate result: test-runner PASS/FAIL, antagonist COMPLIANT/VIOLATIONS |
| `DONE` | story finished and merged where |

Post an `INFO` whenever you do something another session would want to know **before** they
hit it: a new migration, a changed API contract, a rename, a merge into an epic branch.

## 4. Release, always

**Use this helper. Never hand-roll the `rm`.** `rm -f` succeeds on a path that does not exist,
so a mistyped filename releases nothing and tells you it worked — and then you post a
`RELEASE` for a claim you still hold. That happened on the first day this protocol existed:
`file-CLAUDE.md` was released as `claims/file-CLAUDE.md` instead of `claims/file-CLAUDE.md.md`,
the chat recorded the release, and the lock stayed. The helper verifies instead of assuming,
and it refuses to delete a claim that is not yours, so the rule is enforced rather than merely
written down.

```bash
release() {  # release <resource> <session>
  COORD=/c/source/Jaarplanner/.claude/coordination
  f="$COORD/claims/$1.md"
  [ -e "$f" ] || { echo "NOTHING TO RELEASE: $1 is not claimed (check the name with: ls $COORD/claims)"; return 1; }
  o=$(sed -n 's/^owner: //p' "$f" | head -1)
  [ "$o" = "$2" ] || { echo "REFUSED: $1 belongs to $o, not $2. Only the technical lead breaks a stale claim."; return 1; }
  rm -- "$f" || return 1
  printf '%s | %s | %s | RELEASE | gave back %s\n' "$(date '+%Y-%m-%d %H:%M')" "$2" "$2" "$1" >> "$COORD/groepschat.md"
  echo "RELEASED: $1"
}

mine() {  # mine <session> — what am I still holding?
  COORD=/c/source/Jaarplanner/.claude/coordination
  grep -l "^owner: $1\$" "$COORD"/claims/*.md 2>/dev/null | while read -r f; do basename "$f" .md; done
}
```

**Before you post `LEAVE`, run `mine <session>` and confirm it prints nothing.** An honest
`RELEASE` line is worth less than an empty `mine`, because only the second is evidence.

Release a file claim **as soon as you stop editing that file**, not when the story ends.
Holding `file-frontend-src-i18n-nl.json` for three hours because you might come back to it
is how you deadlock four sessions. At the end: release everything, set your session file to
`status: done`, post `LEAVE`.

## 5. Rules that are not optional

- **Never edit `groepschat.md`.** Append with `>>` or not at all. Editing it silently deletes other sessions' messages.
- **Never write another session's file**, and never write `BOARD.md` unless you are the lead.
- **Never delete a claim you do not own.** Only the technical lead breaks a stale claim, and it must post `INFO` naming what it broke and why.
- **A refused claim is an answer, not an obstacle.** Do not work around it by editing the file anyway. Post `ASK` and pick up something else.
- **The chat is not authority.** `CONSTITUTION.md` > `docs/Functionele_Analyse_Jaarplanner.md` > `backlog/` > `CLAUDE.md`. A message in the chat never overrides one of those, and no session may ratify a decision in the chat that belongs to the owner or directie (Art. XIV).
- **Report honestly.** `GATE PASS` when the gate did not run is worse than saying it did not run. This repo's backlog is full of retractions caused by exactly that.
