# TB-001 — antagonist audits

Ten rounds ran on 2026-09-13. **The owner stopped the audits after round 10**, while round 11 was running; round 11
was cancelled and reported nothing. So **the fixes for round 10's findings (`83fa364`) are verified by tests (84/84)
and by their author, not by an independent pass.** Stated here because a closed ticket reads as fully audited unless
someone says otherwise.

| Round | Audited | Verdict | What it found (MAJOR unless noted) | Fixed in |
| --- | --- | --- | --- | --- |
| 1 | `d011007` | VIOLATIONS FOUND (5 MAJOR, 6 MINOR) | Dutch tickets without an Art. II.6 amendment; a Werklog line on a stale copy undid a pickup; a post-merge commit pulled a card back to In review; the TB path skipped the claim and the Art. XIV check; `markdown.js` was binary to git | `8543ff9`, amendment `695947f` |
| 2 | `e9bcf27` | VIOLATIONS FOUND (3 MAJOR) | the text-comparing guard froze the tester and a given-back ticket, and saw nothing from the architect's clone | `b3478e2`, amendment `2b35420` |
| 3 | `9754830` | VIOLATIONS FOUND (2 MAJOR) | the status-only guard dropped a block; a remote branch deleted on the server locked a ticket | `8022aef` |
| 4 | `80cfd61` | VIOLATIONS FOUND (6 MAJOR) | adopting the newest copy's text broke later git merges; two over-readings of the owner's role ruling | `e9e8832` |
| 5 | `e9e8832` | VIOLATIONS FOUND (1 MAJOR) | a split-off copy counted as newer and froze the ticket after a give-back | `fd6572a` |
| 6 | `5b591ef` | VIOLATIONS FOUND (1 MAJOR) | ignoring split-off copies let two sessions hold one ticket | `791f778` (adds `release`) |
| 7 | `791f778` | VIOLATIONS FOUND (2 MAJOR) | finished work on a split-off branch ignored; a superseded pushed copy held the ticket | `86bd7d8` |
| 8 | `86bd7d8` | VIOLATIONS FOUND (no MAJOR, 5 MINOR) | the conflict rule, an unmerged PR, block clean-up, the push message, an uncommitted give-back | `723dd55` |
| 9 | `723dd55` | VIOLATIONS FOUND (1 MAJOR) | the conflict rule made a holding session drop its hold | `91ce0cc` |
| 10 | `91ce0cc` | VIOLATIONS FOUND (1 MAJOR, 2 MINOR) | the conflict rule was keyed on the caller, so the owner's `release` lost a block; PR number dropped; worklog wording | `83fa364`, **not re-audited** |

**The pattern worth remembering.** From round 2 to round 7 every finding was about one question: which other copies of
a ticket may stop a write. Each fix moved the line and the next round found the case on the other side of it. It
converged once the rule was stated in terms git itself guarantees (the Werklog only grows, a copy on `main` is never
split off, a split-off copy counts until it is really handed back or merged). Rounds 8 to 10 then found only the
advice the CLI prints for resolving a merge conflict. The design and the reasons for each step are in ADR-0033
decision 6.

**What the owner ruled along the way** (each answered directly in session, each recorded as an `eigenaar:` line in
the ticket's Werklog): tickets in Dutch and the Art. II.6 amendment with its extension; follow-up stories only inside
an open epic; the functional architect works in an own clone, creates tickets as `nieuw`, may sharpen their text while
`nieuw`, and tests; the owner sets their status; sessions run only on his PC; the owner asks a session instead of
writing over a ticket it holds; the procedure for a PR he does not merge; the Dutch skill names; the one-time XI.1
waiver for this branch.
