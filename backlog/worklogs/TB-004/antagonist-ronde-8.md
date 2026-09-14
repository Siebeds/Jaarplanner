# TB-004 antagonist audit, round 8 (2026-09-14)

**Verdict:** VIOLATIONS FOUND (0 critical, 0 major, 2 minor, 1 question)

**Scope:** `7d8e4a6`, the fixes for round 7. The fix for the shared-use sentence and the fix for the region were confirmed
complete. The `-Skip` fix still had two gaps.

## Findings and what was done

1. **`-Skip` accepted a wrongly cased name.** PowerShell's `-notcontains` ignores case, and ARM's `contains()` does not.
   So `-Skip GPT-5.4-MINI` passed the check, matched nothing in the template and deployed every model. **Fixed:** the
   check compares case-sensitively (`-cnotcontains`).
2. **Unknown parameters were silently ignored.** Without `[CmdletBinding()]`, a mistyped `-WhatIff` went into `$args`,
   and the script deployed for real. The removed `-Location` and a positional region were dropped the same way, or bound
   to `$EvaluatorObjectId`. **Fixed:** `[CmdletBinding(PositionalBinding = $false)]` makes an unknown or positional
   argument an error.
3. **Question: the ADR-0036 amendment was noted only in TB-004.** **Done:** TB-006 now says itself that its ADR amends
   decision 3 of ADR-0036 ("apart from everything else"), because dev and tst share the evaluation resource.

## Still open

- **Criterion 3:** the live run, waiting on Azure (715-123420).
- **Before the PR:** merge `origin/main` again.
