---
id: FB-077
titel: Algemene fiches zijn in de agenda herkenbaar aan een eigen kleur en icoon
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-22 21:50
opgepakt-door: claude-fb077
branch: ticket/FB-077-fichekleur
pr:
geblokkeerd:
fr: [FR-6.1]
---

## Aanleiding

In de agenda lijken algemene (terugkerende) fiches, zoals een kringmoment of turnen, op activiteiten van het thema. De
leerkracht ziet niet in één oogopslag wat terugkerend is en wat bij het thema hoort.

## Gewenst gedrag

- Een algemene fiche heeft in de agenda en in de zijbalk een **eigen, rustige kleur** en een **icoon**, zodat ze nooit
  alleen door kleur herkenbaar is.
- Alle algemene fiches delen die ene kleur en dat icoon; activiteiten blijven eruitzien zoals vandaag.
- De kleur botst niet met de kleuren die al vergeven zijn: de doelsoorten, de status van voorstellen, de dekking en het
  accent.

## Acceptatiecriteria

- [x] Gegeven een algemene fiche en een activiteit in dezelfde week, wanneer de leerkracht de agenda bekijkt, dan heeft de fiche een andere kleur én een icoon dat de activiteit niet heeft.
- [x] Gegeven de zijbalk, dan dragen de algemene fiches daar dezelfde kleur en hetzelfde icoon als in de agenda.
- [x] Gegeven de tekst op een algemene fiche, dan haalt die een contrast van minstens 4,5:1, gemeten in de browser.
- [x] Gegeven een schermlezer, dan wordt een algemene fiche aangekondigd als algemene fiche.

## Testscenario's

1. Meld aan als leerkracht en open de agenda van een week met een algemene fiche en een activiteit.
2. De algemene fiche heeft een eigen kleur en een icoon; de activiteit heeft ze niet.
3. Open de zijbalk: de algemene fiches dragen daar dezelfde kleur en hetzelfde icoon.
4. Bekijk het op een breedte van ongeveer 390px: kleur en icoon zijn nog zichtbaar.

## Buiten scope

- Een eigen kleur per algemene fiche.
- Een vast uurrooster voor algemene fiches.

## Open vragen

Geen. De kleur en het icoon kiest de bouwsessie met de frontend-design-skill.

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
- 2026-09-22 21:15 · claude-fb077 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten, samen met FB-076 een kleurkeuze
- 2026-09-22 21:21 · claude-fb077 · kleurkeuze: geen zevende tint maar een dieper neutraal vlak (hue 220, papier) met stevigere rand plus het bestaande icoon, eigenaar 2026-09-22
- 2026-09-22 21:40 · claude-fb077 · browsercontrole gedaan op 1440 en 390px, licht en donker: naam 13,32:1 licht en 16,1:1 donker; vlak een stap dieper dan vlak-diep omdat dat maar 1,09:1 haalde tegen een kleurloze activiteit; smal-blokdefect apart als TB-060
- 2026-09-22 21:50 · claude-fb077 · antagonist: COMPLIANT, geen CRITICAL of MAJOR; vier MINOR opgelost: vlak is nu een token in index.css met bewaakte donkere waarde, kleine tekstregels gemeten (4,88:1 licht, 9,3:1 donker), schermafbeelding op echte 1440, en de onjuiste bewering dat desktop geen last heeft rechtgezet in TB-060
- 2026-09-22 21:50 · claude-fb077 · in-uitvoering → te-testen: gebouwd: algemene fiche draagt een eigen neutraal vlak (token fiche-vlak/fiche-lijn) plus het fiche-icoon, in de agenda en op de kaart in de zijbalk; gates groen (1243 tests, lint, typecheck), browsercontrole op 1440 en 390px in licht en donker, antagonist COMPLIANT
