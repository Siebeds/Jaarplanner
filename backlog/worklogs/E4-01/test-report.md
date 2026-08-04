# E4-01 — Test report (round 1)

**Verdict:** PASS
**Mode:** both — unit/integration (real PostgreSQL) + Playwright against a real API and a throwaway PostgreSQL database
**Tree verified:** `story/E4-01-live-dekking` at `a938b1b`, three commits off `origin/main` `7f6d8d9`, nothing pushed.
**Environment:** own API port 5521, Vite 5522, throwaway database `jp_e401v` (migrated, demo seed, **dropped afterwards**), claimed and released in the groepschat. Every mutation applied during verification was reverted; `git diff HEAD` over source is empty.

> **Nothing in this report is taken from the implementer's report.** Every figure below was re-measured, including
> the browser half, and the one thing the implementer explicitly did *not* claim - the counterfactual, that a stale
> figure appears **without** the change - was reproduced in the running app rather than left at unit level.

## Criteria checked

### The story's own *Done when*

> *"a drag or edit updates persistence and coverage without a manual save"* - and *"reflected in the dekkingsoverzicht"*.

| # | What was checked | Result | Evidence |
| --- | --- | --- | --- |
| 1 | An **acceptance** persists and the next dekking read accounts for it, with no save step | PASS | Browser: accept *Ik en mijn klas*, then `/dekking` reached **through the nav** shows `2 van 14`, never the cached `0 van 14`. Server confirmed `2 van 14` independently over `curl`. |
| 2 | A **move** persists and moves the figure | PASS | Browser: *Herfst en oogst* to Themaperiode 4 gives `4 van 14`; server `curl` agrees; the placement is `Manueel` at `2027-01-04` in the jaarplan JSON. Rows name their evidence: *Gedekt door Herfst en oogst* on `DEMO-L3-04`. |
| 3 | A **removal** lowers the figure (the direction a cache breaks most quietly) | PASS | Browser: *Uit de themaperiode halen*, confirm, then `/dekking` shows `2 van 14`, down from the cached `4 van 14`. Server `curl` agrees. |
| 4 | The pre-edit figure is **never painted**, and a loading state says so | PASS | With the dekking read slowed to 15 s by a proxy in front of the API, the accessibility tree on arrival is `status: "De dekking wordt berekend."` and contains **no figure element at all**, measured twice: after the move and after the removal. |
| 5 | "Reflected in de dekkingsoverzicht" is reachable without inventing a control | PASS | Every navigation above was a click on the existing nav item, client-side, never a reload. A reload would reset the TanStack cache the defect lives in and make the check vacuous. |
| 6 | The sequence is pinned server-side: one HTTP write, then one dekking read, nothing between | PASS | Five `DekkingNaBewerkingTests` pass against real PostgreSQL, 0 skipped. |

### Claims from `implementation.md`, re-measured

| Claim | Measured | Verdict |
| --- | --- | --- |
| Five backend sequences pass on real PostgreSQL, each observing a change | 5 passed, 0 skipped, with `JAARPLANNER_TEST_POSTGRES` set | confirmed |
| 569 unit + 194 integration, 0 skipped | 569 / 194, 0 skipped, both `Passed!` | confirmed, exact |
| 439 frontend tests / 20 files | `439 passed (439)`, `20 passed (20)` | confirmed, exact (see the flake note) |
| `dotnet format --verify-no-changes` clean | exit 0, no output | confirmed |
| `pnpm lint` clean, `pnpm build` (`tsc -b`) clean | both exit 0 | confirmed |
| Mutation (a): dropping `Status = KoppelingStatus.Manueel` from `Themaplaatsing.VerplaatsNaar` fails *exactly* the move test | `Failed: 1, Passed: 4`, only `Een_versleept_AI_voorstel_gaat_meteen_meetellen_want_het_wordt_manueel`, with `Expected: 1 / Actual: 0` | confirmed, exact |
| Mutation (b): letting `Voorgesteld` count in `DekkingService.TeltVoorDekking` fails *exactly* the two tests premised on 0 | `Failed: 2, Passed: 3`: the acceptance test and the move test | confirmed, exact |
| Mutation (c): disabling `vergeetDekking` fails *exactly* the two frontend tests that assert the drop, while the refused-move test passes either way | 2 failed, 88 passed, both with `expected { aantalGedekt: +0 } to be undefined`; the refused-move test passed | confirmed, exact |
| The browser figures 0, 2, 4, 2 van 14, with the loading line and never the previous number | reproduced independently on my own database and ports | confirmed |
| The demo class is L3 with 14 leerplandoelen in scope and seven `Voorgesteld` placements | `aantalLeerplandoelen: 14`, seven placements, all `Voorgesteld`, `aantalGedekt: 0` | confirmed, exact |

### Beyond what was claimed

1. **The counterfactual, in the running app.** `implementation.md` states honestly that the counterfactual is evidenced only at unit level, because editing the hook while the page is live triggers an HMR reload that resets the cache. It *is* reproducible: disable `vergeetDekking`, restart the dev server, and only *then* run the flow, because the cache only has to survive between the edit and the navigation, not before the run starts. With the fix disabled, accepting *Water* and reaching `/dekking` through the nav painted the pre-edit **`2 van 14`** while the server answered **`4 van 14`**, with no loading state, and corrected itself to `4 van 14` one request later. Screenshot: `e4-01-verify-counterfactual-stale-2van14.png`. **So the defect is precisely a transient window of one request, not a permanently wrong figure**, which is what the implementer's own wording says. Worth stating plainly, because it bounds the severity of what was fixed.
2. **The docstring's central justification is true, and I forced the failure.** With the fix disabled and the dekking read forced to `500`, `/dekking` showed the alert *De dekking kon niet berekend worden.* **directly above a stale `4 van 14`**, while the truth was `6 van 14` (accessibility tree: `alert`, then `heading "Demo, Demo 4 van 14 gedekt"`). With the fix restored, the same forced failure showed the alert **alone**, with no figure anywhere in the tree. That is the strongest argument for `removeQueries` over `invalidateQueries`, and it now rests on evidence rather than on reasoning.
3. **A fourth mutation, mine, proves the third frontend test has teeth.** Moving `vergeetDekking` into `onSettled`, the over-eager error that test was written against, fails **exactly** the refused-move test (1 failed, 89 passed, `expected undefined to be defined`). The implementer only claimed it "passes either way" under mutation (c); it also discriminates against the opposite mistake, so the rule *the cache follows the plan, not the gesture* is genuinely pinned rather than merely stated.

## Commands run

- `dotnet test` in the worktree with `JAARPLANNER_TEST_POSTGRES="Host=127.0.0.1;Port=5432;Database=postgres;Username=postgres;Password=postgres;SSL Mode=Disable"` gives `Passed! Failed: 0, Passed: 569, Skipped: 0` (unit) and `Passed! Failed: 0, Passed: 194, Skipped: 0` (integration)
- `dotnet test tests/Jaarplanner.IntegrationTests --filter "FullyQualifiedName~DekkingNaBewerkingTests"` gives 5/5, then twice more under mutations (a) and (b)
- `corepack pnpm test`: run 1 gave 2 failed / 437 passed, run 2 gave `439 passed (439)`, `20 passed (20)`. See the flake note
- `corepack pnpm vitest run src/features/jaarplan/Jaarplankalender.test.tsx` gives 90 passed, then three more runs under mutations (c) and (d)
- `dotnet format --verify-no-changes`: exit 0
- `corepack pnpm lint`: exit 0. `corepack pnpm build`: exit 0
- `dotnet ef database update` against `jp_e401v`; API on 5521 with `ConnectionStrings__Postgres`, `ASPNETCORE_ENVIRONMENT=Development`, `Demo__Seed=true`; Vite on 5522 with `VITE_API_PROXY_TARGET`
- Playwright MCP: nav to `/dekking`, nav to `/jaarplan`, accept / move / remove / lock, nav to `/dekking`, throughout **client-side only**
- `curl` straight at the API after every edit, as an independent second opinion on each figure

**Test-only infrastructure; no product code was touched to make the timing observable.** Instead of patching `window.fetch` in the page, a small Node proxy sat between Vite and the API, delaying `GET .../dekking` (15 s, later 60 s) and optionally answering it `500`. It lives in the session scratchpad, not in the repo. That is what made both the stale window and the failed-refetch case observable at all.

## Evidence

- `e4-01-verify-4van14-eindstand-na-verplaatsing.png` - `4 van 14` after the move, rows reading *Gedekt door Herfst en oogst*
- `e4-01-verify-2van14-na-verwijderen.png` - back to `2 van 14` after the removal
- `e4-01-verify-counterfactual-stale-2van14.png` - **the defect, with the fix disabled:** `2 van 14` on screen while the server says `4 van 14`
- `e4-01-verify-counterfactual-fout-naast-stale-cijfer.png` and `e4-01-verify-fout-zonder-stale-cijfer.png` - the forced-failure pair, with and without the fix
- `e4-01-verify-bevinding-stale-na-koppelwijziging.png` - **finding 1 below:** `7 van 14` with `DEMO-L3-02` marked *Niet gedekt*, while the server says `8 van 14`
- Console: 0 errors and 0 warnings across the whole positive pass. The only console errors in the session are the `500`s I forced myself.
- **A screenshot is not proof of the loading line.** Each MCP round trip costs 15 to 25 s of wall clock, so an image requested straight after a snapshot can arrive after the answer has landed. It happened to me twice. The loading-state evidence is therefore the **accessibility snapshot** (`status: "De dekking wordt berekend."`, with no figure element in the tree), not an image. The same limit applies to `implementation.md`'s screenshot claim: an image cannot show a state that ends before the shutter opens. Its figures are not disputed, only that one line of evidence is weaker than it reads.

## Findings (none of these block the criterion)

### 1. MAJOR - the same defect is still live one feature over, in code that predicted it

**Not E4-01's criterion** (FR-6.5/FR-7 are plan edits), so it does not fail this story. But it is the answer to *"does anything else serve a stale figure after an edit?"*, and it should become a story before E5-03/E5-05/E5-06 add more readers.

`frontend/src/features/themas/useThemas.ts` says, in its own module comment:

> *Not invalidated, and stated so the omission is a decision rather than an oversight: the dekking queries. A link change moves coverage (Art. V.1), but **no dekking query exists in the frontend yet**, E5-02 builds the screen. **Whoever adds it should add its key here**, because that is the fourth thing a manual link changes.*

E5-02 shipped that query on 2026-08-04 and E4-01 exported exactly the key it asks for. The sentence is now **factually false** and the obligation is **unmet**. Reproduced in the browser, decisively, with the dekking read slowed to 60 s so the window could not be missed:

1. `/dekking` cached at `7 van 14`, reached client-side.
2. `/themas`, then *Ik en mijn klas*, then **Leerplandoel koppelen**, then `DEMO-L3-02`. The server figure becomes `8 van 14`, verified by `curl`.
3. Back to `/dekking` through the nav: the page paints **`7 van 14`** with `DEMO-L3-02` marked *Niet gedekt*, **no loading line**, for the length of one request.

Eleven `useBeheerMutatie` writes plus `useVerwijderThema` are affected, and so are `useWijzigSuggestieStatus` and `useVervangSuggestieDoel` in `features/matching/useDoelsuggesties.ts`: accepting or substituting a doelsuggestie changes a `DoelKoppeling`, hence coverage. **One design note for whoever picks it up:** a link change is school-wide, so it can move coverage for **every** class whose plan holds that thema. `dekkingKlasKey(klasId)` is the wrong granularity there, and the honest drop is the whole `["dekking"]` subtree.

### 2. LOW - `removeQueries` does cost a teacher a loading line on the two edits that cannot move the figure

Asked for explicitly, so it is reported. Measured in the browser: a **lock toggle** ("Vastzetten"), which the implementer's own comment says cannot change coverage, drops the cache and forces a full loading line for an **unchanged** figure (`8 van 14` before, `De dekking wordt berekend.`, `8 van 14` after). A **rejection** (`Voorgesteld` to `Geweigerd`) is the same case: neither status counts, so the figure cannot move.

Real, but small: one extra request, normally under a tenth of a second. The alternative is the per-edit rule the implementer argued against for good reason. A hook that dropped the cache for four of five edits would be a rule nobody could state, and the failure mode of getting it wrong is a stale inspectie-facing figure rather than a pause. **Not a defect. Recorded so the trade-off is known rather than assumed.**

### 3. LOW - "a refused edit keeps the figure" holds for refusals, not for every failure mode

The rule is implemented in `onSuccess`, so any HTTP error keeps the cached figure. That is right for a 400 or 409 refusal, which persisted nothing. Two cases where it keeps a figure that **is** stale:

- **A `404` on a delete or a move**, meaning another session removed the placement. That is the case `useThemas.ts` handles explicitly as *"iemand anders heeft het verwijderd"*. The plan really did change, so the retained figure is wrong. Note that the jaarplan cache is equally stale here, so this is a pre-existing multi-user gap rather than something E4-01 introduced.
- **A write that committed but whose response was lost** (timeout, dropped connection, a 500 after `SaveChanges`): persisted, reported as failed, figure retained.

Both are outside this story and neither is reachable in single-user local use. Worth a sentence in whatever story owns concurrent editing.

### 4. NIT - the new doc comment orphaned `useDekking`'s own docstring

In `frontend/src/features/dekking/useDekking.ts` the new JSDoc for `dekkingKlasKey` was inserted **between** the existing `useDekking` docstring and the code it documented. Two comment blocks now sit adjacent, `useDekking` has no docstring of its own, and the block explaining *"No `staleTime`, deliberately"* hovers over `dekkingKlasKey`, where it is about the wrong thing. Cosmetic: one comment to move.

### Note - one frontend flake, not a product bug

The first `pnpm test` run reported 2 failed / 437 passed, both in `src/features/themas/ThemasPagina.test.tsx` (`findByRole("list")` timeouts), while a full `dotnet test` was saturating the machine: that run took 139 s against 69 s clean. The immediate retry under no load was `439 passed (439)`. Environmental, and `ThemasPagina.test.tsx` is untouched by this story, but it is a timing-sensitive suite worth knowing about.

## Verdict rationale

Every acceptance criterion is met, and every claim in `implementation.md` reproduces at the stated figure, including the three mutation checks at the exact pass/fail split claimed. The browser half was re-done from scratch on an independent database and its own ports, and the one thing the report left at unit level, that the pre-edit figure really does appear without the change, now has browser evidence, as does the failed-refetch argument that justifies `removeQueries` over `invalidateQueries`. No defect touches the *Done when*. Finding 1 is a real stale figure on a real screen and should be filed as its own story: it is a different feature's write path, and failing E4-01 for it would be charging this story with E1-14's unmet obligation.
