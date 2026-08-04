# E4-01 — Immediate persistence + live coverage reflection

**Story:** E4-01 (FR-6.5, FR-7, Art. V.1) · **Branch:** `story/E4-01-live-dekking` off `origin/main` `7f6d8d9`
(i.e. with **E5-02** and **E4-03** already in).

## What this story turned out to be

Its own entry predicted most of it: the server half was already satisfied, because dekking is **computed on
every read and never stored** (Art. V.1), so "reflected without a manual save" needs no wiring and no
invalidation step behind the API. What the entry left open was the two things that were genuinely missing:

1. **Nobody had ever proven the sequence.** Every dekking test seeded placements straight through the
   `DbContext` and read the figure. That proves the read path; it cannot prove a criterion about an *edit*
   followed by a *read*, which is what FR-6.5/FR-7 actually promise a teacher.
2. **The client is allowed to remember, and it did.** The dekkingsoverzicht (E5-02, merged the same day) is a
   different route, so while a teacher edits the kalender its query has **no observer**. The five placement
   mutations wrote the jaarplan into the cache and left the dekking answer sitting there. Navigation between
   the two screens is client-side, so that answer is what `/dekking` paints on arrival: a coverage figure
   computed *before* the edit, with no loading state to say so, and — if the refetch then fails — a stale
   number left on screen beside the error.

So the work is one test file, one four-line client change, and the sentence that says why the client change is
a removal rather than an invalidation.

## The two commits

### `c8aacff` — prove an edit reaches the figure, end to end on real PostgreSQL

`backend/tests/Jaarplanner.IntegrationTests/Postgres/DekkingNaBewerkingTests.cs`: five sequences, each **one
HTTP write through the endpoint the kalender drives, then one `GET …/dekking`, with nothing in between**. The
absence of an intermediate call is the assertion, expressed by construction.

| Sequence | Figure |
| --- | --- |
| hand-place a thema (`POST …/plaatsingen`, E4-03) | 0 → 1, and the covered goal names *Herfstthema* as its evidence |
| accept a proposal (`PUT …/status`) | 0 → 1 |
| move a proposal (`PUT …/blok`) | 0 → 1, because the move sets the placement to `manueel` and `manueel` counts |
| remove a placement (`DELETE`) | 1 → 0 |
| re-place a **stale** placement (`PUT …/blok`) | no figure at all → 1, and `isBetrouwbaar` false → true |

Two of those were worth more than the criterion asked for. The **move** case pins the interaction the story
entry only described in prose: dragging a standing proposal raises the coverage figure as a side effect,
without any decision being recorded. The **stale** case pins the half E5-01 explicitly left unverified: it
proved the figure is *withheld* while a placement is stale, never that resolving one releases it again.

Against real PostgreSQL deliberately (E7-16): dekking is a query over four `DoelKoppeling` layers, and this
project has been bitten six times by a write path verified only on the in-memory provider.

**Mutation-checked rather than trusted for passing first time:**

- dropping `Status = KoppelingStatus.Manueel` from `Themaplaatsing.VerplaatsNaar` → **exactly** the move test
  fails (1 failed, 4 passed);
- letting `Voorgesteld` count in `DekkingService.TeltVoorDekking` → **exactly** the two tests whose premise is
  a figure of 0 before the edit fail (2 failed, 3 passed).

### `7074328` — a plan edit drops this class's cached dekking figure

`vergeetDekking(queryClient, klasId)` in `useJaarplan.ts`, called from the shared `usePlanMutatie` hook (all
five placement edits) and from the generation mutation. It calls `removeQueries`, not `invalidateQueries`, and
the difference is the whole point:

- **invalidate** marks the inactive query stale and leaves the answer in the cache. TanStack paints it on the
  next mount and refetches behind it, so the pre-edit figure is on screen for the length of one request.
- **remove** leaves the page nothing to paint, so it shows its own "laden" line and then the fresh figure.

It is also the trade-off `DekkingPagina` already made for itself: it renders `isPending` on a scope switch
rather than keeping figures computed over another denominator. A total computed over another *plan* is the
same mistake with the same cost, and this screen is the one a directie may put in front of an inspectie
(Art. V.2).

The key is exported from the feature that owns it (`dekkingKlasKey` in `features/dekking/useDekking.ts`) and
imported by the feature that drops it, following the precedent of `themas/useThemas.ts` reaching for
`matching`'s key, so the string `"dekking"` still exists in exactly one place.

Three frontend tests, also mutation-checked: disabling the call fails **exactly** the two that assert the drop
(2 failed of 439), while the third — a **refused** move, where the server persisted nothing and the figure must
therefore survive — passes either way. That third test is the one that pins the rule as *the cache follows the
plan, not the gesture*.

## Browser pass (real API, real PostgreSQL, own throwaway database)

API on 5511, Vite on 5512, database `jp_e401` (migrated, demo seed, dropped afterwards). The demo class is
L3 with 14 L3 leerplandoelen in scope and seven `Voorgesteld` placements, each thema carrying two themadoelen.

Navigation between the two screens was done **client-side through the nav**, never by reloading, because a
reload resets the query cache and would have made the whole check vacuous.

| Action | Figure before | Figure after | Pre-edit figure shown? |
| --- | --- | --- | --- |
| accept *Ik en mijn klas* | 0 van 14 | **2 van 14** | no, the loading line |
| move *Herfst en oogst* to Themaperiode 4 | 2 van 14 | **4 van 14** | no, the loading line |
| remove *Herfst en oogst* from its period | 4 van 14 | **2 van 14** | no, the loading line |

To make the first moment after arrival observable at all, `window.fetch` was patched in the page to delay the
`/dekking` request by three seconds. Without that the read completes faster than a screen can be inspected,
which is exactly why this defect would never have been noticed by looking. The covered rows name their
evidence (*Gedekt door Ik en mijn klas* / *Herfst en oogst*), so the figure is not a count that moved for some
other reason.

Screenshot: [`dekking-na-aanvaarden.png`](dekking-na-aanvaarden.png) (2 of 14, straight after the acceptance).

**Stated honestly:** the *counterfactual* — that a stale figure would appear without this change — is evidenced
at unit level by the mutation check, not in the browser. Reproducing it in the running app would have meant
editing the hook while the page was live, and an HMR reload resets the cache the defect lives in.

## What this story does **not** claim

- **No minimumdoel level** (E5-04, blocked on E1-12): every figure above is leerplandoel-level.
- **No change to the dekkingsoverzicht itself.** E5-02 owns that screen, and it is still `[~]` pending an
  audit of its kleuterjaar chooser. This story changed behaviour, not layout, so no contrast or 390px
  measurement was taken or is claimed.
- **No new control anywhere.** "Reflected in the dekkingsoverzicht" is satisfied by the nav item E0-10
  shipped; inventing a second route to the same screen would be scope this story does not own.

## Gates

- **Backend:** the five new tests pass against real PostgreSQL (`JAARPLANNER_TEST_POSTGRES`, 0 skipped);
  full suite re-run before the story closed.
- **Frontend:** 439 tests / 20 files, 0 skipped. `pnpm lint` clean, and `pnpm build` (`tsc -b`, the type check
  that actually runs — see E7-17) clean.
- **Not run in this session:** the independent `test-runner` and `antagonist` passes. The harness rule in force
  here is that subagents are spawned only when the owner asks, so both gates are **owed** and the story is
  `[~]` until they close. Recorded rather than glossed: this backlog's own history is a series of retractions
  caused by self-reported gates.
