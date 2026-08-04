# E4-03 — Test report (round 1)

**Verdict:** PASS
**Mode:** both (unit/integration + Playwright + headless-Chrome CDP probes)
**Commit verified:** `4a6ad37` on `story/E4-03-handmatig-plaatsen`, worktree
`C:\source\Jaarplanner\.claude\worktrees\e4-03-handmatig-plaatsen`.
`git merge-base --is-ancestor origin/main HEAD` is true, `origin/main` = `ba372a4`, and nothing in
`origin/main` is missing from HEAD, so the three-dot diff is the whole change.

**Criterion, verbatim (`backlog/E4-bewerking-hergeneratie.md`):** *"Add/move/remove thema's,
activiteiten, and goal links by hand, with no AI involved. Done when: a fully hand-built plan is
possible. Ref: FR-7.2."*

**Environment for the browser pass, isolated on purpose.** Own ports 5507 (API) / 5508 (Vite), own
database `jp_e403gate`, all claimed in the groepschat before anything started. `ConnectionStrings__Postgres`
(the key the app actually reads) was set, and **which database the API was on was asserted before any
write**, not after, which is the trap the implementer disclosed. The shared `jaarplanner` database was
never written to. **No Azure AI is configured in this environment at all** (`dotnet user-secrets list`
holds only the connection string; there is no `AzureAI` section), which turns "no AI involved" from a
claim into a property of the environment. See the control experiment below.

---

## The criterion, demonstrated

**A fully hand-built plan is possible: PASS.** On a class with **no `jaarplan` row at all**
(`SELECT count(*) FROM jaarplannen` = 0, asserted first), seven thema's were placed by hand into one
period and `GET .../dekking` went **0 / 14 to 14 / 14, `isBetrouwbaar: true`**, with no generation run,
no AI call and no accept step anywhere. A second, smaller plan was then built **entirely through the
UI** (two "Toevoegen" presses in two different periods) and reads:

```
 BlokStart  | Status  | motivatie_null |      Naam
------------+---------+----------------+-----------------
 2026-09-01 | Manueel | t              | Verkeer
 2027-01-04 | Manueel | t              | Herfst en oogst
```

which `GET .../dekking` reports as `gedekt 4 / 14 | betrouwbaar True | by thema: Herfst en oogst, Verkeer`.

**Control experiment that makes "no AI involved" falsifiable.** `POST .../jaarplan/generatie` with a
valid body answers **500** in this environment (the known E2-09 defect: missing AI config) and writes
**nothing**: `jaarplannen` stayed at 0. So the AI path is provably unusable here, while the
hand-placement path succeeds. Any AI involvement on that path would have produced the same 500.

---

## Claims checked

**1. A class with no jaarplan at all can receive its first thema by hand, and no AI call happens. PASS.**
Precondition asserted, not assumed (`jaarplannen` = 0). After one browser press the row exists and holds
the placement. The browser network log for the whole flow is `GET /jaarplan`, `/jaarplan/parameters`,
`/rooster`, `/themas/bibliotheek`, `POST .../jaarplan/plaatsingen`: no generation and no suggestion
endpoint. On top of that the AI is unconfigured and generation 500s. The unit test asserts
`client.AantalAanroepen == 0`; the Postgres test injects an `OntploffendeAiClient` that throws if reached.

**2. The placement lands as `Manueel` with no `aiMotivatie`, and survives a regeneration. PASS.**
Live row: `Status = Manueel`, `AiMotivatie IS NULL`, `Vergrendeld = f`, `BlokNiveau = Themaperiode`.
Regeneration survival is pinned by `Een_handmatig_geplaatst_thema_overleeft_een_hergeneratie` (two
consecutive `GenereerAsync` runs), which I mutation-checked myself: `Manueel` to `Voorgesteld` in the
service kills that test and the empty-plan test. At code level `IsVervangbaar = Voorgesteld && !Vergrendeld`
and `VerwijderVervangbarePlaatsingen` is regeneration's only deletion path, so a `Manueel` placement is
unreachable by it. Not demonstrated against a live model run: impossible here, no AI configured.

**3. The request keys on the period's start date, never its ordinal. PASS.**
The wire contract has no ordinal field: `HandmatigePlaatsing(Guid ThemaId, DateOnly BlokStart)`. Placing in
the column headed "Themaperiode 3, 9 nov to 20 dec" persisted `BlokStart = 2026-11-09`. Negative probes
against the live API: `blokStart: 3` gives 400 (`JSON value could not be converted`), and
`blokStart: "2026-11-10"`, one day past the boundary, gives 400 "Die periode bestaat niet meer in dit
schooljaar...", so it is refused and never snapped. `themaplaatsingen` unchanged after both.

**4. A thema already in the target period is refused (400), the UI does not offer it, and a rejected
placement still counts as occupying the slot. PASS.**
The duplicate gives 400 "Dit thema staat al in deze periode...", nothing written. In the UI, period 3's
picker omits `Water` while period 1's picker offers "Water (staat al in themaperiode 3)". The rejected case
was driven end to end: `PUT .../status {"status":"Geweigerd"}`, then (a) re-placing the same thema in the
same period gives 400, (b) after a reload the picker in that period still withholds `Water` while a visible
`Geweigerd` card sits there, (c) dekking correctly drops to 0. `Jaarplan.IsAlGeplaatst` reads no status and
`themaPeriodeOrdinalen` is status-blind to match.

**5. The period picker is withheld at the subthemaperiode tier, and the board says in visible text where
hand-planning works. PASS.**
Switched to Subthemaperiodes in the browser: zero "Thema toevoegen" buttons in the DOM, and a visible
paragraph "Zelf een thema in een periode zetten kan in de weergave Themaperiodes." At the coarse tier that
sentence is correctly absent (`PLAATSUITLEG.kan === null`; the probe returned `plaatsuitleg: false`) because
every column carries a labelled button. The server agrees: a subthemaperiode start that is not also a
themaperiode start gives 400 (`Handmatig_plaatsen_op_een_subthemaperiode_die_geen_themaperiode_begint_wordt_geweigerd`).

**6. Three dead-end states each render a sentence instead of an empty picker or a dead button. PASS, and all
three were reproduced in a real browser rather than only in jsdom.**
(a) No thema's at all, with the `themas` table emptied: "Er zijn nog geen thema's om te plannen. Maak er een
aan bij Thema's, of laad de thema's van de school in bij Import.", only `Annuleren`, no submit. Both
destinations it names are live nav items, not "binnenkort".
(b) Failed library load: I killed only my own `Jaarplanner.Api.exe` (PID-scoped), then opened a picker whose
query had no cache. Result: a `role="alert"` reading "De thema's konden niet geladen worden, dus je kan er nu
geen kiezen. Probeer het opnieuw.", no submit.
(c) Period holds every thema, with all 7 placed in period 3: "Alle thema's van de school staan al in deze
themaperiode.", only `Annuleren`.

**7. Focus returns to the trigger when the picker closes, on both exits. PASS.**
Measured in the browser on both paths: after `Annuleren` the accessibility tree marks
`button "Thema toevoegen aan themaperiode 3"` as `[active]`, and after a successful placement the same
trigger is `[active]`. The fix is an effect keyed on the previous `open` value, with `wasOpen` guarding it so
columns do not grab focus on mount. The test `returns focus to the trigger when the picker closes` asserts
`document.activeElement` on both exits.

**8. A hand-placed thema is reflected in dekking with no accept step. PASS.**
`0 / 14` to `2 / 14` for one placement, with both covered doelen naming the placed thema; to `14 / 14` for
seven; and `4 / 14` for the UI-only two-card plan. Rejecting the placement takes it back to 0, so the figure
follows the status rather than the row's existence. `DekkingService.TeltVoorDekking` counts
`Aanvaard or Manueel` (Art. V.1), and no accept control was ever pressed.

**Criterion narrative, for completeness.** Add and remove of activiteiten and goal links exists and is
hand-authored: `SchoolcontentBeheerService.cs:219/319/395` all write `KoppelingStatus.Manueel`, behind the
E1-14 endpoints on `Themas`/`Subthemas`/`Activiteiten`. The one verb-by-object cell that is not built is
moving an activiteit to another subthema; the implementer disclosed it rather than claiming it, and it is now
filed as E4-08 in the working tree. It is not needed for "a fully hand-built plan is possible", so it does
not block this criterion, but whether E4-03 may close with that cell open is the owner's call.

---

## Gates re-derived (measured on this tree, none copied)

| Gate | Result |
| --- | --- |
| `dotnet test` with `JAARPLANNER_TEST_POSTGRES` | **542 unit + 180 integration, 0 failed, 0 skipped** — matches the implementer's figures exactly |
| `corepack pnpm test` | **388 passed / 18 files** — matches exactly |
| `corepack pnpm lint` (`eslint . --max-warnings 0 && tsc --noEmit`) | clean, exit 0 |
| `corepack pnpm build` (the one that type-checks, E7-17) | clean, `built in 4.36s` |
| `dotnet format --verify-no-changes` | clean, exit 0 |
| axe **4.10.2 in a real browser**, picker open | **0 violations.** Five `incomplete` `color-contrast` nodes, all pre-existing chrome (an `aria-hidden` icon span, three empty period wells, the vertical vakantie label); none is an element this story added |
| Backlog progress table at `4a6ad37` | **96 / 43 / 45%**, independently re-derived from the checkboxes: 10+18+9+10+7+9+9+17+7 = 96 stories, done 10+14+8+7+3+1 = 43. Correct. The working tree now reads 97/43/44% because the still-live implementer session added E4-08 at 17:19, and that recount is also correct. My own first count was wrong at 92 because the regex missed the `[!]` blocked marker; four epics use it. |

### Mutation checks I ran myself, in a scratch clone

| Mutation | Killed | Survived |
| --- | --- | --- |
| `KoppelingStatus.Manueel` to `Voorgesteld` | `Een_klas_zonder_jaarplan_krijgt_haar_eerste_thema_handmatig_zonder_enige_ai_aanroep` and `Een_handmatig_geplaatst_thema_overleeft_een_hergeneratie` | 539 others |
| create-if-absent to 404 (`LaadOfMaakJaarplanAsync` becomes `LaadJaarplanAsync ?? throw`) | 6 E4-03 tests | `Handmatig_plaatsen_van_een_onbekend_thema_is_niet_gevonden`, the disclosed blind spot: confirmed real and confirmed harmless, since six other tests catch that regression |

A third test, `De_frontendconstante_voor_het_generatieniveau_volgt_de_backend`, failed under both mutations.
That is a scratch-copy artefact rather than a mutation kill: it walks up for a repo root holding both
`backend/src` and `frontend/src`, and I copied only `backend/`.

### The two disclosed blind spots, probed rather than repeated

1. `Handmatig_plaatsen_van_een_onbekend_thema_is_niet_gevonden` reproduces exactly as disclosed: it survives
   the create-if-absent mutation. Not a defect, because the behaviour is pinned six times over.
2. A jsdom axe run cannot fail on `label-content-name-mismatch`, `duplicate-id-aria` or
   `form-field-multiple-labels`, so I ran axe in the browser and read `incomplete` explicitly rather than only
   `violations`. Nothing this story added appears in either list. SC 2.5.3 also holds by direct read: every
   trigger's accessible name contains its visible label ("Thema toevoegen aan themaperiode 3" contains
   "Thema toevoegen"), and all seven names are distinct.

### Contrast and target size, composited and measured in the browser

| Element | Measured | Threshold |
| --- | --- | --- |
| label "Zet in deze themaperiode", `rgb(21,39,46)` on white | **15.42:1** | SC 1.4.3 needs 4.5 |
| select text, same colour | **15.42:1** | needs 4.5 |
| select border `rgb(83,101,110)` on white | **6.08:1** | SC 1.4.11 needs 3 |
| trigger label `rgb(21,39,46)` on white | **15.42:1** | needs 4.5 |
| trigger border `rgb(150,138,115)` on white | **3.40:1** | needs 3 |
| `plaatsGevolg` `rgb(83,101,110)` on white, 12px | **6.08:1** | needs 4.5 |
| target sizes | trigger **266x36**, select **244x31** | SC 2.5.8 needs 24x24 |

A harmless divergence worth recording: the implementer reported the trigger boundary at 3.21:1, composited
against the `rgba(250,248,245,0.7)` well. I measured 3.40:1, because the trigger's own computed background is
solid white, which is the nearer opaque ancestor. Both pass 3:1 and neither figure is wrong; they use
different backdrops.

**390px:** `windowScrollsX = false` after `scrollTo(9999,0)`, `body.scrollWidth === clientWidth === 390`, and
the picker panel stays inside its column (a 244px select in a 288px column). Elements reported as past the
viewport all sit inside `overflow-x: auto` scrollers (the board list, the nav list), which is the trap the
implementer documented, reproduced here and dismissed for the same reason.

**Console:** 0 errors and 0 warnings on the final page with the picker open. The only errors seen all session
were the 500s I induced by killing my own API for dead end (b), plus `localhost:5496` refusals left in the
shared browser profile by another session.

---

## Commands run

- `dotnet test` in the worktree `backend/` with `JAARPLANNER_TEST_POSTGRES` set: 542 + 180, 0 skipped, exit 0
- `corepack pnpm test`: 388 / 18 files, exit 0
- `corepack pnpm lint`: exit 0. `corepack pnpm build`: exit 0. `dotnet format --verify-no-changes`: exit 0
- `dotnet ef database update` against `jp_e403gate`, because the app does not auto-migrate, then
  `dotnet run --project src/Jaarplanner.Api --no-launch-profile` with `ASPNETCORE_ENVIRONMENT=Development`,
  `Demo__Seed=true` and `ASPNETCORE_URLS=http://127.0.0.1:5507`; `pnpm dev --port 5508` with `VITE_API_PROXY_TARGET`
- `curl` probes: duplicate gives 400, ordinal body gives 400, non-boundary date gives 400, rejected re-place
  gives 400, generation without AI config gives 500 and writes nothing; `GET .../dekking` read at every step
- `psql` against `jp_e403gate` for every assertion about rows, never against the shared `jaarplanner`
- Playwright MCP for the user flow; headless Chrome over CDP for axe 4.10.2, computed styles and the 390px probe
- Mutation checks in a scratch clone under the session scratchpad

One harness error of mine, recorded because it looked exactly like a product defect: a first attempt to place
all seven thema's returned 400 for six of them and 200 for the seventh. `psql` on Windows emits CRLF, so every
id except the last (command substitution strips the final newline) carried a stray carriage return inside the
JSON body, which model binding correctly rejected. Re-run with `tr -d '\r'`: all seven return 200. The product
was never involved.

## Evidence files

- `C:\source\Jaarplanner\.claude\worktrees\e4-03-handmatig-plaatsen\backlog\worklogs\E4-03\gate-evidence\e4-03-hand-built-plan-two-manueel-cards.png`
- `C:\source\Jaarplanner\.claude\worktrees\e4-03-handmatig-plaatsen\backlog\worklogs\E4-03\gate-evidence\e4-03-picker-open-rejected-withheld.png` (rejected card visible while `Water` is withheld from the picker)
- `C:\source\Jaarplanner\.claude\worktrees\e4-03-handmatig-plaatsen\backlog\worklogs\E4-03\gate-evidence\e4-03-deadend-library-load-failed.png`

Playwright wrote these three screenshots into the shared main working tree (`C:\source\Jaarplanner\`); they
were moved here and the main tree verified clean again, because another session is working there.

## Defects

**None.** Four MINOR observations, none blocking and none a criterion failure:

- **[MINOR] Dead `nl.json` key.** `kalender.plaatsThemaKeuzeHier` ("{naam} (staat al in deze themaperiode)")
  is referenced nowhere in `src/`. The thema already in this period is withheld rather than annotated, which
  is the right behaviour, so the key is a leftover of the earlier design. Delete it, or the next reader will
  assume that state renders.
- **[MINOR] `themaPeriodeOrdinalen`'s doc comment overstates its filtering.** It says "Placements at another
  tier ... are skipped", but the function filters only on `blokStart` matching a current block, so a
  `Subthemaperiode` placement whose start coincides with a themaperiode start would be counted. Unreachable
  today, because every writer fixes the tier to `GeneratieNiveau`, so this is a comment that has stopped
  describing its code: the class this repo retracts most often.
- **[MINOR] Untested `Verplaatsstaat` branch.** `PLAATSUITLEG.niveauOnbekend`, mapping to
  `kalender.plaatsNiveauOnbekend`, is unexercised by any test I could find and I could not reach that state
  from the running app. The string exists and the record is exhaustively typed, so this is coverage, not a
  suspected defect.
- **[MINOR] Uncommitted work in the verified worktree.** At `4a6ad37` the tree is source-clean, but
  `backlog/E4-bewerking-hergeneratie.md` and `backlog/README.md` carry uncommitted edits written at
  17:19-17:20 (the E4-08 filing) by the still-live implementer session. Everything above was measured on
  `4a6ad37`'s source, which those edits do not touch, but whoever merges must commit or drop them
  deliberately rather than as a by-product.

## Not verified, stated as plainly as what was

- **Survival of a real (Azure) regeneration run.** No AI is configured in this environment and nobody can run
  one here. Claim 2's regeneration half rests on a mutation-checked unit test over a faked AI client plus the
  `IsVervangbaar` predicate, not on a live model call.
- **`Verplaatsstaat = niveauOnbekend`.** Not reachable from the app as configured.
- **Moving an activiteit between subthema's.** Not built, not claimed, filed as E4-08.
- **The rest of the board's pre-existing behaviour** (drag-and-drop, aanvaarden and weigeren, the lock). Those
  belong to E3-07/E4-02/E4-06 and were exercised only where E4-03's own criteria required it, namely the status
  PUT used to reach the rejected-occupancy case.
- **Multi-user concurrency.** The 400 copy tells a teacher that someone else may have just added the thema, but
  two simultaneous clients were not tested.
- **Keyboard-only traversal of the whole board.** Focus return was measured; tab order across seven columns was
  not walked.
