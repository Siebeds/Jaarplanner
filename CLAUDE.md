# CLAUDE.md — Jaarplanner

Project context for Claude Code. Read this at the start of every session.

> **Source of truth:** [`CONSTITUTION.md`](CONSTITUTION.md) governs *how* we build and the non-negotiable principles; [`docs/Functionele_Analyse_Jaarplanner.md`](docs/Functionele_Analyse_Jaarplanner.md) is the source of truth for *scope*. On any conflict, the constitution wins. Keep this file consistent with both.
>
> **Backlog & progress:** the build plan lives in [`backlog/`](backlog/README.md) — epics (E0–E8) aligned to the build order, with checkbox-tracked stories citing their FR + Constitution article. **Consult it to know what to do next, and update the story checkbox + the progress table in [`backlog/README.md`](backlog/README.md) as work completes.** The backlog is subordinate to the constitution — if a story conflicts, fix the story.
>
> **Architecture decisions:** the technical architecture is recorded as ADRs in [`docs/adr/`](docs/adr/README.md) (ADR-0001…0026), each with a **compliance trace** to the Constitution article(s) and backlog epic(s) it realises (see the traceability matrix in the ADR index). Consult the relevant ADR before building a component; record any new significant decision as a new ADR (supersede, never rewrite). ADRs are subordinate to the constitution.
>
> **UI/UX:** the current design approach is [ADR-0024](docs/adr/0024-single-frontend-inkt-en-signaal.md) — one frontend at `frontend/`, direction "Inkt en Signaal": the chrome is paper and ink plus one rationed accent, because Art. XII already spends every other usable hue on meaning, Radix primitives without shadcn, design tokens in `frontend/src/index.css`, mobile-first with a two column layout from `lg`. It supersedes decisions 1, 2, 3 and 5 of [ADR-0017](docs/adr/0017-ui-ux-design-system.md), which still governs WCAG 2.2 AA and Dutch copy; the older narrative in [`docs/ux/ui-ux-approach.md`](docs/ux/ui-ux-approach.md) predates the rebuild, so read the ADRs first where they disagree.

## What this is
**Jaarplanner** is a web app for a Flemish Catholic primary school (kleuter- en lager onderwijs, 2,5–12 yr). It helps teachers map their existing **thema's** and **activiteiten** onto the learning goals of the new **Op.stap** curriculum (Katholiek Onderwijs Vlaanderen), generate an AI-assisted year plan per class, adjust it via drag-and-drop, and prove coverage of every **minimumdoel** (the government attainment targets). Users: teachers (per class) and directie (school head). **The UI is in Dutch; users are non-technical.**

Full requirements live in [`docs/Functionele_Analyse_Jaarplanner.md`](docs/Functionele_Analyse_Jaarplanner.md) (v0.4 body + Bijlage A refinements; original at `assets/Functionele_Analyse_Jaarplanner.docx`). **This file is the source of truth for the *build*; the functional analysis is the source of truth for *scope*; and [`CONSTITUTION.md`](CONSTITUTION.md) wins on any conflict.**

## Status
**Phase 3 — in progress.** **M0 and M2 are reached.** **M2 was restored 2026-07-30** by E2-08, which gave FR-4.1 the invocation surface it never had: a teacher generates doelsuggesties from `/themas` and reviews them, verified in a browser against a real API and PostgreSQL. **E2 is complete** apart from **E2-09** (a missing AI config returns 500 where 503 belongs — filed, not blocking).

**E1 is not complete** and **M1 is *not* reached**, for two independent reasons: E1-03/E1-04 are reopened and blocked on **E1-12** (decreed-minimumdoelen import), which needs the source file from directie — until then no `Minimumdoel` row can exist and minimumdoel-level coverage, the level the onderwijsinspectie tests, returns nothing; and **most of E1 is still not teacher-facing**. **E1-16 closed 2026-07-31** and gave E1 its first screen (the Doelen-register behind the nav item E0-10 shipped), so "E1 has no UI at all" is no longer true; both teacher-facing halves now exist: **E1-13** landed the import flow and **E1-14 closed 2026-08-04** with the thema-/activiteitenbeheer screens, in two landings and after four antagonist rondes. What still blocks **M1** is the curriculum half alone: **E1-12** needs the decreed-minimumdoelen file from directie.

**E0 is a complete epic again**: **E0-10** — the app shell no story owned (routing, navigatie, klas/schooljaar-keuze, plus a UI redesign) — **closed 2026-07-30** after the browser pass and the antagonist audit. **`E3-06` is the only story left in E3** — `[~]`, awaiting the directie/teacher review that closes it, which the owner postponed to near the end of the build. **E3-03 is no longer blocked on E5:** E5-01 unblocked it on 2026-08-03, it was built on 2026-08-05 and **closed 2026-08-06 by owner ruling** after four antagonist rondes. **E3-07** (drag-and-drop) was closed 2026-07-30, **reopened 2026-08-03 by owner ruling** over a stale *rejected* card that both invited the teacher to pick a period and said the thema could not be moved, and **closed again 2026-08-04** on `story/E3-07-kaartstatus` (`92c7dcb`) after five antagonist rondes ending **COMPLIANT**. *(This sentence claimed the reopening was still open for fifteen days; it is corrected 2026-08-19 rather than deleted, because the stale clause is the more useful record — a status line that names a date goes on looking verified long after the date stops meaning anything.)* **E3-04 closed 2026-07-31** once the browser pass finally ran (headless Chrome from Bash, after both gate agents died on an org spend limit): the generation settings are kept per klas × schooljaar, which is what the owner's 2026-07-30 ruling required and what E4's regeneration inherits.

**E4 is all but complete: two stories remain, E4-07 and E4-09 (filed the same day).** *(Paragraph rewritten by the technical lead on 2026-08-19; it had read *"E4 has started"* since 2026-08-03, five closed stories ago, and would have told an owner restarting after twelve idle days to look in the wrong epic.)* **E4-01, E4-02, E4-03, E4-04, E4-06 and E4-08 are closed and on `main`**, and **E4-05** (één periode hergenereren, FR-8.2) landed as **PR #37** (`96a9060`) on 2026-08-07 — its checkbox stayed `[~]` for twelve days and was corrected in the same sweep, so the progress table read one low the whole time. **E4-07 is buildable since 2026-08-19**: the preserve/overwrite rule was **FR-7.3's** *"ter beslissing"* clause — FR-8.3 owns the diff and cancel, not the rule, and it is **not** an Art. XIV bullet either (it is on none of the fourteen, and calling it one makes Art. XI.2's machinery look applicable when it is not) — and **the project owner ruled it that day: a placement the teacher has decided on (`Aanvaard`, `Geweigerd` or `Manueel`) always survives a (re)generation**, which is the behaviour that already ships. Directie's confirmation is recorded as outstanding in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md); building proceeds on the owner's ruling, which is the conservative option. *(This sentence read "and it cannot be built" for the few hours between the lead's sweep and the ruling; recorded rather than silently overwritten, because the previous version of this paragraph went stale for twelve days in exactly this way.)* **No string was rewritten, and that is not the same as every string being true** — two carry a documented exception (a drag ending in its own period writes nothing, so a *verplaatst* thema can still be discarded) and two more are under suspicion and owned by **E4-09**. *The fifteen-key set itself is in the E4-07 entry and deliberately not enumerated here: this paragraph has already shipped three different counts of it, each one short.* What remains is the pre-apply diff and its cancel (FR-8.3). Details and the reasoning: the E4-07 entry in [`backlog/E4-bewerking-hergeneratie.md`](backlog/E4-bewerking-hergeneratie.md). **E4-06** remains the story worth remembering for its lesson rather than its scope: the lock had a server, an endpoint and a badge and no switch, the fourth instance of the reachable-vs-tested gap after E2-08, E1-15 and E0-10 — a class that has since recurred through E4-03, E4-04 and E4-05's own copy findings.

> **Deliberately no story counts here.** They lived in this paragraph and drifted twice in one day — corrected, then re-falsified by the next commit. [`backlog/README.md`](backlog/README.md) holds the live numbers; a figure you have to remember to sync is a figure that will be wrong.

> [`backlog/README.md`](backlog/README.md) is the source of truth for live progress — consult it rather than this paragraph, and keep this in rough sync at epic boundaries.

## Working agreements (read before writing code)
- **Antwoord de projecteigenaar altijd in het Nederlands.** *(Staande instructie van de projecteigenaar, 2026-07-30.)* Alle chatantwoorden, samenvattingen, statusupdates en vragen aan de eigenaar zijn in het Nederlands, ongeacht de taal waarin de vraag gesteld is. Dit gaat over de **communicatie**, niet over de code: de bestaande afspraken hieronder blijven onveranderd gelden, dus domeinnamen blijven Nederlands, generieke code, technische identifiers en **codecommentaar blijven Engels**, en gebruikersteksten blijven in `nl.json`. Commit messages, ADR's, backlogteksten en worklogs blijven in het Engels zoals ze nu zijn: die zijn geschreven voor wie later de code leest, en halverwege van taal wisselen zou het archief onleesbaar maken. Twijfel je over een artefact: is het een gesprek met de eigenaar, dan Nederlands; is het een artefact in de repo, dan volg je wat er al staat.
- **Domain language is Dutch.** Use Dutch names for domain entities and concepts in code (`Leerplandoel`, `Minimumdoel`, `Doelsoort`, `Thema`, `Jaarplan`, `Dekking`, …). Keep generic/infrastructure code, technical identifiers, tooling, and comments in **English**. Rationale: *leerplandoel* vs *minimumdoel* have no clean English equivalent — translating loses meaning.
- **User-facing strings are Dutch** and centralised in `frontend/src/i18n/nl.json` — never hard-code Dutch text in components.
- **Imported Op.stap goals are read-only reference data.** Never mutate the official content of a leerplandoel/minimumdoel. Teachers may add internal labels/ordering only.
- **AI is advisory (human-in-the-loop).** Every AI suggestion (goal match, generated plan) must be reviewable and accept/reject-able; persist the status. Nothing is "final" without teacher confirmation.
- **No secrets in the repo.** .NET user-secrets locally, Azure Key Vault in the cloud. AI keys live server-side only — never expose them to the frontend. *One narrow ratified exception (2026-07-30):* throw-away **local/CI test-database** credentials may be committed — see [`CONSTITUTION.md` Art. VI.4](CONSTITUTION.md#article-vi--roles-privacy--security). Nothing else qualifies.
- **No pupil personal data in the MVP** (GDPR). Staff accounts only; host in an EU region.
- **Any UI work starts with the `frontend-design` skill.** *(Standing instruction from the project owner, 2026-07-29.)* Before building a new screen or changing how an existing one looks, invoke the **`frontend-design`** skill and design deliberately against this application's own principles — not the generic defaults. That means:
  - **The users are non-technical teachers and a directie, in Dutch.** *Overzichtelijk* beats exhaustive. The data must dominate; explanatory prose is the first thing to cut, and it never gets repeated per row when once above the list will do.
  - **Colour is already spoken for.** Art. XII fixes six doelsoort hues, and the tokens spend more on suggestiestatus and dekking. The chrome therefore gets **one** structural hue plus one attention hue — a second chrome accent competes with the signal the tool exists to send. Never introduce a hue without checking what it collides with. *Renamed 2026-08-30 (ADR-0024):* that structural hue was the token `petrol` in the frontend that has now been retired; it is `--color-accent` (hue 187) in the current one, declared in `frontend/src/index.css`, and the rule tightened rather than changed — the accent is rationed to exactly five uses (primary action, active destination, focus ring, year-strip fill, selected row), listed above its declaration. The principle is unchanged; only the name and the file moved.
  - **Never colour alone** (Art. XII, WCAG 2.2 AA): every state also carries a label or icon.
  - **Contrast must be measured in a real browser.** jsdom cannot evaluate colour, so a green axe run says nothing about the palette — that gap has produced WCAG failures here twice. Composite alpha when you measure; a check that treats a 10% tint as a solid fill lies in both directions. Beware opacity on already-muted text: `text-ink-zacht/80` measures 3.66:1.
  - **No em dashes in user-facing copy.** *(Owner, 2026-07-29.)* Rewrite the sentence — split the clause or use a colon — rather than deleting the character and leaving limp Dutch. En dashes in date ranges are fine.
  - **Copy the frontend authors itself goes in `nl.json`** (Art. II.3). *A stale clause was struck here on 2026-08-06 (E5-06, on its antagonist's note):* this line used to end *"and never render a server-generated string to a user while the Art. II.3 ruling is open"*, and that ruling **landed on 2026-07-30** (`e420648`), so the condition had been false for a week while the instruction still read as binding. The ratified rule is that **the language of a message follows who it is for, not which layer produced it**: a message a teacher or directie can act on is Dutch and **may be composed server-side**, a message only an operator can act on is English, and UI chrome, labels and buttons stay in the catalogue. Server-composed Dutch therefore needs no permission, but it does need a guard that reads the **value** rather than the key, because nothing keeps a server sentence and its `nl.json` twin in step.
  - **Restart the Vite dev server after editing the `@theme` block in `frontend/src/index.css` or adding a font.** A running server keeps the old config, so new utilities silently generate *no CSS* while the CSS variables resolve fine — the page then looks "designed but colourless", or keeps the old typeface. This cost two debugging round trips on E0-10; `pnpm build` proves whether the config itself is right. *Updated 2026-08-30 (ADR-0024):* this said `tailwind.config.js`, which no longer exists — Tailwind v4 configures in CSS. The hazard is the same one, in the new location.
  - **Look at it before claiming it works.** Open the real app in a browser at desktop *and* ~390px. This repo's record is that looking finds what tests do not: a skip-link covering the wordmark, a redirect stealing focus, a picker overlapping its own label, a period column stretched to 600px of white — none of which any passing test noticed.
  - **Never ship a control that does nothing** (the E3-06 rule). An unbuilt destination says so in visible text, not in a `title` tooltip.
  - **A conditional sentence may assert only what its own render condition guarantees** *(the E5-03 rule, 2026-08-06)*. Ask what the branch you are writing inside actually proves, and delete every clause that reaches past it: *"tellen mee in dit cijfer"* presupposed a figure a different branch owned. It binds code comments too. **The corollary is the half that saves you: when the honest explanation is forbidden, say less, never say something else** — that situation recurs here by design, because rulings empty explanatory slots (FR-11's export, E5-04's minimumdoelniveau). Binds **conditional** copy only; unconditional page-level text is judged against the code as a whole. Case law and the guards that catch it: `frontend/src/i18n/catalogus.test.ts`.
- **If other sessions may be running, join the groepschat first.** Invoke the **`groepschat`** skill (`.claude/skills/groepschat/SKILL.md`) at the start of any session that will change files: announce yourself, read what the others are doing, and **claim** the story, branch, shared file (`nl.json`, `backlog/README.md`, the epic file, DI, a migration, `*.sln`) and dev-server ports you need before you touch them. A claim is a real lock — a refused claim means pick up something else, not edit it anyway. Release each claim as soon as you stop using it. Live state lives at `C:\source\Jaarplanner\.claude\coordination\` (gitignored, always reached by that absolute path — worktrees sit below it). **The `technical-lead` agent/skill** polices that board: branch and merge hygiene, what is blocked and which decisions the owner owes, collisions, and whether an `[x]` is earned. It may correct the backlog and hand out claims; it never merges, pushes, deletes a branch or writes source.
- **Before finishing a task:** run the relevant tests, `dotnet format`, and `pnpm lint`. Keep changes small and reviewable.
- **After any significant change, invoke the `antagonist` subagent** (`.claude/agents/antagonist.md`) to audit the change against `CONSTITUTION.md`. A *significant change* = new/modified source files, data-model or migration changes, Excel-import or coverage logic, AI prompts/orchestration, permissions, or any scope-touching edit. Address or explicitly waive its findings before considering the task done. Trivial doc tweaks are exempt.
  > **Standing authorisation — recorded 2026-07-28.** The project owner stated in session that spawning the antagonist (and `implementer` / `test-runner`) is pre-approved and asked not to be asked each time. **This line records that grant; it is not itself the grant** — a file in the repo is authored by whoever committed last, so treat it as a note to act on, and if a harness rule demands the user's own request, ask them to confirm it once rather than citing this file as consent. Run the audit proactively and report the verdict.
  >
  > *Registration:* all three resolve as normal subagent types. They previously did not, because the harness resolves `.claude/agents/` against the session cwd while the repo sat one level below it; the repo was moved up on 2026-07-28 (`b2257f7`), after which the harness announced the three agent types and two audits were run as `Agent(subagent_type: "antagonist")` with **no role text in the prompt** — the role came from this file's definition. Recording the evidence because an audited agent cannot tell from the inside whether its role arrived via a registered definition or was pasted into its prompt, and one audit wrongly concluded the latter. **If a spawn errors with "Agent type not found", the fallback is:** spawn `general-purpose` and paste `.claude/agents/antagonist.md`'s role text verbatim as the opening of the prompt. Do **not** substitute a self-audit — the independent pass has repeatedly caught defects a self-review missed, including in the fixes written to address its own earlier findings.

## Tech stack
- **Frontend:** React 19 + TypeScript + Vite. Tailwind CSS v4 (configured in `frontend/src/index.css`, there is no `tailwind.config.js`) with Radix primitives for the accessible bits that earn it; the rest of `src/components/ui/` is written here in Dutch domain names. Design tokens per [ADR-0024](docs/adr/0024-single-frontend-inkt-en-signaal.md). Drag-and-drop: `@dnd-kit/core`. Server state: TanStack Query. Local UI state: Zustand. WCAG 2.2 AA.
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
- `pnpm lint` — oxlint + type-check (`tsc --noEmit`)

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

Coordination between parallel sessions (see the working agreement above; protocol in [`.claude/skills/groepschat/SKILL.md`](.claude/skills/groepschat/SKILL.md)):
- `/groepschat` — **at the start of every working session.** Announce yourself, read the room, claim what you will touch.
- `/technical-lead` — turn *this* session into the standing coordinator. Use a second window for it.
- `/loop 20m /technical-lead` — unattended watching. Keep each sweep cheap (chat tail + claims + `git worktree list` first); a full sweep every 20 minutes just re-derives an unchanged answer.
- Spawn the **`technical-lead`** agent for a one-off board sweep from inside a session that is busy building.

> **Nobody has to remember these.** The `groepschat` bullet in the working agreements is the standing instruction, and the skill descriptions carry their own triggers, so **an agent invokes them without being asked** — proactively offer a lead sweep when several worktrees are live rather than waiting for the owner to think of it. This block exists so the owner can look the commands up, not as the mechanism that makes them happen.

## Architecture
- **Frontend:** SPA over a REST/JSON API. Organise by feature (`jaarplan`, `doelen`, `themas`, `dekking`). The **kalender + drag-and-drop** and the **dekkingsoverzicht** are the two anchor screens.
- **Backend:** pragmatic layered API — `Domain` (entities, invariants, Dutch ubiquitous language) ← `Application` (use cases, AI orchestration, mapping) ← `Infrastructure` (EF Core, Excel import, Azure AI). `Api` is thin. This is a small app — favour clarity over ceremony; don't over-engineer.
- **AI flow:** frontend requests a match or generated plan → `Application` builds a prompt from the relevant doelen + thema's/activiteiten → calls Azure AI Foundry → parses a **structured JSON** response → returns suggestions with a short motivation and `status = voorgesteld`. Teacher accepts/rejects in the UI.
- **Goals data flow:** Op.stap Excel (one file per discipline) → `Infrastructure` import → `Leerplandoel`/`Minimumdoel` tables. School data (thema's/activiteiten) arrives via a separate Excel upload (FR-1).

## Data model (core entities)
> **Refined model is in [`CONSTITUTION.md` Art. IX](CONSTITUTION.md#article-ix--core-data-model-functional).** It adds `Discipline` (numbered, 9.x split), `Themadoel` (2–3 school-wide anchors), `Subdoel` (per subthema × leeftijd), rich `Thema`/`Subthema`/`Activiteit` attributes, and **level-dependent scoping** (Thema/Themadoel/kernwoordenschat school-wide; Subthema/Subdoel/Activiteit **per leeftijd** since 2026-08-30, [ADR-0025](docs/adr/0025-subthema-per-leeftijd.md)). On conflict the constitution wins. The list below is the original sketch.

- **Klas** — id, naam (e.g. "L3 derde leerjaar"), a required `jaarfase` (JK, K2, K3, L1–L6) with `leerjaar` derived from it ([ADR-0025](docs/adr/0025-subthema-per-leeftijd.md)). A klas is what a teacher plans **in**; since 2026-08-30 it is no longer what content belongs **to**, so a subthema reaches it by matching leeftijd rather than through a foreign key.
- **Leerplandoel** — code (unique), doelsoort, jaarFase, domein, subdomein, cluster?, tekst, voorbeelden?, toelichting?, woordenschat?, `minimumdoelRef` (concordance). Read-only reference data.
- **Minimumdoel** — ref, leeftijd (K-/4-/6-), nr, omschrijving. The decreed eindterm; concorded to leerplandoelen.
- **Thema** — id, naam, subthema's[], activiteiten[].
- **DoelKoppeling** (formerly **ThemaDoel**, see Art. IX.2) — link school-content↔Leerplandoel with `status` (voorgesteld/aanvaard/geweigerd/manueel) and `aiMotivatie`.
- **Jaarplan** — klasId; per **planningsblok** a list of thema's, with a `vergrendeld` flag per thema. **A (re)generation discards only a placement that is `Voorgesteld` and not `vergrendeld`** — a placement the teacher decided on survives without a lock, so the flag only ever changes a run outcome for a `Voorgesteld` placement. *Do not paraphrase this as "an untouched proposal": a drag ending in the period it started in writes nothing, so a placement the teacher did touch stays `Voorgesteld` and is discarded.* *Owner ruling 2026-08-19, and since that date it is in the constitution: [Art. IX.3](CONSTITUTION.md#article-ix--core-data-model-functional) plus its ratification-log entry. Directie's confirmation is still outstanding (question 6 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md)).* Planningsblok granularity is **ratified (directie 2026-07-14)**: two-tier default = themaperiode (4–6 wk) + subthemaperiode (~2 wk), configurable behind the E3-05 seam — still never hard-assume months; see [`CONSTITUTION.md` Art. IX.3](CONSTITUTION.md#article-ix--core-data-model-functional).
- **Generatieparameters** — the pre-generation parameters (FR-5.4), **kept per (klas, schooljaar)** so (her)generatie honours them; startthema's key on the block's `blokStart`, never an ordinal. See [`CONSTITUTION.md` Art. IX.3](CONSTITUTION.md#article-ix--core-data-model-functional).
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
- **Jaarplan / planningsblok** — the year plan per class / a time slot (ratified two-tier default: themaperiode 4–6 wk + subthemaperiode ~2 wk, configurable behind a seam — do not assume months).
- **Startthema / vast moment** — the two pre-generation parameters (FR-5.4): a *preference* for which thema opens a period, and a committed day **inside** a period that may block placement. A closure (vakantie, vrije dag) is a `Schoolsluiting` on the schooljaar, never a vast moment.
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
- ~~Planningsblok granularity~~ — **resolved (directie 2026-07-14):** two-tier default = themaperiode (4–6 wk) + subthemaperiode (~2 wk), configurable behind the E3-05 seam.
- Handling of graadklassen / menggroepen.
- Whether a leerplandoel/thema is shared school-wide or per class.
