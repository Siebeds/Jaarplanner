---
id: TB-012
titel: Agenda opent op de week, en de dagcellen van de maand krijgen rechte hoeken
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 13:51
opgepakt-door: kalender-week
branch: ticket/kalender-week-standaard
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vroeg op 2026-09-14 om twee wijzigingen aan de agenda:

1. In de maandweergave hebben de dagcellen afgeronde hoeken. De thema-, subthema- en hoekstroken lopen bovenaan tot de rand van de cel en worden door die afronding afgesneden, wat er onverzorgd uitziet: de tekst van de strook start in een schuine hoek en de rand van de cel loopt er schuin doorheen.
2. De agenda opent vandaag op de maand. De eigenaar plant in de week en wil dat de week telkens de weergave is waarop de agenda opent.

## Voorgestelde wijziging

- `frontend/src/features/plan/Maandrooster.tsx`: de dagcel en de klikbare laag erachter krijgen rechte hoeken in plaats van `rounded-veld`. De stroken lopen daardoor zonder afsnijding tot in de hoek, ook bij de rand van vandaag en bij het slepen over een cel.
- `frontend/src/features/plan/Agendascherm.tsx`: zonder `?weergave=` in de URL is de week de standaard (was de maand). De navigatie schrijft dus geen parameter meer voor de week en `?weergave=maand` voor de maand. Elke link zonder parameter (het menu-item Agenda, de links vanuit het planoverzicht naar `/agenda/dag/<datum>`) opent daardoor op de week van die datum. Op een telefoon is de week drie dagen vanaf de gekozen dag, zoals ADR-0028 al vastlegt.
- Codecommentaar dat de maand de openingsweergave noemt, wordt bijgewerkt.

## Acceptatiecriteria

- [x] Gegeven de app, wanneer een leerkracht in het menu op Agenda klikt, dan opent de weekweergave van de week van vandaag (op ~390px: drie dagen vanaf vandaag).
- [x] Gegeven de weekweergave, wanneer de leerkracht Maand kiest en de pagina herlaadt, dan blijft de maandweergave staan en naar vorige/volgende gaan blijft in de maand.
- [x] Gegeven het overzicht Thema's per periode (`/agenda/periodes`), wanneer de leerkracht een periode in de agenda opent, dan opent de week van de eerste dag van die periode.
- [x] Gegeven de maandweergave, dan hebben de dagcellen rechte hoeken en worden de stroken bovenaan niet meer door de hoek afgesneden, ook niet bij de cel van vandaag en bij een cel waar een activiteit over gesleept wordt.
- [x] De frontend-tests en `pnpm lint` zijn groen, en de agenda is in een echte browser bekeken op desktop en op ~390px.

## Buiten scope

- De week- en dagweergave zelf (het tijdraster): hun kolommen en blokken veranderen niet.
- Andere afgeronde elementen in de maand: de activiteitchips, de plusknop en het bolletje met het dagnummer van vandaag blijven zoals ze zijn.
- De gekozen weergave onthouden per gebruiker buiten de URL.

## Open vragen

Geen.

## Werklog

- 2026-09-14 13:34 · kalender-week · aangemaakt (status in-uitvoering)
- 2026-09-14 13:44 · kalender-week · gebouwd (a586019); vitest 39 bestanden/264 tests groen, pnpm lint schoon; browsercontrole headless Chrome op wegwerpdatabase: /agenda opent op de week (desktop en 390px), maand blijft staan na herladen en volgende, periodelink opent de week, 35 maandcellen meten 0px hoekradius; alle vijf criteria afgevinkt
- 2026-09-14 13:51 · kalender-week · ontwerp vooraf met de frontend-design-skill (cel is het raster, wat erin zit houdt zijn afronding); antagonist: VIOLATIONS FOUND, 0 kritiek, 0 groot, 2 klein (twee onjuiste codecommentaren), beide opgelost; lint en 264 tests opnieuw groen. Open vraag voor de eigenaar: het label 'Periode van vandaag' op Thema's per periode opent nu een week
- 2026-09-14 13:51 · kalender-week · in-uitvoering → klaar: agenda opent op de week, maandcellen rechte hoeken; gates groen
