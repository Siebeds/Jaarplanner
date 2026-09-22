---
id: FB-084
titel: Tussenpagina toont het Vizier-logo met een eigen wachtbeweging
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-22
bijgewerkt: 2026-09-22 21:49
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De tussenpagina is wat een leerkracht ziet in de seconden voor de app zichzelf kan tonen (TB-026): de naam
"Jaarplanner", groot, met daaronder de driedelige jaarbalk. Bij het wachten gaat die balk bewegen, en dat
is vandaag de enige feedback dat er iets gebeurt.

Met het nieuwe merk (FB-083) verdwijnt die balk. De tussenpagina is daarmee het enige scherm waar het
vervangen van het merk ook iets anders vraagt: het logo staat stil, en er moet dus iets anders zijn dat
laat zien dat de app aan het laden is. Dit is ook het eerste wat iemand van de app ziet, en het is het
scherm dat bij een trage verbinding het langst blijft staan.

De tussenpagina staat **twee keer** getekend, in `index.html` en in `src/app/Tussenpagina.tsx`, en de twee
moeten één tekening blijven: een browser die het script nog laadt toont de statische kopie, en React
vervangt die daarna zonder dat er iets op het scherm verspringt.

## Gewenst gedrag

- De tussenpagina toont het Vizier-logo, groot en gecentreerd, in plaats van de naam met de balk.
- Terwijl de app laadt, is er een rustige beweging die zegt dat er gewacht wordt. De beweging hoort bij het
  logo, niet bij een losse balk: ze mag de stip, de streken of een ring eromheen gebruiken. Ze begint en
  eindigt in rust, zodat een snelle start nooit een halve beweging laat zien.
- Wie "minder beweging" heeft ingesteld, ziet de tussenpagina stil, op haar rustbeeld.
- De statuszin eronder blijft staan waar hij staat, en het scherm verspringt niet op het moment dat React
  de statische kopie overneemt.
- De pagina klopt in lichte en in donkere weergave, ook voor wie de weergave in de app uitdrukkelijk koos.

## Acceptatiecriteria

- [ ] Gegeven een leerkracht die de app opent, wanneer de tussenpagina verschijnt, dan staat daar het
      Vizier-logo en niet meer de naam boven een driedelige balk.
- [ ] Gegeven een trage verbinding, wanneer de tussenpagina blijft staan, dan is er een beweging die het
      wachten toont, en die beweging start vanuit stilstand.
- [ ] Gegeven een bezoeker met "minder beweging" aan, wanneer de tussenpagina verschijnt, dan beweegt er
      niets.
- [ ] Gegeven de statische kopie in `index.html`, wanneer React het scherm overneemt, dan verspringt er
      niets: logo en statuszin staan op dezelfde plaats en dezelfde grootte.
- [ ] Gegeven donkere weergave, wanneer de tussenpagina verschijnt, dan draagt ze de donkere logoversie op
      de donkere grond.

## Testscenario's

1. Sluit alle tabbladen van de app en open ze opnieuw. Je ziet kort de tussenpagina met het Vizier-logo.
2. Knijp de verbinding af (in de ontwikkelaarstools, bijvoorbeeld "Slow 3G") en herlaad. De tussenpagina
   blijft staan en de wachtbeweging loopt rustig door; er springt niets op het moment dat de app komt.
3. Zet in het besturingssysteem "minder beweging" aan en herlaad met dezelfde trage verbinding. Het logo
   staat stil.
4. Zet de weergave op donker en herlaad. De tussenpagina is donker en het logo is de donkere versie.
5. Doe stap 1 ook op een smal scherm (ongeveer 390px). Het logo blijft binnen het scherm en de statuszin
   blijft leesbaar.

## Buiten scope

- Het merk in de zijbalk en op de aanmeldschermen, en de naam in de teksten: dat is FB-083.
- De favicon en de tabbladtitel: dat is FB-085.
- De tekst van de statuszinnen zelf; die blijven zoals TB-026 ze heeft gezet.

## Open vragen

Geen. Welke beweging het wordt, is een ontwerpkeuze binnen dit ticket; ze moet passen bij de vier
bewegingen die de app al kent en de bouwer toont ze aan de eigenaar voor ze vastligt.

## Werklog

- 2026-09-22 21:49 · Siebe · aangemaakt (status nieuw)
