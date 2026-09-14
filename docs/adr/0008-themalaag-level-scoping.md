# ADR-0008 — Two-tier themalaag with level-based ownership/scoping

- **Status:** Accepted. **Both of its ownership statements are superseded; the two-tier principle stands.**
  - The per-class scoping of `Subthema`/`Subdoel`/`Activiteit` was superseded by
    [ADR-0025](0025-subthema-per-leeftijd.md) on 2026-08-30: they are scoped by leeftijd alone.
  - "Owned by team/directie" for the school-scoped tier was superseded by
    [ADR-0030](0030-rollen-en-rechten-in-de-app.md) and the Art. VI.1 amendment on the owner's rulings of 2026-09-13.
    A thema is edited by directie and themabeheer. A subthema and its subdoelen are created, edited and deleted by
    directie and that jaar's hoofdleerkrachten. Every leerkracht with a klas of that leeftijd also edits the content
    of its shared activiteiten and its streefwoordenschat, creates activiteiten, and deletes one they created while
    no goal is linked to it. Goal links by hand stay with directie and the hoofdleerkrachten.
  - What stands is the principle this ADR exists for: scope is prescribed per level by pedagogy, not by one
    shared/per-class flag. The text below is left as written.
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

The ratified gap-analysis (GAP 1–5/12) showed the themalaag is richer and its ownership is **prescribed per level**, not a single shared/per-class flag (Art. IX.2). School-wide: `Thema`, `Themadoel` (2–3 anchors), `kernwoordenschat`, and which minimumdoelen are addressed. Per class & age: `Subthema`, `Subdoel` (per `subthema × leeftijd`), `Activiteit`. A kennisrijk thema is goal-first and interdisciplinary, with rich attributes (onderzoeksvraag, two-tier woordenschat, activiteittype, duur).

## Decision

We will model the themalaag in two ownership tiers:

**School-scoped (shared thema-bibliotheek, owned by team/directie)**
- `Thema` — naam, invalshoeken?, `duurWeken` (≈4–6), `kernwoordenschat[]`, `rijkeWoordenschat[]`.
- `Themadoel` — 2–3 overarching goals linking to leerplan-/minimumdoelen; meant to be verbreed/verdiept/herhaald.

**Class/age-scoped (derived per klas, never bleeding across classes)**
- `Subthema` — probleemstelling?, onderzoeksvraag?, `duurWeken` (≈2).
- `Subdoel` — concrete, age-differentiated goal at `(Subthema × leeftijd)`, building toward the themadoelen; interdisciplinary.
- `Activiteit` — `activiteitType` enum (experiment/prentenboek/hoek/uitstap/spel/waarneming/beweging/onderzoek), hoek?, verwachteUitkomsten?.

All goal links use one entity, **`DoelKoppeling`** (status `voorgesteld/aanvaard/geweigerd/manueel` + `aiMotivatie`), reused for themadoelen, subdoelen, and activity links. Editing a class's subthema/subdoel/activity **must not mutate the shared thema**.

## Alternatives considered

- **Flat `Thema → subthema → activiteit` (original analysis)** — loses themadoel/subdoel and the age dimension; can't represent the school's real planning grain. Rejected per ratified GAP 1–3.
- **Single `isShared` boolean on Thema** — can't express the per-level rule (thema shared but its subthema's per class). Rejected per GAP 5.
- **Copy-per-class of the whole thema** — duplicates school-wide content and breaks vertical coherence; we derive instead of copy.

## Consequences

**Positive**
- Matches the pedagogy exactly; supports school-wide consistency + per-age differentiation and the goal-first wizard.
- One link entity keeps AI/manual status handling uniform.

**Negative / trade-offs**
- More entities and a clear ownership/authorisation boundary to enforce (who may edit school-scoped vs class-scoped).

**Follow-ups**
- E1-02 (entities + scoping), E1-10/11 (CRUD + shared bibliotheek), E2-07 + E6-05 (goal-first wizard). Authorisation per tier ties to ADR-0011.

## Compliance trace

- **Constitution:** Art. IX.2 (themalaag + level scoping), Art. III (autonomous, editable), Art. IV.8 (goal-first authoring), Art. IV.2 (`DoelKoppeling` status).
- **Backlog:** E1-02/10/11, E2-07, E6-05.
- **FR/NFR:** FR-3 (incl. 3.3 resolved per-level), feeds FR-4/FR-5/FR-9.
