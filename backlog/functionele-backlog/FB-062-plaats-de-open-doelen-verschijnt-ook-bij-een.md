---
id: FB-062
titel: Plaats de open doelen verschijnt ook bij een leeftijd die nog geen subthema heeft
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-17
bijgewerkt: 2026-09-22 23:35
opgepakt-door: claude-fb062
branch: ticket/FB-062-open-doelen-zonder-subthema
pr:
geblokkeerd:
fr: [FR-4.4]
---

## Aanleiding

De eigenaar vroeg op 2026-09-17: *"ik wil de AI knop bij subthema's plaats de open doelen al zichtbaar ookal is er nog
geen subthema, nu verschijnt die enkel na de aanmaak van subthema"*.

FB-057 toont per leeftijd hoeveel leerplandoelen van de themadoelen nog in geen subthema hangen, met de AI-knop "Plaats
de open doelen". Die teller en die knop staan vandaag alleen bij een leeftijd die al minstens één subthema heeft. Bij een
nieuw thema, of bij een leeftijd waar nog niemand aan begon, moet de hoofdleerkracht dus eerst met de hand een subthema
aanmaken voor de AI kan helpen, terwijl de AI juist ook nieuwe subthema's mag voorstellen.

**Beslissing van de eigenaar, 2026-09-17:** een leeftijd zonder subthema toont de teller en de knop alleen aan wie de
subthema's van die leeftijd beheert (de hoofdleerkracht van die jaarfase) en aan de directie.

## Gewenst gedrag

- Brengen de themadoelen van een thema leerplandoelen mee voor een leeftijd die nog geen subthema heeft, dan staat die
  leeftijd toch op de themapagina, met hoeveel leerplandoelen nog open zijn en de AI-knop "Plaats de open doelen".
- Die leeftijd zonder subthema ziet alleen wie de subthema's van die leeftijd beheert, en de directie. De directie ziet
  elke leeftijd zonder subthema die open doelen heeft.
- Een leeftijd zonder subthema en zonder open doelen verschijnt niet.
- Vraagt men daar voorstellen, dan kan de AI alleen nieuwe subthema's voorstellen, met een naam, een onderzoeksvraag,
  een lengte en de doelen die erin horen. Aanvaarden, aanpassen en weigeren werken zoals in FB-057.
- Na het aanvaarden van een voorgesteld subthema staat de leeftijd er zoals elke leeftijd met een subthema.
- Bij een leeftijd die al een subthema heeft, verandert er niets.

## Acceptatiecriteria

- [ ] Gegeven een thema met een themadoel dat voor K2 leerplandoelen meebrengt en geen K2-subthema, wanneer de
  hoofdleerkracht van K2 of de directie de themapagina opent, dan staat K2 er met het aantal open leerplandoelen en de
  knop "Plaats de open doelen".
- [ ] Gegeven diezelfde situatie, wanneer een hoofdleerkracht van K3 of een leerkracht de themapagina opent, dan staat
  K2 er niet.
- [ ] Gegeven een leeftijd zonder subthema en zonder open leerplandoelen, wanneer iemand de themapagina opent, dan
  staat die leeftijd er niet.
- [ ] Gegeven K2 zonder subthema, wanneer de hoofdleerkracht van K2 "Plaats de open doelen" kiest, dan verschijnen
  voorgestelde nieuwe subthema's met hun doelen, de vage regenboogring, het label "Voorgesteld" en de icoontjes; wie
  geen recht heeft op K2, krijgt van de server een weigering.
- [ ] Gegeven een voorgesteld nieuw subthema bij K2 zonder subthema, wanneer ik het aanvaard, dan bestaat het
  K2-subthema met zijn doelen als subdoelen en daalt de teller bij K2.

## Testscenario's

1. Meld aan als directie. Maak een thema zonder subthema's en koppel een minimumdoel dat leerplandoelen voor K2
   meebrengt. Onder de subthema's staat K2 met het aantal open doelen en de knop "Plaats de open doelen".
2. Meld aan als hoofdleerkracht van K2 en open hetzelfde thema. K2 staat er met de teller en de knop.
3. Kies "Plaats de open doelen". De knop beweegt tijdens het wachten; daarna staan er een of meer voorgestelde nieuwe
   subthema's bij K2, elk met een vage regenboogring, een motivatie en de kleine icoontjes.
4. Pas een voorgesteld subthema aan met het potlood en aanvaard het. Het subthema staat bij K2 met zijn subdoelen en
   de teller daalt.
5. Meld aan als hoofdleerkracht van K3, en daarna als leerkracht, en open het thema. K2 staat er niet.
6. Bekijk de pagina op ~390px: de leeftijd zonder subthema, de teller en de knop blijven leesbaar.

## Buiten scope

- Een leeftijd zonder subthema tonen aan wie de subthema's van die leeftijd niet beheert.
- Een leeftijd met een subthema: die blijft werken zoals in FB-057.
- Opdelen van een AI-vraag met te veel open doelen (zie FB-057).
- De schoolbrede hiatenanalyse: FB-054.

## Open vragen

Geen.

## Werklog

- 2026-09-17 01:44 · eigenaar · aangemaakt (status nieuw)
- 2026-09-22 23:35 · claude-fb062 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
