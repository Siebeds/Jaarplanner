# E3-05 — Antagonist

**Status: NOT YET RUN.**

The independent antagonist audit has not been performed for E3-05. The previous story's round-3 audit
demonstrated concretely why that matters: the self-audit there returned "compliant" and missed three real
code defects that the real antagonist found.

Do not treat E3-05 as Antagonist-clean until this file carries a real verdict.

Suggested scope when it runs — the change is `git diff feature/e1-import-en-remediatie...HEAD`:
- **Art. IX.3 / ADR-0013 / Art. XIV** — is the grain genuinely a configured outcome, or does something still
  presuppose a unit? Is "no month anywhere" true in fact (grep the diff, not just the enum)?
- **Art. IX.3** — does deriving blocks rather than storing them lose anything E3-01/E3-06/E3-07 will need
  (notably a stable identity for drag-and-drop to attach to)?
- **Art. VIII** — layering: Domain ← Application ← Infrastructure. `IPlanningsblokIndeling` sits in
  Application and its implementation in Infrastructure; is the `Schooljaar` owned-collection mapping via the
  `"_vakanties"` backing-field string a reasonable EF idiom or fragile ceremony?
- **Art. II** — Dutch domain names (`Planningsblok`, `Schooljaar`, `Schoolvakantie`, `Lesperiodes`) with
  English infrastructure; no user-facing Dutch introduced (this story adds no UI copy — confirm).
- **Art. X** — 3 of 18 new tests are unrunnable locally; is the story's `[x]` justified on the executed 15?
- **Judgement call to challenge:** absorbing a short tail into the preceding block is a pedagogical
  heuristic that is *not* stated in ADR-0013 or the constitution. Is inventing it here defensible, or should
  it have been surfaced as an open question?
