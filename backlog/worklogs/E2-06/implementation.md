# E2-06 — "Ongekoppelde doelen" view

## Build round 1 — gap list of leerplandoelen not (yet) linked to any thema

- **FR / Article:** FR-4.4 (toon welke leerdoelen (nog) niet aan een thema gekoppeld zijn) ·
  Art. V (what "linked/gedekt" means: only status `aanvaard`/`manueel` count) · Art. III
  (leerplandoelen are read-only reference data) · Art. II.3 (Dutch strings in nl.json) ·
  Art. VIII (layering: Domain ← Application ← Infrastructure, thin Api).

- **Base:** my worktree started at the E0 foundation (`main`/E0), **not** the E1/E2 line, so
  `frontend/src/features/matching/` and `Domain/Schoolcontent/DoelKoppeling.cs` were absent. As
  instructed I rebased: branch `story/E2-06` is created from `feature/e1-curriculum-content`
  (tip `9661ecc "E2-06: claim (in progress)"`), which has E1 + E2-01..05 + E2-07 merged. Both
  required paths are present there.

### Files changed
Backend:
- `backend/src/Jaarplanner.Application/Curriculum/OngekoppeldDoelWeergave.cs` — read view record
  (code, doelsoort, jaar/fase, domein, subdomein, tekst) for one ongekoppeld doel.
- `backend/src/Jaarplanner.Application/Curriculum/IOngekoppeldeDoelenQuery.cs` — the read seam
  (Application depends on the abstraction; Infra implements — Art. VIII). Documents the "linked" rule.
- `backend/src/Jaarplanner.Infrastructure/Persistence/OngekoppeldeDoelenQuery.cs` — EF Core impl.
- `backend/src/Jaarplanner.Api/Controllers/OngekoppeldeDoelenController.cs` — thin GET
  `GET /api/leerplandoelen/ongekoppeld`.
- `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — registered
  `IOngekoppeldeDoelenQuery → OngekoppeldeDoelenQuery` (scoped, next to the concordance query).
- `backend/tests/Jaarplanner.UnitTests/Curriculum/OngekoppeldeDoelenQueryTests.cs` — 3 query tests.

Frontend (`frontend/src/features/matching/` — following the E2-05 conventions):
- `types.ts` — added `DoelsoortNaam` (API enum-by-name) + `OngekoppeldDoel`.
- `api.ts` — added `haalOngekoppeldeDoelen()`.
- `useDoelsuggesties.ts` — added `useOngekoppeldeDoelen()` query + a shared `ongekoppelde-doelen`
  key, and made `useWijzigSuggestieStatus` **also** invalidate that key (the "updates as links
  change" mechanism).
- `OngekoppeldeDoelenLijst.tsx` — the view (code + `DoelsoortBadge` + browse context + tekst).
- `DoelsuggestieReview.tsx` — renders the gap list as a section so it is reachable/demonstrable.
- `OngekoppeldeDoelenLijst.test.tsx` — 4 Vitest cases (incl. the accept→refetch update + axe).
- `frontend/src/i18n/nl.json` — added the `ongekoppeld.*` copy (all user-facing strings).

### How "linked" is defined (which statuses count)
Per **Art. V**, a leerplandoel is *gekoppeld* only when it carries a `DoelKoppeling` with status
**`aanvaard` or `manueel`**. `voorgesteld` (an open AI suggestion) and `geweigerd` do **not** count —
so a doel that only has a `voorgesteld` suggestion is still **ongekoppeld** and appears in the list.
This is the deliberate decision the story asked me to make and document: the gap list and E5 dekking
agree on what "linked" means.

`DoelKoppeling`s live in four owned tables, so the query unions all of them (a doel linked via any
of these drops out of the gap list, which also matches "linked to any thema" transitively):
1. `thema_doelsuggesties` — an accepted/adjusted thema-level suggestion (E2-05),
2. `themadoelen` — a curated school-wide anchor,
3. `subdoelen` — a per-(subthema × leeftijd) link,
4. activiteit links — `Activiteit.Doelkoppelingen`.

### The query + endpoint
`OngekoppeldeDoelenQuery` runs **two** round-trips (not N+1): (1) materialise the small, `Distinct`
set of codes carrying a real link (union of the four sources, each filtered to aanvaard/manueel);
(2) select `Leerplandoelen` whose `Code` is not in that set, ordered by `(Domein, Subdomein, Code)`,
projected straight into `OngekoppeldDoelWeergave` (`AsNoTracking`, pure read — Art. III.1). The
controller is a thin passthrough returning the list as JSON; the `Doelsoort` enum serialises by name
(the app-wide `JsonStringEnumConverter`), and the frontend maps it to the `DoelsoortBadge` key.

### How the list updates as links change (the Done-when)
The server query is the single source of truth — the list is never derived from local state. The
frontend TanStack Query hook `useOngekoppeldeDoelen()` caches it under the `["ongekoppelde-doelen"]`
key. The existing `useWijzigSuggestieStatus` mutation (E2-05 accept/reject/adjust) now invalidates
**both** the thema's suggestions **and** the `ongekoppelde-doelen` key on success, so any status change
refetches the gap list: accepting/adjusting a suggestion links its doel and removes it from the list;
rejecting one leaves/returns it. A future manual-link path can invalidate the same key.

### Tests added
Backend (`OngekoppeldeDoelenQueryTests`, EF Core in-memory provider — same choice as the other query
tests):
- `Alleen_aanvaard_en_manueel_tellen_als_gekoppeld_voorgesteld_en_geweigerd_niet` — pins the Art. V
  rule: of five doelen (aanvaard / manueel / voorgesteld / geweigerd / none), exactly the voorgesteld,
  geweigerd and un-linked ones remain ongekoppeld.
- `Koppeling_via_themadoel_subdoel_of_activiteit_telt_ook_mee` — a link via a themadoel, a subdoel and
  an activiteit each drops its doel from the list; only the un-linked one survives.
- `Lege_school_geeft_alle_leerplandoelen_terug_gesorteerd` — no links → all doelen returned in
  `(domein, subdomein, code)` order.

Frontend (`OngekoppeldeDoelenLijst.test.tsx`, fetch faked at the boundary):
- renders code + doelsoort badge + text; empty-state; **updates as links change** (accept a suggestion
  → the gap-list query invalidates → refetch → the now-linked doel disappears, the other remains);
  no axe violations.

### Gates
- `dotnet build` ✓ (0 errors) · `dotnet test` ✓ **297 unit + 18 integration passed, 0 failed** ·
  `dotnet format --verify-no-changes` ✓ (exit 0).
- `pnpm lint` ✓ (0 errors; 2 pre-existing shadcn `react-refresh` warnings, untouched) ·
  `pnpm test` ✓ **16 passed (4 new)** · `pnpm build` ✓.
  (pnpm via `corepack pnpm`, v11.9.0 — pnpm not on PATH.)

### Branch
`story/E2-06` (from `feature/e1-curriculum-content`).

### Self-check vs acceptance criteria
- *Show which leerdoelen are not (yet) linked to any thema* → **met.** Endpoint + view list the
  leerplandoelen with no aanvaard/manueel `DoelKoppeling`; query test pins the semantics.
- *The list updates as links change* → **met.** The `useWijzigSuggestieStatus` mutation invalidates
  the gap-list query; frontend test proves accepting a suggestion removes its doel via refetch.
- *Ref FR-4.4 / Art. V* → **met.** "linked" = aanvaard/manueel only, documented and tested.

### For the test-runner
Two ways to verify:
1. **Unit (no infra):** `cd backend && dotnet test --filter FullyQualifiedName~OngekoppeldeDoelenQueryTests`
   and `cd frontend && corepack pnpm test OngekoppeldeDoelenLijst`.
2. **API / Playwright (needs Postgres + seeded curriculum):**
   - `GET /api/leerplandoelen/ongekoppeld` returns the JSON list.
   - UI click-path: open the app (`corepack pnpm dev`, the `DoelsuggestieReview` page is rendered by
     `App.tsx`) → scroll to the **"Ongekoppelde leerplandoelen"** section → it lists the un-linked
     doelen. Paste a thema-id with an open AI suggestion into the "Thema-id" field above, click
     **"Aanvaarden"** on a suggestion, and confirm the accepted doel disappears from the ongekoppeld
     list (both queries invalidate). Requires a seeded curriculum + a thema with a doelsuggestie.

### Open questions / Art. XIV touched
None. No open decision hard-assumed. Scope note: per the E2-04 directie decision, FR-4 matching
persists at thema (school-wide) scope; this view honours that while still counting subdoel/activiteit
links so it stays correct for the E1-10 manual-link path and future class/age matching (E8-07).
