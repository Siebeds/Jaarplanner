# FB-036 — browser pass and gates

Session `woordweb`, 2026-09-15. The worktree's API (port 5186, `bin-run`) and Vite (port 5179) against a
**throwaway database** `jaarplanner_fb036` in the `jaarplanner-db` container, migrated with this branch's migrations;
the owner's `jaarplanner` database was not touched. Headless Chrome (the installed Chrome, its own profile) driven by
a Playwright script in the session scratchpad; the Claude-in-Chrome extension and the Playwright MCP were not
connected. People are fictional: *Leerkracht An*, *Leerkracht Bo*, and the bootstrap directie. The demo seed made one
klas (L3), so the pass ran on an L3 subthema "Regen" under a fictional thema "Het weer (browsertest)".

The local API has no AI key, so the AI request answers 500 there; an AI proposal was placed as a row in the throwaway
database to render and decide one. The AI path itself is proven by the integration tests against the stub client.

## Checks (19/19 passed)

| Scenario | Result |
| --- | --- |
| Empty own web: AI control disabled, "Zet eerst zelf een woord in je woordweb." shown | pass |
| Enter, a comma and a pasted list ("wolk, plas\nmodder") each add words; field empties after the save | pass |
| Five words around the name: `wind regen wolk [Regen] plas modder` | pass |
| AI control enabled after the first word; the sentence is gone | pass |
| AI request without AI configured: "Woorden voorstellen lukte niet." | pass |
| A proposal shows its motivation and is not in the web | pass |
| Accepting it puts it in the web; `Aanvaard` stored in the database | pass |
| Bo sees An's web under "Leerkracht An", with her words and no control | pass |
| Bo keeps a web of her own | pass |
| 390 × 844: `scrollWidth` 390, no horizontal scroll | pass |
| Directie's subthema delete says "Ook 2 woordwebs gaan verloren."; cancelled, subthema still there | pass |

## Contrast, measured in Chrome (alpha composited)

| Element | Ratio | Size |
| --- | --- | --- |
| Name at the core (ink on kaart) | 17.78 | 15px |
| Own word (ink on vlak-diep) | 15.03 | 13px |
| AI error line (attentie-inkt on attentie-zacht) | 9.39 | 13px |
| "Zet eerst zelf…", placeholder, motivation, colleague's word (inkt-zacht) | 6.51 | 13px |

All above WCAG 2.2 AA 4.5:1.

## Gates

- Backend unit: 1727 passed, 4 skipped.
- Backend integration against PostgreSQL: 522 passed, 1 skipped, **1 failed**: `RechtenAfdwingingTests.
  Een_leerkracht_leest_de_klassen_van_haar_jaarfase_ook_van_vorig_jaar_en_geen_andere_Z1_Z6`, which is **flaky on
  `main` and unrelated**: line 426 compares `[K3Blauw, K3Groen]` in creation order with a list sorted by random GUID,
  so it fails about half the time (1 of 3 isolated runs failed). Not changed here; reported to the owner.
- All woordweb tests pass: `WoordwebEndpointsTests` (8), `WoordwebTests`, `WoordwebResponseParserTests`,
  `WoordwebPromptBuilderTests`, the `RechtenmatrixTests` rows, and the write-route sweep with the new open route.
- `dotnet format --verify-no-changes`: clean. `pnpm lint`: clean. Vitest: 871 passed (82 files).

## MINOR, not fixed

- The delete confirmation appends the woordweb sentence after "Dat is niet terug te draaien.", so the irreversibility
  sentence sits in the middle. Rewording `subthemabeheer.verwijderGevolg` touches another feature's copy.
