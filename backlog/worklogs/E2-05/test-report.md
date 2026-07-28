# E2-05 — Test report

> Acceptance verification run by the **orchestrator** directly. The dedicated
> test-runner subagent could not be used for this story: the implementer process
> died on a transient API error, and rather than bounce off flaky sub-agents the
> orchestrator re-ran every gate fresh against the committed `story/E2-05` worktree
> and cross-checked the acceptance criteria. The antagonist (see `antagonist.md`)
> independently confirmed the tests prove FR-4.3 + Art. IV.1/IV.3.

## Verdict: PASS

**Mode:** backend unit + integration (xUnit) and frontend unit (Vitest + Testing Library + jest-axe). No live-app Playwright run (infra-constrained); acceptance instead verified via the automated suites + code inspection of the status-change flow.

## Gates (orchestrator re-ran all, fresh)
| Gate | Result |
|---|---|
| backend `dotnet build` | ✓ 0 errors (pre-existing NU1903 OpenApi warning only) |
| backend `dotnet format --verify-no-changes` | ✓ clean |
| backend unit (`Jaarplanner.UnitTests`) | ✓ 280 passed (story branch) / 294 on the merged tree |
| backend integration (`Jaarplanner.IntegrationTests`) | ✓ 18 passed |
| frontend `pnpm lint` | ✓ 0 errors (2 pre-existing shadcn/ui fast-refresh warnings) |
| frontend `pnpm test` | ✓ 12 passed (incl. 5 new `features/matching/DoelsuggestieLijst.test.tsx`) |
| frontend `pnpm build` | ✓ built |

## Criteria → result
| Criterion | Result | Evidence |
|---|---|---|
| Teacher sets status aanvaard/geweigerd/manueel; reviewable with motivation | PASS | `DoelMatchingService.WijzigSuggestieStatusAsync`; UI renders code + AI motivation with the three actions; `Ai.DoelsuggestieStatusTests` + `DoelsuggestieLijst.test.tsx` |
| No AI auto-apply — teacher-only move off `voorgesteld` (Art. IV.1/IV.3) | PASS | non-teacher status (incl. `voorgesteld`) → `OngeldigeSuggestieStatusFout` → 400; nothing committed on rejection (`AantalKeerBewaard == 0`) |
| Status changes persist and drive coverage (E5) | PASS | persists as `DoelKoppeling.Status`; integration test round-trips via the API and survives a fresh GET; `aanvaard`/`manueel` count toward dekking, `voorgesteld`/`geweigerd` do not |

## Non-blocking follow-ups (from the antagonist)
- MINOR: `AiMatchingExceptionHandler` puts raw Dutch domain messages in `ProblemDetails.Detail` (frontend renders its own nl.json copy and never reads the body; mirrors the existing SchoolcontentExceptionHandler). Consider a neutral Detail.
- MINOR: unused i18n key `matching.statusLabel` (dead).
- QUESTION: endpoints lack `[Authorize]` — pre-existing (no RBAC anywhere yet); routed to **E6-02**.
