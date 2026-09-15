# Antagonist, FB-002 rapportdoelen en sterrenschaal (re-audit)

**Verdict:** COMPLIANT
**Scope:** fix commit `c2e5ebc` on `ticket/FB-002-rapportdoelen-sterrenschaal`. The round-1 blocking finding, and the fix
diff checked for a new CRITICAL or MAJOR (ADR-0037: a re-audit of the blocking findings only).

## Re-audit (round 2)

- **[MAJOR] A rapportdoel that is only a titel could be created and kept (R3, FB-002 Buiten scope): resolved.**
  - **Server, both paths.** `MaakRapportdoelAsync` and `WijzigRapportdoelAsync` both go through `KeurSubdoelenAsync`
    (`RapportsetService.cs`).
    - An empty list is refused with `SchoolcontentValidatieFout(GeenSubdoel)`, which the exception handler turns into a
      400 carrying the Dutch sentence.
    - A missing list (`null`) is refused too, because of `?? []`.
    - On update, the unknown-id lookup still runs first, so the existing 404 test keeps its meaning.
  - **Server tests.** `RapportsetEndpointsTests.cs` pins three refusals: a POST without the list, a POST with an empty
    list, and a PUT that removes the last subdoel. It also pins that nothing was created and that "Rekenen" keeps its one
    subdoel.
  - **Frontend.** `RapportdoelenScherm.tsx` checks `gekozen.size === 0` before sending, with
    `ontwikkelingsrapport.subdoelVerplicht` from `nl.json`. The check covers both new and existing rapportdoelen.
  - **Frontend test.** `RapportdoelenScherm.test.tsx` pins the refusal, that no POST goes out, and that the sentence
    clears once a subdoel is ticked.
  - **Domain entity.** It still allows an empty rapportdoel, as the owner ruled, because D3's cascade can empty one.
    `RapportdoelTests` now says so. The list shows "Geen subdoelen.", which claims only what its render condition
    (`length === 0`) guarantees.

## New CRITICAL or MAJOR in the fix diff

None. How each of the owner's rulings is built:

- **R31: "never a person holding directie".**
  - Server: `Rechtenmatrix.StaatToe` returns `!rij.ZonderDirectie` for any directie. That is the only `IsDirectie`
    branch in Api or Application.
  - Frontend: `lib/rechten.ts` `staatToe` mirrors it.
  - Tests: the unit test, the integration test (403, and the scale unchanged) and `rechten.test.ts` each also assert
    that the same klastoewijzing lets a plain gebruiker through, so the refusal provably comes from the directie right.
  - Both screens gate their edit controls only on `mag.rapportsetBewerken`.
- **D18 widened to a hoofdleerkracht of K3.** Built as ruled.
  - `mag.ontwikkelingsrapportTab` drives the sidebar (`Navigatie.tsx`) and the phone link (`Instellingenindeling.tsx`).
  - `useZichtbareRapportdelen` still puts Kinderen behind `ontwikkelingsrapportZien`, so this person sees Rapportdoelen
    and Sterrenschaal only. The bare path redirects to the first visible part (`Rapportwissel.tsx`).
  - `hoofdleerkrachtLeeftijden` holds only appointments whose schooljaar has not ended, so an expired appointment does
    not offer the tab.
  - Pupil data stays closed: the browser pass records no request to `/api/leerlingen` at `/kinderen` by address.
  - The ADR-0035 D18 note matches the code.
- **Red and blue keep their hues.** The `ster` comment in `index.css` names both collisions (hue 0 and hue 217) and
  records the owner's answer. This matches the ticket Werklog.
- **The round-1 MINORs are fixed.**
  - Language: no hard-coded Dutch, no em dash.
  - NUL byte: the group key is now `JSON.stringify`, and `grep -P '\x00'` finds 0 in the feature folder.
  - Checkbox: now `accent-inkt`, a defined token already used in `Rechtenblad.tsx`, so the accent's ration of five uses
    is untouched.
  - Browser pass: round 2 is recorded and uses only invented staff names (Lotte, Bram), no children.

## Not blocking

- [MINOR] `RapportdoelenScherm.test.tsx`: the sheet test covers only a new rapportdoel. No frontend test unticks the
  last subdoel of an existing one. It is the same code path, and the server's PUT test pins the rule.
  *Fixed after this report:* a test now opens the existing rapportdoel, unticks its only subdoel and asserts the refusal
  and that no PUT is sent.

With no CRITICAL or MAJOR open, FB-002 is not held back by this audit. The owner ruled that this is the last round.
