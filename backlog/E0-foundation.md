# E0 — Project Foundation & Scaffolding

**Phase:** 0 (pre-build) · **Milestone:** M0 — Skeleton up
**Goal:** A running skeleton — repo structure, local Postgres, ASP.NET Core API, React/Vite SPA, CI, and the guardrails (i18n, secrets, layering) that the constitution requires from day one.
**Constitution:** [Art. VIII](../CONSTITUTION.md#article-viii--tech-stack--architecture-binding-choices) (stack), [Art. II](../CONSTITUTION.md#article-ii--domain-language-binding) (Dutch/i18n), [Art. VI](../CONSTITUTION.md#article-vi--roles-privacy--security) (no secrets).

---

- [x] **E0-01 — Repository structure & solution layout**
  Create the intended tree: `frontend/`, `backend/src/{Jaarplanner.Api,Application,Domain,Infrastructure}`, `backend/tests/{UnitTests,IntegrationTests}`, `docs/`, `backlog/`.
  *Done when:* solution builds empty; layering enforced (Domain ← Application ← Infrastructure, thin Api). Ref: Art. VIII.

- [x] **E0-02 — Pin toolchain**
  `global.json` pins the current .NET LTS SDK; frontend uses pnpm with a pinned Node version.
  *Done when:* `dotnet --version` and `pnpm` resolve to pinned versions on a clean machine.

- [x] **E0-03 — Local Postgres via Docker**
  `docker-compose.yml` with a `db` service.
  *Done when:* `docker compose up -d db` gives a reachable Postgres; connection string via user-secrets, **never committed** (Art. VI.4).

- [x] **E0-04 — Backend bootstrap (ASP.NET Core Web API)**
  Minimal API project, health endpoint, EF Core + Npgsql wired, DI container.
  *Done when:* `dotnet run --project src/Jaarplanner.Api` serves `/health`; EF Core connects to Postgres.

- [x] **E0-05 — Frontend bootstrap (React 18 + TS + Vite + Tailwind)**
  Vite SPA, Tailwind, TanStack Query + Zustand providers, `@dnd-kit/core` installed.
  *Done when:* `pnpm dev` serves the app; `pnpm build` and `pnpm lint` pass.
  *Scope boundary (2026-07-29):* this story bootstrapped a **page**, not an application shell — it makes no claim to routing or navigation and its `[x]` is honest. But `App.tsx`'s own comment calls its output the "App skeleton (E0-05)", and every feature since has been appended to that one component. The shell is **E0-10**.

- [x] **E0-06 — i18n scaffold (`frontend/src/i18n/nl.json`)**
  Central Dutch strings file + a `t()` helper; lint/check that forbids hard-coded Dutch literals in components.
  *Done when:* sample screen renders all text from `nl.json`. Ref: Art. II.3.

- [x] **E0-07 — Secrets & config strategy**
  .NET user-secrets locally; Azure Key Vault binding stubbed for cloud; **AI keys server-side only**.
  *Done when:* no secret is in the repo; a documented `dotnet user-secrets` flow exists. Ref: Art. VI.4.

- [x] **E0-08 — CI pipeline & quality gates**
  CI runs `dotnet build` + `dotnet test` + `dotnet format --verify-no-changes` and `pnpm lint` + `pnpm test` + `pnpm build`.
  *Done when:* CI is green on an empty skeleton and blocks on format/lint failures. Ref: Art. X.

- [x] **E0-09 — Design-system foundation (Radix + shadcn/ui + tokens + Storybook)**
  Add Radix UI + shadcn/ui (components copied into `frontend/src/components/ui/`); define Tailwind **design tokens** for doelsoort/suggestion-status/coverage colours; set up **Storybook**; wire **axe** accessibility checks into the dev/CI loop.
  *Done when:* a sample component renders from tokens, appears in Storybook, and passes an axe smoke check. Ref: ADR-0017, Art. VIII, Art. XII; UX doc `docs/ux/ui-ux-approach.md`.

- [~] **E0-10 — App shell: routing, navigatie & klas/schooljaar-keuze** — *added 2026-07-29: no story in E0–E8 owned the shell, so every screen has been appended to `App.tsx`; **built 2026-07-29** on `story/E0-10`, awaiting a look at the screen + the test-runner/antagonist gates*
  The frame every screen lives in: URL-addressable routes, a primary navigation following the information architecture in [`docs/ux/ui-ux-approach.md`](../docs/ux/ui-ux-approach.md) §3, and a **klas/schooljaar selector** replacing the GUID text inputs the current pages use.

  *Why this story exists:* asked what it would take to have an application users can click through, a sweep of E0–E8 found **nothing owns the shell**. The only reference to navigation anywhere in the planning documents is one line in `ui-ux-approach.md` §3 ("Primary navigation (per role, …)") with no story behind it. Meanwhile `App.tsx` stacks the brand header, a stub sidebar toggle, `JaarplanPagina` and `DoelsuggestieReview` in a single flex column, a klas is selected by **pasting a GUID into a text input**, and `react-router` is not a dependency. This is the same defect class as **E2-08** and **E1-15** — a piece everyone assumed was somebody's — except that here the missing piece is where the other unbuilt screens are supposed to go. Without it, E1-13, E1-14, E5-02 and E6-03/04 have no destination and the answer will be four more components appended to `App.tsx`.

  *Done when:*
  1. each screen has its own route/URL: deep-linkable, and browser back/forward behave;
  2. a primary navigation exists per §3 (**Doelen · Thema's · Jaarplan · Dekking · Import · Beheer**), and a destination that is not built yet is either **absent** or **explicitly labelled as not yet available** — never a control that silently does nothing (the rule E3-06 was built under: *"a control that does nothing teaches a review the wrong thing"*);
  3. klas **and** schooljaar are chosen from a list, not typed as a GUID, and the choice is visible and preserved across screens. **No new backend is needed** — `GET /api/klassen` (`KlassenController:23`) and `GET /api/schooljaren` (`SchooljarenController:32`) both already exist; do not add an endpoint for this;
  4. every nav and selector string comes from `nl.json` (Art. II.3) and **no server-generated string is rendered** — see the ⚠️ note in [`README.md`](README.md) under the Art. II.3 entry, where E3-06 nearly became the story that broke this by displaying a descriptive backend label;
  5. keyboard-operable throughout, with a skip-link, a `<nav>` landmark, `aria-current` on the active route, a sane focus order and a clean axe pass — noting the E3-06 lesson that **jsdom cannot evaluate contrast**, so axe covers structure and never colour (Art. XII, WCAG 2.2 AA, E7-10);
  6. `pnpm lint` and `pnpm test` are green and the kalender and the matching review still work from their new routes.

  *Decisions this story must take deliberately, not by default:*
  - **Router library vs. no library.** `router`/`routing` appears in **zero** ADRs and nowhere in the constitution — this is undecided, not decided-elsewhere. Art. VIII fixes the frontend stack and says changing it requires an amendment; a router is *not listed at all*, so adding `react-router` is a stack **addition** rather than a change. Read it that way and it needs an **ADR**, not an amendment — but take that reading explicitly and record it. Weigh the no-dependency alternative honestly: this is six screens in a small app whose constitution says *"favour clarity over ceremony; do not over-engineer"*, and Zustand is already mandated for local UI state (ADR-0014). **Write the ADR before installing anything** — this project's pattern is that a library installed first gets documented never.
  - **Where the current klas/schooljaar selection lives.** ADR-0014 splits server state (TanStack Query) from local UI state (Zustand). The *list* is plainly server state; the *selection* is plainly UI state — but clause 1 also puts it in the URL, which makes the URL a third candidate for source of truth. Pick one, write it down, and derive the others from it, or they will disagree the first time a teacher pastes a link.
  - **Role filtering is out of scope but must not be designed out.** §3 reads "per role, per the §3.2 matrix" — that is **§3.2 Toegangsrechten of the functional analysis** (a Beheerder / Leerkracht-eigen-klas / Leerkracht-andere-klas matrix with a third *lezen* state, cited the same way by E6-02), not a section of the UX document. So the matrix exists and is explicit: two of the six nav destinations — **Import** and **Beheer** — are beheerder-only, and *Jaarplan* / *Dekking* are read-only for another teacher's class. E6-02 owns enforcing it server-side; this story owns a nav whose items can be filtered, and whose read-only states can be expressed, **without being restructured**. Do not build the filtering (there is no authenticated user to filter by until E6-01), and do not build a nav that assumes every item is visible and writable to everyone.

  *Explicitly not in scope:* the screens themselves (E1-13, E1-14, E5-02, E6-03/04); authentication or a login redirect (E6-01/E6-02, with **E7-11** as the deployment gate); role-based filtering of the nav (E6-02); any change to the kalender or matching components beyond giving them a route.

  *Depends on:* E0-05 `[x]`, E0-09 `[x]`.
  *Blocks:* every UI story that needs a screen of its own — E1-13, E1-14, E1-15's admin surface, E2-08's trigger, E5-02/03/05, E6-03/04. E2-05 and E3-06 are reachable today only because they are stacked on the single page.
  Ref: ADR-0003 (SPA over REST), ADR-0014 (state ownership), ADR-0017 + `docs/ux/ui-ux-approach.md` §3, Art. II.3, Art. VIII, Art. XII; NFR-2 (non-technical teachers), NFR-7; E7-10.

  **Built 2026-07-29** on `story/E0-10` — worklog: [`worklogs/E0-10/implementation.md`](worklogs/E0-10/implementation.md). Six routes under one `AppShell`, nav preserving the query string, a schooljaar→klas selector, skip-link, `aria-current`, focus-into-main after navigation, and an honest placeholder for each of the four unbuilt destinations. **The GUID text input is gone from the jaarplan screen.** Gates: 58 Vitest tests green (0 warnings), `pnpm lint` and `pnpm build` exit 0, and the app confirmed serving against live Postgres with the deep link `/dekking` returning 200.
  *The decision the story demanded came first:* **[ADR-0021](../docs/adr/0021-frontend-routing-and-url-selection.md)** — `react-router-dom` v7 declarative (recorded as an Art. VIII *addition* to an unaddressed category, with the alternative reading stated), and **the URL as the single source of truth for the selection**, no Zustand copy. The hand-rolled router was rejected on the honest ground that its real cost is back/forward fidelity and post-navigation focus, not `pushState`.
  *Removed, deliberately:* the E0-05 placeholder Zustand store and its sidebar toggle — a button whose only effect was changing its own label, i.e. exactly the control-that-does-nothing this story forbids, and the first thing a teacher saw. Zustand remains the mandated choice (Art. VIII, ADR-0014); its first real use is E3-07/E3-08. Same for `DndContext`, which wrapped an app with nothing draggable — E3-07 should mount it around the kalender.
  *A constraint this story creates:* real URLs oblige the host to serve `index.html` for unmatched paths, or **every deep link and bookmark 404s while the app still works from the root** — invisible locally, because Vite does the fallback and the API serves no frontend at all. Recorded on **E7-04**.
  *Two silent defects caught while building, both invisible to tests:* `text-destructive` emits no CSS (no such token in `tailwind.config.js`), so the selector's error message would have rendered as ordinary body text; and the repo has two competing error-colour conventions (`text-red-700` vs the *status* token `text-suggestie-geweigerd`) — someone should pick one.
  **Why this is still `[~]` and not `[x]`:** *nobody has looked at the screen.* Both Playwright MCP servers share one Edge profile and the concurrent E2-08 run holds it, so the browser pass — the check this project's own record says finds what tests miss (E3-06's ungrammatical singular) — has not happened. The test-runner and antagonist gates are also still open, and `worklogs/README.md` makes `[x]` conditional on **PASS + COMPLIANT**.
  *Left in scope-boundary, not widened:* the matching review moved to `/themas` and still asks for a thema-id by hand — a real thema list is **E1-14**, generating suggestions is **E2-08**. Nav role-filtering is **E6-02**: §3.2 already makes Import and Beheer directie-only and `magBeheerder` records it, but there is no authenticated user to filter by yet and a client-side gate over an unauthenticated API would be theatre.
