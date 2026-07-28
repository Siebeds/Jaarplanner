# Antagonist Review — E2-05 (Accept / reject / adjust doelsuggesties in the UI)

**Verdict:** COMPLIANT (with 2 MINOR drift items + 1 QUESTION)
**Scope audited:** `git diff feature/e1-curriculum-content...HEAD` (commit 158bc84) — 19 files:
Api `DoelsuggestiesController.cs`, `AiMatchingExceptionHandler.cs`, `Program.cs`; Application
`DoelMatchingService.WijzigSuggestieStatusAsync` + `DoelsuggestieNietGevondenFout` /
`OngeldigeSuggestieStatusFout`; backend unit + integration tests; frontend `matching/*`,
`lib/api.ts`, `i18n/*`, `App.tsx`. Cross-checked pre-existing `DoelKoppeling`, `KoppelingStatus`,
`IDoelMatchOpslag`, `FakeDoelMatchOpslag`, `badge.tsx`.

## Findings

### [MINOR] Raw Dutch domain-exception message (incl. article references) placed on the wire
- **Article/FR:** Art. II.3 (user-facing Dutch centralised) / defense-in-depth
- **Where:** `backend/src/Jaarplanner.Api/Infrastructure/AiMatchingExceptionHandler.cs:44` — `Detail = exception.Message`
- **Problem:** The 400/404 ProblemDetails body carries the raw domain message, e.g.
  `"Status 'Voorgesteld' is geen leerkrachtbeslissing; kies aanvaard, geweigerd of manueel (Art. IV.1/IV.2)."`
  This is developer/constitution-facing prose (mentions article numbers) sitting in an HTTP
  response. It is NOT a user-facing violation: the frontend `apiFetch` throws `ApiError` with a
  generic message, never reads the body, and the UI renders its own nl.json copy
  (`matching.wijzigenMislukt` / `matching.fout`). So no raw message reaches the teacher's screen.
  It mirrors the pre-existing `SchoolcontentExceptionHandler` pattern (consistent, not a regression).
- **Required fix (optional):** Keep teacher-facing copy in nl.json only; consider a neutral `Detail`
  (or omit it) so article references / internal wording never leak onto the wire. Non-blocking.

### [MINOR] Unused i18n key `matching.statusLabel`
- **Article/FR:** Art. X.6 (small/clean change) — drift, not a breach
- **Where:** `frontend/src/i18n/nl.json:43` (`"statusLabel": "Status"`)
- **Problem:** Added but never referenced. The component labels statuses via `statusLabelKey` →
  `suggestieStatus.*`, so this key is dead.
- **Required fix:** Remove the unused key (or wire it up).

### [QUESTION] No authorization on the review endpoints
- **Article/FR:** Art. VI.1 (role-based permissions)
- **Where:** `DoelsuggestiesController` (no `[Authorize]`, no role check)
- **Problem:** Any caller could list/mutate suggestion status. This is the **known pre-existing gap**
  — no RBAC exists anywhere yet (owned by epic E6). Confirmed not a regression introduced by E2-05,
  and this story is not scoped to solve it. Flagged only so it is not forgotten at E6.

## Checks run (proof of thoroughness)

- **Art. IV.1/IV.3 (advisory / human-in-the-loop) — PASS.**
  `DoelMatchingService.WijzigSuggestieStatusAsync` guards `status is not (Aanvaard or Geweigerd or
  Manueel)` and throws `OngeldigeSuggestieStatusFout` — so `Voorgesteld` (AI-only) and any other
  value are rejected. The teacher is the only actor moving a suggestion off `voorgesteld`; the AI
  path (E2-04) still persists `Voorgesteld` only. Frontend double-guards via
  `Leerkrachtbeslissing = Exclude<SuggestieStatus,"Voorgesteld">`. Motivation is surfaced
  (`aiMotivatie` + `matching.motivatieLabel` = "Waarom past dit doel hier?"). Unit test
  `Status_voorgesteld_mag_de_leerkracht_niet_zetten` and integration test
  `Setting_voorgesteld_by_hand_is_rejected_with_400` prove no auto-apply and nothing committed on
  rejection (`AantalKeerBewaard == 0`).
- **Art. V (coverage seam) — PASS.** Status persists as `DoelKoppeling.Status` via
  `koppeling.WijzigStatus(status)` + `_opslag.BewaarAsync`. `KoppelingStatus` enum is the exact value
  E5 reads (`Aanvaard`/`Manueel` count; `Voorgesteld`/`Geweigerd` do not — asserted in
  `Aanvaarde_en_manuele_koppelingen_tellen_mee_voor_dekking`). Integration test proves persistence
  survives a fresh GET (reload). No stored dekking introduced anywhere.
- **Art. II.3 (i18n) — PASS (components).** Grepped the new `.tsx`: all copy via `t()` from
  `nl.json`; no hard-coded Dutch literals in components. ARIA labels use interpolation
  (`t("matching.aanvaardenAria", { code })`). Only drift is the wire `Detail` (MINOR above) and the
  dead key.
- **Art. VIII (layering) — PASS.** Controller is thin (bind → delegate → `Ok`); use case in
  `DoelMatchingService` (Application); status change on the domain entity `DoelKoppeling.WijzigStatus`;
  ProblemDetails mapping isolated in an `IExceptionHandler` in Api. No EF Core reference in
  Api/Domain; `IDoelMatchOpslag` keeps EF in Infrastructure. Frontend uses REST + TanStack Query
  (`useDoelsuggesties` / `useWijzigSuggestieStatus`, invalidate-on-success) per ADR-0017.
  `JsonStringEnumConverter` is registered (`Program.cs:23`) so the PascalCase status contract binds
  both directions — the persistence contract is sound.
- **Art. VI (privacy/secrets) — PASS.** No pupil data. No secrets added. `lib/api.ts` explicitly
  keeps AI keys server-side; this story makes no AI calls.
- **Accessibility (ADR-0017 / WCAG 2.2 AA) — PASS.** Real `<button>` (shadcn `Button`), not
  div-onClick; per-action `aria-label` carrying the doel code; `role=list`, `role=status` (loading),
  `role=alert` (errors); `aria-busy` while mutating; colour never the sole signal — every status
  badge also renders its text label. `jest-axe` test asserts no violations.
- **Scope / collision — PASS.** Diff touches only `Program.cs` (+5, additive handler registration)
  and `DoelMatchingService.cs` (additive method), plus new files and frontend/i18n. Confirmed
  `DependencyInjection.cs` and `AiAuthoring/*` are NOT in the diff (owned by sibling E2-07 this wave).
- **Art. III (curriculum integrity) — PASS.** No mutation of Leerplandoel/Minimumdoel; the link
  references the leerplandoel by stable `code`; only `DoelKoppeling.Status` (autonomous school
  content) changes.

## Open questions surfaced
- RBAC on the review endpoints is deferred to E6 (Art. VI.1) — confirmed pre-existing, not a
  regression. Ensure E6 covers these endpoints.
- `DoelsuggestieReview` currently reads a thema-id from a free-text input as a temporary scaffold
  until thema navigation exists — acceptable interim seam, not a scope breach.
