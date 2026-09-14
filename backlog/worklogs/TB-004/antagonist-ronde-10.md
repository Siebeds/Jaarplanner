# TB-004 antagonist audit, round 10 (2026-09-14)

**Verdict:** COMPLIANT

**Scope:**

- `e8ee9f2`, the round 9 fixes: a blank line keeps the code comment out of the help of `deploy-ai.ps1`, and TB-004 gets
  werklog lines.
- `b6e105b` on `ticket/sjceik-omgevingen`, TB-006's werklog line.

Everything that could reach Azure or the user-secrets was run against a fake `az` and a fake `dotnet`.

## What was confirmed

- **Help:** `Get-Help` shows the synopsis and the examples without the comment. The attribute
  `[CmdletBinding(PositionalBinding = $false)]` still binds to the script, and `-WhatIff` and positional arguments are
  still refused before any call.
- **The script still works for every valid call:**
  - `-WhatIf`, valid and invalid `-Skip` names, and `-EvaluatorObjectId`;
  - `-SetEvalEndpoint`, which runs `deployment sub create` and then the user-secrets call;
  - the location, which stays `swedencentral`.
- **TB-006:** it passes `tickets.mjs check --all`, and its werklog line matches `bijgewerkt`.

Rounds 7 to 9 are closed with this.

## Still open

- **Criterion 3:** the live run. Azure refuses the account with 715-123420, and the owner is filing a support request.
- **Before the PR:** merge `origin/main` again.
