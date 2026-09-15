# FB-038 — antagonist

One audit of `git diff 2e5b186..51ce752` (Art. X.7, XIII, ADR-0037).

**Verdict: COMPLIANT.** No CRITICAL or MAJOR finding. Four MINOR findings:

| # | Finding | Outcome |
| --- | --- | --- |
| 1 | ADR-0028 decisions 4 (every hoekplaatsing has a time) and 7 (hoeken drawn in the grid) became false, and ADR-0028 carried no pointer | Fixed in `b34a071`: ADR-0028's status names ADR-0044, ADR-0044's Supersedes line names both decisions, the index rows of 0044 too (0028 has no row of its own in the index) |
| 2 | `periodekiezer.alIngepland` ("de hoek loopt dan al") stayed as the default `bezetLabel` of a component only the algemene fiches use | Fixed in `b34a071`: `bezetLabel` is required and the key is gone |
| 3 | The sheet's own close controls stayed active while a save of two windows was running, so the second request's refusal would be shown nowhere | Fixed in `b34a071`: `onOpenChange` ignores a close while saving |
| 4 | On a phone, closing a hoek's sheet reopens the panel sheet and Radix focuses its first control, not the card that was pressed (WCAG 2.4.3, soft) | Not fixed: the create tile of TB-015 behaves the same way; both would change together in `Blad`. Listed here |

Checked clean by the antagonist: Art. II.3 and X.3 (every new string in `nl.json`), II.5 (no em dashes), VI.1 (server
rights unchanged; readers get no field, tile or link; algemene fiches planner-only), V.1 and IV (no dekking or AI path
touched), IX (model unchanged, no migration), the backend delete and its tests, no leftover references, every
conditional sentence guarded by its render condition, WCAG labels and target sizes, the supersede recorded without
rewriting a body, and the scope.
