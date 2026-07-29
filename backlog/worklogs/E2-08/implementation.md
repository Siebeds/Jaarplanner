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

**Playwright / by hand in a browser** — this needs a real AI key *or* an expectation of the failure copy.
*(Steps 5–7 were re-verified against `DemoDataSeeder` in fix round 1; step 5 previously named the wrong
discipline, which would have made a correct narrowing look broken.)*

1. Start Postgres (this machine has a **native** PostgreSQL 17 service, `postgresql-x64-17` on 5432; there is
   no Docker here, so `docker compose up -d db` is not the local path), then
   `cd backend && dotnet run --project src/Jaarplanner.Api` with `Demo__Seed=true` (already set in
   `launchSettings.json`) so demo thema's and `DEMO-L3-01…14` leerplandoelen exist.
2. `cd frontend && pnpm dev`, open the app (single page; the doelsuggestie section is below the jaarplan).
3. Get a thema-id: `GET /api/themas` (7 demo thema's: "Ik en mijn klas", "Herfst en oogst", …) and paste it
   into **"Thema-id"**. The generation panel + the review list appear.
4. Press **"Doelsuggesties genereren"**, leaving both filters empty.
   - **With `AzureAI:ApiKey` configured:** the report appears ("… nieuwe suggesties voorgesteld." +
     "Gezocht in N leerplandoelen.") and the list below fills with `Voorgesteld` rows, each showing the
     doelsoort badge, the goal text and the motivation.
   - **Without a key (the default dev state):** expect *"Het voorstellen is nu niet beschikbaar … Meld dit
     aan de beheerder van de tool."* — that is the intended 500 branch, **not** a bug in this story. It is
     also the honest limit of a browser check without a key: **steps 6 and 7 need a key too**, because the
     seeder creates themadoelen only and never a doelsuggestie, so the review list stays empty until a run
     succeeds.
5. Narrow the scope. The demo goals are **all** `disciplineNummer: "1"` and **all** `jaarFase: "L3"`
   (`DemoDataSeeder.KoppelDoelenAsync`), so:
   - type `1` into disciplines → the candidate count stays the same (every demo goal is in scope);
   - type `3` (or any other number) → *"Er zijn geen leerplandoelen die aan je keuze voldoen…"* and **no**
     AI call;
   - type `l3` (lowercase) into jaar/fase → same count as `L3`; the filter is case-insensitive since fix
     round 1. `K3` → the "geen leerplandoelen" message.
6. Re-run the same generation twice: the second report should say "Overgeslagen — al aan dit thema
   gekoppeld: …" and the list must not grow. Note the *first* run can already report duplicates: each demo
   thema arrives with two `Manueel` themadoelen (`DEMO-L3-*`), and those count as already linked.
7. On a row, type another existing code into **"Ander leerplandoel in de plaats van …"** and press
   **"Vervangen"**: the row should show the new code + its text, status **Manueel**, and no motivation.
   Pick a `DEMO-L3-xx` **not** already on this thema (each thema owns two), otherwise the correct answer is
   the refusal *"al aan dit thema gekoppeld"*. Lowercase (`demo-l3-05`) is accepted and stored in the
   curriculum's own casing. Then type `VERZONNEN-99`: expect *"Vervangen lukte niet. Controleer of de code
   bestaat …"* and an unchanged row.
8. Accessibility: every control is reachable by keyboard and has a visible label. The generate button has
   **no** aria-label (fix round 1) — its visible text *is* its accessible name, so speech input can say
   "Doelsuggesties genereren"; the substitution field's label carries the row's code so it is unique per
   row. `jsdom` cannot check colour contrast, so the axe passes cover structure only; the doelsoort/status
   colours come from the existing design tokens, unchanged. A screen-reader pass should hear the run report
   announced — the `role="status"` region is now mounted empty with the panel and filled by the run.

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

---

## Fix round 1 — the two MAJORs, the plural bug and eight smaller findings

Inputs: test-runner **PASS** (1 defect, 1 observation) + antagonist **VIOLATIONS FOUND**
(2 MAJOR, 8 MINOR, 3 QUESTION). Nothing below re-litigates what the audit confirmed
(the Art. II.3 `tekst`/`aiMotivatie` classification, the 4-string Dutch count, contrast, and
dropping `AiMotivatie` on substitution).

### MUST FIX

**1 (MAJOR) — WCAG 2.2 SC 2.5.3 "Label in Name" on the generate button.** `matching.genereerAria`
("Doelsuggesties laten voorstellen voor dit thema") replaced the visible "Doelsuggesties genereren", so the
word *genereren* was absent from the accessible name and speech input could not activate the button by its
visible label. **Fixed by removing the `aria-label`** — the visible text is a sufficient and unique
accessible name — and `matching.genereerAria` is deleted from `nl.json` (it became unused). The other four
aria-labels are supersets of their visible text and were left untouched.
*Regression cover:* `genereerKnop()` in `DoelsuggestieGeneratie.test.tsx` now queries **by the visible
label**, so every one of the 11 tests in that file fails if an overriding aria-label reappears; plus an
explicit test asserting no `aria-label`, `toHaveTextContent` and `toHaveAccessibleName` on the same string.
The finding was right that the sibling file already documents this rule — that comment now matches practice
on both controls.

**2 (MAJOR) — deferred obligations filed only in the deferring story.** Both are now filed in the story
that must **act**, with a back-reference from E2-08 so the pair stays legible:
- `backlog/E5-dekking-export.md` → under **E5-07** (and naming E5-06): a substituted `DoelKoppeling` keeps
  neither the AI's proposed code nor its motivation, so an export cannot show how a coupling arose; needs a
  nullable column + migration **if** directie wants provenance. No column and no migration added here.
- `backlog/E1-curriculum-content.md` → under **E1-15**: the matching prompt's candidate set defaults to all
  loaded leerplandoelen with no cap, so whoever ships the real per-discipline import must weigh a narrower
  default. No cap and no threshold invented.
No checkbox and no progress-table row was touched.

**3 — occurrence six of the plural bug, pinned green by its own test.** `matching.onbekendeCodes` read
"deze **codes staan**…" for a single code. Added `matching.onbekendeCodesEnkelvoud` ("deze code staat…"),
selected via `tAantal` like the two lines above it. **The test that defended the defect is gone:** it
compared the render to `t("matching.onbekendeCodes", …)` — the same template — so it could never fail on
grammar. Replaced by two tests asserting **literal expected Dutch** for n=1 and n=2. The same
template-vs-template shape in "reports the run with correctly inflected counts" got the same treatment.
*Audit of the story's other new keys:* `genereerGelukt`/`kandidaten` already have singular entries and use
`tAantal`; `duplicaatCodes` names no count and carries no demonstrative ("Overgeslagen — al aan dit thema
gekoppeld: …"), so it is correct for one and for ten — now stated in a comment so the next reader does not
have to re-derive it; `geenKandidaten`, `genereerNiets`, the labels and the placeholders carry no agreement.

### SHOULD FIX

**3 — substitution's irreversibility disclosed.** `matching.vervangenUitleg` now ends: *"Het doel dat de AI
voorstelde wordt overschreven en niet bewaard: dat kan je niet ongedaan maken."* Copy only; no behaviour
change, no confirmation dialog invented.

**4 — "Manueel overnemen" now has copy.** New `matching.manueelUitleg`, rendered next to
`vervangenUitleg`: it keeps the same leerplandoel but makes the koppeling the teacher's choice instead of an
AI proposal, *"voor de dekking telt dat even zwaar als “Aanvaarden”"*. That is the honest statement — for
coverage `Aanvaard` and `Manueel` are identical — and it is what distinguishes the two same-badge buttons.
Pinned by a test asserting both substantive clauses in literal Dutch.

**5 — case-insensitive filter matching.** `EfLeerdoelCatalogus` case-folds all three dimensions
(`ToLower()` on both sides, because EF translates that to SQL `lower()` while `ToLowerInvariant()` is not
translatable — noted in the class summary; the values are ASCII). The contract now says so on
`ILeerdoelCatalogus` and `LeerdoelSelectie`, and **`FakeLeerdoelCatalogus` mirrors it exactly** (trim, drop
blanks, fold) — a fake stricter than the real query is how a case bug reaches a browser.
`DoelMatchingService.ZoekLeerdoelAsync`'s re-check moved to `OrdinalIgnoreCase` for the same reason: an
`Ordinal` check there would discard the row the catalogus had just returned and tell the teacher the code
does not exist. What gets **stored** is still the curriculum's own `doel.Code` (Art. III.5).
*Tests:* a `Theory` over `k3`/`K3`/`" k3 "` on the candidate count, a substitution with `nat-k3-02`
asserting `NAT-K3-02` is persisted, and an endpoint test posting `jaarFasen: ["l1"]`. Honest limit stated in
that test: the integration suite runs the real query on the **in-memory** provider, so it pins the filter's
semantics, not the SQL `lower()` translation.
*Also:* `backlog/README.md`'s Art. XIV `jaarFase` entry now records that `jaarFasenPlaceholder` ("bv. K3,
L1") puts the JK/K2/K3 side of the open decision into teacher-facing copy. The placeholder stays.

**6 — `role="status"` mounted with the panel, not with its content.** The live region is now rendered
unconditionally (empty, unstyled) and filled on success; `Runverslag` returns a fragment. A region that
enters the DOM already populated is frequently never announced, which silenced the whole report — including
`aantalKandidaten`, the one line that separates "the AI found nothing" from "there was nothing to search".
Pinned by a test asserting the region is present and empty before the run and non-empty after.

**7 — `badgeSoort` duplication removed.** New `frontend/src/components/doelsoort.ts` holds the `Doelsoort`
badge keys, the wire-form `DoelsoortNaam` and the single `doelsoortBadgeSoort` table; `DoelsuggestieLijst`
and `OngekoppeldeDoelenLijst` import it, `DoelsoortBadge` re-exports the two types so existing importers
(stories, tests) are unchanged, and `features/matching/types.ts` re-exports `DoelsoortNaam` from the one
definition. *Why a separate module rather than inside `DoelsoortBadge.tsx`:* exporting a constant from a
component file trips `react-refresh/only-export-components`, and `pnpm lint` runs at `--max-warnings 0` —
the first attempt failed the gate, so the module is the fix rather than a preference.

**8 — E7-11's route enumeration.** Added the two new anonymous routes and, explicitly, the **AI-cost**
dimension: `…/doelsuggesties/genereer` is the first anonymous endpoint that triggers a billable external
call, with an uncapped candidate list, so an unauthenticated caller can bill the school in a loop. The
Art. VI.1 exposure itself is pre-existing and stays gated by E7-11 `[!]`.

**9 — Art. II.3 log clause.** Added: `DemoDataSeeder.cs:239` **authors** Dutch inside
`Leerplandoel.Tekst` ("Voorbeelddoel {i} — demodata voor de review…"), which E2-08's suggestie list now
renders. Same demo-fixture category as the seeder's `Motivaties`, and it predates this story via
`OngekoppeldeDoelenLijst` — but it is project-written Dutch arriving through a field that entry classifies
as domain data, which is worth the one sentence line 107 asks for.

**10 — the manual-verification script was wrong.** Step 5 said to type `9` "(the demo goals' discipline)";
`DemoDataSeeder` creates them with `disciplineNummer: "1"`. A reviewer following it would have seen "geen
leerplandoelen" at the step meant to prove narrowing *works*. Corrected, and the rest of the script
re-verified against the seeder rather than patched: all demo goals are discipline `1` **and** jaarFase `L3`,
so `1` does not reduce the count either (the old "the candidate count should drop" was wrong for a second
reason); `docker compose up -d db` is not the local path on this machine; steps 6 **and** 7 need an AI key,
because the seeder creates themadoelen and never a doelsuggestie, so the review list is empty until a run
succeeds; the first run can already report duplicates (two `Manueel` themadoelen per demo thema); and a
substitution must target a `DEMO-L3-xx` not already on that thema.

**11 — the near-tautological test.** "does not send an empty substitution" asserted `toBeDisabled()` and
then that a click sent no PUT — entailed by the first half. Replaced by "enables the substitution only once
a real code is typed", which tests something the old one did not: whitespace-only input keeps the button
disabled (the field is trimmed before it unlocks), and a real code enables it.

### RECORDED, deliberately not changed

**Substitution cannot preserve `Voorgesteld`.** `DoelKoppeling.VervangLeerplandoel` unconditionally sets
`Status = Manueel`, and `OngekoppeldeDoelenQuery` (verified: `Aanvaard || Manueel`, across all four owned
link sources) counts that as *gedekt* at once — so "correct the code" and "accept it into my dekking" are
fused, and a teacher cannot leave the koppeling undecided. Recorded as obligation **4** under E2-08 in
`backlog/E2-ai-matching.md`, stating that the fused reading is the current one and that the FR-4.3 ruling
settles it. Behaviour untouched, per instruction and because the ruling may delete one of the two controls.

**Not touched, as instructed:** the `AzureAI` client status codes and the shared exception handler (the
500-vs-503 issue, now its own story); no provenance column and no migration; no candidate cap or threshold;
no checkbox and no progress-table edit.

### Gates (verbatim, re-run after the fixes)

```
$ dotnet build
Build succeeded.
    0 Warning(s)
    0 Error(s)

$ dotnet format --verify-no-changes
(no output — no changes needed)

$ dotnet test                                    # no JAARPLANNER_TEST_POSTGRES
Passed!  - Failed: 0, Passed:  51, Skipped: 36, Total:  87 - Jaarplanner.IntegrationTests.dll (net10.0)
Passed!  - Failed: 0, Passed: 443, Skipped:  0, Total: 443 - Jaarplanner.UnitTests.dll (net10.0)

$ JAARPLANNER_TEST_POSTGRES="Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable" dotnet test
Passed!  - Failed: 0, Passed: 443, Skipped: 0, Total: 443, Duration:  3 s - Jaarplanner.UnitTests.dll (net10.0)
Passed!  - Failed: 0, Passed:  87, Skipped: 0, Total:  87, Duration: 29 s - Jaarplanner.IntegrationTests.dll (net10.0)
```

Counts moved as expected: unit **439 → 443** (one `Theory` with 3 cases + 1 `Fact`), integration
**86 → 87** (the lowercase-selection endpoint test); 36 skipped without the Postgres variable and **0
skipped with it**.

> **One flake worth reporting rather than hiding.** The *first* Postgres run failed 1 of 87 — not in a test
> body but in `PostgresTestDatabase.DisposeAsync` (line 119) teardown for
> `SchoolcontentImportEndpointsTests`, i.e. dropping its own scratch database. Two subsequent identical runs
> were fully green (0 failed, 0 skipped, twice). Unrelated to anything in this story — that fixture touches
> the schoolcontent import, not the leerdoel catalogus — but a pre-existing teardown race in the Postgres
> fixture is worth a line, because it will read as a failure to whoever next runs the suite.

```
$ pnpm lint
$ eslint . --max-warnings 0 && tsc --noEmit
(no output — clean; the first attempt failed on react-refresh/only-export-components, see finding 7)

$ pnpm test
 ✓ src/features/jaarplan/kalenderFormat.test.ts (12 tests)
 ✓ src/components/DoelsoortBadge.test.tsx (4 tests)
 ✓ src/features/matching/OngekoppeldeDoelenLijst.test.tsx (4 tests)
 ✓ src/App.test.tsx (3 tests)
 ✓ src/features/matching/DoelsuggestieGeneratie.test.tsx (11 tests)
 ✓ src/features/matching/DoelsuggestieLijst.test.tsx (10 tests)
 ✓ src/features/jaarplan/Jaarplankalender.test.tsx (8 tests)
 Test Files  7 passed (7)
      Tests  52 passed (52)

$ pnpm build
✓ 112 modules transformed.
✓ built in 4.45s
```

Frontend tests **48 → 52** (+3 in `DoelsuggestieGeneratie`: label-in-name, live-region, the plural split;
+1 in `DoelsuggestieLijst`: the two explanations).

### Files changed in this round

**Frontend**
- `frontend/src/components/doelsoort.ts` *(new)* — the one doelsoort vocabulary + `doelsoortBadgeSoort`.
- `frontend/src/components/DoelsoortBadge.tsx` — imports the types from there and re-exports them.
- `frontend/src/features/matching/DoelsuggestieGeneratie.tsx` — aria-label dropped, `tAantal` for the
  unknown codes, live region mounted with the panel.
- `frontend/src/features/matching/DoelsuggestieLijst.tsx` — shared badge map; renders `manueelUitleg`.
- `frontend/src/features/matching/OngekoppeldeDoelenLijst.tsx` — shared badge map (duplicate table gone).
- `frontend/src/features/matching/types.ts` — `DoelsoortNaam` re-exported from the one definition.
- `frontend/src/i18n/nl.json` — `genereerAria` removed; `onbekendeCodesEnkelvoud` + `manueelUitleg` added;
  `vervangenUitleg` extended with the irreversibility.
- `frontend/src/features/matching/DoelsuggestieGeneratie.test.tsx` · `DoelsuggestieLijst.test.tsx` — see
  findings 1, 3, 4, 6, 11.

**Backend**
- `backend/src/Jaarplanner.Infrastructure/AiAuthoring/EfLeerdoelCatalogus.cs` — case-insensitive filter.
- `backend/src/Jaarplanner.Application/AiAuthoring/ILeerdoelCatalogus.cs` · `LeerdoelSelectie.cs` — the
  case-insensitivity is now part of the documented contract.
- `backend/src/Jaarplanner.Application/AiMatching/DoelMatchingService.cs` — `ZoekLeerdoelAsync` re-check
  `OrdinalIgnoreCase`; the canonical code is what is stored.
- `backend/tests/Jaarplanner.UnitTests/AiAuthoring/FakeLeerdoelCatalogus.cs` — mirrors the real filter.
- `backend/tests/Jaarplanner.UnitTests/Ai/DoelMatchingServiceTests.cs` (+2) ·
  `backend/tests/Jaarplanner.IntegrationTests/DoelsuggestieEndpointsTests.cs` (+1).

**Backlog / docs**
- `backlog/E5-dekking-export.md` (E5-07/E5-06) · `backlog/E1-curriculum-content.md` (E1-15) ·
  `backlog/E7-niet-functioneel.md` (E7-11) · `backlog/README.md` (Art. II.3 log + Art. XIV `jaarFase`) ·
  `backlog/E2-ai-matching.md` (cross-references + obligation 4) · this worklog (script corrections above).
