# FB-001: frontend half and the session's own decisions

- **Ticket:** FB-001, "K3-leerkracht beheert de kinderen van de klas, via een nieuwe tab onderaan de zijbalk".
  FR-13.1, FR-13.7, FR-13.10.
- **Session:** `kindvolg`, 2026-09-15. The backend half was built by an implementer subagent; see
  `implementatie-backend.md`.
- **Branch:** `ticket/FB-001-kinderen-van-de-klas`.

## Owner rulings in session, 2026-09-15

The two open questions in the ticket were put to the owner as multiple-choice questions before anything was built:

- **Phone:** "Via Instellingen", not the recommended sixth tab. The bottom bar keeps its five tabs for everyone. On a
  phone the report is reached through a card at the top of Instellingen, shown to whoever may read a report.
- **"ONDERAAN":** "Boven Instellingen (Aanbevolen)", which is D17 as ADR-0035 writes it. From `lg` the report sits in a
  section of its own, over a rule, above Instellingen, and Instellingen stays last before the sign-in row.

Asked after antagonist round 1 (finding 12):

- **A K3 klas with children cannot be moved to another jaarfase until the children are deleted:** "Ja, zo laten
  (Aanbevolen)".

Also asked, for what comes next: the K3 scale in FB-002 starts from the owner's own example. FB-002 is built on top of
this branch, and this branch may be pushed with a PR once the antagonist is green.

## Design (frontend-design step)

The direction is fixed by ADR-0024 ("Inkt en Signaal"). The screen uses existing tokens only and adds no hue:

- `accent` appears on the primary button ("Kind toevoegen", "Bewaren") and on the active destination: two of its five
  rationed uses.
- Errors use the `attentie` style that the other screens use.

Decisions:

- **Adding twenty names is the job the screen is shaped around** (R15: by hand, one by one). The two fields sit above
  the list. After each child they empty and Voornaam takes the focus again, and a polite live region names who was
  added, because the new row lands somewhere in a sorted list.
- **One card with rules, not a card per child.** A class list is read down the page, and twenty bordered boxes would be
  louder than the names in them. The voornaam carries the weight, because it is the name a kleuterleerkracht uses.
- **Rename in place.** The row turns into the same two fields. Escape or Annuleren puts it back, and focus returns to
  the row's own buttons afterwards.
- **Delete** uses the existing `Bevestiging` sheet. Its consequence line says the reports go too (the ticket's
  acceptance criterion).
- **The klas choice** lists only the klassen that the server says can hold children and that this person may read, so
  it is not the header's Klaskiezer. Choosing one still sets the app's one klas.
- **Name fields** have `autoComplete="off"`: a child's name is not something the browser should offer again in another
  field.
- **Icon:** a sheet with a star (`IcoonRapport`), in the hand-drawn set's geometry. The star is what a report is made of
  (R5); a face or a child would draw a pupil.

## Files (frontend)

| File | What |
| --- | --- |
| `src/features/ontwikkelingsrapport/OntwikkelingsrapportScherm.tsx` | the screen |
| `src/features/ontwikkelingsrapport/leerlingen.ts` | the queries and mutations; nothing is written to storage |
| `src/lib/rechten.ts` | the two rows mirrored, the `rapportklas` resource, `ontwikkelingsrapportZien`, `ontwikkelingsrapportLezen`, `leerlingenBeheren`, `rapportAlleenNogLezen` (the one condition under which "Dit schooljaar is voorbij" may be said, per the E5-03 rule) |
| `src/lib/aanmelding.ts` | `rapportklasIds` and `lopendeRapportklasIds` on `Ik` |
| `src/app/routes.ts` | the `RAPPORT` destination |
| `src/app/Navigatie.tsx` | the section from `lg` only, which moves the push to the bottom edge off Instellingen |
| `src/features/instellingen/Instellingenindeling.tsx` | the phone card |
| `src/components/Iconen.tsx` | `IcoonRapport` |
| `src/components/ui/Veld.tsx` | `Invoer` passes a `ref` |
| `src/App.tsx` | the route |
| `src/i18n/nl.json` | `navigatie.ontwikkelingsrapport` and the `ontwikkelingsrapport` group |
| `src/lib/types.ts` | `KlasWeergave.kanLeerlingenHebben` (fix round 1) |

**Tests:**

- the new `OntwikkelingsrapportScherm.test.tsx`;
- new cases in `Navigatie.test.tsx`, `Instellingenindeling.test.tsx` and `rechten.test.ts`, whose row count goes from
  18 to 20;
- the `Ik` and `KlasWeergave` literals in existing tests gained the new fields.

## Gates

- **Before round 1:**
  - `pnpm lint` (oxlint + tsc) clean; `pnpm test` 65 files, 647 tests green.
  - Browser pass at 1440 and 390 recorded in `browsercheck.md`.
- **Fix round 1 (`7cdefc9`, 2026-09-15):**
  - backend `dotnet build`: 0 warnings, 0 errors;
  - `dotnet format --verify-no-changes`: exit 0;
  - `dotnet test`: unit 1561 passed and 4 skipped; integration 480 passed and 1 skipped (the live KOV import, which
    needs its own opt-in), against the Docker Postgres through `JAARPLANNER_TEST_POSTGRES`;
  - frontend oxlint and `tsc` clean; vitest 65 files, 647 tests passed.
  - *The earlier line pointed at "the ticket Werklog and the round 2 audit"; the antagonist rightly called that
    circular (round 2, finding B), so the figures are here.*
- **Fix round 2:** see below.

## Fix round 1 (antagonist round 1, `antagonist-ronde-1.md`)

| Finding | Change |
| --- | --- |
| 1 (MAJOR) | The screen filters on the server's `kanLeerlingenHebben`, not on `jaarfase === "K3"`. A test with a menggroep stated as K2 that the server says can hold children pins that the screen follows the server. |
| 2 | "Dit kind is niet gevonden." |
| 3 | The comment's claim about the server's words was dropped. |
| 4 | `no-store` asserted on every 200 list read in `LeerlingEndpointsTests`. |
| 5 | This worklog, and a dated note in the backend one. |
| 6 | The browser pass is `browsercheck.md`. |
| 7 | The screen's own `ontwikkelingsrapport.verwijderTitel`. |
| 8 | "Je hebt geen toegang tot het ontwikkelingsrapport." |
| 9 | Its own sentence when no schooljaar exists. |
| 10 | A dated note in ADR-0030 footnote ⁶. |
| 11 | `.gitignore` ignores `**/Microsoft.NET.Workload_*.log`. |
| 12 | The owner ruling above. |

## Fix round 2 (antagonist round 2, `antagonist-ronde-2.md`: 0 MAJOR, 5 MINOR)

| Finding | Change |
| --- | --- |
| A | The test's klassen now pin "follow the server" in both directions. A menggroep stated as K2 that the server says can hold children is offered, and a new "K3 zonder kinderen", stated as K3, that the server says cannot is not. A second mapping in the screen fails one of the two. |
| B | The fix round 1 gate figures are recorded above, not referred to. |
| C | `browsercheck.md` has a dated addendum: the post-fix directie check on the rebuilt API, the new no-access sentence, and contrast measured in the browser for both themes. The double safe-area inset between the phone card and a part's title is accepted, with the reasoning recorded there. |
| D | The test name now says what it proves: "zegt wie geen rapport mag lezen dat die geen toegang heeft". |
| E | `useActieveSelectie` returns `fout` (either list failed to load). The screen shows `selectieLaadFout` before both empty-state branches, so an empty list after a failure is no longer read as "no schooljaar" or "no K3 klas". Two new tests: a real empty list gives `geenSchooljaar`, and a failed load gives the load sentence and neither empty one. The selection mock became replaceable per test (`vi.hoisted`). |

**Gates (2026-09-15, fix round 2):**

- frontend oxlint and `tsc` clean;
- vitest 65 files, 649 tests passed (the 2 new ones included);
- the backend is unchanged in this round.

## Fix round 3 (antagonist round 3, `antagonist-ronde-3.md`: 0 MAJOR, 3 MINOR)

| Finding | Change |
| --- | --- |
| F | `fout` now comes from `isLoadingError`: only a first load that failed, which leaves a list with no data. A failed refetch keeps its data, so the page no longer contradicts its own header, and the form is not unmounted along with what was typed in it. The sentence says only that the page did not load ("Het is niet gelukt deze pagina te laden. Herlaad de pagina."), because either list may be the one that failed. The doc comment and the screen comment were corrected. |
| G | New `lib/selectie.test.tsx` over a real `QueryClient` with a stubbed `fetch`. It covers four cases: both lists load (no `fout`), the schooljaren fail (`fout`), the klassen fail (`fout`), and a refetch fails with data present (no `fout`, lists kept). |
| H | The "Contrast was not measured" line in `browsercheck.md` is struck through and marked as superseded by the addendum. |

The antagonist's follow-up belongs to another ticket and is passed to the owner, not built here. Five other screens say
"no klassen" on an empty list without checking whether the load failed.

**Gates (2026-09-15, fix round 3):** see the ticket Werklog line of this round.
