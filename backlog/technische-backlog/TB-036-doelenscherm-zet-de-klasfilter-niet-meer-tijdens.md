---
id: TB-036
titel: Doelenscherm zet de klasfilter niet meer tijdens het renderen, zonder React-waarschuwing
soort: technisch
status: klaar
prioriteit: laag
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-21 22:18
opgepakt-door: claude-tb-036
branch: ticket/TB-036-klasfilter-zonder-renderwaarschuwing
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Bij de browsercontrole van FB-041 (2026-09-16) toonde de console van het doelenscherm de React-waarschuwing
*"Cannot update a component while rendering a different component … DoelenScherm"*. De leerkracht merkt er niets van,
maar zo'n waarschuwing verbergt echte fouten in de console en kan in een latere React-versie een fout worden.

## Voorgestelde wijziging

`frontend/src/features/doelen/DoelenScherm.tsx` (rond regel 81) roept `volgKlasFase(eigenFase)` op tijdens het
renderen. Dat schrijft in de Zustand-store `useDoelenfilter` (`frontend/src/state/doelenfilter.ts`), waarop andere
componenten geabonneerd zijn. Verplaats die schrijfactie naar een plek die React toelaat (een effect, of een afgeleide
waarde zonder schrijven), en behoud het gedrag uit het commentaar erboven: niets doen zolang de klassen laden, en een
zelf gekozen jaar/fase niet eerst wissen en dan vervangen.

## Acceptatiecriteria

- [x] Gegeven een leerkracht met een klas, wanneer ze naar Doelen gaat, dan toont de browserconsole geen
  "Cannot update a component while rendering"-waarschuwing.
- [x] Gegeven dezelfde leerkracht, dan staat de jaar/fase-filter bij binnenkomst op die van haar klas, zoals nu.
- [x] Gegeven een andere klas in de selectie, wanneer ze wisselt, dan volgt de filter de nieuwe klas, zonder
  tussentijds een lege filter te tonen.
- [x] De bestaande tests van `features/doelen` en `state/doelenfilter` blijven groen, met een test voor het wisselen.

## Buiten scope

Welke filter standaard actief is: dat blijft zoals nu (FB-041).

## Open vragen

Geen.

## Werklog

- 2026-09-16 15:58 · claude-fb-reeks · aangemaakt (status nieuw)
- 2026-09-21 22:07 · claude-tb-036 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-21 22:14 · claude-tb-036 · klasfase wordt nu afgeleid tijdens het renderen en in een effect weggeschreven; nieuwe tests reproduceren de React-waarschuwing op de oude code
- 2026-09-21 22:18 · claude-tb-036 · in-uitvoering → klaar: antagonist COMPLIANT, geen CRITICAL of MAJOR; twee MINOR opgelost (test voor laadt=true, console.error-spy in afterEach hersteld), de derde is louter hookvolgorde. pnpm test 1235 groen, pnpm lint groen; bewijs voor criterium 1 is de Vitest-test die op de oude code exact de React-waarschuwing uitlokt, niet een browsercontrole
