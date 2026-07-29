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
| E0 — Project foundation & scaffolding | [E0-foundation.md](E0-foundation.md) | 0 (pre) | 10 | 9 | ⚠️ Reopened 2026-07-29 — **E0-10 `[~]`**: the app shell no story owned. Built on `story/E0-10` (58 tests green, lint + build clean, [ADR-0021](../docs/adr/0021-frontend-routing-and-url-selection.md) recorded first); open because **nobody has looked at the screen yet** and the test-runner/antagonist gates have not run |
| E1 — Curriculum & content fundament | [E1-curriculum-content.md](E1-curriculum-content.md) | 1 | 15 | 9 | ⚠️ E1-03/04 blocked on E1-12 (source file from directie); **E1-13 + E1-14 own the unbuilt UI halves of FR-1.1–1.5, FR-2.5, FR-3.1/3.2**; **E1-15** owns the missing Op.stap import trigger |
| E2 — AI-matching thema ↔ doel | [E2-ai-matching.md](E2-ai-matching.md) | 2 | 8 | 7 | ⚠️ **M2 withdrawn** — FR-4.1 has no trigger: matching is unreachable outside unit tests. **E2-08** owns it |
| E3 — Jaarplan-generatie & kalender | [E3-jaarplan-kalender.md](E3-jaarplan-kalender.md) | 3 | 10 | 4 | 🚧 E3-01 + E3-02 + E3-05 + E3-10 done; **E3-06 `[~]`** — draft verified end-to-end in a browser 2026-07-29 but **not yet reviewed**; it closes only when the directie/teacher session happens and is captured. E3-03 is blocked (its criterion measures coverage in E5, unbuilt); E3-04, or E3-07 after the review, is next |
| E4 — Manuele bewerking & (her)generatie | [E4-bewerking-hergeneratie.md](E4-bewerking-hergeneratie.md) | 4 | 7 | 0 | Todo |
| E5 — Dekking & export | [E5-dekking-export.md](E5-dekking-export.md) | 5 | 9 | 0 | Todo |
| E6 — Beheer, rollen & samenwerking | [E6-beheer-rollen-samenwerking.md](E6-beheer-rollen-samenwerking.md) | 6 | 9 | 0 | Todo |
| E7 — Niet-functioneel & overkoepelend | [E7-niet-functioneel.md](E7-niet-functioneel.md) | cross-cutting | 13 | 0 | ⚠️ E7-11 is a deployment gate; **E7-12** `[~]` — advisory cleared, the two CI clauses that stop it recurring are still open; **E7-13** owns an Art. VIII layering leak (`ISchoolcontentParser` port sits in Infrastructure) |
| E8 — Fast-follow (post-MVP) | [E8-fast-follow.md](E8-fast-follow.md) | post-MVP | 7 | 0 | Todo |
| **Totaal** | | | **88** | **29** | **33%** |

> **Correction (2026-07-27).** A code review of the E1+E2 branch before merging to `main` reopened
> **E1-03**, **E1-04** and **E1-07**: each was marked done with an acceptance criterion that cannot
> currently be met (no `Minimumdoel` is ever created, so minimumdoel-level coverage — the level the
> inspectie tests — returns nothing; and there is no Excel-upload endpoint). Count corrected 27 → 24.
> The root cause the review identified is that **no test ran against PostgreSQL** — the EF in-memory
> provider enforces no FKs, unique indexes or collation, so these defects passed CI. That is fixed:
> `backend/tests/Jaarplanner.IntegrationTests/Postgres/` runs against a real server, and CI now fails
> rather than skipping when no database is configured.

> **Correction (2026-07-29).** Asked what it would take to have an application users can click
> through, a sweep of E0–E8 found that **no story owned the app shell** — routing, a primary
> navigation, and choosing a klas/schooljaar from a list rather than pasting a GUID. The only trace
> of navigation in any planning document is a single line in `docs/ux/ui-ux-approach.md` §3 with no
> story behind it. Meanwhile every feature built so far has been appended to `App.tsx`, which now
> stacks the kalender and the matching review in one flex column, and a klas is selected by pasting
> a GUID into a text input. Added as **E0-10**, which reopens E0 (9/10).
> This is the third instance of one failure mode — **E2-08**, **E1-15**, now E0-10 — and the
> sharpest, because the missing piece is *where the other unbuilt screens were supposed to go*.
> The pattern to name: the stories were written per-FR, and a shell satisfies no FR by itself, so
> nothing claimed it. Worth asking of any remaining infrastructure that no FR names.

## Milestones (MVP)

- **M0 — Skeleton up** (E0): repo scaffolded, Postgres + API + SPA run locally, CI green. — **still reached**, deliberately: M0's wording is about a running skeleton and that is true. E0 as an *epic* is no longer complete (E0-10), but claiming M0 regressed would be as inaccurate as the claims this backlog keeps having to retract. The shell is a gap in the epic, not in the milestone.
- **M1 — Fundament** (E1): Op.stap goals imported, school thema's imported & manageable, data model live. — ⚠️ **not yet reached** (previously claimed). Two distinct gaps remain:
  1. **The curriculum half.** No `Minimumdoel` can exist, so minimumdoel-level coverage — the level the inspectie tests — returns nothing. Gated on **E1-12**, which needs the decreed-eindtermen source file from directie; that unblocks E1-03/04.
  2. **Everything teacher-facing in E1.** `frontend/src/features/` contains exactly one directory — `matching` (E2). **E1 has no UI at all.** Its stories are `[x]` on server-side evidence, and **seven** FRs name a user action or a display that consequently does not exist: FR-1.1/1.2/1.3/1.4/1.5 (upload, per-row foutmeldingen, preview, add-vs-overwrite choice, sjabloon download), FR-2.5 (the review notice *signaleert*) and FR-3.1 (*leerkrachten kunnen* thema's toevoegen/wijzigen/verwijderen). Tracked as **E1-13** (import flow) and **E1-14** (beheer screens); each affected story now carries an explicit *Scope boundary* note.
  > *Two corrections, both from antagonist audits on 2026-07-28.* First, this line claimed the upload half was "proven end-to-end" — an overstatement: for non-technical teachers end-to-end means teacher → screen, and what was proven was HTTP → database. Second, the correction itself named only **one** teacher-facing gap (FR-1.2) when the same defect sat in E1-05, E1-08, E1-09 and E1-10 — the instance was fixed while the class was left standing. That is the same failure mode as the 2026-07-27 correction below, on its third iteration. **The general lesson, now recorded: an `[x]` earned by a passing API test does not retire an FR whose wording names a user.** Check the verb — *toont*, *signaleert*, *krijgt de gebruiker*, *kan de gebruiker kiezen*, *leerkrachten kunnen* — before marking done.
- **M2 — AI koppelt** (E2): teacher gets accept/reject thema↔doel suggestions with motivation. — ⚠️ **NOT reached; the claim is withdrawn (2026-07-28, third antagonist audit).** The accept/reject/adjust UI exists and works (`frontend/src/features/matching`), but **nothing can ever produce a suggestion for it to show.** `DoelMatchingService.MatchThemaAsync` — the FR-4.1 *"de tool **stelt voor**"* entry point — is invoked from exactly one place in the repository: its own unit tests. No controller, no hosted service, no frontend action calls it, so in a deployed app the list would always render `matching.leeg`. The integration test seeds suggestion rows directly, bypassing generation, so no test covers the gap either. A teacher therefore does **not** get suggestions, which is precisely what this milestone asserts. Tracked as **E2-08**. *Note the asymmetry that hid this: E2-07's wizard-assist endpoints do exist, so the epic looked wired up.*
- **M3 — Plan & kalender** (E3): a year plan is generated and shown in the drag-and-drop calendar.
- **M4 — Volledige controle** (E4): manual edits + full/partial regeneration with locked blocks.
- **M5 — Bewijs van dekking** (E5): coverage down to minimumdoel level, exportable.
- **M6 — School-breed** (E6): admin, roles/permissions, cross-class overviews, collaboration view.
- **MVP complete** = M0–M6 + E7 (non-functional) satisfied.

## Open decisions that gate stories (see [Art. XIV](../CONSTITUTION.md#article-xiv--open-decisions-awaiting-directie))

> **Forwardable version:** [`docs/besluiten-gevraagd.md`](../docs/besluiten-gevraagd.md) states the directie-facing
> asks in plain Dutch, ordered by urgency, with the consequence of leaving each one open. Send that; keep this
> section as the engineering-side record.

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
  **The conflict is constitutional, and option (a) is an amendment (settled 2026-07-28, third audit).** Art. II.3 reads, in full: *"**All user-facing strings are Dutch** and centralised in `frontend/src/i18n/nl.json`. Never hard-code Dutch text in components."* Art. X.3 repeats it with no component scoping: *"No user-facing Dutch text hard-coded — **everything** in `nl.json`."* A `problemen[].melding` rendered to a teacher is a user-facing string that is not in `nl.json`, so **Art. II.3 does forbid it** — via its first clause.
  > *Retraction.* A previous revision of this entry quoted only the second sentence, concluded "the literal text of Art. II.3 does not forbid it", and priced option (a) as "mostly a documentation clarification". Both were wrong, and wrong in the direction that made the decision look cheaper than it is. Option (a) means amending Art. II.3 to scope it to UI chrome — which **Art. XI.1 requires to be a dedicated amendment commit**, however small the wording change. The `api.ts` convention ("never echoes a raw backend message to the teacher") is an *additional* constraint that is project convention, not constitution; that half of the earlier claim was accurate. The original framing — "three documents disagree and cannot all hold" — was right.
  **Migration cost, so it is visible when directie rules:** under option (b) `diff.opmerkingen` and `problemen[].melding` stop being free text, so every test substring-matching them must be rewritten. That is **three** tests in `SchoolcontentImportEndpointsTests` — `Ongeldige_rij_wordt_precies_gerapporteerd_en_geldige_rij_gaat_door` and `Verwisselde_koprij_importeert_niets` (both on `problemen[].melding`) and `Geldig_bestand_dat_inhoud_laat_vallen_is_niet_volledig_verwerkt` (on `diff.opmerkingen[]`). The file's other four tests assert only booleans, `rijNummer`, emptiness or HTTP status, and survive option (b) untouched. *(An earlier revision said "four" — that was the count of stale `isGeldig` assertion lines fixed in `5d6f087`, a different quantity. A number offered as the measure of a decision's cost has to be counted, not recalled.)*
  **The cost has already moved once (2026-07-29, E3-01 audit).** The conflict is no longer confined to the *import* surface. E3-01 added **nine** new server-generated Dutch user-facing strings on the *planning* surface — in `JaarplanGeneratieService`, `SchooljaarBeheerService`, `Schooljaar`'s argument guards, and `JaarplanController` — plus a **new `PlanningExceptionHandler` whose job is to emit them**. So option (b) now means restructuring two payload families and a dedicated handler, not three import tests. This is the entry doing its job: *a decision whose cost grows every story is a decision that gets taken by default.* Each future story that emits Dutch from the backend should add a line here.
  **The ruling is still free of *UI* rework** — the frontend consumes none of this (zero references, no import keys in `nl.json`), so option (b) is still backend + tests only. That ends when **E1-13** ships, which is why E1-13 is written to isolate rendering behind one formatter module. Ruling before E1-13 is materially cheaper than after, and cheaper today than it was yesterday.
  > **⚠️ The paragraph above came within one line of being false, and E1-13 was not what nearly falsified it (2026-07-29, E3-06 audit).** E3-06's kalender rendered `PlanningsroosterWeergave.Blokindeling` — a Dutch label authored in `GeconfigureerdePlanningsblokIndeling` — straight into the page header. That would have made **E3-06**, not E1-13, the story that put server-generated Dutch in front of a user and put UI rework inside option (b). It was caught in audit and **reverted**: the kalender now explains the grain from `nl.json` (`kalender.indelingUitleg`) and displays no server string, so option (b) remains backend + tests only. Two lessons worth keeping: the trigger was **not** the story this entry predicted, so "cheaper before E1-13" understates the urgency — *any* new screen can spring it; and a `blokindeling`-style descriptive label is exactly the shape that looks harmless and is not.
  > **New backend Dutch added by E3-06** (per this entry's own instruction to log it): `PlanningsroosterService`'s `"Schooljaar {id} is niet gevonden."` fault, and `DemoDataSeeder`'s 7 `Motivaties` + its `Voorbeeldmarkering` prefix. The seeder's strings *are* teacher-visible (they land in `AiMotivatie` and render on a card), which makes them the first **demo-fixture** Dutch to reach a user — a third category this entry did not anticipate, and one that argues for option (c)'s actionable/diagnostic split being insufficient on its own.
  **A third option has appeared in the code without anyone choosing it (2026-07-29, E3-01 audit) — ratify or reject it.** E3-01 made its AI-failure 422 **English** on the stated reasoning that translating `"Malformed JSON: …"` would mean inventing new backend Dutch, while the *same commit* added new Dutch teacher-facing text in `KlasBeheerService`. The audit judged the English payload defensible on its own terms (it is internally consistent, and Art. II.3 binds `nl.json`, not `ProblemDetails.Title`) but found the *argument* inconsistent. What the code now actually implements is a rule nobody ratified:
  > **(c) Dutch when the teacher can act on it; English when it is a model or operator diagnostic.**
  That is a defensible principle — a validation message a teacher must act on *should* be Dutch, and an AI-response parse failure is not something a teacher can fix. It is also the reason the backend is currently three-way inconsistent: Dutch titles in three exception handlers, English title+detail in the jaarplan 422, Dutch fault messages from the services. **Decide (a), (b) or (c) explicitly**, because until then each new handler is a coin flip and the inconsistency is being written into the codebase one story at a time. Recommendation: **(c) plus (a)** — ratify the actionable/diagnostic split *and* amend Art. II.3 to scope it to UI chrome, since (c) only makes sense if server-generated Dutch is permitted at all.
- **Discipline 9's official name / the 9.x nesting.** The Art. VII.0 list has no bare `"9"` row and never names it, so 9.1/9.2/9.3 are seeded with `parentDiscipline = null` and **nothing** in the codebase ever sets that column. Art. XII meanwhile describes 9 as a subject that *is split*. Directie to supply discipline 9's official name, or confirm 9.1/9.2/9.3 are genuinely top-level. Until then any UI grouping of 9.x is impossible.
- **Does seeding the full taxonomy pre-empt "disciplines first"?** The migration seeds all 13 disciplines unconditionally, without consulting the [ADR-0019](../docs/adr/0019-discipline-selection-config-seam.md) `IDisciplineSelectie` seam. The reading taken is that the seam scopes which disciplines' **goals** are imported, while the discipline rows are the authoritative taxonomy (Art. VII.0) that the FK cannot do without. Consequence to confirm: any UI listing `disciplines` will show all 13, so a later "starter selection" answer becomes a filtering concern rather than a config change.
- **Is "2–3 themadoelen" (Art. IX.2) a range or just a maximum?** Only the upper bound (3) exists in code. A thema imported with 0 or 1 themadoel lands silently, un-anchored, while an over-anchored one is reported. Either the minimum should be reported too, or Art. IX.2 should say 2 is a pedagogical guideline rather than an invariant.
