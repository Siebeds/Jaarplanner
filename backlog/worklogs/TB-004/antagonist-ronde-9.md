# TB-004 antagonist audit, round 9 (2026-09-14)

**Verdict:** VIOLATIONS FOUND (0 critical, 0 major, 2 minor)

**Scope:** `9323aec` (the round 8 fixes in `deploy-ai.ps1`) and `5979706` on `ticket/sjceik-omgevingen` (the TB-006
note). All three round 8 items were confirmed fixed. `-WhatIf` binds to the script's own switch, valid `-Skip` names and
`-SetEvalEndpoint` still work, and every unknown or positional argument is refused before any call. All of this was
tested against a fake `az` and a fake `dotnet`.

## Findings and what was done

1. **The new comment ended up in the script's help.** It sat directly below `#>`, so PowerShell appended it to example
   1 of `Get-Help -Examples`. **Fixed:** a blank line now separates the help block from the comment.
2. **TB-006 was edited by hand without a werklog line or a new `bijgewerkt`** (ADR-0033, `backlog/TICKETS.md`).
   **Fixed:** a werklog line was written through `tickets.mjs log` on `ticket/sjceik-omgevingen`, which also set
   `bijgewerkt`.

## Still open

- **Criterion 3:** the live run, waiting on Azure support (715-123420; the owner's manual attempt in the portal failed
  the same way).
- **Before the PR:** merge `origin/main` again.
