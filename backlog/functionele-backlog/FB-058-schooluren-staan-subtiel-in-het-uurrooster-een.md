---
id: FB-058
titel: Schooluren staan subtiel in het uurrooster: een heel lichte effen tint, geen arcering
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 23:36
opgepakt-door: schooluren-tint
branch: ticket/FB-058-schooluren-tint
pr:
geblokkeerd:
fr: [FR-12.1]
---


## Aanleiding

Sinds FB-023 kan de directie de schooluren per weekdag instellen. Het uurrooster van de agenda toont de uren buiten de
schooldag en de middagpauze nu met een diagonale arcering en een label in elke kolom ("begin 8:30", "middagpauze",
"einde 15:30"). De eigenaar vindt dat *"zeeeer onduidelijk"*: de arcering is de luidste vorm op het scherm, en een
activiteit die in een gearceerd stuk staat (een opvang om 7:45, voorlezen om 15:00) is slecht leesbaar, omdat de strepen
door het blok heen schemeren.

De eigenaar koos uit vier voorstellen voor voorstel A, maar met een veel lichtere tint dan in de schets:
https://claude.ai/artifact/JzSatMWwikSRL89MmeZwkk

## Gewenst gedrag

- De uren buiten de schooldag en de middagpauze krijgen in het uurrooster een **heel lichte, effen tint**, zonder
  arcering of ander patroon. De schooldag zelf blijft wit. De tint is net zichtbaar: het raster en de planning blijven
  het eerste wat opvalt.
- De labels in elke kolom verdwijnen. De begin- en eindtijd van de schooldag staan als tekst in de uurkolom, zodat de
  betekenis nooit alleen op de tint rust.
- Een activiteit of fiche in een getint stuk is even goed leesbaar als een blok binnen de schooluren: er schemert niets
  door het blok heen.
- Een dag waarop de school dicht is, blijft te onderscheiden van de uren buiten schooltijd op een lesdag.
- Zoals nu blijft elk uur planbaar (klikken en slepen op een getint uur werkt), en hoort een schermlezer de schooluren
  bij de dagkop.

## Acceptatiecriteria

- [ ] Gegeven een lesdag met schooluren 8:30–15:30 en middagpauze 12:00–13:15, wanneer de leerkracht de weekagenda
      opent, dan zijn 7:00–8:30, 12:00–13:15 en 15:30–einde licht en effen getint, zonder strepen, en is 8:30–12:00 en
      13:15–15:30 wit.
- [ ] Gegeven dezelfde week, wanneer de leerkracht de kolommen bekijkt, dan staat er in geen enkele dagkolom nog een
      label "begin", "middagpauze" of "einde", en staan de begin- en eindtijd van de schooldag in de uurkolom.
- [ ] Gegeven een activiteit van 15:00 tot 16:00, wanneer ze in de agenda staat, dan heeft het blok een dekkende
      achtergrond en is de naam zonder doorschemerende tint of lijnen leesbaar.
- [ ] Gegeven een week met een gesloten dag, wanneer de leerkracht de week bekijkt, dan ziet die de gesloten dag anders
      dan de getinte uren buiten schooltijd, en staat bij de gesloten dag nog altijd de naam van de sluiting.
- [ ] Gegeven een getint uur, wanneer de leerkracht erop klikt of er een stuk op sleept, dan kan die daar plannen zoals
      op elk ander uur.
- [ ] Gegeven de lichte en de donkere weergave, wanneer de tijden in de uurkolom gemeten worden in een echte browser,
      dan halen ze minstens 4,5:1 contrast (WCAG 2.2 AA).

## Testscenario's

1. Meld aan als directie en stel voor maandag 8:30–15:30 in met middagpauze 12:00–13:15, en voor woensdag 8:30–12:05
   zonder pauze. Je ziet de schooluren bewaard.
2. Meld aan als leerkracht en open de weekagenda van een week met maandag en woensdag. Je ziet voor en na de schooluren
   en tijdens de middagpauze een heel lichte effen tint, geen strepen, en geen labels in de kolommen.
3. Kijk naar de uurkolom links. Je ziet de begintijd 8:30 en de eindtijd van de schooldag als tekst staan.
4. Plan op maandag een activiteit van 7:45 tot 8:30 en een van 15:00 tot 16:00. Je ziet beide blokken met een dekkende
   achtergrond; hun naam is even goed leesbaar als die van een blok om 10:00.
5. Klik op woensdag om 14:00 in het getinte stuk. Je kunt daar iets plannen.
6. Open een week met een vakantiedag of andere gesloten dag. Je ziet die dag duidelijk anders dan de getinte uren van
   een lesdag, met de naam van de sluiting.
7. Schakel naar de donkere weergave en herhaal stap 2 tot 4. Je ziet hetzelfde, even subtiel en leesbaar.
8. Bekijk de agenda op een smal scherm (ongeveer 390 px breed). Je ziet de tint en de tijden in de uurkolom zonder dat
   er iets overlapt.

## Buiten scope

- Het instellen van de schooluren zelf (FB-023) verandert niet.
- De maandweergave: die toont geen uren.
- De AI die met de schooluren rekening houdt (FB-027).

## Open vragen

Geen.

## Werklog

- 2026-09-16 23:32 · Siebeds · aangemaakt (status nieuw)
- 2026-09-16 23:36 · schooluren-tint · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
