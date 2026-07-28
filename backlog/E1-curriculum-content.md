# E1 — Curriculum & Content Fundament

**Phase:** 1 · **Milestone:** M1 — Fundament
**Goal:** The data model exists; Op.stap leerplandoelen are imported (read-only) with the correct taxonomy and concordance; the school's thema's/subthema's/activiteiten are imported and manageable — including the richer themalaag (themadoelen, subdoelen, rich attributes) and level scoping.
**Covers FR:** FR-1, FR-2, FR-3. **Constitution:** [Art. III](../CONSTITUTION.md#article-iii--curriculum-data-integrity--professional-autonomy-non-negotiable), [Art. VII](../CONSTITUTION.md#article-vii--opstap-taxonomy--excel--model-mapping), [Art. IX](../CONSTITUTION.md#article-ix--core-data-model-functional).

---

### Data model

- [x] **E1-01 — Curriculum entities (read-only)**
  `Discipline` (string `nummer`, optional `parentDiscipline`, 9.x split), `Leerplandoel` (code unique, doelsoort enum, jaarFase, domein, subdomein, **cluster nullable**, tekst, voorbeelden?, toelichting?, woordenschat?, `minimumdoelRef`), `Minimumdoel` (ref, leeftijd K-/4-/6-, nr, omschrijving). Grouping key `(domein, subdomein)`; identity = `code`.
  *Done when:* migrations create the tables; entities are immutable from app code paths (Art. III.1). Ref: Art. IX.1, VII.0.
  *Note (2026-07-27):* stays done — the AC is about tables + immutability, both met. Two reference-data gaps found by code review were fixed/logged separately: the `disciplines` table had **no rows** and nothing to create them (its FK broke the first import) — now seeded from the Art. VII.0 authoritative list; `minimumdoelen` is still empty (see E1-03/E1-04). The 9.x nesting is seeded with `parentDiscipline = null` because the authoritative list has no bare `"9"` row and does not name it.

- [x] **E1-02 — School-content entities (autonomous, level-scoped)**
  `Thema` (school-scoped: naam, invalshoeken?, `duurWeken`, `kernwoordenschat[]`, `rijkeWoordenschat[]`), `Themadoel` (school-scoped, 2–3, links to leerplandoel/minimumdoel), `Subthema` (class/age-scoped: probleemstelling?, onderzoeksvraag?, `duurWeken`), `Subdoel` (class/age-scoped, per `(subthema × leeftijd)`), `Activiteit` (class/age-scoped: `activiteitType` enum, hoek?, verwachteUitkomsten?), `DoelKoppeling` (status enum + `aiMotivatie`).
  *Done when:* migrations created; scoping enforced (Thema/Themadoel/kernwoordenschat school-wide; Subthema/Subdoel/Activiteit per class & age). Ref: Art. IX.2.
  *Note (2026-07-27):* stays done — migrations exist and scoping is enforced. Code review found the class scope was **unusable in practice**: nothing could create a `Klas`, so every subthema was rejected/dropped. Fixed by the `Klas` CRUD endpoint (`IKlasBeheerService` + `POST /api/klassen`), which E3 needs anyway for per-class plan generation.

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
  *Done when:* a re-import diff/notice is produced; existing plans intact. Ref: FR-2.5.

- [x] **E1-06 — Discipline selection (starter set vs all)** — *data-driven seam built ([ADR-0019](../docs/adr/0019-discipline-selection-config-seam.md)); the actual disciplines-first choice (Art. XIV) stays runtime config (`Opstap:DisciplineSelectie`), not compiled in*
  Make the imported discipline set configurable; isolate behind a seam so neither "all" nor a subset is hard-coded.
  *Done when:* the choice is data-driven, not compiled in.

### FR-1 — Thema/activiteit import

- [~] **E1-07 — Excel upload + validation + per-row errors** — *reopened 2026-07-27 (code review): there is no upload endpoint*
  Upload `.xlsx` of thema's/subthema's/activiteiten; validate required columns/fields; clear per-row error messages.
  *Done when:* invalid rows are reported precisely; valid file proceeds. Ref: FR-1.1/1.2.
  *Progress (2026-07-28):* all three gaps **implemented** — `SchoolcontentImportController` adds `GET sjabloon` / `POST voorbeeld` / `POST` (which also makes E1-09's template generator reachable); header validation is now **positional** so a reordered template is refused instead of importing wrong data; and unknown goal codes plus a 4th themadoel are **reported** rather than aborting the import as a 500 (the cap is now checked in both preview and commit, restoring "preview == commit"). See [worklog](worklogs/E1-07/implementation.md).
  *Why still `[~]`:* the 6 Postgres-backed endpoint tests could not be executed on the dev machine (no Docker / no local PostgreSQL) and report as skipped. Per the build rule "never mark `[x]` without PASS", this flips to `[x]` once CI — which has the Postgres service container — runs them green. The 5 unit-level robustness tests **do** pass locally.

- [x] **E1-08 — Import preview + add/update-or-overwrite on re-import**
  Show a preview before commit; on re-import let the user choose add vs. update/overwrite.
  *Done when:* preview matches committed result; re-import modes work; **the overwrite path preserves (or explicitly warns before discarding) teacher-set `DoelKoppeling` statuses** (`aanvaard`/`geweigerd`/`manueel`) so a re-import never silently destroys human decisions. Ref: FR-1.3/1.4, Art. IV.2 (mirrors E1-05's non-destructive stance).

- [x] **E1-09 — Downloadable import template**
  Template `.xlsx` matching the import structure, incl. fields for themadoelen, subthema onderzoeksvragen, two-tier woordenschat, activiteittype, duurWeken.
  *Done when:* template downloads and round-trips through E1-07. Ref: FR-1.5, Gap A.4. *Note: final columns gated on Art. XIV "Thema/activiteit Excel structure".*

### FR-3 — Beheer

- [x] **E1-10 — CRUD for thema/subthema/activiteit + goal links**
  Add/edit/delete at each level; link an activiteit/subthema to one or more leerdoelen; manage 2–3 themadoelen per thema.
  *Done when:* CRUD respects level scoping; goal links persist with status. Ref: FR-3.1/3.2.

- [x] **E1-11 — Gedeelde thema-bibliotheek (school-wide thema's)**
  Thema + themadoelen + kernwoordenschat owned at school level; per-class derivation of subthema's/subdoelen without cross-class bleed.
  *Done when:* editing a class's subthema does not mutate the shared thema. Ref: FR-3.3 (resolved per-level), Art. IX.2, Gap A.5.

### FR-2 — Decreed minimumdoelen (added 2026-07-28)

- [!] **E1-12 — Decreed-minimumdoelen import** — *blocked: needs the source file from directie*
  Import the decreed eindtermen as `Minimumdoel` rows (`ref`, `leeftijd` K-/4-/6-, `nr`, `omschrijving`) from a dedicated source, separate from the per-discipline goal Excel. Read-only reference data (Art. III.1); identity is `ref`, which is the concordance key leerplandoelen already point at.
  *Done when:* a decreed source imports, `minimumdoelen` is populated, MD-concorded leerplandoelen commit without FK failure, and minimumdoel-level coverage returns results. Ref: FR-2.2/2.3, Art. IX.1, Art. V.2.
  *Background:* the Art. XIV "minimumdoel source" decision was **resolved 2026-07-28 in favour of a separate import** (over making `omschrijving` nullable, which would have required amending Art. IX.1). **Unblocks E1-03 and E1-04**, and E5's inspectie-facing coverage depends on it — the minimumdoel level is what the onderwijsinspectie tests.
  *Blocked on:* the actual decreed source (Excel/CSV of the eindtermen). The column mapping cannot be written against a file that has not been supplied.
