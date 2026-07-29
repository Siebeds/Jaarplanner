# E2-08 — Trigger the matching: an invocation surface for FR-4.1

## Build round 1 — the missing wire, plus the two riders

- **FR / Article:** FR-4.1 (primary), FR-4.2 (judgeability rider), FR-4.3 (the "aanpassen" rider).
  Constitution: Art. IV.1 (nothing auto-applied), IV.2 (status persisted), IV.3 (motivation surfaced),
  IV.5 (validate before use, nothing persisted on malformed output), IV.6 (fakeable client),
  III.1/III.5 (curriculum read-only, codes never fabricated), VI.4 (keys server-side), II.3 (all
  user-facing Dutch from `nl.json`), V (a doel counted once), VIII (layering, thin Api), XII + WCAG 2.2
  AA (never colour alone), XIV (disciplines-first stays open).
- **Branch:** `story/E2-08`, branched from `feature/e2-ai-matching` (= `main` @ `305ed3c`).

### What was actually wrong, and what fixes it

`DoelMatchingService.MatchThemaAsync` takes `IReadOnlyCollection<Leerplandoel> leerdoelen` as a
parameter. That is why nothing could call it: no code path in a running application had a candidate set
to hand it. The fix is not a new service — it is **step 0**, resolving that set through the seam that
already exists (`ILeerdoelCatalogus`), exposed as a method a controller can call:

```
POST /api/themas/{themaId}/doelsuggesties/genereer      → DoelMatchingService.GenereerSuggestiesAsync
PUT  /api/themas/{themaId}/doelsuggesties/{id}/leerplandoel → DoelMatchingService.VervangSuggestieDoelAsync
```

`MatchThemaAsync` keeps its parameterised signature (it is the pure core the unit tests drive);
`GenereerSuggestiesAsync` is the reachable entry point.

### Files changed

**Backend — application/domain**
- `backend/src/Jaarplanner.Application/AiMatching/DoelMatchingService.cs` — added
  `GenereerSuggestiesAsync` (resolve candidates → run the existing pipeline) and
  `VervangSuggestieDoelAsync` (FR-4.3 substitution); injected `ILeerdoelCatalogus`; enriched the read
  view with the goal's own text/doelsoort; added the "no candidates ⇒ do not call the AI" guard.
- `backend/src/Jaarplanner.Application/AiMatching/DoelsuggestieGeneratieVerzoek.cs` *(new)* — the
  optional request body carrying the caller's `LeerdoelSelectie`; documents the Art. XIV default and the
  prompt-volume risk at the place a reader will look for them.
- `backend/src/Jaarplanner.Application/AiMatching/OngeldigeDoelsubstitutieFout.cs` *(new)* — one fault
  covering all four ways a substitution can be refused → 400.
- `backend/src/Jaarplanner.Application/AiMatching/DoelMatchSuggestieWeergave.cs` — added `Tekst` and
  `Doelsoort` (both nullable, defaulted, so no call site broke) — FR-4.2.
- `backend/src/Jaarplanner.Application/AiMatching/DoelMatchResultaat.cs` — added `AantalKandidaten`, so
  the scope of a run is observable rather than implied.
- `backend/src/Jaarplanner.Application/AiAuthoring/LeerdoelSelectie.cs` — added an optional `Codes`
  dimension so one known code can be resolved through the existing seam instead of loading the whole
  curriculum to answer "does this code exist?".
- `backend/src/Jaarplanner.Domain/Schoolcontent/DoelKoppeling.cs` — added `VervangLeerplandoel(code)`:
  points the link at a different goal, sets `Manueel`, clears `AiMotivatie`.

**Backend — infrastructure/api**
- `backend/src/Jaarplanner.Infrastructure/AiAuthoring/EfLeerdoelCatalogus.cs` — applies the new `Codes`
  filter.
- `backend/src/Jaarplanner.Infrastructure/AiMatching/EfDoelMatchOpslag.cs` — the GET list now joins the
  read-only leerplandoelen to fill `Tekst`/`Doelsoort` (one extra `AsNoTracking` read; nothing written).
- `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — `ILeerdoelCatalogus` moved above its
  two consumers; comments corrected to say the matching service is now reachable from a controller.
- `backend/src/Jaarplanner.Api/Controllers/DoelsuggestiesController.cs` — `POST …/genereer` (200, or 422
  with the English diagnostic on invalid AI output) and `PUT …/{id}/leerplandoel`.
- `backend/src/Jaarplanner.Api/Infrastructure/AiMatchingExceptionHandler.cs` —
  `OngeldigeDoelsubstitutieFout` → 400.

**Frontend**
- `frontend/src/features/matching/DoelsuggestieGeneratie.tsx` *(new)* — the trigger panel: the button,
  the two optional scope filters, the failure branches, and the run report.
- `frontend/src/features/matching/DoelsuggestieLijst.tsx` — renders the goal text + doelsoort badge, and
  adds the per-row substitution field/button with its own 400-vs-other error branch.
- `frontend/src/features/matching/DoelsuggestieReview.tsx` — renders the trigger above the list.
- `frontend/src/features/matching/api.ts` · `useDoelsuggesties.ts` · `types.ts` — the two new calls, the
  two new mutations (both invalidating the suggestions query; the substitution also invalidates the gap
  list, since a `manueel` link counts as coupled), and the enriched/new types.
- `frontend/src/i18n/nl.json` — 28 new keys under `matching`; relabelled `manueel` /`manueelAria` from
  "Manueel aanpassen" to "Manueel **overnemen**" so it is not confusable with the new substitution.

**Docs / backlog**
- `backlog/README.md` — the Art. II.3 entry's own instruction: logged the 4 new backend Dutch strings,
  and drew the boundary between authored copy and displayed domain data (see "Art. II.3" below).
- `backlog/E2-ai-matching.md` — three deferred obligations recorded under E2-08 (no checkbox touched).

### Key decisions

**1. The `LeerdoelSelectie` default is `Alles`, chosen visibly and reversibly.**
The request body is optional and carries a `selectie` with `disciplines` / `jaarFasen` / `codes`; omitting
it resolves to `LeerdoelSelectie.Alles` at **one documented place** (`GenereerSuggestiesAsync`), not as a
literal in the controller. Visibility and reversibility are concrete, not asserted:
- the UI shows both filters, empty, with copy that says what empty means and that *"met welke disciplines
  de school start, is nog niet beslist — daarom kies jij het hier, per keer"* (`matching.selectieUitleg`);
- the response reports `aantalKandidaten`, which the UI renders ("Gezocht in 12 leerplandoelen"), so a
  teacher can see the scope a run used instead of trusting an invisible default;
- narrowing is per run, so no state has to be migrated when directie rules.
I deliberately did **not** reuse `IDisciplineSelectie` (the E1-06 import config seam): that seam scopes
which disciplines' goals get *imported*, and borrowing it for match scope would silently equate two
different questions.

**Prompt-volume risk, noted and not solved.** With `Alles`, every loaded leerplandoel goes into the
prompt. That is safe today — the database holds only the demo seeder's `DEMO-*` goals and no Op.stap
import can be triggered yet (E1-15) — and will not be once a real per-discipline import lands. No cap was
invented: deciding which goals are silently withheld from the model is pedagogical, not technical.
Recorded in `DoelsuggestieGeneratieVerzoek`'s summary and as obligation (2) under E2-08 in the epic file.

**2. "Aanpassen" = substituting a different leerplandoel — implemented, and flagged as a reading.**
`VervangSuggestieDoelAsync` repoints the link, sets `Manueel`, and clears `AiMotivatie` because that
motivation argued for the goal the AI proposed and not for this one (Art. IV.3). It refuses: a blank code,
a code the loaded Op.stap set does not carry (Art. III.5 — never fabricate), the suggestion's own current
code (that is the *other* action, and this path must not become a back door to it), and a code already
linked to the thema (two links to one doel would double-count it in dekking, Art. V).
**The reading is not settled.** E2-05's note records that if directie reads "aanpassen" as merely
overriding the AI's verdict, FR-4.3 was already satisfied. So both actions ship side by side — the
pre-existing status-to-`manueel` button (relabelled "Manueel overnemen") and the new substitution — and
either can be removed without rework once directie rules. The cost of shipping both is honest and stated:
two controls on one row that a teacher could confuse.
**Accepted loss:** after a substitution nothing records which code the AI had proposed. Keeping it needs a
nullable column and a migration; judged out of proportion here and recorded as obligation (1) under E2-08.

**3. Art. II.3 — the UI renders no server-authored Dutch.** Every string the teacher reads comes from
`nl.json`. Both new failure paths branch on **HTTP status only**:
- generation: 422 → `matching.genereerMislukt` ("de AI gaf geen bruikbaar antwoord … probeer opnieuw");
  anything else → `matching.genereerOnbeschikbaar` ("nu niet beschikbaar … meld dit aan de beheerder").
- substitution: 400 → `matching.vervangenMislukt` (actionable: check the code); anything else →
  `matching.vervangenOnbeschikbaar`.
`ProblemDetails.Title`/`Detail` are never read by the frontend. The 4 new Dutch fault messages are
therefore backend-only today, which is why option (b) in the README entry still costs no UI rework.
*What the UI does render from the server is domain data, not copy:* the leerplandoel's official `tekst`
(read-only Op.stap content — exactly the thing the product exists to display, and already rendered by
`OngekoppeldeDoelenLijst` since E2-06) and `aiMotivatie` (model output, rendered since E2-05). I stated
that boundary explicitly in the README entry rather than leaving an auditor to infer it.

**4. No AI call when there are no candidates.** An empty candidate set cannot produce a usable suggestion
— every answer would be discarded as unknown — so the model is not called and the run returns success with
`aantalKandidaten = 0`. The UI shows a distinct message (`matching.geenKandidaten`) instead of "de AI
stelde geen enkel leerplandoel voor", because today the real cause is that no Op.stap import has run, and
blaming the AI for that would be a false diagnosis. Pinned by test both back- and front-end.

**5. Nothing auto-applied (Art. IV.1).** The endpoint has no accept path; generation persists only
`Voorgesteld` (enforced by `Thema.VoegDoelsuggestieToe`, which throws on any other status). There is no
retry and no re-prompt on "poor" quality — judging quality is the teacher's job (Art. IV.7). A malformed
response persists nothing and commits no unit of work (asserted).

**6. Adjacent defect flagged, not expanded (as instructed).** With no `AzureAI:ApiKey` configured the
client throws and `POST …/genereer` returns **500**, where **503** would describe an unconfigured
dependency far better. I did not change `AzureAiFoundryClient` or the shared exception handler — E3-02
deferred exactly this because it reaches into E2-01 — and instead branched the UI on status, as E3-02 did.
Recorded here and in the controller's summary so it is not rediscovered a third time.

### Tests added

**Unit — `backend/tests/Jaarplanner.UnitTests/Ai/DoelMatchingServiceTests.cs`** (all against
`FakeAiClient` + `FakeDoelMatchOpslag` + `FakeLeerdoelCatalogus`: no network, no database)
- `Genereren_haalt_de_kandidaten_zelf_op_en_persisteert_als_voorgesteld` — the entry point resolves its
  own candidates, persists `Voorgesteld` + motivation + text/doelsoort, commits once.
- `Zonder_selectie_zoekt_de_generatie_in_alles` — the default is `LeerdoelSelectie.Alles`, asserted on
  what the catalogus was actually asked for.
- `Een_selectie_van_de_leerkracht_begrenst_de_kandidaten` — a jaar/fase filter reaches the seam and
  changes `AantalKandidaten`.
- `Zonder_kandidaten_wordt_de_ai_niet_aangeroepen` — 0 calls to the AI, 0 commits, success with 0.
- `Genereren_op_kapotte_json_persisteert_niets` — nothing added, nothing committed, candidate count still
  reported.
- `Genereren_slaat_een_verzonnen_code_over` / `…_een_al_gekoppelde_code_over` — Art. III.5 and idempotency.
- `Aanpassen_vervangt_het_doel_en_zet_de_koppeling_op_manueel` — code changed, status `Manueel`,
  `AiMotivatie` null, the *new* goal's text returned.
- `Aanpassen_naar_een_onbestaande_code_wordt_geweigerd` / `…_zonder_code_…` (Theory: `""`, `"   "`) /
  `…_naar_een_al_gekoppeld_doel_…` / `…_naar_hetzelfde_doel_…` — each asserts the suggestion is unchanged
  *and* that nothing was committed.
- `Aanpassen_van_een_onbekende_suggestie_of_thema_geeft_niet_gevonden`.
- `DoelsuggestieStatusTests.Beslissing_geeft_de_doeltekst_mee_…` — the enriched shape holds on the status
  path too, so the row never flickers between enriched and bare.

**Integration — `backend/tests/Jaarplanner.IntegrationTests/DoelsuggestieEndpointsTests.cs`**
The file's pre-existing tests seeded suggestion rows directly, which is precisely why the suite was green
while the feature was unreachable. The new tests go **through** `POST …/genereer` — real controller, real
service, real EF store, real `EfLeerdoelCatalogus`; only the AI client is stubbed and only the DB provider
is in-memory, so **nothing skips**:
- `Genereren_maakt_voorgestelde_suggesties_die_de_lijst_daarna_toont` — asserts the list is *empty first*
  (the deployed-app symptom), then that a fresh GET returns the generated row with its text + doelsoort.
- `Een_selectie_in_de_aanvraag_begrenst_de_kandidaten` — `{"selectie":{"jaarFasen":["L1"]}}` → 1 candidate.
- `Kapot_ai_antwoord_geeft_422_en_persisteert_niets` — 422 and the list is still empty afterwards.
- `Een_verzonnen_code_belandt_niet_in_de_databank`.
- `Opnieuw_genereren_dupliceert_niets`.
- `Aanpassen_vervangt_het_doel_en_overleeft_een_herlaad` — `Manueel`, motivation gone, new text, read back
  out of the store.
- `Aanpassen_naar_een_onbestaande_code_geeft_400_en_wijzigt_niets`.

**Frontend — `frontend/src/features/matching/DoelsuggestieGeneratie.test.tsx`** (new, 8 tests). It renders
the trigger **and** the list together on purpose: the defect was never a broken component but the absence
of a connection, so a test asserting only that a POST went out would have passed on the broken code too.
What is pinned is the wire — an empty list becomes a populated one because the button was pressed. Also:
`tAantal` inflection ("1 nieuwe suggestie" + "Gezocht in 12 leerplandoelen"), the selection actually sent,
the 0-candidate message instead of blaming the AI, unknown codes named, 422 vs 500 copy, and axe.

**Frontend — `DoelsuggestieLijst.test.tsx`** (+4): the goal text and the doelsoort abbreviation/label
render (never colour alone), the substitution sends a trimmed code to the `/leerplandoel` endpoint and the
row comes back `Manueel` with the new text, the button is disabled on an empty field, and a refused
substitution shows local Dutch copy while the row stays unchanged.

### Gates (verbatim)

```
$ dotnet build
Build succeeded.

$ dotnet format --verify-no-changes
(no output — no changes needed)

$ JAARPLANNER_TEST_POSTGRES="Host=127.0.0.1;...;SSL Mode=Disable" dotnet test
Passed!  - Failed:     0, Passed:   439, Skipped:     0, Total:   439, Duration: 27 s - Jaarplanner.UnitTests.dll (net10.0)
Passed!  - Failed:     0, Passed:    86, Skipped:     0, Total:    86, Duration: 54 s - Jaarplanner.IntegrationTests.dll (net10.0)
```

Note: run **with** `JAARPLANNER_TEST_POSTGRES` against local Postgres 17, so the 36 `[PostgresFact]` tests
that otherwise skip all executed — 0 skipped. Without the variable the same integration project reports
`Failed: 0, Passed: 50, Skipped: 36, Total: 86` (measured). Nothing new in this story skips: the 7 new
integration tests run on the in-memory provider with a stubbed AI client, unconditionally.

```
$ pnpm lint
$ eslint . --max-warnings 0 && tsc --noEmit
(no output — clean)

$ pnpm test
 ✓ src/features/jaarplan/kalenderFormat.test.ts (12 tests)
 ✓ src/components/DoelsoortBadge.test.tsx (4 tests)
 ✓ src/features/matching/OngekoppeldeDoelenLijst.test.tsx (4 tests)
 ✓ src/features/matching/DoelsuggestieGeneratie.test.tsx (8 tests)
 ✓ src/App.test.tsx (3 tests)
 ✓ src/features/matching/DoelsuggestieLijst.test.tsx (9 tests)
 ✓ src/features/jaarplan/Jaarplankalender.test.tsx (8 tests)
 Test Files  7 passed (7)
      Tests  48 passed (48)

$ pnpm build
✓ 111 modules transformed.
✓ built in 5.97s
```

All gates green. No migration was needed — nothing about the schema changed.

### Self-check vs acceptance criteria

| *Done when* | Met? | Evidence |
| --- | --- | --- |
| A teacher can trigger matching for a thema **from the UI** | Yes | `DoelsuggestieGeneratie` renders inside `DoelsuggestieReview`, which `App.tsx` already mounts. `DoelsuggestieGeneratie.test.tsx` drives the button and the list populates. Browser steps below. |
| …and see the resulting `voorgesteld` suggestions **with their motivation** | Yes | Integration test asserts the GET returns `status: "Voorgesteld"` + `aiMotivatie` after generation; the list test asserts both render, plus the status badge label. |
| …**generated through the real service (not seeded)** | Yes | The generation integration tests never insert a `DoelKoppeling`; they POST and then assert on rows only that path could have written, starting from an asserted-empty list. |
| AI client stays server-side (Art. VI.4) | Yes | No key or AI config reaches the frontend; the frontend only calls `POST …/genereer`. `AzureAI` options remain bound server-side in `DependencyInjection`. |
| …and behind its interface so the flow is testable with the faked client (Art. IV.5/IV.6) | Yes | 14 new unit test methods (15 cases) run against `FakeAiClient` with no network and no DB; the integration factory swaps `IAiClient` for a stub and needs no key. |
| Nothing is auto-applied (Art. IV.1) | Yes | No accept path on the endpoint; `Thema.VoegDoelsuggestieToe` rejects any status but `Voorgesteld`; malformed output persists nothing and commits nothing (asserted). |
| Rider: FR-4.3 "aanpassen" = substitute a different doel, landing `Manueel` | Yes | `PUT …/{id}/leerplandoel`; 5 unit tests + 2 integration tests + 3 frontend tests. Reading flagged as reversible. |
| Rider: FR-4.2 — leerplandoel `tekst` (+ doelsoort badge) in the payload | Yes | `DoelMatchSuggestieWeergave.Tekst`/`Doelsoort`, filled on all four paths (generate / list / status / substitute); rendered with the abbreviation and label, never colour alone (Art. XII). |

### For the test-runner

**Unit/integration:** `cd backend && dotnet test` — set `JAARPLANNER_TEST_POSTGRES` to run the Postgres
suite too. `cd frontend && pnpm test`.

**Playwright / by hand in a browser** — this needs a real AI key *or* an expectation of the failure copy:
1. `docker compose up -d db` (or local Postgres), then `cd backend && dotnet run --project src/Jaarplanner.Api`
   with `Demo:Seed=true` (already set in `launchSettings.json`) so demo thema's and `DEMO-*` leerplandoelen exist.
2. `cd frontend && pnpm dev`, open the app (single page; the doelsuggestie section is below the jaarplan).
3. Get a thema-id: `GET /api/themas` (or read it from the demo seeder's output) and paste it into
   **"Thema-id"**. The suggestion panel appears.
4. Press **"Doelsuggesties genereren"**, leaving both filters empty.
   - **With `AzureAI:ApiKey` configured:** the report appears ("… nieuwe suggesties voorgesteld." +
     "Gezocht in N leerplandoelen.") and the list below fills with `Voorgesteld` rows, each showing the
     doelsoort badge, the goal text and the motivation.
   - **Without a key (the default dev state):** expect *"Het voorstellen is nu niet beschikbaar … Meld dit
     aan de beheerder van de tool."* — that is the intended 500 branch, **not** a bug in this story. It is
     also the honest limit of a browser check without a key.
5. Narrow the scope: type `9` into disciplines (the demo goals' discipline) and re-run; the candidate count
   should drop. Type a discipline that does not exist and re-run: expect the "geen leerplandoelen die aan
   je keuze voldoen" message and **no** AI call.
6. Re-run the same generation twice: the second report should say "Overgeslagen — al aan dit thema
   gekoppeld: …" and the list must not grow.
7. On a row, type another existing code into **"Ander leerplandoel in de plaats van …"** and press
   **"Vervangen"**: the row should show the new code + its text, status **Manueel**, and no motivation.
   Type `VERZONNEN-99` and press Vervangen: expect *"Vervangen lukte niet. Controleer of de code bestaat …"*
   and an unchanged row.
8. Accessibility: every control is reachable by keyboard and has a visible label; the substitution field's
   label carries the row's code so it is unique per row (aria-label deliberately omitted — it would
   override the visible text and break WCAG 2.5.3). `jsdom` cannot check colour contrast, so the axe passes
   cover structure only; the doelsoort/status colours come from the existing design tokens, unchanged.

### Open questions / Art. XIV touched

1. **Art. XIV "disciplines first" — untouched but now user-facing.** The choice is asked per run and
   defaults to "everything loaded", stated on screen. Nothing is compiled in. A ruling changes UI copy at
   most.
2. **Which reading of FR-4.3's "aanpassen" is right?** Both ship. Directie's answer removes one control.
3. **Should the originally proposed code survive a substitution?** Needs a column + migration; not built.
   Matters before any export claims to show how a coupling came about (E7/FR-11).
4. **A missing `AzureAI:ApiKey` returns 500 where 503 fits better.** Not changed here (touches E2-01 and
   the shared handler; E3-02 deferred the same thing). Two stories have now worked around it in their own UI.
5. **Prompt volume once a real Op.stap import lands** (E1-05/E1-15). Flagged, not solved, no cap invented.
6. **`aiMotivatie` and Op.stap `tekst` are server-supplied Dutch shown to a teacher.** I classify both as
   *domain data*, not authored copy, and said so in the README's Art. II.3 entry. If the eventual ruling
   means to cover displayed domain data as well, that is a much larger question than the one that entry
   currently frames — worth confirming rather than assuming.
