# Antagonist verdict — E2-04

**Original verdict:** VIOLATIONS FOUND (1 MAJOR needing ratification; 2 MINOR; 1 QUESTION).
**Resolution:** the MAJOR was explicitly *"must be ratified, not silently introduced."* The directie (user) **ratified thema-level matching on 2026-07-13**; `CONSTITUTION.md` Art. IX.2 was amended to sanction `Thema.doelsuggesties[]`, E2-04's Done-when was narrowed to *"per thema"*, and activiteit-/subdoel-level matching was opened as fast-follow **E8-07**. With ratification in place the MAJOR is cleared and the story is accepted. The MINORs are advisory (see below).

---

## Verdict (as returned by the antagonist, verbatim)

**Verdict:** VIOLATIONS FOUND (1 MAJOR needing ratification; 2 MINOR; 1 QUESTION). The core behaviour is compliant and well-tested; the blocker is a data-model/scope decision that must be ratified, not silently introduced.

**Scope audited:** commit `f459d6e` vs base `a368fa5` on branch `story/E2-04`. 19 files across Application / Domain / Infrastructure / tests / worklog.

### Q1 — DoelKoppeling vs a parallel model
A `DoelKoppeling` entity already exists (`Domain/Schoolcontent/DoelKoppeling.cs`, the Art. IX.2 link, `LeerplandoelCode` + `Status` + `AiMotivatie`). **The implementer reused it** — `Thema.Doelsuggesties` is a `List<DoelKoppeling>` mapped via the shared `DoelKoppelingMapping.Configure`. So it is **not** a parallel model at the entity level (good). **However**, it introduces a new persisted attachment point (`Thema.Doelsuggesties` + table `thema_doelsuggesties`) not in the ratified Art. IX.2 Thema attribute set, at **school-wide thema scope**, which conflicts with Art. IV.8 (FR-4 = subdoel step 6) + Art. IX.2 Subdoel (class/age) scoping. Labelled an "Art. XIV open decision," but this granularity is **not** on the ratified Art. XIV list → premature schema commitment. → **MAJOR: must be ratified (amend Art. IX.2) or re-scoped to subdoel level.**

### Q2 — Art. IV.2 / IV.5 / III integrity — all COMPLIANT
- Everything persisted as `voorgesteld`; `Thema.VoegDoelsuggestieToe` throws on any other status; no path writes aanvaard/geweigerd (Art. IV.1/2).
- Malformed output → early failure, `BewaarAsync` never called; test `Malformed_json_persisteert_niets_en_geeft_een_fout` (Art. IV.5).
- Unknown/hallucinated codes skipped (`OvergeslagenOnbekend`), never fabricated; test present (Art. III.5/IV.4).
- Reference data read-only; FK to `leerplandoelen` is `onDelete: Restrict` (Art. III.1).

### Q3 — granularity ("per thema/activiteit")
Delivered thema-level only; the "activiteit" half leans on pre-existing E1-10 *manual* links (not AI matches). Same root as Q1.

### Findings
- **[MAJOR]** Thema-level suggestion bucket = unratified Art. IX.2 extension at a scope conflicting with Art. IV.8 / Art. IX.2 Subdoel scoping. *(Resolved by ratification 2026-07-13 — Art. IX.2 amended.)*
- **[MINOR]** "per activiteit" half of the criterion not delivered by the matching flow. *(Resolved — criterion narrowed to "per thema"; activiteit/subdoel → E8-07.)*
- **[MINOR]** Dutch developer/diagnostic strings (`ThemaNietGevondenFout`, `VoegDoelsuggestieToe` exception, `DoelMatchResultaat.Fout`) sit outside `nl.json`. No violation today (no UI layer); **when E2-05 surfaces them, map to `nl.json` keys** rather than echoing raw messages. *(Carry-forward note for E2-05.)*
- **[QUESTION]** `DoelMatchingService` public API changed (`VraagSuggestiesAsync` removed → `MatchThemaAsync`; ctor gained a dependency). Confirmed no out-of-worktree consumer relied on the old signature (E2-01 seam only, same feature line).

### Layering / migration / prompt-alignment — all sound
Port `IDoelMatchOpslag` in Application, `EfDoelMatchOpslag` in Infrastructure, domain behaviour on `Thema`; direction Domain ← Application ← Infrastructure respected. Migration `20260713194326_ThemaDoelsuggesties`: `Up` only creates `thema_doelsuggesties` (PK `{ThemaId, Id}`, FK→themas cascade, FK→leerplandoelen restrict, code index); `Down` drops just that table; no E1 table altered. Prompt alignment now demands exactly `{"suggesties":[{"code","motivatie"}]}` — matches the E2-03 parser contract.

DoD: worklog claims 285 tests pass + `dotnet format` clean (antagonist is read-only, did not execute — confirmed green by the test-runner and by the orchestrator on the merged tree: 273 unit + 12 integration).
