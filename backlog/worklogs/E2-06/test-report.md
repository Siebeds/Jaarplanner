# E2-06 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (backend) + Vitest (frontend) + code inspection. Playwright NOT run (justified below).

## Criteria checked
- *Done when:* **"the list updates as links change"** (FR-4.4) → PASS
  - Backend: the query recomputes the linked-code set on every call and returns leerplandoelen whose code is not in it (`OngekoppeldeDoelenQuery.HaalOngekoppeldeDoelenAsync`), so any status/link change is reflected on the next fetch. Pinned by `OngekoppeldeDoelenQueryTests.Alleen_aanvaard_en_manueel_tellen...` (accepting/adjusting removes the doel; a still-voorgesteld doel stays).
  - Frontend: `useWijzigSuggestieStatus` invalidates `["ongekoppelde-doelen"]` on mutation success (useDoelsuggesties.ts:53). Pinned by `OngekoppeldeDoelenLijst.test.tsx > "updates as links change: accepting a suggestion removes its doel from the list"` — a mutable fetch fake drops NAT-K3-01 on PUT; after accept, invalidation → refetch removes it while NAT-K3-02 remains.
- Semantics: "gekoppeld" = `DoelKoppeling` status `Aanvaard` OR `Manueel`; `Voorgesteld`/`Geweigerd` do NOT count (Art. V) → PASS — `Alleen_aanvaard_en_manueel_tellen_als_gekoppeld_voorgesteld_en_geweigerd_niet` asserts result is exactly `{C-VOORGESTELD, D-GEWEIGERD, E-ONGEKOPPELD}` (A aanvaard + B manueel drop out).
- Links via themadoel / subdoel / activiteit also count (not just thema doelsuggesties) → PASS — `Koppeling_via_themadoel_subdoel_of_activiteit_telt_ook_mee` asserts only `BLIJFT-OVER` survives after themadoel(aanvaard)/subdoel(manueel)/activiteit(aanvaard) links; query unions all four owned link tables (OngekoppeldeDoelenQuery.cs:41-66).
- Leerplandoelen are read-only reference data (Art. III.1) → PASS — query is read-only: `AsNoTracking()`, only SELECTs over `Leerplandoelen`; controller is GET-only; no mutation of reference data anywhere in the diff.
- UI copy from nl.json, no hard-coded Dutch → PASS — all strings via `t(...)` keys under `ongekoppeld.*` (nl.json:52-61); doelsoort shown as badge with abbreviation (colour not the sole signal, WCAG).

## Commands run
- `dotnet build` (backend) → Build succeeded, 0 errors (4 NU1903 warnings, pre-existing Microsoft.OpenApi advisory, unrelated).
- `dotnet test --no-build` → Integration: 18/18 passed; Unit: 297/297 passed. Named E2-06 query tests all green.
- `corepack pnpm test` (frontend) → 4 files, 16/16 passed, incl. all 4 in `OngekoppeldeDoelenLijst.test.tsx`.
- `corepack pnpm lint` → 0 errors, 2 warnings (react-refresh in shadcn `badge.tsx`/`button.tsx`, pre-existing, not this story).
- DI: `IOngekoppeldeDoelenQuery` → `OngekoppeldeDoelenQuery` registered (DependencyInjection.cs).

## Evidence
- Query: OngekoppeldeDoelenQuery.cs:41-81 (four-table union of aanvaard/manueel codes; two round-trips, no N+1).
- Endpoint: `GET /api/leerplandoelen/ongekoppeld` (OngekoppeldeDoelenController.cs) — thin, delegates only.
- Invalidation: useDoelsuggesties.ts:45-56.

## Playwright note
Not run. The view renders backend `GET /api/leerplandoelen/ongekoppeld`, which requires a running Postgres seeded with imported Op.stap curriculum plus school thema's/links to produce a meaningful gap list — heavy to stand up, and the "updates as links change" behaviour is already pinned end-to-end at both layers: the query over the real EF Core mapping (backend) and the invalidation→refetch cycle through the fetch boundary (frontend). Playwright would add little assurance here.

## Defects
None.
