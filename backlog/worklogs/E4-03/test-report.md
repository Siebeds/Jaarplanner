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
