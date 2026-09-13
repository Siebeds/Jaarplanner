# Backlog board

A local kanban board and a command line for the two ticket folders, `backlog/functionele-backlog/` and
`backlog/technische-backlog/`. The format and the workflow are described for people in
[`backlog/TICKETS.md`](../../backlog/TICKETS.md) and decided in
[ADR-0033](../../docs/adr/0033-ticketbacklog-en-kanbanbord.md).

Node 22 or newer and git. **No dependencies**, no build step, nothing to install.

## Run it

```sh
node tools/backlog-board/server.mjs --open        # or double-click start-board.cmd
```

It serves <http://localhost:5199> on `127.0.0.1` only, re-reads every 3 seconds (`--interval`) and pushes changes to
the page. `--port` and `--repo` override the defaults. It reads git and the disk and never fetches, pulls, checks out
or writes.

## Command line

```sh
node tools/backlog-board/tickets.mjs --help
```

`list`, `check`, `next-id`, `new`, `status`, `log`, `block`, `unblock`, `pr`. Every write goes through here so
`bijgewerkt` and the Werklog stay in the shape the board reads, and every write refuses when a newer copy elsewhere
says a different status, holder or block (naming the git command that fixes it).

## Test it

```sh
cd tools/backlog-board && node --test "test/*.test.mjs"
```

The source tests build throwaway git repositories with branches and worktrees in the temp directory.

## Where things are

| File | What |
| --- | --- |
| `lib/format.mjs` | the format: folders, keys, sections, statuses, columns, transitions. Change it here first, then `TICKETS.md` (a test keeps them in step) |
| `lib/parse.mjs` | parses and validates one ticket; never throws |
| `lib/sources.mjs` | collects versions from `main`, unmerged branches and worktrees |
| `lib/board.mjs` | picks the winning version, derives the column, flags collisions |
| `lib/write.mjs` | the new-ticket template and targeted edits |
| `tickets.mjs` | the command line |
| `server.mjs`, `public/` | the board |
