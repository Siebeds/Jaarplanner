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
| E0 — Project foundation & scaffolding | [E0-foundation.md](E0-foundation.md) | 0 (pre) | 9 | 6 | In progress |
| E1 — Curriculum & content fundament | [E1-curriculum-content.md](E1-curriculum-content.md) | 1 | 11 | 0 | Todo |
| E2 — AI-matching thema ↔ doel | [E2-ai-matching.md](E2-ai-matching.md) | 2 | 7 | 0 | Todo |
| E3 — Jaarplan-generatie & kalender | [E3-jaarplan-kalender.md](E3-jaarplan-kalender.md) | 3 | 10 | 0 | Todo |
| E4 — Manuele bewerking & (her)generatie | [E4-bewerking-hergeneratie.md](E4-bewerking-hergeneratie.md) | 4 | 7 | 0 | Todo |
| E5 — Dekking & export | [E5-dekking-export.md](E5-dekking-export.md) | 5 | 9 | 0 | Todo |
| E6 — Beheer, rollen & samenwerking | [E6-beheer-rollen-samenwerking.md](E6-beheer-rollen-samenwerking.md) | 6 | 9 | 0 | Todo |
| E7 — Niet-functioneel & overkoepelend | [E7-niet-functioneel.md](E7-niet-functioneel.md) | cross-cutting | 10 | 0 | Todo |
| E8 — Fast-follow (post-MVP) | [E8-fast-follow.md](E8-fast-follow.md) | post-MVP | 6 | 0 | Todo |
| **Totaal** | | | **78** | **6** | **8%** |

## Milestones (MVP)

- **M0 — Skeleton up** (E0): repo scaffolded, Postgres + API + SPA run locally, CI green.
- **M1 — Fundament** (E1): Op.stap goals imported, school thema's imported & manageable, data model live.
- **M2 — AI koppelt** (E2): teacher gets accept/reject thema↔doel suggestions with motivation.
- **M3 — Plan & kalender** (E3): a year plan is generated and shown in the drag-and-drop calendar.
- **M4 — Volledige controle** (E4): manual edits + full/partial regeneration with locked blocks.
- **M5 — Bewijs van dekking** (E5): coverage down to minimumdoel level, exportable.
- **M6 — School-breed** (E6): admin, roles/permissions, cross-class overviews, collaboration view.
- **MVP complete** = M0–M6 + E7 (non-functional) satisfied.

## Open decisions that gate stories (see [Art. XIV](../CONSTITUTION.md#article-xiv--open-decisions-awaiting-directie))

Stories blocked on these are marked `[!]`:
- Planningsblok granularity (themaperiode 4–6 wk / subthemaperiode ~2 wk vs. month/week) — **do not hard-assume months**.
- Disciplines first (all vs. starter selection); `cluster` presence per discipline.
- `leergebied`/Wereldoriëntatie surfacing & mapping; `jaarFase` code form (1K/2K/3K ↔ JK/K2/K3).
- Op.stap import source (manual per-discipline Excel vs. automated).
- Teacher visibility scope; export formats & layouts; coverage depth (binary vs. herhaling/opbouw).
