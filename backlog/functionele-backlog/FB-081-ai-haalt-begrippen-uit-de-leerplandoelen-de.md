---
id: FB-081
titel: AI haalt begrippen uit de leerplandoelen, de doelenpagina toont ze per discipline
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:47
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-2.1]
---

## Aanleiding

Op.stap noemt in de leerplandoelen wiskundige begrippen (bijvoorbeeld "eerste" en "laatste" bij de jongste kleuters,
"optellen" en "aftellen" bij de eerste kleuter) en woordbegrippen per leeftijd. Die zitten verstopt in de tekst van de
doelen. Een leerkracht die wil weten welke begrippen haar klas moet leren, moet vandaag alle leerplandoelen opnieuw
lezen.

## Gewenst gedrag

- De AI haalt uit elk leerplandoel de **wiskundige begrippen** en de **woordbegrippen**, per leeftijd.
- De doelenpagina krijgt, naast de leerplandoelen en de minimumdoelen, een sectie **Begrippen**. Daarin staan alle
  begrippen per discipline en per leeftijd, gescheiden in wiskundige begrippen en woordbegrippen.
- Bij elk begrip ziet de leerkracht uit welk leerplandoel het komt.
- De begrippen verschijnen zonder keuring, met een label dat de AI ze uit de doelen haalde (beslissing van de eigenaar,
  2026-09-18).
- De tekst van de leerplandoelen verandert niet: de doelen van Op.stap blijven alleen-lezen.
- Na een nieuwe import van Op.stap worden de begrippen van een gewijzigd doel opnieuw bepaald.

## Acceptatiecriteria

- [ ] Gegeven geïmporteerde leerplandoelen, wanneer de leerkracht de sectie Begrippen opent, dan staan de begrippen per discipline en per leeftijd, gescheiden in wiskundige begrippen en woordbegrippen.
- [ ] Gegeven een begrip, wanneer de leerkracht het aanklikt, dan ziet ze de leerplandoelen waaruit het komt.
- [ ] Gegeven de sectie, dan staat er een label dat de AI de begrippen uit de leerplandoelen haalde.
- [ ] Gegeven een leerplandoel waaruit begrippen gehaald zijn, dan is de tekst van het doel ongewijzigd.
- [ ] Gegeven een nieuwe Op.stap-import waarin een doel wijzigt, dan worden de begrippen van dat doel opnieuw bepaald, en blijven de andere ongewijzigd.

## Testscenario's

1. Meld aan als leerkracht en open de doelenpagina. Naast de leerplandoelen en de minimumdoelen staat de sectie
   Begrippen.
2. Kies de discipline wiskundige initiatie en de eerste kleuter: je ziet onder meer "optellen" en "aftellen", apart van
   de woordbegrippen.
3. Klik op "optellen": de leerplandoelen waaruit het komt, staan erbij.
4. Het label bovenaan zegt dat de AI de begrippen uit de doelen haalde.
5. Open een van die leerplandoelen: de tekst is dezelfde als voordien.

## Buiten scope

- De begrippen op het thema tonen (FB-082).
- Begrippen toevoegen aan de kernwoordenschat van een thema.
- Begrippen met de hand toevoegen, wijzigen of verwijderen.

## Open vragen

- Begrippen die de AI zonder keuring toont, botsen met Art. IV.1 (AI is adviserend, een voorstel is pas definitief na
  een beslissing). Dit vraagt een uitzondering in de constitutie en een ADR, zoals bij het woordweb (Art. IV.4,
  ADR-0043). Tot de eigenaar die vastlegt, gaat dit ticket niet in bouw.
- Levert de Op.stap-API de begrippen misschien al apart? Dan is de AI niet nodig. De bouwsessie zoekt dit eerst uit.

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
