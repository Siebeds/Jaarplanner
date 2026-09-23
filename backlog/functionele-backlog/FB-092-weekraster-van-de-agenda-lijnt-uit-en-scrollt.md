---
id: FB-092
titel: Weekraster van de agenda lijnt uit en scrollt maar op één plek
soort: functioneel
status: te-testen
prioriteit: laag
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 11:31
opgepakt-door: claude-fb092
branch: ticket/FB-092-weekraster
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Het weekraster van de agenda heeft een paar kleine onevenwichtigheden, die de eigenaar op 2026-09-23 opmerkte:

- De themastroken bovenaan springen een paar pixels in, maar de blokken eronder lopen bijna tot tegen de lijn
  van de kolom. Een kolom heeft dus geen vaste linker- en rechterrand.
- Onderaan de tijdas staat "12:30" vlak onder "12:00". Het halve uur tussen de hele uren oogt als een fout.
- Het raster scrollt in een eigen kader binnen een pagina die zelf ook scrollt. Er staan dus twee schuifbalken dicht
  bij elkaar, en die van het raster heeft de standaardstijl met pijltjes.
- De lege hoek linksboven, boven de tijdas, is even hoog als de dagkoppen met hun stroken en toont niets.

## Gewenst gedrag

- In elke dagkolom beginnen en eindigen de themastroken en de blokken op dezelfde linker- en rechterrand.
- De tijdas toont alleen hele uren. Waar de schooldag op een half uur eindigt, is dat zichtbaar aan het raster zelf
  (bijvoorbeeld een lichte arcering na het einde), niet aan een extra label.
- De gebruiker scrollt op één plek. Als het raster op zichzelf blijft scrollen, heeft de schuifbalk dezelfde rustige
  stijl als de rest van de app, zonder pijltjes.
- De hoek linksboven toont niets overbodigs en is niet hoger dan nodig.

## Acceptatiecriteria

- [x] Gegeven een dagkolom met een themastrook en een blok, wanneer je ze in een echte browser bekijkt, dan hebben
      ze dezelfde linker- en rechterrand.
- [x] Gegeven een schooldag die om 12:30 eindigt, wanneer de week opent, dan toont de tijdas alleen hele uren en is
      het einde van de dag toch zichtbaar.
- [x] Gegeven de week op een laptop, wanneer de leerkracht naar de middag scrollt, dan beweegt er één schuifbalk en
      blijven de dagkoppen bovenaan staan.
- [x] Gegeven een telefoon van ~390px, wanneer de week opent, dan scrollt het raster zonder dat de pagina horizontaal
      mee schuift.

## Testscenario's

1. Open de werkweek op een laptop. Kijk naar maandag: de themastrook en het blok Onthaal beginnen en eindigen op
   dezelfde lijn.
2. Kijk onderaan de tijdas: alleen hele uren. Het einde van de schooldag is te zien aan het raster.
3. Scroll naar de middag: er is één schuifbalk, en de dagkoppen blijven staan.
4. Herhaal op een telefoon.

## Buiten scope

De themastroken zelf (FB-090), de blokken zelf (FB-091) en de werkbalk boven de agenda (FB-089).

## Open vragen

- Het raster scrollt nu bewust in een eigen kader, zodat de dagkoppen en de themastroken bovenaan blijven. Kan dat
  met één schuifbalk (vaste dagkoppen onder de vaste schermkop), of blijft het kader en krijgt alleen de
  schuifbalk een rustiger stijl? Dat beslist de bouwer met de eigenaar, na een browsercheck.

## Werklog

- 2026-09-23 10:59 · claude-vercelanalyse · aangemaakt (status nieuw)
- 2026-09-23 11:06 · claude-fb092 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-23 11:13 · claude-fb092 · eigenaar koos: raster vult de rest van het scherm, pagina scrollt op een laptop niet meer, dunne schuifbalk
- 2026-09-23 11:27 · claude-fb092 · browser 1440x900: strook en blok op dezelfde randen in alle kolommen, pagina 900=900, één dunne schuifbalk, PageDown scrollt het raster; 390x844 geen paginascroll, 390x667 pagina scrollt 115px zonder de kaart onder de onderbalk; vitest 1327 groen, lint schoon
- 2026-09-23 11:31 · claude-fb092 · antagonist: COMPLIANT; vier MINOR opgelost (ADR-0028 en ADR-0038 aangevuld, commentaar, bredere schuifbalkduim)
- 2026-09-23 11:31 · claude-fb092 · in-uitvoering → te-testen: gebouwd: raster vult het scherm (flex-kolom over 100dvh), één dunne schuifbalk, strook en blok op dezelfde randen, alleen hele uren met gestippelde schoolgrens; vitest en lint groen
