# Jaarplanner — Backlog & Planning

This is the working backlog for the Jaarplanner build. It is **derived from** and **subordinate to**:
1. [`CONSTITUTION.md`](../CONSTITUTION.md) — binding principles (wins on any conflict).
2. [`docs/Functionele_Analyse_Jaarplanner.md`](../docs/Functionele_Analyse_Jaarplanner.md) — scope (FR/NFR).
3. [`docs/Gap-analyse_Opstap_referentie.md`](../docs/Gap-analyse_Opstap_referentie.md) — ratified refinements.
4. [`docs/adr/`](../docs/adr/README.md) — architecture decisions; [`docs/ux/ui-ux-approach.md`](../docs/ux/ui-ux-approach.md) — UI/UX approach.

> If a story here ever contradicts the constitution, the **constitution wins** — fix the story. When scope is clarified or a decision is made, update the relevant epic *and* the source documents.

## How to use this backlog

- Each **epic** is one `.md` file, aligned to the build order in [`CONSTITUTION.md` §9.3 / Art. VIII](../CONSTITUTION.md).
- Each epic holds **stories** with a stable id (`E<epic>-<nn>`), a checkbox status, acceptance criteria, and references to the FR + Constitution article it satisfies.
- **Update the checkbox when status changes** and keep the progress table below in sync. The Antagonist audits significant changes against the constitution — keep stories honest.

### Status legend
- `[ ]` **Todo** — not started
- `[~]` **In progress**
- `[x]` **Done** — implemented, tested, Antagonist-clean
- `[!]` **Blocked** — waiting on an Open Decision (Art. XIV) or another story

## Epics & progress

| Epic | File | Phase | Stories | Done | Status |
| --- | --- | --- | --- | --- | --- |
| E0 — Project foundation & scaffolding | [E0-foundation.md](E0-foundation.md) | 0 (pre) | 9 | 9 | ✅ Done |
| E1 — Curriculum & content fundament | [E1-curriculum-content.md](E1-curriculum-content.md) | 1 | 13 | 9 | ⚠️ E1-03/04 blocked on E1-12 (needs the source file from directie); E1-13 owns FR-1.2's unbuilt UI half |
| E2 — AI-matching thema ↔ doel | [E2-ai-matching.md](E2-ai-matching.md) | 2 | 7 | 7 | ✅ Done |
| E3 — Jaarplan-generatie & kalender | [E3-jaarplan-kalender.md](E3-jaarplan-kalender.md) | 3 | 10 | 2 | 🚧 E3-05 + E3-10 done; E3-01 is next |
| E4 — Manuele bewerking & (her)generatie | [E4-bewerking-hergeneratie.md](E4-bewerking-hergeneratie.md) | 4 | 7 | 0 | Todo |
| E5 — Dekking & export | [E5-dekking-export.md](E5-dekking-export.md) | 5 | 9 | 0 | Todo |
| E6 — Beheer, rollen & samenwerking | [E6-beheer-rollen-samenwerking.md](E6-beheer-rollen-samenwerking.md) | 6 | 9 | 0 | Todo |
| E7 — Niet-functioneel & overkoepelend | [E7-niet-functioneel.md](E7-niet-functioneel.md) | cross-cutting | 11 | 0 | ⚠️ E7-11 is a deployment gate |
| E8 — Fast-follow (post-MVP) | [E8-fast-follow.md](E8-fast-follow.md) | post-MVP | 7 | 0 | Todo |
| **Totaal** | | | **82** | **27** | **33%** |

> **Correction (2026-07-27).** A code review of the E1+E2 branch before merging to `main` reopened
> **E1-03**, **E1-04** and **E1-07**: each was marked done with an acceptance criterion that cannot
> currently be met (no `Minimumdoel` is ever created, so minimumdoel-level coverage — the level the
> inspectie tests — returns nothing; and there is no Excel-upload endpoint). Count corrected 27 → 24.
> The root cause the review identified is that **no test ran against PostgreSQL** — the EF in-memory
> provider enforces no FKs, unique indexes or collation, so these defects passed CI. That is fixed:
> `backend/tests/Jaarplanner.IntegrationTests/Postgres/` runs against a real server, and CI now fails
> rather than skipping when no database is configured.

## Milestones (MVP)

- **M0 — Skeleton up** (E0): repo scaffolded, Postgres + API + SPA run locally, CI green.
- **M1 — Fundament** (E1): Op.stap goals imported, school thema's imported & manageable, data model live. — ⚠️ **not yet reached** (previously claimed). Two distinct gaps remain:
  1. **The curriculum half.** No `Minimumdoel` can exist, so minimumdoel-level coverage — the level the inspectie tests — returns nothing. Gated on **E1-12**, which needs the decreed-eindtermen source file from directie; that unblocks E1-03/04.
  2. **The teacher-facing half of the import.** **E1-07 closed 2026-07-28**, proven **from HTTP to PostgreSQL** in CI — *not* user-to-screen. There is no import UI: nothing renders the per-row foutmeldingen that FR-1.2 requires the tool to *show*. Tracked as **E1-13**.
  > *An earlier revision of this line said the upload half was "proven end-to-end", which the antagonist audit of 2026-07-28 correctly called an overstatement: for a product whose users are non-technical teachers, end-to-end means teacher → screen, and what was proven was HTTP → database. Corrected, and E1-13 added to own the rest — the same failure mode as the 2026-07-27 correction below, caught one step earlier this time.*
- **M2 — AI koppelt** (E2): teacher gets accept/reject thema↔doel suggestions with motivation.
- **M3 — Plan & kalender** (E3): a year plan is generated and shown in the drag-and-drop calendar.
- **M4 — Volledige controle** (E4): manual edits + full/partial regeneration with locked blocks.
- **M5 — Bewijs van dekking** (E5): coverage down to minimumdoel level, exportable.
- **M6 — School-breed** (E6): admin, roles/permissions, cross-class overviews, collaboration view.
- **MVP complete** = M0–M6 + E7 (non-functional) satisfied.

## Open decisions that gate stories (see [Art. XIV](../CONSTITUTION.md#article-xiv--open-decisions-awaiting-directie))

Stories blocked on these are marked `[!]`:
- ~~Planningsblok granularity~~ — **RESOLVED (directie 2026-07-14):** two-tier default = themaperiode (4–6 wk) + subthemaperiode (~2 wk), configurable behind a seam (E3-05); never hard-assume months.
- Disciplines first (all vs. starter selection); `cluster` presence per discipline.
- `leergebied`/Wereldoriëntatie surfacing & mapping; `jaarFase` code form (1K/2K/3K ↔ JK/K2/K3).
- Op.stap import source (manual per-discipline Excel vs. automated).
- ~~Minimumdoel source~~ — **RESOLVED (2026-07-28): a separate decreed-minimumdoelen import.** `Minimumdoel` requires an `omschrijving` (Art. IX.1) that **neither** documented Op.stap source carries — the ordeningskader has only Discipline→Domein→Subdomein, and the per-discipline goal Excel's A–M mapping has no such column (Art. VII.1), only the concordance key (B/C/D). Decision: a **second import path** for the decreed eindtermen (ref + leeftijd + nr + omschrijving), keeping Art. IX.1 unchanged and the curriculum read-only (Art. III.1). Tracked as **E1-12** below; it needs directie to supply the source file. Until E1-12 lands, every MD-concorded leerplandoel still fails its FK on insert, so **E1-03/E1-04 stay `[~]`**.
- Teacher visibility scope; export formats & layouts; coverage depth (binary vs. herhaling/opbouw).

### Surfaced by the E3-05 antagonist audit of 2026-07-28 (need a ruling, not a guess)

- ~~What happens to a teaching stretch too short for a full themaperiode?~~ — **RESOLVED (directie 2026-07-28): distinguish a *vakantie* from a *vrije dag*.** The problem was never really "short stretches" — it was that every closure was treated as a period boundary, so Hemelvaart + brugdag and Pinkstermaandag chopped May into slivers and left a one-week "themaperiode" nobody can plan a thema into. The school now classifies each closure when entering the calendar: a **`Vakantie`** (herfst, kerst, krokus, paas) ends a planning period; a **`VrijeDag`** (Hemelvaart, Pinkstermaandag, pedagogische studiedag, facultatieve vrije dag) is a day off *inside* a period and leaves the grid intact. No invented threshold — the answer lives in data the school owns, and "a planningsblok never spans a vakantie" becomes exactly true rather than approximately true. Implemented in E3-05 (`Sluitingssoort`, `Schoolsluiting`); recorded in [ADR-0020](../docs/adr/0020-planningsblok-derivation-rules.md).
  *Residual:* a genuine long gap can still leave a stretch too short for one themaperiode (e.g. a school closing for three weeks mid-year). That yields one short block, asserted by test. It is now a rare edge rather than a routine May occurrence, so it is accepted rather than tracked as open.
- ~~What happens to an existing jaarplan when a school edits its vakantiedata?~~ — **RESOLVED (directie 2026-07-28): flag it loudly; never move it silently.** Blocks are derived, so editing a vacation reshapes the grid and a stored thema placement can end up pointing at a date that is no longer a block boundary. The ruling:
  1. **Never silently relocate a teacher's thema.** The application does not guess a new period. A stale placement keeps its stored date and is marked as needing attention.
  2. **The signal must be impossible to ignore and impossible to dismiss.** Not a toast, not a badge tucked in a corner: a persistent notification on the jaarplan that stays until every affected placement is resolved by a human. "Fix later" is not an option the UI offers.
  3. **It must be resolved as soon as possible**, so the flag names exactly which thema's are affected and offers the re-placement action inline.
  4. **Coverage must not claim what it cannot prove.** A jaarplan with unresolved stale placements cannot report trustworthy dekking, because a thema whose period is unknown is not demonstrably taught in the school year. Until resolved, the dekkingsoverzicht and any export mark the figure as **onbetrouwbaar / te herzien** rather than showing a number that would mislead an inspectie (Art. V.2, and the same spirit as Art. III.4's review report for curriculum re-import).
  *Implementation is split:* **E3-07** detects and persists (placements key on the block's start date, per [ADR-0020](../docs/adr/0020-planningsblok-derivation-rules.md)); **E3-09** renders the non-dismissible flag; **E5** must honour point 4.

### Surfaced by the earlier antagonist audit of 2026-07-28 — E1 remediation (need a ruling, not a guess)

- **Art. II.3 — where do user-facing Dutch diagnostics live?** Three documents currently disagree and cannot all hold: Art. II.3/X.3 say Dutch UI text belongs in `frontend/src/i18n/nl.json`; `frontend/src/lib/api.ts` states the client "never echoes a raw backend message to the teacher"; yet FR-1.2's whole value (row numbers, offending column, the unknown codes, the ignored themadoel codes) **can only** be delivered by displaying `problemen[].melding` and `diff.opmerkingen[]` verbatim. Options: (a) amend Art. II.3 to scope it to UI chrome and permit server-generated diagnostics; (b) restructure the payload as machine-readable codes + parameters the UI renders from `nl.json`. Until ruled, the backend keeps growing as a second source of Dutch copy.
  **Migration cost, so it is visible when directie rules (updated 2026-07-28):** the prediction in the line above is now measurable. Under option (b) `diff.opmerkingen` stops being `string[]`, so every test that substring-matches it must be rewritten. There are now **four** endpoint tests in `SchoolcontentImportEndpointsTests` whose shape presumes option (a), one of which (`Geldig_bestand_dat_inhoud_laat_vallen_is_niet_volledig_verwerkt`) asserts on `diff.opmerkingen[]` directly. **The ruling is still genuinely free** — the frontend consumes none of this yet (zero references, no import keys in `nl.json`), so option (b) costs backend + test changes only, with no UI rework. That freedom ends when **E1-13** ships, which is why E1-13 is written to isolate the rendering behind one formatter module. Ruling before E1-13 is materially cheaper than after.
- **Discipline 9's official name / the 9.x nesting.** The Art. VII.0 list has no bare `"9"` row and never names it, so 9.1/9.2/9.3 are seeded with `parentDiscipline = null` and **nothing** in the codebase ever sets that column. Art. XII meanwhile describes 9 as a subject that *is split*. Directie to supply discipline 9's official name, or confirm 9.1/9.2/9.3 are genuinely top-level. Until then any UI grouping of 9.x is impossible.
- **Does seeding the full taxonomy pre-empt "disciplines first"?** The migration seeds all 13 disciplines unconditionally, without consulting the [ADR-0019](../docs/adr/0019-discipline-selection-config-seam.md) `IDisciplineSelectie` seam. The reading taken is that the seam scopes which disciplines' **goals** are imported, while the discipline rows are the authoritative taxonomy (Art. VII.0) that the FK cannot do without. Consequence to confirm: any UI listing `disciplines` will show all 13, so a later "starter selection" answer becomes a filtering concern rather than a config change.
- **Is "2–3 themadoelen" (Art. IX.2) a range or just a maximum?** Only the upper bound (3) exists in code. A thema imported with 0 or 1 themadoel lands silently, un-anchored, while an over-anchored one is reported. Either the minimum should be reported too, or Art. IX.2 should say 2 is a pedagogical guideline rather than an invariant.
