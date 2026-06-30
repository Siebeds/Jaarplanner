# Antagonist Review — E1-02 School-content entities (autonomous, level-scoped)

**Verdict:** COMPLIANT
**Scope audited:** the single E1-02 commit `e86f66d` diffed against the E1-01 tip `69211b9` (23 files: 9 new domain entities/enums under `Jaarplanner.Domain/Schoolcontent` + `Planning/Klas.cs`, 7 EF configs, the `SchoolContentEntities` migration + snapshot, `AppDbContext` additions, 2 test files, 1 worklog).

## Findings

No violations. One observation, nothing requiring a fix.

### [QUESTION] `Leeftijd` is a free-text `varchar(8)` rather than a constrained type
- **Article/FR:** Art. II / Art. XIV (jaarFase codes open decision)
- **Where:** `Subthema.cs:61`, `Subdoel.cs:34`; `SubthemaConfiguration.cs:30`, `SubdoelConfiguration.cs:20`
- **Observation:** `Leeftijd` is a required `string` (max 8). Tests use `"K3"` (JK/K2/K3 form), but Art. XIV leaves open whether Excel col F uses `1K/2K/3K` or `JK/K2/K3`. Free text is the correct non-committal choice (isolate behind a seam). Flagging only so the team knows no enum/whitelist enforces valid leeftijd values yet — that belongs to a later story once the decision resolves. Not a violation.

## Checks run (proof of thoroughness)

- **Art. IX.2 — model shape & level scoping.** All prescribed entities/fields present. Themadoel 2–3: upper bound (3) enforced in `Thema.VoegThemadoelToe`; 2-minimum left to authoring time (E1-10). **Scoping is structural, not advisory:** `Subthema.KlasId` required non-nullable FK to `Klas` (ctor rejects `Guid.Empty`), EF `IsRequired()` + DB FK; `Subthema.Leeftijd`/`Subdoel.Leeftijd` non-nullable. School-scoped Thema/Themadoel/kernwoordenschat carry **no** class FK. Subdoel/Activiteit inherit class scope via Subthema (cascade).
- **Art. IV — AI advisory.** `KoppelingStatus` enum has exactly the four prescribed states; `aiMotivatie` captured on every `DoelKoppeling`; status persisted by name. `WijzigStatus` is the only status mutator (teacher decision); nothing auto-finalises. No AI client introduced (deferred to E2 — no scope creep).
- **Art. III — curriculum immutability.** `git diff` shows zero changes to `Domain/Curriculum/*` or curriculum EF configs. `DoelKoppeling` references `Leerplandoel` only by stable `Code` via read-only FK `OnDelete(Restrict)` — links, never mutates. Migration only `CreateTable`s new tables + FKs into `leerplandoelen`; no ALTER/DROP.
- **Art. II — Dutch domain language.** Entities/fields/methods all Dutch; infra/comments English. Dutch text in domain exception messages is developer-facing, not UI copy (Art. II.3 / nl.json N/A). No i18n files touched.
- **Art. VI — privacy/secrets.** No secret files; `Klas` holds only naam + leerjaar; `Leeftijd` is an age-band code, not a birthdate. No pupil PII — group-level scoping, MVP-compliant.
- **Art. VIII — tech stack/layering.** EF Core + Npgsql, Postgres types (`uuid`, `text[]`). Domain entities in `Jaarplanner.Domain`; mapping in `Infrastructure`; `Api`/`Application` untouched. `DoelKoppelingMapping` keeps the link's column shape in one place (no duplication). No EPPlus, no new deps.
- **Art. X — DoD.** Worklog: format clean, build 0/0, 73 unit + 7 integration green, migration DDL validated via `ef migrations script --idempotent`. New tests pin the headline scoping criterion.
- **Scope creep check.** No Excel import (E1-07), no API/controllers/UI (E1-10), no shared-library/coverage logic (E1-11), no AI matching (E2), no Jaarplan/Schooljaar/planningsblok model. `Klas` deliberately minimal. Clean.

## Open questions surfaced
- **Art. XIV — jaarFase/leeftijd codes (`1K/2K/3K` vs `JK/K2/K3`).** `Leeftijd` intentionally free-text; resolve before any leeftijd-based coverage roll-up is built.

The change is consistent with the constitution. No findings to address or waive.
