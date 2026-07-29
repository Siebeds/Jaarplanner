# E1 — Curriculum & Content Fundament

**Phase:** 1 · **Milestone:** M1 — Fundament
**Goal:** The data model exists; Op.stap leerplandoelen are imported (read-only) with the correct taxonomy and concordance; the school's thema's/subthema's/activiteiten are imported and manageable — including the richer themalaag (themadoelen, subdoelen, rich attributes) and level scoping.
**Covers FR:** FR-1, FR-2, FR-3. **Constitution:** [Art. III](../CONSTITUTION.md#article-iii--curriculum-data-integrity--professional-autonomy-non-negotiable), [Art. VII](../CONSTITUTION.md#article-vii--opstap-taxonomy--excel--model-mapping), [Art. IX](../CONSTITUTION.md#article-ix--core-data-model-functional).

---

### Data model

- [x] **E1-01 — Curriculum entities (read-only)**
  `Discipline` (string `nummer`, optional `parentDiscipline`, 9.x split), `Leerplandoel` (code unique, doelsoort enum, jaarFase, domein, subdomein, **cluster nullable**, tekst, voorbeelden?, toelichting?, woordenschat?, `minimumdoelRef`), `Minimumdoel` (ref, leeftijd K-/4-/6-, nr, omschrijving). Grouping key `(domein, subdomein)`; identity = `code`.
  *Done when:* migrations create the tables; entities are immutable from app code paths (Art. III.1). Ref: Art. IX.1, VII.0.
  *Note (2026-07-27, qualified 2026-07-28):* stays `[x]` — its AC is tables + immutability, both met and covered by executed unit tests. Two reference-data gaps found by code review were fixed/logged separately: the `disciplines` table had **no rows** and nothing to create them (its FK broke the first import) — now seeded from the Art. VII.0 authoritative list; `minimumdoelen` is still empty (see E1-03/E1-04). The 9.x nesting is seeded with `parentDiscipline = null` because the authoritative list has no bare `"9"` row and does not name it.
  ⏳ **The seed itself is not yet verified anywhere.** Its only evidence is `ReferentiedataIntegriteitTests`, which **skips** without a real PostgreSQL, and the migration has never been applied to any instance. Held to the same standard as E1-07: treat "seeded" as claimed-but-unproven until CI runs it green.

- [x] **E1-02 — School-content entities (autonomous, level-scoped)**
  `Thema` (school-scoped: naam, invalshoeken?, `duurWeken`, `kernwoordenschat[]`, `rijkeWoordenschat[]`), `Themadoel` (school-scoped, 2–3, links to leerplandoel/minimumdoel), `Subthema` (class/age-scoped: probleemstelling?, onderzoeksvraag?, `duurWeken`), `Subdoel` (class/age-scoped, per `(subthema × leeftijd)`), `Activiteit` (class/age-scoped: `activiteitType` enum, hoek?, verwachteUitkomsten?), `DoelKoppeling` (status enum + `aiMotivatie`).
  *Done when:* migrations created; scoping enforced (Thema/Themadoel/kernwoordenschat school-wide; Subthema/Subdoel/Activiteit per class & age). Ref: Art. IX.2.
  *Note (2026-07-27, qualified 2026-07-28):* stays `[x]` — migrations exist and scoping is enforced, both covered by executed unit tests. Code review found the class scope was **unusable in practice**: nothing could create a `Klas`, so every subthema was rejected/dropped. Addressed by the `Klas` CRUD endpoint (`IKlasBeheerService` + `POST /api/klassen`), which E3 needs anyway for per-class plan generation.
  ⏳ **That endpoint is not yet verified anywhere.** Its only evidence is `KlasEndpointsTests`, which **skips** without a real PostgreSQL. Held to the same standard as E1-07: claimed-but-unproven until CI runs it green.

### FR-2 — Op.stap import

- [~] **E1-03 — Op.stap Excel parser (ClosedXML), single-source mapping** — *reopened 2026-07-27 (code review): the `Minimumdoel` half of the AC is not met*
  Parse one Excel per discipline using the A–M mapping in **one place** in code (Art. III.3, VII.1). Handle hidden/empty columns; nullable cluster.
  *Done when:* a discipline file produces correct `Leerplandoel`/`Minimumdoel` rows. **High-risk logic — unit-tested thoroughly** (Art. V.6).
  *Open:* the parser produces **`Leerplandoel` rows only — never a `Minimumdoel`**. It reads the concordance *key* (col D, or B+C) but the per-discipline goal Excel has **no `omschrijving` column** (Art. VII.1), so there is no source for the decreed minimumdoel text and no code path inserts one. **Blocked on an Art. XIV decision: where do minimumdoel rows come from?** Also: `ResolveMinimumdoelRef` emits partial keys like `"K-"` when col D is blank and only one of B/C is filled.

- [~] **E1-04 — Doelsoort recognition & concordance** — *reopened 2026-07-27 (code review): concordance cannot yield minimumdoel-level coverage*
  Map doelsoort enum (MD/G/+/P/S/A); build `minimumdoelRef` = B+C; link minimumdoelen ↔ leerplandoelen.
  *Done when:* concordance is queryable; coverage at minimumdoel level becomes possible (feeds E5). Ref: FR-2.2/2.3.
  *Open:* `Leerplandoel.MinimumdoelRef` is a **`Restrict` FK** to `minimumdoelen.Ref`, and the `minimumdoelen` table is never populated (see E1-03). So every MD-concorded row **fails to commit** (SQLSTATE 23503), and minimumdoel-level coverage — the level the **onderwijsinspectie** tests (Art. V.2) — can return nothing. Doelsoort mapping itself is done and tested; the concordance *chain* is proven to work as soon as a minimumdoel exists (`ReferentiedataIntegriteitTests`), so this is purely the missing data source.

- [x] **E1-05 — Re-import without clobbering plans**
  Re-importing updated Op.stap data updates reference data but **does not auto-overwrite jaarplannen**; flags what to review.
  *Done when:* a re-import diff/notice is produced; existing plans intact. Ref: **FR-2.5 server side only**.
  *Scope boundary (2026-07-28, corrected by the third audit):* FR-2.5 says the tool *"**signaleert** wat herbekeken moet worden"* — the same verb class as FR-1.2's *toont*. The diff/notice is **computed in-process and returned to its caller — of which there is none.** `IOpstapImportService` is DI-registered but referenced by no controller and by no test outside `OpstapImportServiceTests`, so the Op.stap (re-)import cannot be triggered by an HTTP client, a CLI or a job at all. FR-2.5 also requires that *"de doelen **opnieuw ingeladen** kunnen worden"* — that half fails too, and so does **FR-2.1's initial import**. The missing invocation surface is **E1-15**; the display half is **E1-13** clause 6.
  > *An earlier revision of this note said the notice is "produced and **returned**", implying a reachable caller. That was the same category of overstatement as the "proven end-to-end" it was written to replace — narrowing a claim to "server side only" does not rescue it when the server side has no entry point either.*

- [x] **E1-06 — Discipline selection (starter set vs all)** — *data-driven seam built ([ADR-0019](../docs/adr/0019-discipline-selection-config-seam.md)); the actual disciplines-first choice (Art. XIV) stays runtime config (`Opstap:DisciplineSelectie`), not compiled in*
  Make the imported discipline set configurable; isolate behind a seam so neither "all" nor a subset is hard-coded.
  *Done when:* the choice is data-driven, not compiled in.

### FR-1 — Thema/activiteit import

- [x] **E1-07 — Excel upload + validation + per-row errors** — *reopened 2026-07-27 (code review); closed 2026-07-28 on green CI*
  Upload `.xlsx` of thema's/subthema's/activiteiten; validate required columns/fields; clear per-row error messages.
  *Done when:* invalid rows are reported precisely; valid file proceeds. Ref: **FR-1.1 and FR-1.2, server side only**.
  *Scope boundary (clarified 2026-07-28, widened by the third audit):* this story owns the **server side** — parse, validate, report, commit. Both cited FRs name the user and both display halves are deferred to **E1-13**: FR-1.1 *"**De gebruiker kan** een Excel-bestand (.xlsx) opladen"* (clause 1) and FR-1.2 *"**toont** duidelijke foutmeldingen per rij"* (clause 2). The `[x]` here means the endpoint reports precisely and is proven from HTTP to PostgreSQL; it does **not** mean a teacher can upload anything or see any of it. Neither FR is satisfied until E1-13 lands. *(FR-1.1 was left un-narrowed by the previous round — the selective fix the round claimed to have stopped.)*
  *Progress (2026-07-28):* all three gaps **implemented** — `SchoolcontentImportController` adds `GET sjabloon` / `POST voorbeeld` / `POST` (which also makes E1-09's template generator reachable); header validation is now **positional** so a reordered template is refused instead of importing wrong data; and unknown goal codes plus a 4th themadoel are **reported** rather than aborting the import as a 500 (the cap is now checked in both preview and commit, restoring "preview == commit"). See [worklog](worklogs/E1-07/implementation.md).
  *Closed (2026-07-28), CI run [30357426252](https://github.com/Siebeds/Jaarplanner/actions/runs/30357426252):* the Postgres-backed endpoint tests now run green — **42 integration passed / 0 skipped**, 328 unit passed. They had been *failing*, not merely unexecuted: four of them still asserted the old single `isGeldig` property after this story's own audit fix (finding 3) split the response into `isBestandGeldig` + `isVolledigVerwerkt`, so CI was red on every push from 2026-07-28 09:11 onward while the backlog recorded only "awaiting CI". Assertions corrected, and a seventh test now pins the distinction the split exists for: a workbook naming a non-existent klas parses clean (`isBestandGeldig` true) yet drops its subthema (`isVolledigVerwerkt` false) — previously unasserted.
  *Lesson (same root cause as the E1 reopening):* a test that can only run in CI is not evidence until CI has run it. "Awaiting CI" and "passing in CI" were conflated for five pushes.

- [x] **E1-08 — Import preview + add/update-or-overwrite on re-import**
  Show a preview before commit; on re-import let the user choose add vs. update/overwrite.
  *Done when:* preview matches committed result; re-import modes work; **the overwrite path preserves (or explicitly warns before discarding) teacher-set `DoelKoppeling` statuses** (`aanvaard`/`geweigerd`/`manueel`) so a re-import never silently destroys human decisions. Ref: **FR-1.3/1.4 server side only**, Art. IV.2 (mirrors E1-05's non-destructive stance).
  *Scope boundary (2026-07-28, antagonist audit):* both cited FRs name the **user**, not the API. FR-1.3: *"Vóór het definitief inlezen **krijgt de gebruiker** een voorbeeldweergave"*; FR-1.4: *"Bij herimport **kan de gebruiker kiezen** tussen toevoegen of bestaande gegevens bijwerken/overschrijven."* A `POST …/voorbeeld` returning JSON is not a user receiving a preview, and a `modus` field on a request body is not a user choosing. Both display halves are deferred to **E1-13**, including the add-vs-overwrite choice and the Art. IV.2 warning before discarding human decisions — which is the one place in this flow where a silent default would destroy teacher work.

- [x] **E1-09 — Downloadable import template**
  Template `.xlsx` matching the import structure, incl. fields for themadoelen, subthema onderzoeksvragen, two-tier woordenschat, activiteittype, duurWeken.
  *Done when:* template downloads and round-trips through E1-07. Ref: **FR-1.5 server side only**, Gap A.4. *Note: final columns gated on Art. XIV "Thema/activiteit Excel structure".*
  *Scope boundary (2026-07-28, antagonist audit):* FR-1.5 wants the template *"downloadbaar, zodat duidelijk is hoe het bestand eruit moet zien"* — a teacher needs somewhere to click. `GET …/sjabloon` serves the file correctly and is proven by test, but no UI links to it. The download surface is deferred to **E1-13**.

- [ ] **E1-13 — Import-UI: upload, preview & per-row foutmeldingen op het scherm** — *added 2026-07-28 (antagonist audit): FR-1.2's display half was unowned*
  The teacher-facing screen for the school-content import: pick an `.xlsx`, see the preview diff, and **read the per-row problems and opmerkingen on screen** — with the sjabloon download alongside it.
  *Why this story exists:* E1-07 built and proved the whole server side, but FR-1.2 reads *"De tool valideert het bestand … en **toont** duidelijke foutmeldingen per rij."* Nothing showed them: `frontend/src/features/` contained only `matching`, no component referenced `schoolcontent-import`/`problemen`/`opmerkingen`, and `nl.json` had no import keys. The audit found no story in E1–E8 owned it, so closing E1-07 would have retired FR-1.2 with half of it unbuilt. Users are **non-technical teachers** — a diagnostic that exists only in a JSON response does not satisfy the FR.
  *Done when:* a teacher can, on screen —
  1. download the sjabloon (FR-1.5) and upload a filled `.xlsx` (FR-1.1);
  2. read the per-row problems (row number + offending column) and the opmerkingen for content that was dropped (FR-1.2);
  3. see a distinction between **`isBestandGeldig`** (it parsed) and **`isVolledigVerwerkt`** (nothing was dropped) — the two **must not** be collapsed into one "OK", which is exactly the defect E1-07's audit finding 3 rejected, and this is the layer where it would reach a teacher;
  4. review the preview *before* committing (FR-1.3);
  5. **choose add vs. update/overwrite on re-import (FR-1.4)**, and be warned before an overwrite discards teacher-set `DoelKoppeling` statuses (Art. IV.2) — never a silent default;
  6. **read the Op.stap re-import review notice (FR-2.5)** — *what must be reviewed* after curriculum reference data changed, from `OpstapHerimportDiff`. Note this is the **other** importer: a different flow and DTO from the school-content one above, so it may warrant its own screen; it is listed here because it is the same *kind* of surface and must not be orphaned again. Requires **E1-15** to exist first, since nothing can trigger an Op.stap import today.
  Ref: FR-1.1/1.2/1.3/1.4/1.5 (display halves, deferred from E1-07/E1-08/E1-09), FR-2.5's review notice (from E1-05), Art. II.3, Art. IV.2, ADR-0017.
  *Depends on:* E1-07 `[x]` (the endpoint + response contract).
  *Gated by an open decision — read before building:* the **Art. II.3 diagnostics ruling** (see `README.md`, unresolved). `problemen[].melding` and `diff.opmerkingen[]` are today **server-generated Dutch free text**, while Art. II.3/X.3 require Dutch UI copy to live in `nl.json`. Option (a) permits displaying them verbatim; option (b) restructures the payload as codes + parameters the UI renders from `nl.json`. **Do not hard-assume one** — if the ruling has not landed, isolate the rendering behind a single formatter module so option (b) becomes a change in one place rather than throughout the UI.

### FR-3 — Beheer

- [x] **E1-10 — CRUD for thema/subthema/activiteit + goal links**
  Add/edit/delete at each level; link an activiteit/subthema to one or more leerdoelen; manage 2–3 themadoelen per thema.
  *Done when:* CRUD respects level scoping; goal links persist with status. Ref: **FR-3.1/3.2 server side only**.
  *Scope boundary (2026-07-28, antagonist audit):* FR-3.1 is the most explicitly actor-naming FR in the set — *"**Leerkrachten kunnen** thema's, subthema's en activiteiten toevoegen, wijzigen en verwijderen"* — and there is no UI for any of it. The REST surface and its level-scoping invariants are done and tested; the teacher-facing beheer screens are deferred to **E1-14**. Note E6-05 (thema-opbouw wizard) covers *guided creation* of a new thema and does not cite FR-3.1, so it does not own *wijzigen/verwijderen* of existing content.

- [ ] **E1-14 — Beheer-UI voor thema's, subthema's & activiteiten** — *added 2026-07-28 (antagonist audit): FR-3.1's interaction half was unowned*
  The teacher-facing screens for managing school content: list/inspect thema's, and add, edit and delete at thema / subthema / activiteit level, including the 2–3 themadoelen and the goal links with their status.
  *Why this story exists:* the audit that closed E1-07 found the same defect in E1-10 — a `[x]` retiring FR-3.1 while *"leerkrachten kunnen … toevoegen, wijzigen en verwijderen"* had no surface a leerkracht could use. E1-13 was scoped to the import flow and does not cover ongoing content management.
  *Done when:* a teacher can create, edit and delete a thema, a subthema and an activiteit from the UI; **link an activiteit or subthema to one or more leerplandoelen, and manage a thema's 2–3 themadoelen (FR-3.2)** — the link-*creation* action, distinct from deciding on an AI-proposed link, which is E2-05's; level scoping is visible and respected (thema/themadoel/kernwoordenschat school-wide, subthema/subdoel/activiteit per klas & leeftijd, Art. IX.2); the 2–3 themadoel guideline is surfaced rather than silently enforced; and a link's status persists (Art. IV). Ref: FR-3.1/3.2 (display halves, deferred from E1-10), FR-3.3, Art. IX.2, ADR-0017.
  *Ownership note (2026-07-28):* FR-3.2 reads *"Een activiteit **kan aan** één of meerdere leerdoelen **gekoppeld worden**"* — creating a link. The endpoints exist (`ThemasController`/`SubthemasController`/`ActiviteitenController`, E1-10) with no UI; this story owns that UI. E2 owns only the *review* of AI-proposed links.
  *Relationship to E6-05:* E6-05 is the opinionated 10-step wizard for *building a thema from scratch* (Gap A.7, Art. IV.8). E1-14 is the plain CRUD surface for content that already exists. Build E1-14 first — the wizard needs somewhere to land its output.
  *Depends on:* E1-10 `[x]` (the endpoints + level-scoping rules).

- [x] **E1-11 — Gedeelde thema-bibliotheek (school-wide thema's)**
  Thema + themadoelen + kernwoordenschat owned at school level; per-class derivation of subthema's/subdoelen without cross-class bleed.
  *Done when:* editing a class's subthema does not mutate the shared thema. Ref: FR-3.3 (resolved per-level), Art. IX.2, Gap A.5.

### FR-2 — Decreed minimumdoelen (added 2026-07-28)

- [!] **E1-12 — Decreed-minimumdoelen import** — *blocked: needs the source file from directie*
  Import the decreed eindtermen as `Minimumdoel` rows (`ref`, `leeftijd` K-/4-/6-, `nr`, `omschrijving`) from a dedicated source, separate from the per-discipline goal Excel. Read-only reference data (Art. III.1); identity is `ref`, which is the concordance key leerplandoelen already point at.
  *Done when:* a decreed source imports, `minimumdoelen` is populated, MD-concorded leerplandoelen commit without FK failure, and minimumdoel-level coverage returns results. Ref: FR-2.2/2.3, Art. IX.1, Art. V.2.
  *Background:* the Art. XIV "minimumdoel source" decision was **resolved 2026-07-28 in favour of a separate import** (over making `omschrijving` nullable, which would have required amending Art. IX.1). **Unblocks E1-03 and E1-04**, and E5's inspectie-facing coverage depends on it — the minimumdoel level is what the onderwijsinspectie tests.
  *Blocked on:* the actual decreed source (Excel/CSV of the eindtermen). The column mapping cannot be written against a file that has not been supplied.

- [ ] **E1-15 — Trigger the Op.stap import: an invocation surface for FR-2.1/2.5** — *added 2026-07-28 (third antagonist audit): the curriculum import is unreachable*
  Give `IOpstapImportService` a way to be called in a running application — an endpoint (or an explicitly-documented admin/CLI path) to run an initial import and a re-import per discipline, returning the `OpstapHerimportDiff` review report.
  *Why this story exists:* `IOpstapImportService` is DI-registered at `Infrastructure/DependencyInjection.cs` but referenced by **no controller** and by no test outside `OpstapImportServiceTests`. The parser, the concordance logic, the non-destructive re-import and the review diff are all built and tested — and **none of it can be run.** FR-2.1 (*"De leerplandoelen … worden ingeladen"*) and FR-2.5 (*"de doelen kunnen **opnieuw ingeladen** worden"*) both fail on the trigger, not the logic. This is the same defect as E2-08, in the other importer, and it went unnoticed for the same reason: unit tests reach a service directly, so "tested" and "reachable" look identical from the test report.
  *Done when:* an initial Op.stap import and a re-import can both be triggered in a deployed app; the re-import returns its review report; the curriculum stays read-only (Art. III.1) and existing jaarplannen are untouched (Art. III.4). Ref: FR-2.1, FR-2.5, Art. III.1/III.4.
  *Interacts with:* **E1-12** (the decreed-minimumdoelen import needs a trigger too — decide whether it shares this surface); **E1-13** clause 6 (rendering the review notice). Note this story does **not** unblock E1-03/E1-04 — those wait on the source file.
  *Open (Art. XIV):* who may run an import, and from where? This is reference-data administration, so it likely belongs behind a directie-only role (Art. VI, FR-10) rather than a teacher-facing screen — which is a permissions decision, not just a routing one. Do not hard-assume; if E6-02's role matrix has not landed, put the endpoint behind a single authorisation seam.
