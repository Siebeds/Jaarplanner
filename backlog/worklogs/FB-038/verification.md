# FB-038 — verification

Branch `ticket/FB-038-hoeken-zijpaneel`, commits `51ce752` (change) and `b34a071` (antagonist's minor findings).

## Gates

| Gate | Result |
| --- | --- |
| `pnpm lint` (oxlint + `tsc --noEmit`) | clean |
| Vitest | 86 files, 952 tests passed |
| `dotnet format --verify-no-changes` | clean |
| Unit tests | 1801 passed, 4 skipped (live Op.stap contract) |
| Postgres integration (`HoekverrijkingEndpointsTests`, `RechtenAfdwingingTests`) | 32 passed, including the new `Een_hoek_gaat_weg_met_de_plaatsingen_die_een_vroegere_agenda_achterliet` |

## Browser pass

Headless Chrome over CDP with its own profile (Node 24 script in the session scratchpad), Vite on 5178 proxying to the
API on 5186, against a throwaway copy of the dev database (`jp_fb038`, migrations equal to the branch), dropped
afterwards. The copy had no subthema's or hoeken, so the script made them through the API as directie: a subthema
"Wie zijn wij?" (L3) under "Ik en mijn klas", a stored window 14–25 september for the L3 demo klas, three hoeken, one
placement for the Leeshoek through the dormant `/api/klassen/{id}/hoekplaatsingen` route (the shape an earlier agenda
left), and a second gebruiker holding themabeheer only (reads every klas, plans none).

30 of 30 checks green:

| Scenario | What was seen |
| --- | --- |
| 1. Subthemabalk | Links "Open thema Ik en mijn klas" and "Open subthema Wie zijn wij? op de themapagina", the days beside them; no word about hoeken, no button in the list |
| 1. Grid | No hoek block in the week, the hidden Leeshoek placement included; no hoek in the month |
| 2. Panel | Each card shows "Wie zijn wij?" and "+ Verrijking invullen"; a hoek card carries no drag semantics; the create tile is there |
| 2. Sheet | Title "Bouwhoek", one field labelled "Wie zijn wij?" with its days under it; typed and saved |
| 3. After saving | The text stands under the Bouwhoek; focus is back on its card; two weeks on (past the subthema) nothing stands under it; back again, it is there |
| 5. Instellingen | No "keer in de agenda" line; deleting the Bouwhoek names its verrijking; deleting the Leeshoek (hidden placement) says nothing about the agenda, succeeds without an alert, and the placement is gone (`GET …/hoekplaatsingen` answers `[]`) |
| 6. Reader | The "alleen bekijken" line; no algemene fiches switch; the Hoekenfiches panel with the saved text, "Nog niets ingevuld" under the empty hoek, no tile; the sheet shows the text with no field and no Bewaren, its own "Sluiten" in view |
| 7. Phone, 390×844 | No horizontal scroll; the chip opens the panel as a sheet; pressing the Bouwhoek closes it and opens the hoek's sheet with the saved text; Annuleren brings the panel back |
| Console | No errors |

The day view was not opened on its own: it is the same `Tijdraster` as the week, whose hoek kind is gone (Vitest).

## Contrast

Measured in the browser, compositing every ancestor's background on a canvas. The first pass measured dark twice:
headless Chrome starts in dark mode, so its "light" was dark. A second pass set each scheme explicitly.

| Text | Light | Dark |
| --- | --- | --- |
| Subthema name on a hoek card (`text-inkt-zwak`, micro) | 4.64:1 | 6.44:1 |
| Verrijking on a hoek card (`text-inkt`) | 16.58:1 | 14.62:1 |
| "Verrijking invullen" / "Nog niets ingevuld" (`text-inkt-zacht`) | 6.08:1 | 8.44:1 |
| Days beside a run in the subthemabalk (`text-inkt-zwak`, micro) | 4.64:1 | 6.44:1 |
| Subthema link in the subthemabalk | 16.58:1 | 14.62:1 |
| Days under a field in the sheet | 4.97:1 | not measured |

## Acceptance criteria

1. Subthemabalk with links only: browser, scenario 1; `Subthemabalk.test.tsx`.
2. Fill in and save from the panel, empty in another subthema's week: browser, scenarios 2 and 3; `Hoekenpaneel.test.tsx`,
   `Hoekverrijkingblad.test.tsx`, `verrijkingenweek.test.ts`.
3. A reader sees the hoeken and their verrijkingen without fields or tile: browser, scenario 6; `Hoekenpaneel.test.tsx`,
   `Navigatie.test.tsx`, `Agendascherm.test.tsx`.
4. No hoek placed in the agenda, none in week, day or month: browser, scenario 1 and the month; `Tijdraster.test.tsx`,
   `Agendascherm.test.tsx` (no request for placements at all).
5. A hoek that stood in the agenda is deleted, the confirmation names only the verrijkingen: browser, scenario 5;
   `HoekBeheerServiceTests`, the Postgres test.
6. Real browser at desktop and ~390px: this pass.
