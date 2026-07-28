# E3-05 — Antagonist

**Status: RUN 2026-07-28 — verdict VIOLATIONS FOUND. See below.**

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

---

## Verdict — 2026-07-28: **VIOLATIONS FOUND** (6 MAJOR, 5 MINOR, 1 QUESTION)

The auditor re-derived the block grid independently (its own re-implementation of `Blokken` +
`Lesperiodes`) rather than reading the code and inferring, so the numbers below are computed.

**E3-05 stays `[~]`. Three of the six MAJOR findings are demonstrated defects in shipped code, not drift.**
Per Art. X.7 they must be fixed or explicitly waived by the user.

### MAJOR 1 — the documented default grid emits 1-week "themaperioden", outside the ratified 4–6 wk range
`GeconfigureerdePlanningsblokIndeling.cs:72-91` + `PlanningsblokOptions.cs:33,46`. Over the project's own
fixture year with **default** options the grid is 10 blocks, of which P4/P6/P8 are **7 days (1,0 wk)** and P2
is 27 days (3,9 wk). `MinimumBlokDagen = 5` does not catch them because 7 > 5. With `ThemaperiodeWeken = 6`
absorption also breaches the *upper* bound (46 days, 6,6 wk). **No test asserts any block's `AantalDagen`.**
*Independently found while building the E3-10 wireframe with real dates — see
[`docs/ux/wireframes/e3-10-kalender.md`](../../../docs/ux/wireframes/e3-10-kalender.md).* Distributing each
stretch over `round(stretchdagen / blokdagen)` near-equal blocks gives 7 blocks, all 4,4–6,0 wk.

### MAJOR 2 — the two tiers do not nest
`GeconfigureerdePlanningsblokIndeling.cs:57-95` chops each tier independently from the same stretches, so a
`Subthemaperiode` straddles a `Themaperiode` boundary (fixture: fine block `29 sep–12 okt` crosses the coarse
boundary `5/6 okt`). That contradicts `Planningsblokniveau.cs:7-8` ("subdivided into"), makes E3-08's "zoom
into a themaperiode" incoherent, and makes E3-01's "thema in a period, its subthema's in that period's
subthemaperioden" unimplementable. **The E3-10 wireframe's zoom strip assumes nesting** — so the artifact and
the code currently disagree.

### MAJOR 3 — `Ordinaal` is not the stable key it is documented to be
`Planningsblok.cs:12-16,43-44` claims the ordinal "stays stable when a school later shifts its vacation dates
by a few days". Demonstrated false: moving **only the kerstvakantie start by one day** flips the grid between
9 and 10 blocks, and `Ordinaal 5` moves from 8–14 feb to 4 jan–7 feb. A thema attached to "period 5" silently
relocates. Latent today (no `Jaarplan` persists placements) — **becomes CRITICAL the moment E3-07 stores it.**
I wrote that stability claim in the entity doc, the worklog and the commit message; it is wrong.

### MAJOR 4 — "default is documented, not compiled-in" is not actually met
`appsettings.json` is **untouched**: there is no `Planning:Blokindeling` section anywhere. The values are C#
property initialisers compiled into the assembly — *overridable*, so "configurable behind a seam" holds, but
not *documented in configuration space*. The ADR-0019 precedent this story claims to mirror carries a
`_comment` **and** the values in `appsettings.json:8-15`. The worklog and test-report record this AC as met;
that overstates what was built.

### MAJOR 5 — the ADR-0013 deviation was not recorded as a decision
ADR-0013 places granularity as "configuration on the `Schooljaar`"; the implementation splits it (breaks =
schooljaar data, lengths = per-deployment config), so two schooljaren in one deployment cannot differ. That
is defensible but is documented only in a worklog bullet — `docs/adr/` is untouched, and `CLAUDE.md` requires
recording a significant decision as an ADR.

### MAJOR 6 — the short-tail absorption policy is an invented answer, hard-coded
`GeconfigureerdePlanningsblokIndeling.cs:80-87`. Only the *threshold* is configurable; the *policy*
(greedy-chop-from-front, absorb tail backwards) is compiled in, and is the direct cause of findings 1 and 3.
Competing policies give materially different grids and choosing between them is a pedagogical question
Art. XIV reserves for directie. I flagged this myself as "mine, not ADR-0013's" — the auditor's point is that
flagging it is not sufficient when it is the compiled-in default of the very seam meant not to pre-empt.

### MINOR findings
- Whole stretches shorter than `MinimumBlokDagen` still emit a stub block, so the stated justification is
  enforced only for tails (`:82`).
- `record` value-equality covers all four properties, contradicting "identity is the ordinal"
  (`Planningsblok.cs:19` vs `:43-44`).
- `AantalDagen`'s doc says a span "may include a short vacation" — impossible by construction (`:52-56`).
- Art. IX.3's "Schooljaar contains multiple klassen" is unimplemented and **no story owns it** (the worklog's
  deliberate-omissions list does not mention it).
- No configuration-*binding* test, unlike the ADR-0019 precedent (`OpstapImportDisciplineSelectieTests.cs:118-139`)
  — so the section path `Planning:Blokindeling` and the property names are exercised by nothing.
- `Omschrijving` returns composed Dutch prose from Infrastructure. **Ruled not a violation today** (identical
  in kind to the accepted `GeconfigureerdeDisciplineSelectie.Omschrijving`), but if E3-06/E3-08 renders it as
  a UI label, the label must come from `nl.json` with the numbers as parameters.

### Confirmed clean (the auditor's own checks)
- **"No month anywhere in planning" is true in fact** — 16 grep hits for `maand|month`, every one prose in a
  comment explaining the prohibition; zero in code, zero in the frontend. No `DateTime.Month` access, no
  `planningsblokken` table.
- **`Lesperiodes()` arithmetic is sound** — hand-verified for a vacation on the first school day, on the last
  school day, two adjacent vacations, and a whole-year vacation. Never emits an invalid or zero-length period.
- `Vakanties`' fresh-allocation projection is not a correctness or performance trap; `Schoolvakantie` is
  effectively immutable and no invariant depends on the projection.
- The `"_vakanties"` string mapping is a reasonable EF idiom — a field rename fails loudly at model-build.
- Layering correct and **not** over-engineered; no new package references; `Dekking` still computed-not-stored;
  Art. III/IV/VI/VII untouched; Dutch domain naming correct throughout; no hard-coded Dutch in components.
- Bookkeeping honest: `[~]`, the test-report separating executed from skipped tests, and this file's earlier
  "NOT YET RUN" were all judged correct.

### The gate the auditor is most pointed about
> "The tests confirm the implementation's shape; they do not falsify it."

`PlanningsblokIndelingTests.cs:29-30` asserts only `subthemaperiodes.Count > themaperiodes.Count` under a
comment claiming the fine tier subdivides the coarse one — a strictly weaker assertion than the property, and
**the property is false** (MAJOR 2). Nothing asserts block duration (MAJOR 1) or ordinal stability (MAJOR 3).
