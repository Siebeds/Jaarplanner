# Architecture Decision Records — Jaarplanner

This folder records the **architecturally significant decisions** for Jaarplanner and shows, for each, how it complies with the binding [`CONSTITUTION.md`](../../CONSTITUTION.md) and serves the [`backlog/`](../../backlog/README.md).

> ADRs are **subordinate to the constitution**. An ADR may *refine* how a principle is realised, but it can never override one. If an ADR ever conflicts with the constitution, the ADR is wrong — fix it or raise a constitution amendment (Art. XI). Every ADR ends with a **Compliance trace**, so the chain *principle → decision → backlog work* is auditable.

## How we work with ADRs
- One decision per file: `NNNN-short-title.md`, numbered sequentially.
- Use [`0000-template.md`](0000-template.md).
- **Status** lifecycle: `Proposed` → `Accepted` → (later) `Deprecated` / `Superseded by ADR-XXXX`.
- Superseding, not editing: when a decision changes, write a new ADR and mark the old one superseded.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions in ADRs | Accepted |
| [0002](0002-pragmatic-layered-backend.md) | Pragmatic layered backend (Domain ← Application ← Infrastructure, thin Api) | Accepted |
| [0003](0003-spa-over-rest-json-api.md) | React SPA over a REST/JSON API | Accepted |
| [0004](0004-postgresql-efcore-npgsql.md) | PostgreSQL via EF Core + Npgsql | Accepted |
| [0005](0005-dutch-ubiquitous-language-i18n.md) | Dutch ubiquitous language & centralised i18n | Accepted |
| [0006](0006-opstap-readonly-import-closedxml.md) | Op.stap as read-only reference data via single-source ClosedXML import | Accepted |
| [0007](0007-curriculum-taxonomy-concordance.md) | Curriculum taxonomy & concordance model | Accepted (concordance clause superseded by 0018) |
| [0008](0008-themalaag-level-scoping.md) | Two-tier themalaag with level-based ownership/scoping | Accepted (per-class scoping of Subthema/Subdoel/Activiteit superseded by 0025) |
| [0009](0009-dekking-computed-not-stored.md) | Dekking is computed, never stored | Accepted |
| [0010](0010-ai-advisory-architecture.md) | AI advisory architecture (injectable client, server-side, structured+validated) | Accepted |
| [0011](0011-authn-authz-rbac-gdpr.md) | AuthN/AuthZ, RBAC & GDPR data minimisation. **§3 superseded by 0030** (2026-09-11): the ownership rules predated content per leeftijd. **§4 narrowed by 0035** (2026-09-14): pupil data for the K3 ontwikkelingsrapport only | Accepted |
| [0012](0012-secrets-config-management.md) | Secrets & configuration management | Accepted |
| [0013](0013-planningsblok-abstraction.md) | Planningsblok abstraction for an open decision | Accepted ("configuration on the Schooljaar" clause superseded by 0020) |
| [0014](0014-frontend-state-and-dnd.md) | Frontend state management & drag-and-drop | Accepted |
| [0015](0015-testing-strategy.md) | Testing strategy & high-risk coverage | Accepted |
| [0016](0016-azure-hosting-eu-residency.md) | Azure hosting & EU data residency. **The *no pupil PII* constraint narrowed by 0035** (2026-09-14): pupil data for the K3 ontwikkelingsrapport only | Accepted |
| [0017](0017-ui-ux-design-system.md) | UI/UX approach & design system (shadcn/ui + Radix, WCAG 2.2 AA) | Accepted (decisions 1, 2, 3 and 5 superseded by 0024) |
| [0018](0018-concordance-one-to-many-fk.md) | Concordance is a one-to-many nullable FK (M:N rejected; supersedes 0007 concordance clause) | Accepted |
| [0019](0019-discipline-selection-config-seam.md) | Discipline-selection config seam for an open decision (Art. XIV; data-driven, not compiled in) | Accepted |
| [0020](0020-planningsblok-derivation-rules.md) | Planningsblok derivation rules — even distribution, nested tiers, identity = (niveau, start), lengths per deployment (refines 0013) | Accepted |
| [0021](0021-frontend-routing-and-url-selection.md) | Frontend routing (`react-router-dom`, declarative) and the URL as the single source of truth for the klas/schooljaar selection | Accepted |
| [0022](0022-curriculum-administration-authorisation-seam.md) | Curriculum-administration authorisation seam (one named policy `Curriculumbeheer`, a documented no-op until E6-02) and one endpoint per import source (complements 0011). **§1 amended by 0031** (2026-09-11): the policy requires an authenticated user once a scheme exists | Accepted |
| [0023](0023-activiteit-day-placement.md) | An activiteit is placed on a calendar **day**, never on a planningsblok; `Planningsblokniveau` gains no week/day member and a week is a rendering grouping (relates to 0013/0020, supersedes neither) | Accepted |
| [0024](0024-single-frontend-inkt-en-signaal.md) | One frontend at `frontend/` (frontend-v3 renamed in, the old frontend and frontend-mobile deleted); design direction "Inkt en Signaal": near-achromatic chrome (one rationed accent), Radix primitives without shadcn, tokens in CSS, mobile-first (supersedes 0017 decisions 1/2/3/5) | Accepted |
| [0025](0025-subthema-per-leeftijd.md) | A **subthema is scoped by leeftijd alone** (the `KlasId` leaves the entity, so a subthema on K3 holds for every K3 class); a `Klas` states a required `Jaarfase` and derives its `Leerjaar` from it; planning stays per klas (supersedes ADR-0008's per-class scoping of Subthema/Subdoel/Activiteit). **Amended 2026-08-30:** an activiteit may move to another thema and **only to a subthema at the same leeftijd** (supersedes the owner ruling of 2026-08-05); the invariant binds the move verb and **not** `WijzigScope`, which stays open as E1-19 | Accepted |
| [0026](0026-streefwoordenschat-op-subthema.md) | Streefwoordenschat is a **third** vocabulary list, on `Subthema` and therefore scoped by leeftijd alone; the thema's two school-wide lists are untouched, no new endpoint, and the calendar strip stays decorative because the doorklik is one control per run (depends on 0025, supersedes nothing) | **Proposed** |
| [0030](0030-rollen-en-rechten-in-de-app.md) | **Roles and rights live in the app**, Entra only authenticates (own school tenant); only invited people log in; directie sees and edits everything; thema's for directie and a few people; a jaar's subthema's for its **hoofdleerkrachten** (per schooljaar, several allowed); a leerkracht edits their own klassen, can view others and may add **personal** activiteiten/subdoelen; the FR-1 import is directie + themabeheer. **Revised 2026-09-13:** doelsuggesties are generated and reviewed by **directie and themabeheer only** (reversing the 2026-09-11 answer "every leerkracht"); a klas may have several leerkrachten; no separate ICT role; the shared activiteiten (their content; not subdoelen) are edited by every leerkracht with a klas of that leeftijd as well; a hoofdleerkracht edits thema's only with themabeheer and creates, edits and deletes their jaar's subthema's; subdoelen and hand-made goal links on shared content are for directie and the hoofdleerkrachten, while every leerkracht of that leeftijd edits and creates shared activiteiten, edits streefwoordenschat, and deletes an activiteit they made while it has no goal links (the app records its maker); the FR-1 import and the wizard are themabeheer's, links included, but the wizard creates subthema's and subdoelen only for a thema it builds from scratch, through actions of its own; a maker's delete right follows the person; an appointment counts until its schooljaar ends; a graadklas provisionally gets the rights of its one jaarfase. §1 quotes the owner's rulings verbatim (2026-09-11 and 2026-09-13), §2 holds the defaults that are **not** ruled, and a matrix row is ratified only as far as the rulings it cites; §4 four open questions; only directie may use the import's option to delete human decisions; amendment part 1 was **ratified on 2026-09-14**, so the matrix binds as far as the rulings it cites (supersedes 0011 §3) | Accepted |
| [0031](0031-sessielogin-via-de-api.md) | Personal login as a **session held by the API**: Entra ID over OpenID Connect with the framework's own handler, an encrypted `HttpOnly` cookie and no token in the browser; every `/api` route requires a session by default and answers 401, never a redirect; authenticated means invited; a development sign-in and a test scheme that issue the same cookie path; first-login binding on the UPN of a member account onto an unbound invitation only, failing closed without `acct` (amends 0022 §1). **Decision 2 amended by 0034** (2026-09-13): the frontend's `index.html` for a client route joins the anonymous list | Accepted |
| [0032](0032-opstap-api-als-importbron.md) | **KOV's Op.stap API is the curriculum import source**, read by the backend into the database through a preview and an apply; only **G** goals for now (Z and V skipped); the Excel import stays until the API import has run in production (supersedes 0006 in part: the source) | Accepted |
| [0033](0033-ticketbacklog-en-kanbanbord.md) | **A Markdown ticket backlog beside the epics**: `backlog/functionele-backlog/` (FB, on `main`) and `backlog/technische-backlog/` (TB, on the work branch) in one fixed Dutch format defined once in `tools/backlog-board/lib/format.mjs`; every write through one CLI; a read-only local kanban board that reads `main`, unmerged branches and worktrees, with *In review* derived and never written; no work without a ticket or a story; ticket text Dutch by amendment of Art. II.6 (supersedes nothing) | Accepted |
| [0034](0034-demo-omgeving-op-azure.md) | **A demo environment on Azure** at the lowest cost: App Service F1 Linux, PostgreSQL B1ms, Key Vault, one resource group in an EU region; **the API serves the frontend** with an anonymous SPA fallback that excludes `api/` and `health/`; a self-contained publish; the owner's **waiver of E7-11's deployment clause for this demo only** (fictional data, the owner's own accounts, no AI); the app runs as the database admin, a demo trade-off. Realises 0016 for a demo; **amends 0031 decision 2** (the anonymous routes) | Accepted |
| [0035](0035-ontwikkelingsrapport-derde-kleuter.md) | **The ontwikkelingsrapport for the derde kleuter brings pupil data into scope, for this report only**: leerlingen by hand (voornaam, achternaam) in a K3 klas; one timeless K3 set of rapportdoelen (groups of K3 subdoelen) and one star scale, edited by every K3 leerkracht; three fixed evaluatiemomenten with a gradatie and text per rapportdoel, an algemeen besluit and a kindtekening (metadata stripped); an AI rewrite that replaces the names of the klas's children before the call (best-effort, R25) and stores no proposal; PDF and Word generated on demand, never stored; a fifth right, **Leerlingzorg** (read only); kept until directie wipes a schooljaar; never counts for dekking. Narrows 0011 §4 and 0016's *no pupil PII*; extends the 0030 matrix (a fifth right and six rows); amends Art. I.1, I.2, IV.1–IV.5, VI.1, VI.2 and VI.6, and adds VI.7 and IX.4, in TB-005's amendment commit | Accepted |
| [0036](0036-ai-evaluatieomgeving-en-v1-route.md) | **An evaluation resource for the AI doelsuggesties, the v1 route, and Entra as an explicit choice**: the AI client speaks the Azure OpenAI v1 API (`/openai/v1/chat/completions`, the deployment as `model`, no `api-version`) and reads the token usage; the key stays the default and `AzureAI:Authentication = Entra` is an explicit choice with a cached token, never a fallback for a missing key; a keyless Foundry resource in Sweden Central with Data Zone Standard (EU) deployments, in its own resource group, for the eval runner of TB-004; retrieval is chosen by measurement (no Azure AI Search) and evaluation data stays out of the public repo. Whether a school's app uses its managed identity is left to TB-006 | **Accepted** (owner, 2026-09-14) |

## Compliance traceability matrix

Each ADR → the Constitution article(s) it realises → the backlog epic(s) it enables.

| ADR | Constitution | Backlog | FR/NFR |
| --- | --- | --- | --- |
| 0002 | Art. VIII | E0 | all backend FRs; NFR-8 |
| 0003 | Art. VIII | E0, E3, E5 | FR-6, FR-9; NFR-2/3/7 |
| 0004 | Art. VIII | E0, E1 | FR-1/2/9; NFR-3/8/9 |
| 0005 | Art. II | E0-06, E7-01 | NFR-1 |
| 0006 | Art. III, VII | E1-03/04/05/06 | FR-2 |
| 0007 | Art. VII, IX.1 | E1-01/03/04 | FR-2.1/2.2/2.3 |
| 0008 | Art. III, IX.2 | E1-02/10/11, E2-07, E6-05 | FR-3 |
| 0009 | Art. V | E5-01..05/08, E4-01 | FR-9.1/9.2/9.3, FR-6.5; NFR-3 |
| 0010 | Art. IV | E2 (all), E3-01 | FR-4, FR-5; NFR-5 |
| 0011 | Art. VI | E6-01/02/09, E7-06 | FR-10, FR-12.2; NFR-5/6 |
| 0012 | Art. VI.4 | E0-07, E0-08, E7-05 | NFR-5 |
| 0013 | Art. IX.3, XIV | E3-05/08, E6-03 | FR-5.1, FR-6.1/6.3 |
| 0014 | Art. VIII | E0-05, E3-06/07, E4-01 | FR-6.2/6.5; NFR-2/3/7 |
| 0015 | Art. V.6, IV.6, X, VIII | E0-08, E1-03, E5-01, E2-01 | FR-2/4/9; NFR-3 |
| 0016 | Art. VI.3, VIII | E7-04/05/06/09 | NFR-4/5/6/9 |
| 0017 | Art. VIII, II, XII | E0-09, E3-06/07/10, E5-02/03/09, E6-05, E7-02/10 | FR-4/6/9; NFR-1/2/7 |
| 0018 | Art. VII.1, IX.1, III.5, V | E1-04, E5 | FR-2.2/2.3, FR-9.3 |
| 0019 | Art. XIV, III, VII.0, VIII, II | E1-06 | FR-2 |
| 0020 | Art. IX.3, XIV, XI.2/XI.3 | E3-05, E3-01, E3-07, E3-08, E6-03 | FR-5.1, FR-6.1/6.2/6.3 |
| 0021 | Art. VIII, II.3, XII, IX.3 | E0-10; enables E1-13/14/15, E2-08, E5-02, E6-03/04 | FR-6, FR-9, FR-10/§3.2; NFR-2/7 |
| 0022 | Art. VI.1/VI.5, XIV, VIII, III.1/III.4, II.3 | E1-15; E1-12, E6-01/02, E7-11, E7-13 | FR-2.1/2.5, FR-10/§3.2; NFR-5 |
| 0023 | Art. IX.3, IX.2, IV.2, V.1, VIII | E9-03; enables E9-04/05 | FR-6.2/6.3, FR-7.2 |
| 0024 | Art. VIII, XII, II, X | E9 | NFR-1/2/7 |
| 0025 | Art. IX.2, IX.3, III, V; +Art. II.3, IV.2, XIV (2026-08-30 amendment) | E1; E4 (E4-08); E10 | FR-3; FR-7.2 |
| 0026 | Art. III, IX.2, II.3, V.1, XII | E10-01 | F9 (owner meeting notes; not an FR) |
| 0030 | Art. VI.1/VI.2/VI.5/VI.6, IX.2, II.4, XII, IV, V.1, III, XI, XIV (two-part amendment: part 1 ratified 2026-09-14, touching VI.1, a note on IV.1 and a pointer on IV.8, IX.2 `Thema`, `doelsuggesties[]` and `Activiteit` (the maker), XII, XIV; IX.2 personal content with E6-10) | E6-01/02/04/05/08/09/10, E10-01, E1-19, E7-06, E7-11 | FR-1, FR-3.1, FR-4, FR-7.2, FR-10.1/10.2, FR-12.2, FA §3.1/§3.2/§4/§7, A.7, Bijlage A.11; NFR-5/6 |
| 0031 | Art. VI.1/VI.2/VI.4/VI.5/VI.6, VIII, II.3 | E6-01; E7-11 (authentication half), E6-02, E6-04, E7-06 | FR-10; NFR-5/6 |
| 0032 | Art. VII.2, III.1/III.3/III.4, V.2/V.6, XIV | E1-12, E1-21/22/23; E1-03/04 | FR-2.1–2.5, FR-9.3 |
| 0033 | Art. II.6 (amended), II.2, X, XIII, VI, XI/XIV | all epics, side by side; tickets from 2026-09-13 | none (team workflow) |
| 0034 | Art. VI.2/VI.3/VI.4/VI.5/VI.6, VIII; Art. VI.1 unmet by the code until E6-02 (the owner waived E7-11's deployment clause for this demo, not the article) | E7-04, E7-11, E7-05, E7-09 | NFR-4/5/6/9 |
| 0035 | Art. I.1/I.2, IV.1–IV.5, VI.1/VI.2/VI.6 and a new VI.7, a new IX.4, XII (amended in TB-005); XI.1 followed; V.1 unchanged; VI.3/VI.5, VIII, II.1/II.3, XIV (three bullets touched) | TB-005; the FB build tickets of its §6, after E6-02; E6-02/04, E7-06/09/11, E8 (note) | FR-13 (new), FR-10, FR-12.2; NFR-5/6 |
| 0036 | Art. IV.4/IV.5/IV.6, VI.2/VI.7, VI.3, VI.4, VI.6, VIII; realises 0016 for the AI evaluation; relates to 0010, 0012 and 0034 | TB-004; TB-006; E7-06; E2-09 (unchanged) | FR-4 (A.7 step 6); NFR-5/6 |

## Open decisions referenced by ADRs

Where an ADR depends on an unresolved [Art. XIV](../../CONSTITUTION.md#article-xiv--open-decisions-awaiting-directie) decision, it documents the **seam** rather than presupposing an answer. The clearest examples are [ADR-0013 (planningsblok)](0013-planningsblok-abstraction.md) and [ADR-0019 (discipline selection)](0019-discipline-selection-config-seam.md), and now [ADR-0022 (who may administer curriculum data)](0022-curriculum-administration-authorisation-seam.md) — whose seam is deliberately a **no-op** until E6-02 binds it, which is the case to read if you want to know what a seam does *not* buy you.
