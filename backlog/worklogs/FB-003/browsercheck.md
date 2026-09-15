# FB-003: browser pass

Run on 2026-09-15 against the branch's own build: API from `bin-run` on port 5187 and Vite on 5178, on the throwaway
database `jp_fb003` (migrated, demo seed on). Seeded with made-up content only: four K3 leerplandoelen `FB3-01` to
`FB3-04`, klassen "K3 blauw" and "K3 groen", teachers "Juf Blauw" and "Juf Groen", one thema with a K3 subthema and
four decided subdoelen, the rapportdoelen "Luisteren en spreken", "Tellen en meten" and "Natuur verkennen", and the
children "Fien Proefmans", "Staf Voorbeeld" and "Roos Testermans". Chromium through Playwright, at 1440×900 and
390×844. Screenshots stayed in the gitignored `.playwright-mcp/`.

| Scenario / AC | What was done | Result |
|---|---|---|
| 1, AC1 | As Juf Blauw, Kinderen: the names are links; opened Fien's report. | Each rapportdoel with its titel, "Volledig bereikt", "Nog niet volledig" and "Geen ster" (chosen), a text field and the subdoelen folded under "2 subdoelen" / "1 subdoel"; the Algemeen besluit field at the bottom; Rapport 1 current of three. |
| 3, AC2 | Chose "Volledig bereikt" for Luisteren en spreken and "Nog niet volledig" for Tellen en meten, typed a text and a besluit, clicked away. | Each block showed "Bewaard"; the chosen stars filled in. |
| 3, AC2 | Reloaded the page at 390px. | Stars, text and besluit all still there. |
| 4, AC2 | Opened Rapport 2. | Empty: "Geen ster" everywhere, empty fields. |
| 7, AC3 | Signed in as Juf Groen (K3 groen) and opened Fien's report by its address. | "Je hebt geen toegang tot dit rapport." and nothing of the report. |
| 6, AC5 | As Juf Blauw, Sterrenschaal: deleted "Volledig bereikt" and confirmed. | Refused: "Deze gradatie staat al op een rapport en kan niet verwijderd worden. Je kan ze wel hernoemen of verschuiven." |
| 6, AC5 | Renamed it to "Bereikt", reopened Rapport 1. | The report shows "Bereikt", still chosen. |
| Layout at 390px | Measured in the page. | 16px gutter on both sides, no horizontal overflow (`scrollWidth` = `clientWidth`); the star choices wrap. |
| Contrast (composited, in the browser) | Chosen pill's outline against the card, texts, current Rapport switch. | Outline 4.97:1; chosen label 17.78:1; other labels and "Bewaard" 6.51:1; current Rapport outline against its track 4.21:1. |

Not walked in the browser, and covered by tests instead:
- AC4 (a schooljaar that is over): a past schooljaar needs a klas with an end date in the past. Covered by the
  integration test `Na_het_schooljaar_leest_de_leerkracht_het_rapport_nog_maar_wijzigt_niets_en_de_directie_wel` and
  the screen test "toont na het schooljaar het rapport alleen om te lezen, en zegt waarom".
- Scenario 8 (directie fills in): integration test `Niemand_buiten_de_klas_…_en_de_directie_wel` and the screen test
  "laat de directie invullen".
- AC6 / scenarios 2 and 5 (dekking unchanged): integration test `Het_dekkingsoverzicht_is_hetzelfde_voor_en_na_het_invullen`
  compares the whole dekking payload before and after.
