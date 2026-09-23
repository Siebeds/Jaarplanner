---
id: FB-091
titel: Terugkerende fiche weegt in de agenda minder dan een geplande activiteit
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 20:21
opgepakt-door: claude-fb091
branch: ticket/FB-091-stille-fiche
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Een klas met een dagelijkse fiche als "Onthaal" ziet in de week vijf identieke, zware blokken: een rand, een vulling,
een vetgedrukte naam, het icoon voor terugkerend, het beginuur en het doel-icoon, allemaal in een strook van een
uur. De eigenaar bekeek dat op 2026-09-23. De routine die een leerkracht elke dag al kent, is zo het zwaarste op
het scherm, en een geplande activiteit valt ernaast minder op.

Het beginuur in het blok herhaalt bovendien wat de tijdas er vlak naast al zegt, wanneer het blok op een heel uur
begint.

## Gewenst gedrag

- Een **terugkerende** fiche staat stiller in de agenda dan een activiteit: lichter, zonder zware rand en niet
  vetgedrukt. Ze blijft herkenbaar aan het icoon voor terugkerend en aan de kleur en het icoon van een algemene
  fiche (FB-077). Een fiche die één keer gepland is, blijft zoals ze is.
- Het **beginuur** staat alleen in een blok dat niet op een heel uur begint. Een blok dat om 8:00 begint, toont geen
  "8:00" meer; een blok dat om 8:15 begint, wel.
- Het doel-icoon (FB-018) blijft staan zoals nu.

## Acceptatiecriteria

- [x] Gegeven een week met een dagelijkse fiche "Onthaal" en een geplande activiteit op dezelfde dag, wanneer de
      leerkracht de week opent, dan springt de activiteit meer in het oog dan de fiche.
- [x] Gegeven een terugkerende fiche, wanneer ze in de agenda staat, dan is ze nog altijd herkenbaar als algemene
      fiche en als terugkerend, door een icoon en niet door kleur alleen.
- [x] Gegeven een blok dat om 8:00 begint, wanneer het in de week staat, dan staat er geen "8:00" in het blok; een
      blok dat om 8:15 begint, toont "8:15".
- [x] Gegeven de stillere fiche, wanneer het contrast gemeten wordt in een echte browser, in lichte en donkere
      weergave, dan haalt de tekst WCAG 2.2 AA.
- [x] Gegeven een fiche die één keer gepland is, wanneer ze in de agenda staat, dan ziet ze eruit zoals voordien.

## Testscenario's

1. Open een week met een dagelijkse fiche "Onthaal" om 8:00 en een activiteit om 10:00 op maandag. De activiteit
   springt eruit; Onthaal staat er rustig, met het icoon voor terugkerend.
2. Kijk in het blok van Onthaal: er staat geen "8:00".
3. Verplaats een activiteit naar 10:15: het blok toont "10:15".
4. Schakel naar donkere weergave: Onthaal blijft leesbaar.

## Buiten scope

De kleur en het icoon van een algemene fiche zelf (FB-077), en wat een smal blok laat vallen (TB-060).

## Open vragen

Geen.

## Werklog

- 2026-09-23 10:59 · claude-vercelanalyse · aangemaakt (status nieuw)
- 2026-09-23 20:10 · claude-fb091 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-23 20:20 · claude-fb091 · gebouwd: terugkerende fiche (meer dan één moment) half zo diep, zonder rand, niet vet; beginuur weg op een heel uur ('tot 9:00' op lange blokken); Vitest 1352 groen, lint groen
- 2026-09-23 20:20 · claude-fb091 · browser (mock, 1440 en 390px): stille fiche licht tekst 5,65:1 en icoon 4,32:1, donker 8,53:1 en 6,5:1; activiteiten springen eruit in een volle week
- 2026-09-23 20:21 · claude-fb091 · antagonist: COMPLIANT, twee MINOR (eenmalige fiche draagt nog het terugkeer-icoon, FB-077-scope; randgeval-test niet nodig: 10:15-10:50 dekt het al); criteria afgevinkt op test en browsermeting
- 2026-09-23 20:21 · claude-fb091 · in-uitvoering → te-testen: terugkerende fiche stiller, beginuur weg op een heel uur; Vitest, lint, browser en antagonist groen
