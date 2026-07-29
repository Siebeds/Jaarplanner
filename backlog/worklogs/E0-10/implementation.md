# E0-10 — App shell: routing, navigatie & klas/schooljaar-keuze

## Build round 1 — the frame, the URL as selection state, and the end of the GUID input

- **FR / Article:** Art. VIII (stack — router as an addition to an unaddressed category) · Art. II.3 (all copy from
  `nl.json`) · Art. XII + WCAG 2.2 AA · Art. IX.3 (Schooljaar↔Klas containment rendered, not re-derived) ·
  FR-6, FR-9, FR-10/§3.2 · NFR-2, NFR-7 · [ADR-0021](../../../docs/adr/0021-frontend-routing-and-url-selection.md)
  (written for this story) · [ADR-0014](../../../docs/adr/0014-frontend-state-and-dnd.md) ·
  [ADR-0017](../../../docs/adr/0017-ui-ux-design-system.md)
- **Branch:** `story/E0-10`, branched from `main` at `305ed3c`
- **Worktree:** `.claude/worktrees/e0-10` — deliberately not the main working tree; see *Concurrency* below.

### The decision the story required first

E0-10 forbade installing a router before recording the decision. **[ADR-0021](../../../docs/adr/0021-frontend-routing-and-url-selection.md)**
was written first and decides two things:

1. **`react-router-dom` v7 (declarative), not a hand-rolled router.** Art. VIII fixes the frontend stack and says
   changing it needs an amendment; routing is *not addressed at all* there, and `router`/`routing` appears in zero
   of ADR-0001…0020. Read as an **addition**, so an ADR suffices — the reading is stated in the ADR rather than
   leaned on silently, and if the architect reads Art. VIII's list as exhaustive, an Art. XI amendment must
   accompany it (wording changes, decision does not). Hand-rolling was rejected on the honest ground: the cost is
   not `pushState`, it is back/forward fidelity and post-navigation focus for screen-reader users — WCAG
   obligations a tested router already meets. Fewer dependencies, more bespoke code to get wrong, is the *more*
   ceremonious option.
2. **The URL is the single source of truth for the klas/schooljaar selection** (`?schooljaar=&klas=`). No Zustand
   copy, no context. Clause 1 requires deep links to work, so the URL must be authoritative for a shared link;
   a value with two writable homes diverges, and the first symptom is "the link opened someone else's class".

### Files added

| Path | Why |
| --- | --- |
| `frontend/src/app/routes.ts` | The six §3 destinations in one place — path, label key, `isGebouwd`, `magBeheerder`. The nav renders from this, so "what exists" has a single home. |
| `frontend/src/app/AppShell.tsx` | Skip-link, header (brand + selector + nav), `<main>` + `Outlet`, and focus-into-main after navigation. |
| `frontend/src/app/Navigatie.tsx` | The nav. Every link carries `location.search` — the one place that rule lives. |
| `frontend/src/app/KlasKiezer.tsx` | Two native `<select>`s: schooljaar, then that year's own klassen. |
| `frontend/src/app/useSelectie.ts` | Reads/writes the selection in the URL. Changing the year clears the class. |
| `frontend/src/app/schooljaren.ts` | TanStack Query over `GET /api/schooljaren`. |
| `frontend/src/app/BinnenkortPagina.tsx` | The honest placeholder for an unbuilt destination. |
| `frontend/src/app/NietGevondenPagina.tsx` | Catch-all for a stale bookmark. |
| `frontend/src/app/KlasKiezer.test.tsx` | 10 tests: selection, URL round-trip, year-change clearing, survival across navigation. |

### Files changed

| Path | Why |
| --- | --- |
| `frontend/src/App.tsx` | Was a flex column stacking two features; now the route table. |
| `frontend/src/features/jaarplan/JaarplanPagina.tsx` | Klas comes from the shell via the URL; its own GUID input is gone. |
| `frontend/src/i18n/nl.json` | Added `navigatie`, `binnenkort`, `selectie`; removed `zijbalk` and `kalender.klasIdLabel`/`klasIdPlaceholder`; `kalender.geenKlas` now points at the selector instead of an input that no longer exists. |
| `frontend/src/App.test.tsx` | Rewritten: 15 tests over the real `App` and its real `BrowserRouter`. |
| `frontend/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | `react-router-dom@7.18.2`. |
| `backlog/E7-niet-functioneel.md` | The SPA-fallback constraint this story creates for E7-04 (below). |
| `docs/adr/README.md` | ADR-0021 in the index + traceability matrix. |

### Files deleted

- `frontend/src/store/uiStore.ts` and its sidebar toggle. It was an E0-05 placeholder whose own docstring said to
  replace it "as real UI state is introduced", and the button's only effect was changing its own label — a control
  that does nothing, which clause 2 forbids in the nav and which had no business being the first thing a teacher
  saw. **Zustand stays the mandated choice** (Art. VIII, ADR-0014); its first real use is E3-07's drag state and
  E3-08's zoom level. The dependency is untouched.
- `DndContext` from `App.tsx` — it wrapped an app with nothing draggable. E3-07 should mount it around the
  kalender, with the sensors and keyboard support that story requires.

### Decisions taken visibly, so a review can overrule them

- **Unbuilt destinations are shown, not hidden.** Clause 2 allowed either. Showing them makes the intended
  information architecture part of what directie/teachers react to; hiding four of six shows a smaller tool than
  the one being built. The marker is **visible text inside the link** — so it is in the accessible name too —
  explicitly not a `title`, which E3-06's audit found is invisible on touch, unreachable by keyboard and unread by
  most screen readers.
- **`/` redirects to `/jaarplan`.** The kalender is an anchor screen (Art. VIII) and the most complete thing here.
- **Selection changes `replace` the history entry** rather than pushing. A dropdown is a filter, not a navigation;
  pushing would mean three Backs to leave a screen after switching class three times.
- **Role filtering is not built.** §3.2 *Toegangsrechten* already decrees Import and Beheer are directie-only, and
  `magBeheerder` records it — but there is no authenticated user to filter by (E6-01, gated by E7-11), and a
  client-side gate over an unauthenticated API is security theatre. E6-02 filters a list; it will not have to
  restructure one.
- **The matching page still asks for a thema-id by hand.** It moved to `/themas` and works, but replacing that
  input with a real thema list is **E1-14** and generating suggestions at all is **E2-08**. This story owns the
  frame, not the screens — noted rather than quietly widened.

### A constraint this story creates for deployment

Real URLs oblige the host to return `index.html` for any unmatched path. Without it **every deep link and bookmark
404s while the app still works when navigated from the root** — and the gap cannot be seen locally, because
`pnpm dev` does the fallback for free and **the API does not serve the frontend at all** (no `UseStaticFiles` /
`MapFallbackToFile` anywhere in `backend/src`). Recorded on **E7-04**, the story that will configure hosting,
because a deferral recorded only where it was discovered is a deferral that gets lost.

### Two defects caught while building, worth recording

1. **`text-destructive` emits no CSS.** There is no `destructive` token in `tailwind.config.js`, so the selector's
   error message would have rendered as ordinary body text — visually not an error at all. Tailwind fails silently
   on an unknown class, and no test would have caught it. Changed to `text-red-700`, matching
   `Jaarplankalender`. Worth noting that the repo has two error conventions (`text-red-700` in the kalender,
   `text-suggestie-geweigerd` — a *status* token — in matching); somebody should pick one.
2. **An `act()` warning in the axe test** because the schooljaren query settled mid-assertion. Fixed by waiting on
   the settled shell rather than on the nav alone, so the suite is clean rather than noisy-but-green.

### Gates

| Gate | Result |
| --- | --- |
| `pnpm test` | **58 passed**, 7 files, 0 failed, no warnings |
| `pnpm lint` (ESLint `--max-warnings 0` + `tsc --noEmit`) | **exit 0** |
| `pnpm build` | **exit 0** (120 modules, 285 kB / 90 kB gzip) |
| API + dev server against live Postgres 17 | `/health/ready` 200; `GET /api/schooljaren` returns the seeded 2026-2027 year with its klas |
| Deep-link fallback under Vite | `GET /dekking` → 200 |

### Not done — and not claimed

- **Nobody has looked at the screen.** The one check this repo insists on ("31 green tests … said nothing about
  whether the sentence was grammatical") did not happen: both Playwright MCP servers share one Edge profile and
  the concurrent E2-08 run holds it. The suite drives the real router, the real URL and a real axe pass, and the
  app is confirmed serving — but that is not the same thing, and E3-06's precedent is that looking finds things
  tests do not. **Servers left running on `http://localhost:5199` (API `:5184`) so this can be done directly.**
- **No test-runner and no antagonist pass yet.** Per `worklogs/README.md` a story is `[x]` only on
  **PASS + COMPLIANT**; this one stays `[~]`.

### Concurrency note

A parallel `jaarplan-build` run claimed **E2-08** mid-story: it committed this story's backlog text as `305ed3c`,
moved the main working tree's `HEAD` from `fix/code-review-findings` → `main` → `feature/e2-ai-matching`, and took
a locked worktree on `story/E2-08`. This work therefore lives in its own worktree, and the main tree was restored
to exactly the state that run left it in (including its uncommitted E2-08 claim, which is not mine to move).
**Expect a merge conflict with E2-08 in `App.tsx` and `nl.json`** — that run's scope includes a frontend trigger in
`features/matching`. Port 5173 was taken by it too, hence `:5199` above.
