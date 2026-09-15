# FB-022 — verification

Branch `ticket/FB-022-fiche-dagtekst`. All runs on 2026-09-15, machine B (Docker Postgres on 5433).

## Automated gates

| Gate | Result |
| --- | --- |
| Unit tests, `FullyQualifiedName~AlgemeneFiche` | 30 passed (before the MINOR service test was added; see the final run below) |
| Integration tests on PostgreSQL (`JAARPLANNER_TEST_POSTGRES`) | 471 passed, 1 skipped (live KOV import), 0 failed. Includes `Een_tekst_voor_dinsdag_staat_na_herladen_alleen_bij_dinsdag_en_blijft_bij_verplaatsen` and the rights sweep `ElkeWijzigendeRouteVraagtEenRechtTests`, which picks up the new route on its own |
| Frontend `pnpm test` | 67 files, 614 tests passed |
| `pnpm lint` (oxlint + tsc) | clean |
| `dotnet format` | no changes |

## After the antagonist's MINOR findings

Both were fixed rather than listed:

| Test | Result |
| --- | --- |
| `AlgemeneFicheplaatsingServiceTests.Een_dagtekst_wordt_bewaard_en_een_onbekend_moment_of_een_te_lange_tekst_geweigerd` | passes (19 placement unit tests in total) |
| `AlgemeneFicheEndpointsTests.Een_leerkracht_van_de_klas_zet_de_tekst_en_een_van_een_andere_klas_mag_ze_alleen_lezen` (leerkracht of the klas writes; one of another K3 klas gets the authorisation's 403 and reads it; a moment of another placement is 404) | passes (7 fiche integration tests, 0 skipped) |

The antagonist's QUESTION (warn softly when a day text contains a name of a child of the klas) is left to the owner.

## Browser pass

Headless Chrome driven over the DevTools protocol (the Chrome extension and the Playwright MCP were not connected), against Vite on 5179 → API on 5186 → throwaway database `jaarplanner_fb022` with the demo seed. Setup: algemene fiche "Wero" in the demo klas, every school day of the week of 14 September, 13:15–14:00.

| Check | Result |
| --- | --- |
| AC1: text on Tuesday, save, reload | The field is labelled "Tekst voor dinsdag 15 september". After a reload it holds the saved text; Wednesday's field is empty |
| AC2: moved to another hour | Dragged in the week grid: 13:15 → 13:45 (ends 14:30). The text is unchanged (read back through the API) |
| AC3: text on the block | A 45-minute block shows one line of the text under the name and time, truncated with an ellipsis. The accessible name ends with the text. On the 390px day view the block shows the whole text |
| AC4: read-only gebruiker | A gebruiker with no right on the klas opens the block: the text is shown as a paragraph, with no field and no save button. A direct `PUT …/tekst` answers 403 |
| Delete asks first | "Hele periode uit de agenda halen" opens a confirmation: "Bij 1 dag van deze periode staat een tekst. Die gaat mee verloren." Annuleren keeps the period; "Periode weghalen" removes it |
| 390px | Day view and sheet fit, no horizontal scroll |
| Contrast (measured in the browser, alpha composited) | Hint under the field 7.58:1; the day text on the block 14.62:1 |
| Console errors | none |
