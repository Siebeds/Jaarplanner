# E2-05 — Accept / reject / adjust in the UI

> Worklog completed by the orchestrator: the implementer finished the code and
> reported "all gates green", but its process died on a transient API error before
> committing/writing this worklog. The orchestrator re-ran every gate fresh, wrote
> this worklog from the diff, and committed. Gate numbers below are the orchestrator's
> own runs.

## What was built
Teacher review + decision flow for AI `doelsuggesties` (FR-4.3, Art. IV.1/IV.3).

### Backend (API + Application)
- `Application/AiMatching/DoelMatchingService.WijzigSuggestieStatusAsync(themaId, suggestieId, status)` — records a teacher decision on one persisted `DoelKoppeling`: `Aanvaard` / `Geweigerd` / `Manueel`. Rejects any non-teacher status (e.g. `voorgesteld`) with `OngeldigeSuggestieStatusFout` — the AI never auto-applies (Art. IV.1/IV.2). Loads the thema, finds the koppeling, calls `DoelKoppeling.WijzigStatus`, persists via the store so the change survives reload and is the exact `Status` E5 coverage reads (`aanvaard`/`manueel` count toward dekking; `voorgesteld`/`geweigerd` do not).
- `Api/Controllers/DoelsuggestiesController.cs` — GET a thema's suggestions + endpoint to set a suggestion's status.
- `Api/Infrastructure/AiMatchingExceptionHandler.cs` — maps the AiMatching faults to clean HTTP responses (404 for not-found, 400 for invalid status) instead of leaking raw domain strings.
- `Application/AiMatching/DoelsuggestieNietGevondenFout.cs`, `OngeldigeSuggestieStatusFout.cs` — typed faults.
- `Api/Program.cs` — wires the exception handler (additive; +5 lines).

### Frontend (`frontend/src/features/matching/`)
- `DoelsuggestieLijst.tsx` / `DoelsuggestieReview.tsx` — the review UI: each suggestion shows its leerplandoelcode + AI motivation with accept / reject / adjust actions.
- `api.ts`, `types.ts`, `useDoelsuggesties.ts` — TanStack Query hooks over the new endpoints; `lib/api.ts` extended with the calls.
- `i18n/nl.json` (+ `i18n/index.ts`) — all Dutch strings centralised (Art. II.3); `App.tsx` wires the feature in.

## Shared-file edits (flagged)
- `Program.cs` (additive, +5) and `DoelMatchingService.cs` (additive, +42) — **not** `DependencyInjection.cs` (E2-07 owns that this wave, so no collision).
- `frontend/src/i18n/nl.json`, `i18n/index.ts`, `lib/api.ts`, `App.tsx` — frontend shared files owned by E2-05 this wave (E2-07 is backend-only).

## Gates (orchestrator re-ran all, fresh)
- Backend `dotnet build` ✓ 0 errors · `dotnet format --verify-no-changes` ✓ · unit **280 passed** · integration **18 passed**.
- Frontend `pnpm lint` ✓ 0 errors (2 pre-existing shadcn/ui fast-refresh warnings) · `pnpm test` ✓ **12 passed** (incl. 5 new `DoelsuggestieLijst.test.tsx`) · `pnpm build` ✓.

## Done-when — met
Status changes persist as `DoelKoppeling.Status` (integration test `DoelsuggestieEndpointsTests` round-trips through the API/DB; `DoelsuggestieStatusTests` covers the service decision + the `voorgesteld`-rejection), survive reload, and drive E5 coverage.

## How to verify
- Backend: `cd backend && dotnet test` → `Ai.DoelsuggestieStatusTests` (accept/reject/adjust + invalid-status rejection) and `DoelsuggestieEndpointsTests` (HTTP round-trip persists status).
- Frontend: `cd frontend && pnpm test` → `features/matching/DoelsuggestieLijst.test.tsx` (renders motivation, accept/reject/adjust call the API and update).
- Manual click-path (Playwright): open the thema's doelsuggesties review → each row shows code + motivation → click Aanvaarden / Weigeren / Aanpassen → status badge updates and persists on reload.
