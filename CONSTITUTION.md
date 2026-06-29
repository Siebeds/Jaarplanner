# Jaarplanner — Project Constitution

> **This file is the single source of truth for the Jaarplanner project.**
> Every decision, every change, every line of code and content is measured against it.
> When anything here conflicts with another document or with code, **this constitution wins** — unless the constitution itself is deliberately amended (see [Article XI — Amendment](#article-xi--amendment-process)).
>
> **Hierarchy of truth:**
> 1. This `CONSTITUTION.md` — governs *how* we build and the non-negotiable principles.
> 2. [`docs/Functionele_Analyse_Jaarplanner.md`](docs/Functionele_Analyse_Jaarplanner.md) — the source of truth for *scope* (the functional analysis, v0.4).
> 3. [`CLAUDE.md`](CLAUDE.md) — operational guidance for Claude Code; must stay consistent with this constitution.
>
> Authoritative source document: `assets/Functionele_Analyse_Jaarplanner.docx` (v0.4, 20 June 2026, by Siebe De Saedeleir). Supporting Op.stap reference material lives in `assets/`.

---

## Preamble

**Jaarplanner** is a web application for a Flemish Catholic primary school (kleuter- en lager onderwijs, 2,5–12 jr). It helps teachers map their existing **thema's** and **activiteiten** onto the learning goals of the **Op.stap** curriculum (Katholiek Onderwijs Vlaanderen), generate an AI-assisted year plan per class, adjust it via drag-and-drop, and **prove coverage of every minimumdoel** — the government-decreed attainment targets the inspectorate tests against.

The users are **teachers** (per class) and **directie** (school head). They are **non-technical**. The product exists to remove a tedious, error-prone manual mapping task and to make coverage *provable*.

This constitution encodes the principles that must hold for the product to be trustworthy: faithful curriculum data, human-controlled AI, demonstrable coverage, and a Dutch, accessible experience.

---

## Article I — Mission & Non-Goals

### I.1 Mission

Deliver a tool that lets a school:
1. Load its own **thema's / subthema's / activiteiten** (Excel import).
2. Load the official **Op.stap leerplandoelen** (incl. decreed **minimumdoelen** via concordantie) per discipline.
3. Get **AI suggestions** linking thema's/activiteiten to leerdoelen, each with a motivation.
4. **Generate a year plan per class**, spread across the school year.
5. **Edit it freely** in a calendar via drag-and-drop.
6. **Regenerate** the whole plan or a single period.
7. See a **coverage / gap analysis** down to minimumdoel level.
8. Collaborate within role-based permissions, and **export** as proof of coverage.

### I.2 Non-Goals (out of scope for this version)

The following are explicitly **out of scope** and must not be built without an amendment:
- Pupil-level tracking or reporting.
- Integration with school-administration / pupil-tracking systems (e.g. Smartschool, Informat).
- Access for parents or pupils.
- Automatic generation of the actual lesson material.
- Evaluation / grading / points management.

---

## Article II — Domain Language (binding)

1. **The domain language is Dutch.** Domain entities and concepts use Dutch names in code: `Leerplandoel`, `Minimumdoel`, `Doelsoort`, `Thema`, `Subthema`, `Activiteit`, `Jaarplan`, `Planningsblok`, `Dekking`, `Concordantie`, `Klas`, `Schooljaar`. Translating *leerplandoel* vs *minimumdoel* loses meaning — do not translate domain terms.
2. **Generic / infrastructure code, technical identifiers, tooling, and comments are in English.**
3. **All user-facing strings are Dutch** and centralised in `frontend/src/i18n/nl.json`. Never hard-code Dutch text in components.
4. The glossary in [Article XII](#article-xii--glossary-nl--en) is authoritative for domain terms. Extend it rather than inventing synonyms.

---

## Article III — Curriculum Data Integrity & Professional Autonomy (non-negotiable)

> **The legal dividing line (the reason this product exists as it does).** The government decrees **only** the *minimumdoelen*, the *leerinhouden*, and that schools build knowledge systematically toward a *leerlijn* (kennisrijk curriculum). The government does **not** prescribe which **thema's** or **subthema's** a school uses, nor how it organises them — that is the school's **professionele autonomie**, and the inspectorate does **not** test the thema layer. Coverage is therefore proven at **minimumdoel level**, never at thema level.
>
> This is the architectural justification for the two-sided model: **Op.stap goals are read-only because they are decreed; thema's/subthema's/activiteiten are fully editable because they are autonomous school content.**

1. **Imported Op.stap goals are read-only reference data.** The official content of a `Leerplandoel` / `Minimumdoel` is **never** mutated by the application or its users.
2. Teachers may add **internal labels and ordering only** — never alter official text, code, doelsoort, jaar/fase, domein structure, or concordantie.
3. Op.stap is **still rolling out**; columns may change. The **Op.stap Excel → model mapping lives in exactly one place** in the code (see [Article VII](#article-vii--opstap-taxonomy--excel--model-mapping)).
4. When Op.stap is re-imported (updated), existing **jaarplannen are not silently overwritten**; the tool flags what must be reviewed (FR-2.5).
5. Each `Leerplandoel` carries a **unique code**. Codes are the stable identity for matching, coverage, and re-import.

---

## Article IV — AI Is Advisory (human-in-the-loop)

1. **The AI proposes; the human decides.** Nothing is "final" without teacher confirmation.
2. Every AI output (goal match, generated plan) must be **reviewable and accept/reject/adjustable**, and its **status must be persisted** (`voorgesteld` / `aanvaard` / `geweigerd` / `manueel`).
3. **Every suggestion carries a short motivation** ("waarom past dit doel hier?") surfaced in the UI (FR-4.2, Art. 7 of the FA).
4. The AI is **grounded only on the school's own data** (its thema's/activiteiten) and the loaded Op.stap goals — **never** external or unknown sources.
5. AI calls **always request structured JSON** (goal codes + one-line motivation; or planningsblok→thema's for plan generation) and the response is **validated before use**.
6. The matching / plan logic must be **testable with a faked AI client** — the client is injected behind an interface.
7. **Final responsibility for correct coverage lies with the teacher and directie.** The tool supports, it does not replace, pedagogical judgement.
8. **AI fits the school's goal-first authoring method**, not the reverse. The school builds a kennisrijk thema in ~10 steps (thema → 2–3 themadoelen → subthema's → subdoelen → rijk aanbod). The **thema-opbouw wizard scaffolding these steps is a committed MVP feature** (not optional — see FA Bijlage A.7), with AI assist at **themadoel selection** (step 2) and **subdoel selection** (step 6, the matching of FR-4). AI never skips ahead of the teacher in this flow.

---

## Article V — Coverage Must Be Provable (Dekking)

1. **Dekking is computed, never stored.**
   - A `Leerplandoel` is *gedekt* when it is linked (status `aanvaard` or `manueel`) to a thema that is placed in the plan.
   - A `Minimumdoel` is *gedekt* when **≥1 concorded leerplandoel** is gedekt.
2. Coverage is shown at **both levels**: leerplandoel and — via concordantie — **minimumdoel**, because the minimumdoel level is what the **onderwijsinspectie** tests (FR-9.3).
3. Coverage must be **filterable by doelsoort** (e.g. only minimumdoelen) and must list the **missing goals** (gap-analyse).
4. The coverage overview is **exportable as proof of coverage** (FR-9.5, FR-11).
5. The directie can pull **school-wide and per-class** overviews from the beheerpagina (FR-9.4, FR-12).
6. **The Op.stap Excel parser and the coverage calculation are the highest-risk logic in the system and must be covered by tests well.**

---

## Article VI — Roles, Privacy & Security

1. **Roles:** `Beheerder` (directie / ICT-coördinator), `Leerkracht`, and optional `Zorgcoördinator / co-teacher`. Permissions are **role-based and configurable** per the matrix in §3.2 of the FA.
2. **No pupil personal data in the MVP** (GDPR/AVG). Staff accounts only.
3. **Host in an EU region.** AI processing happens in an EU, GDPR-compliant environment (e.g. Azure AI Foundry, EU data zone).
4. **No secrets in the repo.** .NET user-secrets locally, Azure Key Vault in the cloud. **AI keys are server-side only — never exposed to the frontend.**
5. Access via personal login; data encrypted in transit and at rest (NFR-5).
6. A processing register and retention periods are provided (NFR-6).

---

## Article VII — Op.stap Taxonomy & Excel → Model Mapping

### VII.0 Two distinct structures (do not conflate)

Op.stap exposes **two related but different artifacts**, and the model must keep them apart:

1. **Ordeningskader** — the official browse/grouping taxonomy, exactly three levels: **`Discipline → Domein → Subdomein`**. There is **no `cluster` and no `leergebied`** at this level.
2. **Per-discipline goal Excel** (one file per discipline) — the rows of *leerplandoelen*, which additionally carry `cluster` (**optional/nullable**), `code`, `jaarFase`, `voorbeelden`, `toelichting`, `woordenschat`, and the `minimumdoelRef` concordance.

Rules that follow:
- **`cluster` is nullable** and belongs to the goal Excel, not the ordeningskader. Coverage roll-ups and filters must not assume it is present.
- **`subdomein` names are not globally unique** (e.g. Muzische vorming repeats *Repertorium / Bouwstenen / Vaardigheden en vormgevingsmiddelen* under Muziek/Beeld/Drama/Dans/Media). The grouping key is the composite **`(domein, subdomein)`**. The unique row identity remains the leerplandoel **`code`**.
- **Disciplines are numbered and partly nested.** A `Discipline` carries a **string `nummer`** (e.g. `"1"`, `"9.2"`) and an optional `parentDiscipline`. Authoritative list: 1 Nederlands en communicatie · 2 Wiskunde · 3 Wetenschap en techniek · 4 Aardrijkskunde · 5 Geschiedenis · 6 Muzische vorming · 7 Lichamelijke opvoeding en motoriek · 8 ICT · 9.1 Veilige en gezonde levensstijl · 9.2 Leren leren · 9.3 Sociaal en emotioneel leren · 10 Frans · 11 Rooms-katholieke godsdienst.
- **`leergebied` / `Wereldoriëntatie`** is the teachers' grouping vocabulary, *not* an Op.stap ordeningskader level. If surfaced in the UI it is a presentation-layer mapping over disciplines (open decision; see Art. XIV) — never a source of truth.

### VII.1 Excel → model column mapping

One Excel file per discipline. Hidden columns may be empty. **This mapping is kept in one place in code** (Art. III.3).

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

> Doelsoort colours (UI convention): MD blue, G neutral, + green, P/S pink, A yellow.

---

## Article VIII — Tech Stack & Architecture (binding choices)

> The functional analysis lists framework choices as *indicative*. For the **build**, these are fixed (CLAUDE.md). Changing them requires an amendment.

- **Frontend:** React 18 + TypeScript + Vite. Tailwind CSS, with **Radix UI + shadcn/ui** (copied into the repo) as the accessible component layer and design tokens — see [ADR-0017](docs/adr/0017-ui-ux-design-system.md). Drag-and-drop `@dnd-kit/core`. Server state TanStack Query. Local UI state Zustand. **UI/UX target: WCAG 2.2 AA**; approach in [`docs/ux/ui-ux-approach.md`](docs/ux/ui-ux-approach.md).
- **Backend:** ASP.NET Core Web API (C#) on the current **.NET LTS**, SDK pinned in `global.json`. EF Core + Npgsql. Excel parsing **ClosedXML** (MIT — **avoid EPPlus**, commercial licence).
- **Database:** PostgreSQL (local via Docker).
- **AI:** Azure AI Foundry (Azure OpenAI), **called only from the backend**.
- **Hosting:** Microsoft Azure.
- **Architecture:** SPA over REST/JSON. Backend is pragmatically layered — `Domain` (entities, invariants, Dutch ubiquitous language) ← `Application` (use cases, AI orchestration, mapping) ← `Infrastructure` (EF Core, Excel import, Azure AI). `Api` is thin. **This is a small app — favour clarity over ceremony; do not over-engineer.**
- **Anchor screens:** the **kalender + drag-and-drop** and the **dekkingsoverzicht**.

---

## Article IX — Core Data Model (functional)

### IX.1 Curriculum (read-only reference data — Art. III)

- **Discipline** — `nummer` (string, e.g. `"1"`, `"9.2"`), naam, optional `parentDiscipline`. One Op.stap Excel per discipline.
- **Leerplandoel** — code (unique), doelsoort, jaarFase, domein, subdomein, **cluster? (nullable)**, tekst, voorbeelden?, toelichting?, woordenschat?, `minimumdoelRef` (concordance). Belongs to a discipline. **Read-only.** Grouping key `(domein, subdomein)`; identity `code`.
- **Minimumdoel** — ref, leeftijd (K-/4-/6-), nr, omschrijving. The decreed eindterm; concorded to leerplandoelen.

### IX.2 School content (autonomous, fully editable — Art. III)

Scoping is **level-dependent and prescribed by pedagogy** (not a single shared/per-class flag):

- **Thema** *(school-scoped — shared school-wide)* — id, naam, invalshoeken?, `duurWeken` (≈ 4–6), `kernwoordenschat[]`, `rijkeWoordenschat[]`, subthema's[], themadoelen[]. Owned by the team/directie via the shared thema-bibliotheek.
- **Themadoel** *(school-scoped)* — the **2–3 overarching goals** that anchor a whole thema and are deliberately the same school-wide; each links to a `Leerplandoel`/`Minimumdoel` and is meant to be *verbreed/verdiept/herhaald*. Distinct from a per-activity goal link.
- **Subthema** *(class/age-scoped)* — naam, `probleemstelling?`, `onderzoeksvraag?`, `duurWeken` (≈ 2), belongs to a Thema. May differ per klas/leeftijd.
- **Subdoel** *(class/age-scoped)* — a concrete, **age-differentiated** goal at the `(Subthema × leeftijd)` level, linking to a `Leerplandoel`/`Minimumdoel`; builds up toward the themadoelen. Themes are **interdisciplinary** — subdoelen routinely span multiple disciplines.
- **Activiteit** *(class/age-scoped)* — naam, `activiteitType` (enum: experiment, prentenboek, hoek, uitstap, spel, waarneming, beweging, onderzoek, …), optional `hoek`, `verwachteUitkomsten?`; can link to one or more leerdoelen.
- **DoelKoppeling** (the link entity, formerly "ThemaDoel") — any link School-content↔Leerplandoel with `status` (voorgesteld / aanvaard / geweigerd / manueel) and `aiMotivatie`. Used for themadoelen, subdoelen, and activity links alike.

### IX.3 Planning & coverage

- **Schooljaar** — contains multiple klassen; carries the vakantie-/periodestructuur.
- **Klas** — id, naam (e.g. "L3 — derde leerjaar"), leerjaar/leeftijdsgroep; has one `Jaarplan`.
- **Jaarplan** — klasId; per **planningsblok** a list of thema's, with a `vergrendeld` flag per thema (excluded from regeneration). Planningsblok granularity is an **open decision** (Art. XIV): the real cadence is *themaperiode* (4–6 wk) and *subthemaperiode* (~2 wk), which does **not** cleanly align to the legacy "maand" default — do not hard-assume months.
- **Dekking** — computed, not stored (see Article V). Binary (gedekt/niet-gedekt) for the MVP is a **deliberate simplification**; "herhaling/opbouw over leeftijden" (verticale samenhang) may be surfaced later (Art. XIV).

---

## Article X — Definition of Done (every task)

Before a task is considered finished:
1. The relevant **tests** pass (`dotnet test`, `pnpm test`).
2. **`dotnet format`** applied (backend) and **`pnpm lint`** clean (frontend).
3. **No user-facing Dutch text hard-coded** — everything in `nl.json`.
4. **No secrets** added to the repo.
5. The change is **consistent with this constitution**; any conflict is resolved or escalated as an amendment.
6. Changes are **small and reviewable**.
7. **The Antagonist review has been run** on significant changes (see [Article XIII](#article-xiii--the-antagonist)) and its findings addressed or explicitly waived.

---

## Article XI — Amendment Process

1. This constitution may only change deliberately. An amendment is a **dedicated commit** that:
   - States *what* principle changed and *why*.
   - Updates any dependent text in `CLAUDE.md` and the functional analysis in the same change.
2. **Open decisions** (Article XIV) are not amendments — they are gaps awaiting a directie decision. Resolving one updates the relevant article and removes it from the open list.
3. If code and constitution disagree, the **code is wrong by default** — fix the code, or amend the constitution if the principle genuinely changed.

### Ratification log

| Date | Ratified by | What |
| --- | --- | --- |
| 2026-06-29 | Siebe De Saedeleir (auteur/directie) | Adopted the Op.stap reference-material refinements as binding: **Art. III** professional-autonomy principle (GAP 0c), **Art. VII.0** taxonomy correction (`Discipline → Domein → Subdomein`, `cluster` nullable — GAP 0a), the **Art. IX** themalaag model (Themadoel/Subdoel + rich attributes + level scoping), and the **Art. IV.8** goal-first authoring with the thema-opbouw wizard as a **committed MVP feature**. Source: `docs/Gap-analyse_Opstap_referentie.md`. |
| 2026-06-29 | Siebe De Saedeleir (auteur/directie) | Closed two Art. XIV open decisions: **Hosting/AI** = Azure + EU region + EU AI data zone ([ADR-0016](docs/adr/0016-azure-hosting-eu-residency.md)); **Identity provider** = Microsoft Entra ID ([ADR-0011](docs/adr/0011-authn-authz-rbac-gdpr.md)). |
| 2026-06-29 | Siebe De Saedeleir (auteur/directie) | Adopted the **UI/UX approach** ([ADR-0017](docs/adr/0017-ui-ux-design-system.md)): Tailwind + Radix UI + shadcn/ui (copied in) as the accessible component layer, design tokens for doelsoort/status/coverage, wireframes-first for the anchor screens, **WCAG 2.2 AA** app-wide. Approach doc: `docs/ux/ui-ux-approach.md`. |

---

## Article XII — Glossary (NL ↔ EN)

- **Op.stap** — the new katholiek basisonderwijs curriculum; contains leerplandoelen + minimumdoelen + leerroutes.
- **Leerplandoel** — a curriculum goal (unique code) from Op.stap.
- **Minimumdoel / eindterm** — government-decreed attainment target; embedded in Op.stap; concorded to leerplandoelen.
- **Doelsoort** — goal type (MD / G / + / P / S / A); colours: MD blue, G neutral, + green, P/S pink, A yellow.
- **Concordantie** — the link between leerplandoelen and minimumdoelen; enables minimumdoel-level coverage.
- **Discipline / domein / subdomein / cluster** — the Op.stap subject taxonomy (one Excel per discipline).
- **Leerroute** — an Op.stap learning trajectory (optional, later phase).
- **Jaar/fase** — JK, K2, K3 (kleuter) and L1–L6 (lager); minimumdoelen anchor at mijlpalen K3 / L4 / L6. Teacher vocabulary **1K/2K/3K** maps to **JK/K2/K3** (confirm which form Excel col F uses).
- **Discipline (genummerd)** — the 11 numbered Op.stap subjects (1 Nederlands … 11 RKG), with 9 split into 9.1/9.2/9.3. The stable import/grouping key.
- **Leergebied / Wereldoriëntatie** — the teachers' grouping vocabulary (Wereldoriëntatie = umbrella over aardrijkskunde / geschiedenis / wetenschap en techniek). **Not** an Op.stap ordeningskader level — a presentation mapping only.
- **Thema / subthema / activiteit** — the school's own content building blocks.
- **Themadoel** — the 2–3 overarching, school-wide goals anchoring a whole thema (verbreed/verdiept/herhaald).
- **Subdoel** — a concrete, age-differentiated goal per `(subthema × leeftijd)` building up toward the themadoelen.
- **Onderzoeksvraag / probleemstelling** — the driving question(s) per subthema in a kennisrijk thema.
- **Kernwoordenschat vs. rijke (thema)woordenschat** — two-tier vocabulary per thema (basiswoorden vs. rijke themawoorden); kernwoordenschat is school-wide.
- **Rijk aanbod / activiteittype** — the palette of activity forms (experiment, prentenboek, hoek, uitstap, spel, waarneming, beweging, onderzoek).
- **Hoek** — a learning corner (ontdektafel, techniekhoek, boekenhoek …).
- **Themaperiode / subthemaperiode** — duration units: thema 4–6 wk, subthema ±2 wk; candidate planningsblokken.
- **Leerlijn (verticale samenhang)** — school-guaranteed continuity/build-up of a goal across ages (1K→3K→lager); "geen gaten in de leerlijn". Distinct from Op.stap **leerroute**.
- **Professionele autonomie** — the legal principle that thema's/subthema's/ordering are the school's free choice; only minimumdoelen/leerinhouden/kennisopbouw are decreed (Art. III).
- **Kennisrijk curriculum / kennisrijk thema** — the goal-first, interdisciplinary, knowledge-building (4–6 wk) pedagogical frame the tool serves.
- **Jaarplan / planningsblok** — the year plan per class / a time slot (granularity is an open decision; see Art. XIV).
- **Dekking** — coverage; **gap-analyse** — the missing-goals overview.
- **Graadklas / menggroep** — combined-grade class; a planning edge case to support.

---

## Article XIII — The Antagonist

A dedicated, maximally critical reviewer agent (`.claude/agents/antagonist.md`) audits **every significant change** against this constitution.

- It is invoked after significant changes (new/changed source files, data model, Excel mapping, AI prompts, scope-touching edits).
- It checks each relevant article and reports **violations, risks, and drift** — leaving no stone unturned.
- Its verdict (`COMPLIANT` / `VIOLATIONS FOUND`) and findings must be **addressed or explicitly waived** before a task is done (Article X.7).
- The Antagonist defends *this document*; it does not defend convenience.

---

## Article XIV — Open Decisions (awaiting directie)

These are **not yet settled** and must be confirmed before building deep. Until resolved, code must not hard-assume an answer; isolate the choice behind a clear seam.

- **Disciplines first**: all Op.stap disciplines, or a starter selection? (List in Art. VII.0.)
- **Op.stap import**: manual per-discipline Excel download vs. an automated/online source.
- **`cluster` presence**: is `cluster` populated in every discipline's Excel, or only some? (Affects roll-ups; cluster is nullable regardless — Art. VII.0.)
- **Ordering & graadklassen**: follow Op.stap jaar/fase ordering (JK–L6, mijlpalen K3/L4/L6); how to handle graadklassen / menggroepen?
- **Planningsblok granularity**: themaperiode (4–6 wk) and/or subthemaperiode (~2 wk) vs. month / week / lesblok. The pedagogical cadence does not align to months — pick deliberately. Until decided, isolate behind a seam (do not hard-assume months).
- **`leergebied` / Wereldoriëntatie surfacing**: show it as a presentation grouping over disciplines? Confirm the Wereldoriëntatie → {Aardrijkskunde, Geschiedenis, Wetenschap en techniek} mapping.
- **Coverage depth**: keep binary dekking for MVP, or later surface herhaling/opbouw over ages (verticale samenhang)?
- **`jaarFase` codes**: confirm whether Excel col F uses 1K/2K/3K or JK/K2/K3.
- **Number of classes & teachers** in the first version.
- **Teacher visibility**: school-wide / per graad / narrower (FR-10.2).
- **Thema/activiteit Excel structure**: which columns exist today (defines the FR-1 import template; must accommodate themadoelen, subthema onderzoeksvragen, two-tier woordenschat, activiteittype, duurWeken).
- **Required overviews/reports** on the beheerpagina and their export format.
- **Export formats**: PDF, Excel, or both; which layout (inspectie / klassenmap).
- **Multilingual** support later (e.g. for non-Dutch-speaking teachers)?
- **Final product name.**

> **Resolved (no longer open):**
> - **Thema scope** is now settled *per level* (Art. IX.2): `Thema` + `Themadoel` + `kernwoordenschat` are **school-wide**; `Subthema` + `Subdoel` + `Activiteit` are **per class & age**. (Supersedes the former open "shared vs per-class" binary and FR-3.3.)
> - **The decreed/autonomous boundary** (Art. III): only minimumdoelen/leerinhouden/kennisopbouw are decreed; the thema layer is professional autonomy, tested only at minimumdoel level.
> - **Hosting/AI sign-off** (2026-06-29): **Azure + EU hosting and EU AI data zone confirmed** (see [ADR-0016](docs/adr/0016-azure-hosting-eu-residency.md)).
> - **Identity provider** (2026-06-29): **Microsoft Entra ID confirmed** (see [ADR-0011](docs/adr/0011-authn-authz-rbac-gdpr.md)); auth remains wrapped/swappable.

---

*Derived faithfully from the Functionele Analyse v0.4. Keep this constitution and the functional analysis in sync — when scope is clarified, update both.*
