---
id: FB-080
titel: Dekkingsoverzicht toont de dekking per discipline, met doorklikken naar de doelen
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-22 22:30
opgepakt-door: claude-fb080
branch: ticket/FB-080-dekking-per-discipline
pr:
geblokkeerd:
fr: [FR-9.1, FR-9.2]
---

## Aanleiding

Het dekkingsoverzicht van een klas toont welke doelen gedekt zijn, maar niet per discipline. Een leerkracht die wil
weten of wiskunde of taal achterblijft, moet de lijst zelf doorlopen.

## Gewenst gedrag

- Het dekkingsoverzicht van een klas toont per **discipline** (bijvoorbeeld wiskundige initiatie, Nederlands, ...) hoeveel
  doelen gedekt zijn, voor de dekkingsprognose en de dekking, allebei zichtbaar zoals vandaag.
- Een discipline toont een aantal en een percentage, niet alleen een kleur.
- De leerkracht klikt door naar de doelen van een discipline, met wat gedekt is en wat ontbreekt.
- De filters die er al zijn (bijvoorbeeld op doelsoort) blijven werken.
- De cijfers per discipline tellen op tot het totaal dat het overzicht nu toont.

## Acceptatiecriteria

- [x] Gegeven een klas met gekoppelde doelen in meerdere disciplines, wanneer de leerkracht het dekkingsoverzicht opent, dan staat per discipline het aantal en het percentage, voor de dekkingsprognose en de dekking.
- [x] Gegeven een discipline, wanneer de leerkracht erop klikt, dan ziet ze de doelen van die discipline, met welke gedekt zijn en welke ontbreken.
- [x] Gegeven de cijfers per discipline, dan tellen ze op tot het totaal van het overzicht.
- [x] Gegeven een filter op doelsoort, wanneer de leerkracht het aanzet, dan passen de cijfers per discipline zich aan.
- [x] Gegeven de weergave per discipline, dan draagt elke toestand een getal of label, nooit alleen kleur.

## Testscenario's

1. Meld aan als leerkracht van een klas met een jaarplan. Open het dekkingsoverzicht.
2. Per discipline staan een aantal en een percentage, voor de dekkingsprognose en de dekking.
3. Klik op een discipline: de doelen van die discipline staan er, met gedekt en niet gedekt.
4. Tel de aantallen per discipline op: ze komen overeen met het totaal bovenaan.
5. Zet de filter op minimumdoelen en controleer dat de cijfers per discipline mee veranderen.

## Buiten scope

- Een schoolbreed overzicht met alle klassen naast elkaar.
- De export van het dekkingsoverzicht.

## Open vragen

Geen.

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
- 2026-09-22 22:01 · eigenaar · nieuw → klaar-voor-bouw: opgenomen in de backlog: klaar voor bouw
- 2026-09-22 22:03 · claude-fb080 · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-22 22:30 · claude-fb080 · dekking per discipline gebouwd: aantal, percentage en prognose per groep, plus een doelsoortfilter dat de cijfers stuurt; 1251 frontend-tests en lint groen, browserpas op 1440px en 390px
