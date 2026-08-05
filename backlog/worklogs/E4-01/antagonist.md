# E4-01 — antagonist, round 1

**Verdict:** VIOLATIONS FOUND (1 MAJOR, 6 MINOR, 1 QUESTION — no CRITICAL)

*Authored by the `antagonist` agent on 2026-08-04 and pasted here verbatim by the session that owns the branch:
the agent is read-only on project files and could not write this itself. Nothing below is edited, including the
findings that turned out to be about my own prose.*

**Scope audited:** `git diff origin/main...HEAD` on `story/E4-01-live-dekking` (`c8aacff`, `7074328`, `a938b1b`)
in the worktree `C:\source\Jaarplanner\.claude\worktrees\e4-01-live-dekking`, i.e.
`backend/tests/Jaarplanner.IntegrationTests/Postgres/DekkingNaBewerkingTests.cs`,
`frontend/src/features/jaarplan/useJaarplan.ts`, `frontend/src/features/dekking/useDekking.ts`,
`frontend/src/features/jaarplan/Jaarplankalender.test.tsx`, `backlog/E4-bewerking-hergeneratie.md`,
`backlog/README.md`, `backlog/worklogs/E4-01/*`. Ripple effects checked into `Themakaart.tsx`,
`Jaarplankalender.tsx`, `DekkingPagina.tsx`, `useDoelsuggesties.ts`, `useThemas.ts`, `EfDekkingOpslag.cs`,
`DekkingService.cs`, `nl.json`, `app/routes.ts`.

The core of the change survives the attack. `removeQueries` over `invalidateQueries` is correct and I could not
falsify it (details under Checks). The findings are about claims made *around* the change.

## Findings

### [MAJOR] The new test file asserts a product disclosure that no string in the product makes

- **Article/FR:** Art. IV.1/IV.2 (human-in-the-loop), Art. X.5/X.6 (consistency, reviewable), the E3-06 rule's
  spirit; plus the standing obligation recorded in the E4-01 story entry itself.
- **Where:** `DekkingNaBewerkingTests.cs:122-124` — *"…it is also the kind of consequence a teacher must be told
  about, **which is why the card discloses it before the drag**."*
- **Problem:** Re-derived at HEAD, the card discloses something else, somewhere else:
  - `kalender.verplaatsGevolg` = *"Het thema wordt dan jouw eigen keuze in plaats van een AI-voorstel, en de
    motivatie van de AI verdwijnt. Dat kan je niet terugdraaien."* It discloses the status conversion and the
    loss of the motivation. It says **nothing about dekking**.
  - It renders only inside the opened *Aanpassen* panel, and only when a picker exists (`Themakaart.tsx:641`
    gate `doelen.length > 0`, then `:679`). A teacher who **drags** never sees it.
  - The drag route itself discloses no consequence at all: `Jaarplankalender.tsx:382-396` fires
    `verplaats.mutate` directly; the board-level `kalender.sleepUitleg` is purely instructional; the dnd-kit
    live-region announcements (`Jaarplankalender.tsx:405-426`) are position-only.
  - The only dekking-related sentence a teacher can read on this screen is `kalender.beslisUitleg`
    (`Jaarplankalender.tsx:658`): *"Zolang een thema een AI-voorstel blijft, telt het niet mee voor de
    dekking."* Combined with `verplaatsGevolg` that is a two-step inference for the picker route and no
    information at all for the drag route.
  - The story entry carries the *open* obligation this comment reads as discharged:
    `backlog/E4-bewerking-hergeneratie.md` (E4-01 entry) — *"a drag sets the placement to `manueel` … So
    dragging a `voorgesteld` thema raises the coverage figure as a side effect of the move. … it belongs in
    whatever copy this story or E4-02 writes."* E4-01 wrote no copy (`nl.json` untouched, confirmed), and
    neither the story entry nor the worklog's "What this story does not claim" list records the obligation as
    still outstanding.
- **Required fix:** one of two, not silence. Either (a) correct the comment to state exactly what is disclosed
  (*the placement becomes the teacher's own choice and the AI motivation is lost*), where (the Aanpassen picker
  only), and that the **dekking** consequence is disclosed nowhere and the copy obligation from this story's own
  entry is still open; or (b) write the copy in `nl.json` (Art. II.3) and cite the key from the comment. Note
  that (b) is a UI change, which per CLAUDE.md pulls in `frontend-design` and a browser pass, so (a) plus an
  explicit hand-off is the smaller, honest move.

### [MINOR] "Bitten six times" is stale at HEAD; the backlog says seven

- **Article/FR:** Art. X.5 (consistency); the E4-02 audit's own recurring failure mode.
- **Where:** `DekkingNaBewerkingTests.cs:28` and `worklogs/E4-01/implementation.md:47`.
- **Problem:** `backlog/E7-niet-functioneel.md` E7-16 at HEAD reads *"the class behind **seven** defects"* and
  *"rediscovered **seven** times by seven different sessions"*, with an enumerated list of **7** instances
  (instance 7 = E5-01, 2026-08-03, 15:01). The figure "six" was true before E5-01's second instance was
  recorded. (E7-16 does carry a pre-existing internal inconsistency — its list heading still says *"The six
  instances"* over seven items — which plausibly seeded the copy, but that is a reason to file it, not to
  inherit it.)
- **Required fix:** cite the class (E7-16) without a count, in both places; a count copied into a code comment
  is a count that will be wrong again. Optionally file E7-16's own heading/count mismatch.

### [MINOR] The generation branch of the new code is pinned by no test

- **Article/FR:** Art. X.1 (a gate proves what it claims), Art. V.6.
- **Where:** `useJaarplan.ts:149` (`vergeetDekking` inside `useGenereerJaarplan.onSuccess`).
- **Problem:** `dekkingKlasKey` is imported in exactly one test file and used only in the new `describe`
  (`Jaarplankalender.test.tsx:3305-3398`), whose three cases drive an **accept**, a **move** and a **refused
  move** — all through `usePlanMutatie`. Deleting line 149 leaves all 439 frontend tests green. The worklog's
  mutation claim ("disabling the call fails exactly the two that assert the drop") is therefore about the
  `usePlanMutatie` call site only and does not cover the generation call site, and the worklog does not say so.
- **Required fix:** either a fourth case (generate → assert the class's dekking entries are gone; the
  generation stub already exists in this file) or an explicit line in the worklog stating that branch is
  unpinned.

### [MINOR] The client half is pinned at cache level only, though the observable behaviour is testable

- **Article/FR:** Art. X.1; the repo's own "reachable-vs-tested" pattern (E2-08, E1-15, E0-10, E4-06).
- **Where:** `Jaarplankalender.test.tsx:3305-3398`; no counterpart in `features/dekking/Dekkingsoverzicht.test.tsx`.
- **Problem:** the three new tests assert `queryClient.getQueryData(...) === undefined`. That is a cache
  assertion, not a behaviour assertion. What the story promises a teacher — *the dekkingsoverzicht shows its own
  "laden" line and then the new figure, never the pre-edit figure* — is asserted in no automated test, although
  it is reachable without a router: mount `Jaarplankalender`, perform the edit, unmount, mount `DekkingPagina`
  with the **same** `QueryClient` and a stub returning the new figure, assert `dekking.laden` renders and the
  pre-edit number never does. The removal is only meaningful via that consequence.
- **Required fix:** add that test, or record in the worklog that the *observable* half of the client change
  rests on the browser pass alone.

### [MINOR] The browser table's load-bearing column has no artefact

- **Article/FR:** Art. X.1.
- **Where:** `worklogs/E4-01/implementation.md:88-100`; single artefact `dekking-na-aanvaarden.png`.
- **Problem:** the screenshot verifies exactly one cell of the table (I read it: *"2 van 14 doelen gedekt"*,
  rows *"Gedekt door Ik en mijn klas"*, scope *Deze klas*, class *L3 derde leerjaar (demo)*). It does **not**
  capture the third column — *"Pre-edit figure shown? no, the loading line"* — for any of the three rows, and
  that column is the entire point of the change (it is the moment the deliberate three-second delay was
  introduced to make observable). Rows 2 and 3 (`→ 4 van 14`, `→ 2 van 14`) have no artefact at all. The
  worklog is honest about the *counterfactual* not being reproduced in the browser; it is silent about the
  *positive* observation being unartefacted while presenting it as a measured table.
- **Required fix:** either add a screenshot of the loading line (the delay makes it capturable), or mark that
  column as observed-not-captured in the same sentence that already concedes the counterfactual.

### [MINOR] The same stale-figure path survives on the other two write routes, and the "not claimed" list omits it

- **Article/FR:** Art. V.1/V.2 (a figure a directie may show an inspectie must follow the plan).
- **Where:** `features/matching/useDoelsuggesties.ts:57-68` (`useWijzigSuggestieStatus`) and `:96-107`
  (`useVervangSuggestieDoel`); `features/themas/useThemas.ts:172-179+` (themadoel add/remove via
  `useBeheerMutatie`). None of them touches the dekking cache.
- **Problem:** dekking is computed over four `DoelKoppeling` layers (`EfDekkingOpslag.cs:71-90`): layer 1 =
  themadoelen, layer 2 = accepted/adjusted doelsuggesties. Both are written from `/themas`, which is built and
  teacher-facing (E1-14, E2-08). So a teacher can accept a doelsuggestie or add a themadoel on a *placed*
  thema, walk to `/dekking` through the nav, and read a pre-edit figure with no loading state — byte for byte
  the defect this story defines as "the one failure this screen must not have" (`useJaarplan.ts:58-60`).
  E4-01's criterion (FR-6.5/FR-7, plan edits) does not cover it, so this is not a breach of the story; but the
  worklog's "What this story does **not** claim" list names three absences and not this one, and the hook
  comment states the rationale as a general property.
- **Required fix:** add it to the not-claimed list and file it (E5 or E4 follow-up: the same `vergeetDekking`
  seam applied to the two thema-side mutation families; note it is class-agnostic there, so the key would have
  to drop `["dekking"]` wholesale).

### [MINOR] A doc comment in `useDekking.ts` now documents nothing

- **Article/FR:** Art. X.6 (reviewable), Art. II.2.
- **Where:** `frontend/src/features/dekking/useDekking.ts:6-19` followed immediately by `:20-28`.
- **Problem:** the E5-02 block (*"The scope is part of the query key…"*, *"No `staleTime`, deliberately…"*) used
  to sit directly above `dekkingKey`. The new export was inserted between them, so the file now has two
  consecutive JSDoc blocks: hover/tooling attaches the E4-01 text to `dekkingKlasKey`, and the E5-02 rationale
  documents nothing, while `dekkingKey` (`:31`) and `useDekking` (`:34`) have lost theirs. The `staleTime`
  reasoning in particular belongs to the query, not the key.
- **Required fix:** move the E5-02 block back onto the symbol it describes (`useDekking` or `dekkingKey`),
  leaving the new block on `dekkingKlasKey`.

### [MINOR] Art. II.5 breach surfaced by this story's own evidence (pre-existing, not introduced here)

- **Article/FR:** Art. II.5 — *"No `—` in any string a user can read or that becomes data: `nl.json`, **seeded
  and demo content**…"*
- **Where:** `backend/src/Jaarplanner.Infrastructure/Demo/DemoDataSeeder.cs:239` —
  `tekst: $"Voorbeelddoel {i} — demodata voor de review, geen Op.stap-leerplandoel."`
- **Problem:** the em dash is rendered to a user, visibly, in this story's committed screenshot
  (`dekking-na-aanvaarden.png`, every row of the overview). It is the only data string in that file with the
  character (the other 16 occurrences are comments, which Art. II.5 explicitly permits). Not introduced by this
  branch — no backend `src/` file is in the diff — but it is a live breach at HEAD in the artefact this story
  chose as evidence.
- **Required fix:** file it (an E7 hygiene item); do not fix it inside E4-01, which changed no production
  backend code.

### [QUESTION] Does a drag that raises dekking without a recorded decision need copy, and where?

- **Article/FR:** Art. IV.1 (the human decides) read against Art. V.1's counting of `manueel`; the E4-01 story
  entry's standing note.
- **Where:** `Themaplaatsing.VerplaatsNaar` (`Themaplaatsing.cs:175-180`), pinned by the new test at
  `DekkingNaBewerkingTests.cs:119-139`.
- **Problem:** I judge the *behaviour* compliant: a drag is a human act, `manueel` is one of Art. IV.2's four
  persisted statuses, and the AI is not granting coverage. What is undecided is whether the raise must be
  **stated** to the teacher, and if so whether on the drag route (which today says nothing), in
  `verplaatsGevolg`, or once above the board beside `beslisUitleg`. This is an owner decision, not a violation
  I can assert, and it is the substance behind the MAJOR above.

## Checks run (proof of thoroughness)

- **Art. V.1 — "computed, never stored"; the `removeQueries` argument (attacked, held).** `DekkingService`
  computes per read (`DekkingService.cs:66-94`, `TeltVoorDekking` `:233-235`); nothing persists a figure. The
  invalidate-leaves-a-paintable-answer claim is correct TanStack semantics, and I checked the one race that
  would break `removeQueries`: in query-core **5.101.2**
  (`node_modules/.pnpm/@tanstack+query-core@5.101.2/.../queryCache.js:39-48` → `query.js:86-89`) `remove` calls
  `query.destroy()` → `cancel({silent:true})` and deletes the map entry, so an in-flight pre-edit fetch cannot
  be written back. The repo's recorded `removeQueries` hazard (`useThemas.ts:147-158`: removing a query with a
  mounted observer forces an immediate refetch, which resurrected a 404) does not apply: `useDekking` has
  exactly one consumer, `DekkingPagina.tsx:49`, and it is on another route. `DekkingPagina.tsx:114-116` does
  render `dekking.laden` on `isPending`, and `useDekking` has no `placeholderData`, so the "nothing to paint"
  claim is true. **No finding.**
- **Art. V.6 — coverage logic under test.** Ran the full backend suite with a real local PostgreSQL:
  **763 passed, 0 failed, 0 skipped** (569 unit + 194 integration); the new class alone: **5 passed, 0
  skipped**. Frontend: **439 passed / 20 files, 0 skipped**. `pnpm lint` clean, `pnpm build` clean,
  `dotnet format --verify-no-changes` clean (the worklog's gate list omits `dotnet format` even though it
  touched backend code, Art. X.2 — verified clean, so no finding).
- **Mutation claims re-derived, not re-run** (my role is read-only, so I did not mutate source). Backend:
  dropping `Status = Manueel` from `Themaplaatsing.VerplaatsNaar:175-180` breaks only the move test (the
  stale-healing test seeds `Aanvaard`, which still counts) → *1 failed, 4 passed* is right. Letting
  `Voorgesteld` count in `TeltVoorDekking` breaks only the accept and move tests (whose premise is 0 before the
  edit) → *2 failed, 3 passed* is right. Frontend: only the two new drop-assertions read the dekking cache, and
  test 3 never reaches `onSuccess` → *2 failed, third passes either way* is right. The independent
  `test-runner` gate is still owed and this inference does not substitute for it.
- **"The absence of an intermediate call is the assertion, by construction" — judged real, not decorative.**
  Each test performs write-then-`GET` over HTTP against a per-test database (`PostgresTestDatabase.MaakAsync`
  creates `jp_test_dekkingbewerking_<guid>`), so a server that needed a second call would fail these tests. The
  endpoint set matches what the kalender actually calls (`features/jaarplan/api.ts:100/124/135/152`). The
  `vergrendeling` endpoint (`api.ts:180`) is absent from the file, which is correct: lock does not enter
  `TeltVoorDekking`.
- **Repo claims about prior coverage — re-derived at HEAD, all true.** `DekkingEndpointsTests.cs` contains
  **only** `GetAsync` calls (methods at `:58-296`), so "every dekking test seeded placements straight through
  the `DbContext`" holds; the withholding case is `:177` and no test anywhere resolved a stale placement and
  re-read the figure, so the E5-01 gap claim holds. "directie ruling 2026-07-28, clause 4" is a real, cited
  ruling (`backlog/E5-dekking-export.md:30,37`). `themas/useThemas.ts:5` really does import `matching`'s key,
  so the precedent for the cross-feature key import is real.
- **Art. VIII — layering and dependency direction. No finding.** Backend layering untouched (no production
  backend code in the diff; stack unchanged: net10.0 LTS, EF Core + Npgsql, ClosedXML, React
  18/Vite/Tailwind/dnd-kit/TanStack/Zustand). Frontend: `features/jaarplan → features/dekking` is a one-way
  edge — I checked for the cycle and `features/dekking` imports nothing from `features/jaarplan`. The
  constitution imposes no frontend layer order, only feature organisation, and the
  mutating-feature-imports-the-invalidated-key direction matches the existing `themas → matching` convention. A
  neutral `lib/queryKeys.ts` would be a deviation from that convention, not a fix.
- **Art. II — domain language and copy.** `nl.json` is not in the diff (verified). No Dutch literal added to any
  component; the new tests resolve labels through `t(...)`. New identifiers follow the split correctly: Dutch
  domain (`vergeetDekking`, `dekkingKlasKey`, `Opzet`, `ZetPlaatsingOpAsync`), English comments. Art. II.5: no
  em dash in any new user-readable string or datum; the em dashes in the worklog, comments and backlog are
  developer prose, explicitly permitted by Art. II.5's scope clause. The one real breach is in pre-existing seed
  data (MINOR above).
- **Art. III / VII / IX — untouched.** No migration, no entity change, no Excel mapping change. The test seeds
  two `Leerplandoel` rows into its own throwaway database (test fixture, not a mutation of official content).
  Block starts are asked of the `IPlanningsblokIndeling` seam (`DekkingNaBewerkingTests.cs:250-252`) rather than
  assumed, so Art. IX.3's "never hard-assume months" is honoured.
- **Art. VI — privacy/secrets.** Diff scanned: no password, key, token or connection string;
  `_db.ConnectionString` comes from `JAARPLANNER_TEST_POSTGRES`. The worklog names a database (`jp_e401`) and
  two ports, no credentials. No pupil data. No AI code touched, so no key surface.
- **Art. XIV — no open decision hard-assumed.** No month assumption, no discipline assumption, no export-format
  assumption; the two-tier seam is used, not bypassed.
- **Scope (FA) / E3-06 spirit — "no new control" claim holds.** `/dekking` is a primary nav destination with
  `isGebouwd: true` (`app/routes.ts`), visible on the kalender (confirmed in the committed screenshot's nav
  bar), and `kalender.beslisUitleg` names dekking on the board. So an edit does have a discoverable route to the
  figure and the claim is not a promise nothing delivers. **No finding.**
- **Backlog arithmetic re-derived.** E4 row `8 | 3` matches the epic file exactly: 8 `- [` entries, three `[x]`
  (E4-02, E4-03, E4-06), E4-01 `[~]`, so "the done count is unchanged" is correct. The commit SHAs, base
  (`7f6d8d9`) and "E5-02 and E4-03 both in" all check out against `git log`.
- **Minor observation, not a finding:** `ZetOpAsync`'s `if (!await context.Leerplandoelen.AnyAsync(...))` guard
  and the `Guid.NewGuid()` name suffixes defend against cross-test collisions that cannot occur (one fresh
  database per test method). Harmless, but it implies a shared database to a future reader. Relatedly,
  `Assert.Equal(2, voor.AantalLeerplandoelen)` depends on nothing else seeding a K3 leerplandoel; true today,
  worth knowing if the demo seed ever gains a kleuterklas.

## Open questions surfaced

- **Art. IV.1 disclosure of the drag-raises-dekking side effect** (the QUESTION above): required or not, and if
  required, on the drag route as well as the picker. This is the story's own standing obligation and needs the
  owner, not the auditor.
- **Art. V.2 beyond the kalender:** whether the two `/themas` write families that change dekking layers 1 and 2
  must get the same treatment before `/dekking` is put in front of an inspectie, and which story owns it.

**The change is not done.** The MAJOR must be fixed or explicitly waived by the owner (not by another agent),
and the MINORs addressed or recorded.
