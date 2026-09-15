# FB-020 — verification

Branch `ticket/FB-020-hoekverrijking-per-subthema`, 2026-09-15, machine B (Docker Postgres on 5433).

## Automated gates

| Gate | Result |
| --- | --- |
| Backend unit tests (all) | 1632 passed, 4 skipped. New: `HoekverrijkingTests` (4), `HoekverrijkingServiceTests` (13), `HoekBeheerServiceTests.Een_hoek_telt_zijn_verrijkingen_en_neemt_ze_mee_als_hij_weggaat`; the old dated-verrijking tests in `HoekplaatsingTests` and `HoekplaatsingServiceTests` went with the model |
| Integration tests on PostgreSQL, `HoekverrijkingEndpointsTests` and `HoekurenEndpointsTests` | 4 passed: save (storing the window first), rewrite and blank-removes over HTTP, the weekplanning naming the window by its id, the count per subthema, the cascade when the subthema is deleted, a hoek of another klas as a Dutch 400 that stores nothing, and **the migration**: the database stepped back to `AlgemeneFichemomentTekst`, three rows written in the old shape, migrated up; the herfst window got "herfstboeken\n\nkastanjes" (date order), the winter window "kastanjes", the row overlapping nothing was dropped |
| Frontend `pnpm test` | 81 files, 823 tests passed. New: `Subthemabalk.test.tsx`, `Verrijkingenblad.test.tsx`, the verrijking describe in `Hoekdetailblad.test.tsx`, two tests in `Hoekenpaneel.test.tsx`, one in `subthemareeksen.test.ts` |
| `pnpm lint` (oxlint + tsc) | clean |
| `dotnet format --verify-no-changes` | clean |

## Browser pass

Headless Chrome over the DevTools protocol (the Chrome extension was not connected), 1440×900 and 390×844 mobile,
against Vite on 5178 → API on 5186 (built from this worktree into `bin-run`) → throwaway database `jp_fb020_browser`
with all migrations and the Development demo seed. Signed in through the development sign-in as
`directie@jaarplanner.local`.

Test data, fictional, made through the API: in the demo klas (L3) the hoeken boekenhoek, bouwhoek and zandtafel; a
thema "Seizoenen (test)" with two L3 subthema's, "De herfst (test)" with a stored window 14–25 September and "De winter
(test)" running only through an activiteit planned on 29 September; the boekenhoek placed 14 September to 9 October at
13:30.

| Check | Result | Evidence |
| --- | --- | --- |
| The balk above the grid names the running subthema and invites to fill in | PASS | "De herfst (test) 14 sep – 25 sep · Hoekverrijking invullen" |
| AC1: click the subthema, fill in three hoeken, save | PASS | sheet "Hoeken tijdens De herfst (test)" with 3 fields; no sentence about storing a window; read back through the API: 3 texts |
| AC2: the balk shows a preview | PASS | "3 hoeken: boekenhoek: prentenboeken over de herfst" |
| AC2: under each hoek in the side panel, the verrijking of the week's subthema | PASS | all three cards carry "De herfst (test)" and their text (second run: the first clicked the hidden below-`lg` switch of the same name) |
| AC5: a verrijking is not a block in the time grid | PASS | the texts occur only inside the balk and the side panel; the grid holds the boekenhoek's own blocks |
| AC4: the hoek's detail lists and edits its verrijking per subthemaperiode | PASS | "De herfst (test), 14 sep – 25 sep" with the text; rewritten to "prentenboeken en bladeren"; the balk followed |
| AC3: the next subthemaperiode is empty until filled | PASS | week of 30 September: "De winter (test) · Hoekverrijking invullen"; after filling only the zandtafel, only its card shows "De winter (test)", none shows De herfst |
| A subthema with no stored window: the sheet says so first, and saving stores it | PASS | "Dit subthema heeft nog geen vastgelegde periode. Bewaren legt ze vast: 29 sep – 29 sep."; the weekplanning then names a window 29–29 September |
| AC3: the previous subthemaperiode stays | PASS | back in week 38: "3 hoeken: boekenhoek: prentenboeken en bladeren" |
| Deleting a subthema names the count (opened, cancelled) | PASS | "Hiermee verdwijnen ook 0 activiteiten, 0 gekoppelde doelen en 3 hoekverrijkingen van klassen." |
| Deleting a hoek names its verrijkingen (opened, cancelled) | PASS | "De 2 verrijkingen die bij deze hoek staan, verdwijnen mee." |
| 390px: balk, sheet, side panel as a sheet | PASS | `scrollWidth` 390 with and without the sheet; the panel sheet shows the three cards with their verrijking |
| Contrast of the balk, measured in the browser | PASS | name 13.12:1, dates 5.78:1, "3 hoeken:" 7.58:1, preview text 13.12:1 |
| Console | PASS | no errors or warnings |

AC6 (another klas of the same age sees its own) is proven below the browser, on the database:
`HoekverrijkingServiceTests.Een_andere_klas_van_dezelfde_leeftijd_ziet_haar_eigen_verrijkingen_en_bereikt_deze_niet`
(another klas reads none of these, and cannot reach this klas's window through its own route).

Screenshots: `01`–`13` in the session scratchpad, not committed (they hold only the fictional test data).
