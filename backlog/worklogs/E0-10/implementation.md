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

## Build round 2 — the browser pass, and a design pass on the shell

The owner freed the Playwright profile, so round 1's outstanding item — *nobody has looked at the screen* — was
done. It found **three defects the 58 green tests did not**, which is round 1's own prediction coming true.

### What looking found

1. **The skip-link covered the wordmark.** `focus:absolute` with no positioned ancestor placed it over the `h1`,
   hiding half of "Jaarplanner" whenever a keyboard user focused it. Now in flow when focused (`not-sr-only`
   restores `position: static`), so it pushes the page down as a full-width bar instead of covering it.
2. **The root redirect stole focus — and the test that "proved" it did not was unsound.** `/` → `/jaarplan` is a
   pathname change, so the focus-after-navigation effect fired on the very first visit and dropped focus into an
   empty `<main>`. Everything in the header, including the class selector a teacher needs *first*, sat behind the
   focus position, reachable only by Shift+Tab.
   **The instructive part is why the test passed.** The guard was a `useRef(true)` "skip the first render" flag,
   and `StrictMode` **deliberately double-invokes effects in development**: the first invocation cleared the flag,
   the second focused `main` anyway. The test rendered `App` *without* `StrictMode`, while `main.tsx` wraps it in
   one — so the harness was gentler than the runtime it was supposed to represent, and dev and production
   disagreed with each other too. Fixed twice over: the guard now compares against the **previous pathname**
   (idempotent under double invocation) and skips `REPLACE` navigations, and **both test files now render inside
   `StrictMode`**, so this class of bug cannot hide there again.
3. **Two favicon 404s on every page load** — nothing declared an icon, so the browser probed `/favicon.ico`. Added
   `public/favicon.svg`: unequal ink bars with a gap, i.e. the year-ribbon with a vakantie in it. Deliberately not
   a calendar-page glyph, since a uniform month grid is the one thing ADR-0013 and the approved E3-10 wireframe
   refuse. Console is now clean: **0 errors**.

### The design pass, and the position behind it

The shell as first built was stock shadcn slate: an undifferentiated white band in which the wordmark, the class
selector and the navigation all competed, and whose heaviest object was a solid dark pill — which on `/dekking`
meant *the boldest thing on screen was advertising a screen that does not work yet*.

**The position taken: the chrome carries no colour at all.** Art. XII already assigns fixed meaning to six
doelsoort hues, and the token set adds coverage and suggestion-status colours on top. A seventh accent for
navigation would compete with the one signal this tool exists to communicate, so the shell earns its identity from
a **tonal chrome/content split** (muted header band against a white page) and from typographic hierarchy, leaving
every hue free to mean something. Concretely:

- Header is one band with a clear internal order: wordmark + one line of purpose, then the context selector, then
  the tabs. Selector labels dropped to small tracked caps — at body size they competed with the wordmark.
- Active tab is **weight + a 2px rule** flush with the header's edge, not a filled block. A rule reads as
  *position*, which is all it should say, and it echoes the ribbon the kalender is built on. `aria-current` still
  carries it programmatically, so the state is never colour- or weight-alone.
- The unbuilt marker went from "nog niet beschikbaar" to **"binnenkort"**. The long form nearly doubled four of six
  nav items and made the menu read as mostly broken; the placeholder page still states it in full. *Flag for the
  review:* "binnenkort" is friendlier but faintly promises timing — the backlog has stories, not dates.

Evidence: [shell + jaarplan](../../docs/ux/wireframes/e0-10-shell-jaarplan.png) ·
[mobile, 390 px](../../docs/ux/wireframes/e0-10-shell-mobiel.png).

### Verified in the browser (Edge, live API + Postgres)

| Check | Result |
| --- | --- |
| `/` redirects to `/jaarplan` | ✓, and focus stays on `body` (`document.activeElement` asserted, not inferred) |
| Clicked nav moves focus into `main` | ✓ `activeElement.id === "hoofdinhoud"` |
| Chosen class survives navigation | ✓ `?klas=` intact after jaarplan → dekking |
| Deep link `/dekking` opened cold | ✓ renders that screen |
| Kalender renders the seeded year | ✓ 7 periods, 4 vakantie gaps, te-vol flag on periode 3, two empty periods, every motivation carrying its *"Voorbeeld (geen AI-antwoord)"* marker |
| Console | **0 errors** |
| Responsive at 390 × 844 | ✓ header stacks, nav wraps to three rows, content legible |

### Gates (round 2)

`pnpm test` **59 passed** / 7 files, 0 warnings · `pnpm lint` exit 0 · `pnpm build` exit 0.

### Still not done — and not claimed

- **No test-runner and no antagonist pass.** Per `worklogs/README.md` a story is `[x]` only on
  **PASS + COMPLIANT**; this stays `[~]`.
- **No teacher or directie has seen it.** I looked at it; they have not. That is a different check and it belongs
  with E3-06's review session.
- **A real mobile navigation** (a disclosure rather than three wrapped rows) is not built. Acceptable — the
  kalender ribbon wants width and teachers will be on laptops — but it is a known edge, not an oversight.
- **The `/themas` screen still asks for a thema-id by hand** (E1-14) and cannot generate suggestions (E2-08).

### One thing to reconcile, owned by nobody

The repo now has **two error-colour conventions**: `text-red-700` (kalender, and the selector, which followed it)
and `text-suggestie-geweigerd` — a *status* token — in the matching feature. Both pass contrast; they should not
both exist. Not fixed here because picking one is a design-system decision that touches E2's components, and this
story owns the shell.

### Concurrency note

A parallel `jaarplan-build` run claimed **E2-08** mid-story: it committed this story's backlog text as `305ed3c`,
moved the main working tree's `HEAD` from `fix/code-review-findings` → `main` → `feature/e2-ai-matching`, and took
a locked worktree on `story/E2-08`. This work therefore lives in its own worktree, and the main tree was restored
to exactly the state that run left it in (including its uncommitted E2-08 claim, which is not mine to move).
**Expect a merge conflict with E2-08 in `App.tsx` and `nl.json`** — that run's scope includes a frontend trigger in
`features/matching`. Port 5173 was taken by it too, hence `:5199` above.
