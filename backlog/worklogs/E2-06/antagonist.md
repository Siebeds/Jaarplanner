# Antagonist Review — E2-06 "Ongekoppelde doelen" view (FR-4.4)

**Verdict:** COMPLIANT (with 2 MINOR advisory findings)
**Scope audited:** `git diff 9661ecc...HEAD` on branch `story/E2-06`, commit `ae354c8`.
Files: backend `OngekoppeldeDoelenController.cs`, `IOngekoppeldeDoelenQuery.cs`, `OngekoppeldDoelWeergave.cs`,
`OngekoppeldeDoelenQuery.cs`, `OngekoppeldeDoelenQueryTests.cs`, `DependencyInjection.cs`; frontend
`OngekoppeldeDoelenLijst.tsx` (+test), `types.ts`, `api.ts`, `useDoelsuggesties.ts`, `DoelsuggestieReview.tsx`, `nl.json`.

## Findings

### [MINOR] Gap query tested only on the EF Core in-memory provider, not Postgres
- **Article/FR:** Art. V.6 (coverage/gap logic is highest-risk — cover it well); CLAUDE.md testing guidance ("integration-test against a Postgres test container").
- **Where:** `backend/tests/Jaarplanner.UnitTests/Curriculum/OngekoppeldeDoelenQueryTests.cs:20` (`UseInMemoryDatabase`).
- **Problem:** `HaalOngekoppeldeDoelenAsync` builds four owned-collection subqueries (`Thema.Doelsuggesties`,
  `Themadoel.Koppeling`, `Subdoel.Koppeling`, `Activiteit.Doelkoppelingen`), `.Concat()`s them, `.Distinct()`s,
  then filters `!gekoppeldeCodes.Contains(l.Code)`. The in-memory provider evaluates client-side and does NOT
  prove this UNION-of-owned-subqueries translates on Npgsql. A translation failure would only surface at runtime
  in production. This is a risk, not a proven bug — behaviourally the logic is correct and well covered.
- **Required fix:** Add (or extend) a Postgres-test-container integration test that runs this query, or otherwise
  confirm the Concat/Distinct/negated-Contains pattern translates on Npgsql. Consistent with the existing
  in-memory query-test pattern, so acceptable to defer, but flag it.

### [MINOR] Gap-list invalidation is wired only to the suggestie accept/reject flow
- **Article/FR:** FR-4.4 ("list updates as links change"); Art. V (all link sources count).
- **Where:** `frontend/src/features/matching/useDoelsuggesties.ts:48-55` — only `useWijzigSuggestieStatus`
  invalidates `["ongekoppelde-doelen"]`.
- **Problem:** The backend query correctly counts links from all four sources (themadoel, subdoel, activiteit,
  thema-doelsuggestie). But on the frontend, only accept/reject/adjust of a doelsuggestie invalidates the gap-list
  cache. A link created via a themadoel / subdoel / activiteit mutation elsewhere would leave the gap list stale
  until a natural refetch. Within E2-06's matching scope this is acceptable (those mutation hooks are not part of
  this story), but it is a forward-looking gap.
- **Required fix:** When themadoel/subdoel/activiteit link-mutation hooks are added, they must also invalidate the
  `["ongekoppelde-doelen"]` query key (consider centralising the key).

## Checks run (proof of thoroughness)
- **Art. III (curriculum integrity):** Query is pure read — `AsNoTracking()`, projects into an Application record,
  no `SaveChanges`, no writes anywhere in the diff. Leerplandoelen never mutated. COMPLIANT.
- **Art. V (coverage semantics):** Verified the status filter is exactly `Aanvaard || Manueel` in all four branches;
  `Voorgesteld`/`Geweigerd` excluded (confirmed against `KoppelingStatus` enum). Verified the four link sources are
  the COMPLETE set of `DoelKoppeling` holders in the domain (`Thema.Doelsuggesties`, `Themadoel.Koppeling`,
  `Subdoel.Koppeling`, `Activiteit.Doelkoppelingen`); `Subthema`/`Leerplandoel` reference `DoelKoppeling` only in
  comments/children already covered by the `Subdoelen`/`Activiteiten` DbSets. Test pins both status semantics and
  all-four-sources behaviour. Correctly does NOT check plan placement (that is FR-9 dekking, not FR-4.4 linkage) —
  no E5 scope creep. COMPLIANT.
- **Art. II.3 (i18n):** All user-facing Dutch (`ongekoppeld.*`) added to `nl.json`; component and
  `DoelsuggestieReview` section use `t()` exclusively — no hard-coded Dutch literals. COMPLIANT.
- **Art. VIII (layering):** Interface + view record in Application, EF impl in Infrastructure, thin controller in Api
  (binds + delegates only), DI registered `AddScoped`. No EF type leaks past Infrastructure. Query is two round-trips
  (materialise linked codes, then filter) — not N+1. COMPLIANT.
- **Art. VI (privacy/security):** No secrets, no pupil personal data introduced. Staff-only, unchanged. COMPLIANT.
  (Note: controller carries no explicit role attribute, consistent with the rest of the E2 controllers; RBAC is
  handled at the app level in E-later — not a regression introduced here.)
- **Accessibility (ADR-0017 / WCAG 2.2 AA):** Semantic `<ul>/<li>`; loading `role="status"`, error `role="alert"`;
  doelsoort conveyed via `DoelsoortBadge` (colour + abbreviation + `aria-label`), never colour alone. Frontend test
  includes a jest-axe assertion. COMPLIANT.
- **Enum serialisation:** `Doelsoort` serialised by name via globally-registered `JsonStringEnumConverter`
  (`Program.cs:23`); backend member names match the frontend `DoelsoortNaam` union and the `badgeSoort` map exactly.
  No integer/name mismatch. COMPLIANT.
- **Scope of edits:** `DependencyInjection.cs` (+5 lines, additive registration), `useDoelsuggesties.ts` (additive
  hook + one extra invalidate), `DoelsuggestieReview.tsx` (additive section), `api.ts`/`types.ts` (additive). All
  minimal and correct. COMPLIANT.

## Open questions surfaced
- None. The story deliberately does not touch any Art. XIV open decision (no planningsblok/discipline/scope assumptions).
