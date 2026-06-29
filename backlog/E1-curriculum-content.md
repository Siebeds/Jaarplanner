# E1 — Curriculum & Content Fundament

**Phase:** 1 · **Milestone:** M1 — Fundament
**Goal:** The data model exists; Op.stap leerplandoelen are imported (read-only) with the correct taxonomy and concordance; the school's thema's/subthema's/activiteiten are imported and manageable — including the richer themalaag (themadoelen, subdoelen, rich attributes) and level scoping.
**Covers FR:** FR-1, FR-2, FR-3. **Constitution:** [Art. III](../CONSTITUTION.md#article-iii--curriculum-data-integrity--professional-autonomy-non-negotiable), [Art. VII](../CONSTITUTION.md#article-vii--opstap-taxonomy--excel--model-mapping), [Art. IX](../CONSTITUTION.md#article-ix--core-data-model-functional).

---

### Data model

- [ ] **E1-01 — Curriculum entities (read-only)**
  `Discipline` (string `nummer`, optional `parentDiscipline`, 9.x split), `Leerplandoel` (code unique, doelsoort enum, jaarFase, domein, subdomein, **cluster nullable**, tekst, voorbeelden?, toelichting?, woordenschat?, `minimumdoelRef`), `Minimumdoel` (ref, leeftijd K-/4-/6-, nr, omschrijving). Grouping key `(domein, subdomein)`; identity = `code`.
  *Done when:* migrations create the tables; entities are immutable from app code paths (Art. III.1). Ref: Art. IX.1, VII.0.

- [ ] **E1-02 — School-content entities (autonomous, level-scoped)**
  `Thema` (school-scoped: naam, invalshoeken?, `duurWeken`, `kernwoordenschat[]`, `rijkeWoordenschat[]`), `Themadoel` (school-scoped, 2–3, links to leerplandoel/minimumdoel), `Subthema` (class/age-scoped: probleemstelling?, onderzoeksvraag?, `duurWeken`), `Subdoel` (class/age-scoped, per `(subthema × leeftijd)`), `Activiteit` (class/age-scoped: `activiteitType` enum, hoek?, verwachteUitkomsten?), `DoelKoppeling` (status enum + `aiMotivatie`).
  *Done when:* migrations created; scoping enforced (Thema/Themadoel/kernwoordenschat school-wide; Subthema/Subdoel/Activiteit per class & age). Ref: Art. IX.2.

### FR-2 — Op.stap import

- [ ] **E1-03 — Op.stap Excel parser (ClosedXML), single-source mapping**
  Parse one Excel per discipline using the A–M mapping in **one place** in code (Art. III.3, VII.1). Handle hidden/empty columns; nullable cluster.
  *Done when:* a discipline file produces correct `Leerplandoel`/`Minimumdoel` rows. **High-risk logic — unit-tested thoroughly** (Art. V.6).

- [ ] **E1-04 — Doelsoort recognition & concordance**
  Map doelsoort enum (MD/G/+/P/S/A); build `minimumdoelRef` = B+C; link minimumdoelen ↔ leerplandoelen.
  *Done when:* concordance is queryable; coverage at minimumdoel level becomes possible (feeds E5). Ref: FR-2.2/2.3.

- [ ] **E1-05 — Re-import without clobbering plans**
  Re-importing updated Op.stap data updates reference data but **does not auto-overwrite jaarplannen**; flags what to review.
  *Done when:* a re-import diff/notice is produced; existing plans intact. Ref: FR-2.5.

- [!] **E1-06 — Discipline selection (starter set vs all)** — *blocked: Art. XIV "Disciplines first" + "cluster presence"*
  Make the imported discipline set configurable; isolate behind a seam so neither "all" nor a subset is hard-coded.
  *Done when:* the choice is data-driven, not compiled in.

### FR-1 — Thema/activiteit import

- [ ] **E1-07 — Excel upload + validation + per-row errors**
  Upload `.xlsx` of thema's/subthema's/activiteiten; validate required columns/fields; clear per-row error messages.
  *Done when:* invalid rows are reported precisely; valid file proceeds. Ref: FR-1.1/1.2.

- [ ] **E1-08 — Import preview + add/update-or-overwrite on re-import**
  Show a preview before commit; on re-import let the user choose add vs. update/overwrite.
  *Done when:* preview matches committed result; re-import modes work; **the overwrite path preserves (or explicitly warns before discarding) teacher-set `DoelKoppeling` statuses** (`aanvaard`/`geweigerd`/`manueel`) so a re-import never silently destroys human decisions. Ref: FR-1.3/1.4, Art. IV.2 (mirrors E1-05's non-destructive stance).

- [ ] **E1-09 — Downloadable import template**
  Template `.xlsx` matching the import structure, incl. fields for themadoelen, subthema onderzoeksvragen, two-tier woordenschat, activiteittype, duurWeken.
  *Done when:* template downloads and round-trips through E1-07. Ref: FR-1.5, Gap A.4. *Note: final columns gated on Art. XIV "Thema/activiteit Excel structure".*

### FR-3 — Beheer

- [ ] **E1-10 — CRUD for thema/subthema/activiteit + goal links**
  Add/edit/delete at each level; link an activiteit/subthema to one or more leerdoelen; manage 2–3 themadoelen per thema.
  *Done when:* CRUD respects level scoping; goal links persist with status. Ref: FR-3.1/3.2.

- [ ] **E1-11 — Gedeelde thema-bibliotheek (school-wide thema's)**
  Thema + themadoelen + kernwoordenschat owned at school level; per-class derivation of subthema's/subdoelen without cross-class bleed.
  *Done when:* editing a class's subthema does not mutate the shared thema. Ref: FR-3.3 (resolved per-level), Art. IX.2, Gap A.5.
