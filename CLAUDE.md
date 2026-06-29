# CLAUDE.md — Jaarplanner

Project context for Claude Code. Read this at the start of every session.

> **Source of truth:** [`CONSTITUTION.md`](CONSTITUTION.md) governs *how* we build and the non-negotiable principles; [`docs/Functionele_Analyse_Jaarplanner.md`](docs/Functionele_Analyse_Jaarplanner.md) is the source of truth for *scope*. On any conflict, the constitution wins. Keep this file consistent with both.
>
> **Backlog & progress:** the build plan lives in [`backlog/`](backlog/README.md) — epics (E0–E8) aligned to the build order, with checkbox-tracked stories citing their FR + Constitution article. **Consult it to know what to do next, and update the story checkbox + the progress table in [`backlog/README.md`](backlog/README.md) as work completes.** The backlog is subordinate to the constitution — if a story conflicts, fix the story.
>
> **Architecture decisions:** the technical architecture is recorded as ADRs in [`docs/adr/`](docs/adr/README.md) (ADR-0001…0017), each with a **compliance trace** to the Constitution article(s) and backlog epic(s) it realises (see the traceability matrix in the ADR index). Consult the relevant ADR before building a component; record any new significant decision as a new ADR (supersede, never rewrite). ADRs are subordinate to the constitution.
>
> **UI/UX:** the design approach lives in [`docs/ux/ui-ux-approach.md`](docs/ux/ui-ux-approach.md) ([ADR-0017](docs/adr/0017-ui-ux-design-system.md)): Tailwind + Radix UI + shadcn/ui (copied in), design tokens for doelsoort/status/coverage, wireframes-first for the anchor screens, WCAG 2.2 AA.

## What this is
**Jaarplanner** is a web app for a Flemish Catholic primary school (kleuter- en lager onderwijs, 2,5–12 yr). It helps teachers map their existing **thema's** and **activiteiten** onto the learning goals of the new **Op.stap** curriculum (Katholiek Onderwijs Vlaanderen), generate an AI-assisted year plan per class, adjust it via drag-and-drop, and prove coverage of every **minimumdoel** (the government attainment targets). Users: teachers (per class) and directie (school head). **The UI is in Dutch; users are non-technical.**

Full requirements live in [`docs/Functionele_Analyse_Jaarplanner.md`](docs/Functionele_Analyse_Jaarplanner.md) (v0.4 body + Bijlage A refinements; original at `assets/Functionele_Analyse_Jaarplanner.docx`). **This file is the source of truth for the *build*; the functional analysis is the source of truth for *scope*; and [`CONSTITUTION.md`](CONSTITUTION.md) wins on any conflict.**

## Status
Greenfield — repo is empty apart from this file. When scaffolding, follow the structure and stack below and the MVP order in **Roadmap**.

## Working agreements (read before writing code)
- **Domain language is Dutch.** Use Dutch names for domain entities and concepts in code (`Leerplandoel`, `Minimumdoel`, `Doelsoort`, `Thema`, `Jaarplan`, `Dekking`, …). Keep generic/infrastructure code, technical identifiers, tooling, and comments in **English**. Rationale: *leerplandoel* vs *minimumdoel* have no clean English equivalent — translating loses meaning.
- **User-facing strings are Dutch** and centralised in `frontend/src/i18n/nl.json` — never hard-code Dutch text in components.
- **Imported Op.stap goals are read-only reference data.** Never mutate the official content of a leerplandoel/minimumdoel. Teachers may add internal labels/ordering only.
- **AI is advisory (human-in-the-loop).** Every AI suggestion (goal match, generated plan) must be reviewable and accept/reject-able; persist the status. Nothing is "final" without teacher confirmation.
- **No secrets in the repo.** .NET user-secrets locally, Azure Key Vault in the cloud. AI keys live server-side only — never expose them to the frontend.
- **No pupil personal data in the MVP** (GDPR). Staff accounts only; host in an EU region.
- **Before finishing a task:** run the relevant tests, `dotnet format`, and `pnpm lint`. Keep changes small and reviewable.
- **After any significant change, invoke the `antagonist` subagent** (`.claude/agents/antagonist.md`) to audit the change against `CONSTITUTION.md`. A *significant change* = new/modified source files, data-model or migration changes, Excel-import or coverage logic, AI prompts/orchestration, permissions, or any scope-touching edit. Address or explicitly waive its findings before considering the task done. Trivial doc tweaks are exempt.

## Tech stack
- **Frontend:** React 18 + TypeScript + Vite. Tailwind CSS + Radix UI + shadcn/ui (copied in) for accessible components; design tokens per [ADR-0017](docs/adr/0017-ui-ux-design-system.md). Drag-and-drop: `@dnd-kit/core`. Server state: TanStack Query. Local UI state: Zustand. WCAG 2.2 AA.
- **Backend:** ASP.NET Core Web API (C#) on the current **.NET LTS** — pin the exact SDK in `global.json`. Data access: EF Core + Npgsql. Excel parsing: **ClosedXML** (MIT; avoid EPPlus — commercial license).
- **Database:** PostgreSQL (local via Docker).
- **AI:** Azure AI Foundry (Azure OpenAI), called only from the backend.
- **Hosting:** Microsoft Azure.

## Repository structure (intended)
```
/
├─ CLAUDE.md
├─ docs/                         # functional analysis, POC prompt, decisions
├─ docker-compose.yml            # local Postgres
├─ global.json                   # pinned .NET SDK
├─ frontend/                     # React + TS + Vite
│  └─ src/
│     ├─ features/               # jaarplan, doelen, themas, dekking
│     ├─ components/             # shared UI
│     ├─ lib/                    # api client, shared types
│     └─ i18n/nl.json            # all Dutch UI strings
└─ backend/
   ├─ src/
   │  ├─ Jaarplanner.Api/            # endpoints/controllers, DI, auth (thin)
   │  ├─ Jaarplanner.Application/    # use cases, services, AI orchestration
   │  ├─ Jaarplanner.Domain/         # entities & value objects (Dutch domain language)
   │  └─ Jaarplanner.Infrastructure/ # EF Core, Postgres, Excel import, Azure AI client
   └─ tests/
      ├─ Jaarplanner.UnitTests/
      └─ Jaarplanner.IntegrationTests/
```

## Development commands
Frontend (`cd frontend`):
- `pnpm install` — install deps
- `pnpm dev` — dev server
- `pnpm build` — production build
- `pnpm test` — Vitest
- `pnpm lint` — ESLint + type-check

Backend (`cd backend`):
- `dotnet restore`
- `dotnet run --project src/Jaarplanner.Api` — run the API
- `dotnet test` — xUnit
- `dotnet format` — apply code style

Database / EF Core:
- `docker compose up -d db` — start local Postgres
- `dotnet ef migrations add <Name> --project src/Jaarplanner.Infrastructure --startup-project src/Jaarplanner.Api`
- `dotnet ef database update --project src/Jaarplanner.Infrastructure --startup-project src/Jaarplanner.Api`

> pnpm and the exact project names are conventions — once chosen, stay consistent.

## Architecture
- **Frontend:** SPA over a REST/JSON API. Organise by feature (`jaarplan`, `doelen`, `themas`, `dekking`). The **kalender + drag-and-drop** and the **dekkingsoverzicht** are the two anchor screens.
- **Backend:** pragmatic layered API — `Domain` (entities, invariants, Dutch ubiquitous language) ← `Application` (use cases, AI orchestration, mapping) ← `Infrastructure` (EF Core, Excel import, Azure AI). `Api` is thin. This is a small app — favour clarity over ceremony; don't over-engineer.
- **AI flow:** frontend requests a match or generated plan → `Application` builds a prompt from the relevant doelen + thema's/activiteiten → calls Azure AI Foundry → parses a **structured JSON** response → returns suggestions with a short motivation and `status = voorgesteld`. Teacher accepts/rejects in the UI.
- **Goals data flow:** Op.stap Excel (one file per discipline) → `Infrastructure` import → `Leerplandoel`/`Minimumdoel` tables. School data (thema's/activiteiten) arrives via a separate Excel upload (FR-1).

## Data model (core entities)
> **Refined model is in [`CONSTITUTION.md` Art. IX](CONSTITUTION.md#article-ix--core-data-model-functional).** It adds `Discipline` (numbered, 9.x split), `Themadoel` (2–3 school-wide anchors), `Subdoel` (per subthema × leeftijd), rich `Thema`/`Subthema`/`Activiteit` attributes, and **level-dependent scoping** (Thema/Themadoel/kernwoordenschat school-wide; Subthema/Subdoel/Activiteit per class & age). On conflict the constitution wins. The list below is the original sketch.

- **Klas** — id, naam (e.g. "L3 — derde leerjaar"), leerjaar.
- **Leerplandoel** — code (unique), doelsoort, jaarFase, domein, subdomein, cluster?, tekst, voorbeelden?, toelichting?, woordenschat?, `minimumdoelRef` (concordance). Read-only reference data.
- **Minimumdoel** — ref, leeftijd (K-/4-/6-), nr, omschrijving. The decreed eindterm; concorded to leerplandoelen.
- **Thema** — id, naam, subthema's[], activiteiten[].
- **DoelKoppeling** (formerly **ThemaDoel**, see Art. IX.2) — link school-content↔Leerplandoel with `status` (voorgesteld/aanvaard/geweigerd/manueel) and `aiMotivatie`.
- **Jaarplan** — klasId; per **planningsblok** a list of thema's, with a `vergrendeld` flag per thema (excluded from regeneration). Planningsblok granularity is an **open decision** (real cadence: themaperiode 4–6 wk / subthemaperiode ~2 wk) — do **not** hard-assume months; see [`CONSTITUTION.md` Art. IX.3 / XIV](CONSTITUTION.md#article-ix--core-data-model-functional).
- **Dekking** is computed, not stored: a leerplandoel is *gedekt* when linked (status aanvaard/manueel) to a thema placed in the plan; a minimumdoel is *gedekt* when ≥1 concorded leerplandoel is gedekt.

## Op.stap Excel → model mapping
One Excel file per discipline. Hidden columns may be empty. **Keep this mapping in one place** — Op.stap is still rolling out, so columns may change.

> **Taxonomy correction (see [`CONSTITUTION.md` Art. VII.0](CONSTITUTION.md#article-vii--opstap-taxonomy--excel--model-mapping)):** the official *ordeningskader* has only three levels — `Discipline → Domein → Subdomein`. `cluster` (col I) is **nullable** and lives in the per-discipline goal Excel, not the ordeningskader. `subdomein` names are not globally unique → group by `(domein, subdomein)`; identity stays `code`.

| Col | Op.stap | Maps to |
|-----|---------|---------|
| A | Doelsoort | `doelsoort` — enum: MD (minimumdoel), G (gemeenschappelijk), + (verdieping), P (precurriculum, illustratief), S (specifiek, illustratief), A (anderstalige nieuwkomers, illustratief) |
| B | LfMD | minimumdoel leeftijd (K- = einde 3e kleuter, 4- = 4e lj, 6- = 6e lj) |
| C | nrMD | minimumdoel nummer (decreet) |
| D | MD | B+C combined = concordance key → `minimumdoelRef` |
| E | Code | `code` (unique per leerplandoel) |
| F | Jaar/fase | `jaarFase` — JK, K2, K3, L1–L6 (or fase for P/S) |
| G | Domein | `domein` |
| H | Subdomein | `subdomein` |
| I | Cluster | `cluster` (optional) |
| J | Leerplandoel | `tekst` |
| K | Voorbeelden | `voorbeelden` (illustratief) |
| L | Toelichting | `toelichting` |
| M | Woordenschat | `woordenschat` (richtinggevend) |

## Domain glossary (NL ↔ EN)
- **Op.stap** — the new katholiek basisonderwijs curriculum; contains leerplandoelen + minimumdoelen + leerroutes.
- **Leerplandoel** — a curriculum goal (unique code) from Op.stap.
- **Minimumdoel / eindterm** — government-decreed attainment target; embedded in Op.stap; concorded to leerplandoelen.
- **Doelsoort** — goal type (MD / G / + / P / S / A); conventional colours: MD blue, G neutral, + green, P/S pink, A yellow.
- **Concordantie** — the link between leerplandoelen and minimumdoelen; enables minimumdoel-level coverage.
- **Discipline / domein / subdomein / cluster** — the Op.stap subject taxonomy (one Excel per discipline).
- **Leerroute** — an Op.stap learning trajectory (optional, later phase).
- **Jaar/fase** — JK, K2, K3 (kleuter) and L1–L6 (lager); minimumdoelen anchor at mijlpalen K3/L4/L6.
- **Thema / subthema / activiteit** — the school's own content building blocks.
- **Jaarplan / planningsblok** — the year plan per class / a time slot (granularity is an open decision; real cadence: themaperiode 4–6 wk / subthemaperiode ~2 wk — do not assume months).
- **Dekking** — coverage; **gap-analyse** — the missing-goals overview.
- **Graadklas / menggroep** — combined-grade class; a planning edge case to support.

## AI conventions (Azure AI Foundry)
- All AI calls are server-side; keys via Key Vault / user-secrets. Prefer an **EU data zone**.
- Always request **structured JSON** (goal codes + one-line motivation; or month→themes for plan generation) and validate it before use.
- Ground the model only on the school's own data (doelen + thema's/activiteiten) — no external sources.
- Return suggestions as `voorgesteld`; never auto-apply. Surface the motivation in the UI.
- The matching/plan logic must be testable with a **faked AI client** — inject the client behind an interface.

## Testing
- **Backend (xUnit):** unit-test the dekking/concordance logic and the Excel import. Integration-test the API against a Postgres test container.
- **Frontend (Vitest + Testing Library):** kalender (drag-and-drop), suggestion accept/reject, and the dekkingsoverzicht.
- **Highest-risk logic = the Op.stap Excel parser and the coverage calculation** — cover them well.

## Roadmap (MVP first)
MVP core (functional analysis FR-1..FR-10): Excel import of thema's/activiteiten (FR-1), inladen van Op.stap-leerplandoelen (FR-2), thema-/activiteitenbeheer (FR-3), AI-matching (FR-4), AI-jaarplangeneratie (FR-5), kalender + drag-and-drop (FR-6), manuele bewerking (FR-7), (her)generatie (FR-8), dekkingsoverzicht incl. minimumdoelniveau (FR-9), rollen/rechten + inkijken (FR-10).

Fast-follow: multi-class dekkingsdashboard (FR-9.4), samenwerking/opmerkingen (FR-10.3), kopiëren vorig schooljaar (FR-12.3), Op.stap-leerroutes.

## Open decisions (confirm before building deep)
- Which disciplines to include first (all vs. a starter selection).
- Op.stap import: manual per-discipline Excel download vs. an automated source.
- Planningsblok granularity (month / week / lesblok / themaperiode).
- Handling of graadklassen / menggroepen.
- Whether a leerplandoel/thema is shared school-wide or per class.
