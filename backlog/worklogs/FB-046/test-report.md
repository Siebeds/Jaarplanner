# FB-046 — Test report (round 1)

**Verdict:** PASS
**Mode:** both (Vitest + real browser: headless Chrome driven over CDP)

Setup: worktree `ticket/FB-046-activiteit-aantal-doelen` at 045cdf4. API on :5194 and Vite on :5274, against the
throwaway database `jaarplanner_fb046_test` (migrated, demo seed; the seeder reported "created", so it was not the
shared `jaarplanner`). Added by SQL: subthema "Drijven en zinken" (L3) under thema "Water", with activiteiten
"Proef met de waterbak" (3 doelen), "Voorlezen over een bootje" (1 doel) and "Waterhoek inrichten" (0 doelen),
and a fictional user "Hoofdleerkracht L3 (test)" with a hoofdleerkracht appointment for L3. Checked as directie and
as that hoofdleerkracht, at 1440x900 and 390x844.

## Criteria checked
- "activiteit met drie doelen ... staat '3 doelen' en geen enkele doelcode" → PASS. Row text at all four runs:
  `Proef met de waterbak | Experiment | 3 doelen`; no `DEMO-L3` in any activiteit row, including at 1440px, where
  the removed `lg:block` code span used to show.
- "activiteit met één doel ... '1 doel'" → PASS. `Voorlezen over een bootje | Prentenboek | 1 doel`.
- "activiteit zonder doel ... herkenbaar, met tekst of icoon" → PASS. `Waterhoek inrichten | Hoek | Nog geen doel`,
  with the hollow ring (`border-attentie`) in the attentie colour. The other rows have neither.
- "wanneer men ze aanklikt, dan ziet men haar doelen met code en tekst" → PASS. Clicking the row opens the sheet
  "Activiteit bewerken". Under DOELEN (3) it lists DEMO-L3-09, -01 and -05, each with the text "Voorbeelddoel n ..."
  and its status.
- "Nagekeken in een echte browser op desktop en ~390px" → PASS. See the screenshots below.
- Owner's answer "de knop blijft staan" → PASS. Every row keeps the "Doel koppelen aan <naam>" control, for directie
  and for the hoofdleerkracht, at both widths.

## Commands run
- `dotnet ef database update` (throwaway DB) → Done
- health checks → api 200, vite 200, proxy 401, signin 200
- `vitest run ThemadetailScherm.test.tsx Doelmerk.test.tsx` → 36/36 passed (includes the 3 new FB-046 tests,
  which assert the count, the absence of codes, "Nog geen doel" and the koppel button)
- `pnpm lint` → exit 0
- Browser console (errors/warnings/exceptions) during all runs → none

## Evidence
- `directie-1440-subthema-open.png`, `directie-390-subthema-open.png`
- `hoofdleerkracht-1440-subthema-open.png`, `hoofdleerkracht-390-subthema-open.png`
- `directie-1440-activiteit-blad.png`, `directie-390-activiteit-blad.png`, `hoofdleerkracht-1440-activiteit-blad.png`
- `hoofdleerkracht-390-activiteit-blad.png`, `hoofdleerkracht-390-activiteit-blad-doelen.png` (sheet scrolled to DOELEN)

## Observations (not FB-046 defects)
- At 390px the activiteiten list takes about 190px of a 390px screen (row from x=47 to x=235) and leaves an empty
  gutter on the right. There is no horizontal overflow. This existed before FB-046: below `lg` the diff changes no
  rendered DOM, because the removed span was `hidden lg:block`. It could be a separate ticket.
- "Voorbeelddoel n — demodata ..." contains an em dash. This is demo seed data, not UI copy.

## Defects
- None.
