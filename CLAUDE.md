# CLAUDE.md — Jaarplanner

Operational guidance for Claude Code. Keep it short and current: live status is in [`backlog/README.md`](backlog/README.md),
history in git, the ADRs and [`docs/constitutie-log.md`](docs/constitutie-log.md), not here.

**Sources of truth.** [`CONSTITUTION.md`](CONSTITUTION.md) governs how we build and wins on any conflict.
[`docs/Functionele_Analyse_Jaarplanner.md`](docs/Functionele_Analyse_Jaarplanner.md) governs scope.
[`backlog/`](backlog/README.md) holds the epics and live progress; new work enters as tickets
([`backlog/TICKETS.md`](backlog/TICKETS.md)). Architecture decisions are ADRs in [`docs/adr/`](docs/adr/README.md):
consult the relevant one before building a component, and record a new significant decision as a new ADR (supersede,
never rewrite). UI direction: [ADR-0024](docs/adr/0024-single-frontend-inkt-en-signaal.md) ("Inkt en Signaal"), with
[ADR-0017](docs/adr/0017-ui-ux-design-system.md) still governing WCAG 2.2 AA and Dutch copy.

## What this is
**Jaarplanner** is a web app for a Flemish Catholic primary school (kleuter en lager, 2,5–12 jr). Teachers map their
own **thema's** and **activiteiten** onto the goals of the **Op.stap** curriculum (Katholiek Onderwijs Vlaanderen),
generate an AI-assisted year plan per klas, adjust it by drag-and-drop, and prove coverage of every **minimumdoel**
(the decreed attainment targets the onderwijsinspectie tests). K3 teachers also write an **ontwikkelingsrapport** per
child. The users are leerkrachten and directie: non-technical, and the UI is Dutch.

## Working agreements
- **Antwoord de projecteigenaar altijd in het Nederlands.** Dat gaat over de communicatie, niet over de code:
  code, commentaar, commits, ADR's, de epic-backlog en worklogs blijven Engels. De tickets in
  `backlog/functionele-backlog/` en `backlog/technische-backlog/`, en `backlog/TICKETS.md`, zijn Nederlands (Art. II.6).
- **Domain language is Dutch** in code (`Leerplandoel`, `Minimumdoel`, `Thema`, `Dekking`, …); generic code,
  identifiers and comments are English.
- **User-facing strings live in `frontend/src/i18n/nl.json`**; never hard-code Dutch in a component. A message a
  teacher or directie can act on may be composed server-side in Dutch; an operator-only message is English (Art. II.3).
- **Imported Op.stap goals are read-only.** Teachers add internal labels and ordering only.
- **AI is advisory.** Every suggestion is reviewable and accept/reject-able, stored as `voorgesteld` with a motivation,
  and final only after the person with the right decides it (Art. IV.1, VI.1). Exception: an ontwikkelingsrapport
  rewrite stores no proposal and no motivation, only the decision.
- **No secrets in the repo** (user-secrets locally, Key Vault in Azure; AI keys server-side only). Only throw-away
  local/CI test-database credentials may be committed (Art. VI.4).
- **No pupil data outside the K3 ontwikkelingsrapport**, and inside it only what Art. VI.7 allows; no pupil content in
  logs. **No real child's name anywhere in the repo**: not in tests, seeds, screenshots, worklogs or tickets.
- **No work without a ticket or a story** ([ADR-0033](docs/adr/0033-ticketbacklog-en-kanbanbord.md)). Epic stories
  (`E<n>-<nn>`) go through the `jaarplan-build` skill. For anything else, find the ticket, or first create a TB ticket
  with `ticket-aanmaken`, then work it with `ticket-uitvoeren`. A ticket's status and Werklog change only through
  `node tools/backlog-board/tickets.mjs`; never work around a refusal. Only the owner moves an FB ticket's status by
  hand; a session moves it only through the CLI while working it.
  Exempt: questions, read-only investigation, edits to ticket files, and backlog bookkeeping.
- **Parallel sessions each work in their own worktree** under `.claude/worktrees/`, never by switching branches in the
  shared checkout. There are no file locks: any session may edit `nl.json` or another shared file, and conflicts are
  resolved at merge. Two unmerged branches that each add an EF migration: whoever merges second regenerates theirs.
- **Before finishing:** the relevant tests, `dotnet format` and `pnpm lint`. Keep changes small and reviewable.
- **Antagonist:** after a significant change (source, data model or migration, import or coverage logic, AI prompts,
  permissions, scope), spawn the `antagonist` agent **once**, on the finished story or ticket. Only CRITICAL and MAJOR
  findings block: fix them and ask for a re-audit of just those, at most two rounds, after which the owner decides.
  Fix MINOR findings when cheap or list them in the worklog; they never start a new round (Art. X.7, XIII,
  [ADR-0037](docs/adr/0037-lichter-agentproces.md)). The owner has pre-approved spawning `antagonist`, `implementer`
  and `test-runner`. If a spawn errors with "Agent type not found", spawn `general-purpose` with
  `.claude/agents/antagonist.md` pasted as the opening of the prompt; never substitute a self-audit.
- **Write the rule as it stands now**, here and in the constitution. The date and the reason belong in the commit, the
  ADR or `docs/constitutie-log.md`, not next to the rule.

### UI work
Start any new screen, or any change to how one looks, with the **`frontend-design`** skill, and design against this app:
- **Overzichtelijk beats exhaustive.** The data dominates; explanatory prose is the first thing to cut, and is never repeated per row.
- **Colour is spoken for.** Art. XII gives six doelsoort hues, and suggestiestatus and dekking use more. The chrome has one accent, `--color-accent` in `frontend/src/index.css`, rationed to the five uses listed above its declaration, plus one attention hue. A control that calls the AI is an `AiKnop`, and only such a control wears its rainbow ring ([ADR-0039](docs/adr/0039-ai-knoppen-regenboogring.md)). Check what a new hue collides with before adding it.
- **Never colour alone:** every state also carries a label or icon (WCAG 2.2 AA).
- **Measure contrast in a real browser**, compositing alpha; jsdom cannot evaluate colour. Beware opacity on muted text: `text-ink-zacht/80` measures 3.66:1.
- **No em dashes in user-facing copy:** rewrite the sentence (split it, or use a colon). En dashes in ranges are fine.
- **A conditional sentence asserts only what its own render condition guarantees.** When the honest explanation is forbidden, say less, never something else. Cases and guards: `frontend/src/i18n/catalogus.test.ts`.
- **Never ship a control that does nothing**; an unbuilt destination says so in visible text.
- **Restart Vite after editing the `@theme` block or adding a font**; a running server silently generates no CSS for new utilities.
- **Look at it before claiming it works:** the real app, at desktop and at ~390px.

## Tech stack
- **Frontend:** React 19 + TypeScript + Vite; Tailwind CSS v4 (configured in `frontend/src/index.css`, no `tailwind.config.js`); Radix primitives where they earn it, the rest of `src/components/ui/` written here; `@dnd-kit/core`; TanStack Query; Zustand.
- **Backend:** ASP.NET Core Web API (C#) on the .NET LTS pinned in `global.json`; EF Core + Npgsql; ClosedXML (never EPPlus).
- **Database:** PostgreSQL (local via Docker). **AI:** Azure AI Foundry (EU data zone) or the Anthropic Claude API (no EU guarantee), picked by `Ai:Provider` ([ADR-0048](docs/adr/0048-claude-api-als-tweede-ai-provider.md)), backend only. **Hosting:** Azure.

## Repository structure
```
frontend/src/{features,components,lib,i18n/nl.json}
backend/src/Jaarplanner.{Api,Application,Domain,Infrastructure}
backend/tests/Jaarplanner.{UnitTests,IntegrationTests}
backlog/               epics, tickets (functionele-/technische-backlog), worklogs
docs/                  functional analysis, ADRs, besluiten-gevraagd.md, constitutie-log.md
tools/backlog-board/   ticket CLI and local kanban board
```

## Development commands
- **Frontend** (`cd frontend`): `pnpm install` · `pnpm dev` · `pnpm build` · `pnpm test` (Vitest) · `pnpm lint` (oxlint + `tsc --noEmit`). Use `corepack pnpm` where pnpm is not on PATH.
- **Backend** (`cd backend`): `dotnet restore` · `dotnet run --project src/Jaarplanner.Api` · `dotnet test` · `dotnet format`.
- **Database** (from `backend`): `docker compose up -d db`, then
  - `dotnet ef migrations add <Name> --project src/Jaarplanner.Infrastructure --startup-project src/Jaarplanner.Api`
  - `dotnet ef database update --project src/Jaarplanner.Infrastructure --startup-project src/Jaarplanner.Api`
- **Tickets** (Node only): `node tools/backlog-board/server.mjs --open` (board on http://localhost:5199) · `node tools/backlog-board/tickets.mjs list | check | next-id | new | status | log | block | unblock | pr | release` · tests: `cd tools/backlog-board && node --test "test/*.test.mjs"`.
- **Skills:** `app-starten` (run the app for the owner), `deploy-demo` (the Azure demo), `technical-lead` (a sweep of the build, on request only).

## Architecture
- SPA over REST/JSON, organised by feature. Anchor screens: the **kalender with drag-and-drop** and the **dekkingsoverzicht**.
- Backend layered pragmatically: `Domain` ← `Application` (use cases, AI orchestration) ← `Infrastructure` (EF Core, imports, AI clients); `Api` is thin. A small app: clarity over ceremony.
- **AI flow:** the backend builds a prompt from the school's own doelen and thema's, calls the configured provider, validates a **structured JSON** response, and returns suggestions with a motivation and `status = voorgesteld`. The client sits behind an interface and is faked in tests. The one exception to grounding on school data alone is a woordweb's words (Art. IV.4, ADR-0043).
- **Op.stap goals** come from KOV's Op.stap API, backend only, G goals for now ([ADR-0032](docs/adr/0032-opstap-api-als-importbron.md), Art. VII.2). The minimumdoelen mapping is `OnderwijsdoelMapping`, the leerplandoelen mapping `CurriculumdoelMapping`, each kept in one place. The per-discipline Excel route (Art. VII.1) refuses every file once a leerplandoelen snapshot has been applied. School thema's and activiteiten arrive by Excel upload (FR-1).

## Domain model
The model is [`CONSTITUTION.md` Art. IX](CONSTITUTION.md#article-ix--core-data-model-functional), the glossary Art. XII, and the rights Art. VI.1 with the matrix in [ADR-0030 §3](docs/adr/0030-rollen-en-rechten-in-de-app.md#3-the-matrix-that-follows). The rules needed most while coding:
- `Thema`, `Themadoel` and kernwoordenschat are school-wide; `Subthema`, `Subdoel` and `Activiteit` are per **leeftijd** (jaarfase), not per klas; `AlgemeneFiche` is per klas. A klas has a required `jaarfase`.
- `DoelKoppeling` links content to a leerplandoel with a `status` (voorgesteld/aanvaard/geweigerd/manueel) and `aiMotivatie`.
- **Dekking is computed, never stored**, in two steps per klas, both shown: the dekkingsprognose and the dekking (Art. V.1). A minimumdoel counts only through a thema it is a themadoel of (placed, for dekking); a leerplandoel through a subthema at the klas's leeftijd (placed in the agenda, for dekking) or a planned algemene fiche of the klas. A thema's doelsuggestie proposes a minimumdoel and counts only as the themadoel its acceptance makes.
- **A (re)generation discards only a placement that is `Voorgesteld` and not `vergrendeld`.** A drag ending in its own period writes nothing, so that placement stays `Voorgesteld`.
- Planningsblokken: themaperiode (4–6 wk) and subthemaperiode (~2 wk), configurable behind the E3-05 seam; never assume months. Generatieparameters are kept per (klas, schooljaar); startthema's key on `blokStart`, never an ordinal.
- Rights, checked server-side: directie sees and edits everything; themabeheer edits thema's, runs the FR-1 import and the wizard, and with directie alone reviews doelsuggesties; a hoofdleerkracht per (schooljaar, jaarfase) owns that jaarfase's subthema's, subdoelen and goal links; a klastoewijzing gives a klas's planning; a leerkracht and a hoofdleerkracht read the planning of the klassen of their own jaarfase, themabeheer every klas, anyone else none ([ADR-0040](docs/adr/0040-klassen-inkijken-per-jaarfase.md)); Leerlingzorg reads every ontwikkelingsrapport.
- The ontwikkelingsrapport (K3 only, Art. IX.4 and VI.7) holds the only pupil data and never counts for dekking.
- A `Woordweb` (the brainstorm of step 3, [ADR-0043](docs/adr/0043-eigen-woordweb-per-subthema.md)) is personal: one per (gebruiker, subthema), read by everyone, edited by its owner and directie. Its AI words come from the model's own language knowledge (the Art. IV.4 exception), and it never counts for dekking.

## Testing
- **Backend (xUnit):** the dekking and concordance logic, the Op.stap API mapping and its HTML-to-text conversion, and the Excel import; integration tests against a Postgres test container.
- **Frontend (Vitest + Testing Library):** kalender drag-and-drop, suggestion accept/reject, the dekkingsoverzicht.
- The Op.stap import and the coverage calculation are the highest-risk logic (Art. V.6): cover them well.

## Open decisions
Art. XIV of the constitution lists what is still open, and [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md) what directie has been asked. Never hard-assume an open answer; isolate it behind a seam.
