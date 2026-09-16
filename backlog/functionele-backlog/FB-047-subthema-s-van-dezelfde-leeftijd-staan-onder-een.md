---
id: FB-047
titel: Subthema's van dezelfde leeftijd staan onder één leeftijdslabel
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 22:10
opgepakt-door: sessie-fb047
branch: ticket/FB-047-leeftijd-eenmalig
pr:
geblokkeerd:
fr: [FR-3.1]
---

## Aanleiding

De eigenaar merkte op 2026-09-16 in de demo-omgeving: *"een leeftijd kan meerdere subthema's hebben om het thema te
coveren (e.g. een thema herfst van 5 weken kan voor de K2's resulteren in subthema "Bladeren verzamelen" van 2 weken
en subthema "Bladeren herkennen" van 3 weken. Laat die subthema's dan onder elkaar geplaatst worden (is nu het geval)
maar met links dan eenmalig "K2" en niet tweemaal."*

Vandaag toont elk subthema links zijn eigen leeftijd. Twee K2-subthema's onder elkaar tonen dus twee keer "K2".

## Gewenst gedrag

- Op de themapagina staan de subthema's gegroepeerd per leeftijd, in de volgorde van de leeftijden zoals nu.
- De leeftijd staat **één keer** links van haar groep; de subthema's van die leeftijd staan er onder elkaar naast.
- Elk subthema houdt zijn eigen naam, duur, tellingen en uitklapknop.
- Een leeftijd met één subthema ziet er hetzelfde uit, met één subthema in de groep.

## Acceptatiecriteria

- [x] Gegeven een thema met twee K2-subthema's en één K3-subthema, wanneer de themapagina opent, dan staat "K2" één keer,
  met beide K2-subthema's onder elkaar, en "K3" één keer met zijn subthema.
- [x] Gegeven die groep, dan is voor elk subthema nog te zien dat het bij K2 hoort, ook voor een schermlezer.
- [x] Gegeven een van de K2-subthema's, wanneer men het openklapt, dan blijft het andere zoals het was.
- [x] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Open een thema met twee subthema's voor K2 en één voor K3.
2. Links staat "K2" één keer, met "Bladeren verzamelen" en "Bladeren herkennen" onder elkaar ernaast; daaronder "K3".
3. Klap "Bladeren herkennen" open. Het andere K2-subthema blijft dicht.
4. Lees de pagina met een schermlezer: bij elk subthema is de leeftijd te horen.
5. Herhaal op ~390px.

## Buiten scope

De volgorde van de subthema's binnen een leeftijd: die blijft zoals nu.

## Open vragen

Geen.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
- 2026-09-16 22:02 · sessie-fb047 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-16 22:07 · sessie-fb047 · gebouwd: één leeftijdslabel per groep, duur verhuisd naar de kaart, leeftijd voor schermlezers in de vouwknop; 3 nieuwe vitest-tests (falen op de oude code), lint groen
- 2026-09-16 22:09 · sessie-fb047 · criteria afgevinkt: 1 en 3 door vitest en de browser, 2 door de toegankelijke namen in Chrome ('..., leeftijd K2'), 4 door een browserpas op 1440px en 390px op een wegwerpdatabase, zonder horizontale overloop
- 2026-09-16 22:10 · sessie-fb047 · in-uitvoering → te-testen: gebouwd: elke leeftijd staat één keer links naast al haar subthema's, de duur staat in de kaart, schermlezers horen de leeftijd per subthema; vitest, lint en browserpas groen; antagonist COMPLIANT (MINOR: de schermlezer leest 'naam , leeftijd K2' met een spatie voor de komma, verstaanbaar)
