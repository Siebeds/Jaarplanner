---
id: FB-085
titel: Vizier-favicon, tabbladtitel en een app-icoon om de app op een tablet te zetten
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

Een leerkracht werkt met veel tabbladen open. Vandaag draagt het tabblad van de app een zelfgetekend
vierkantje (`frontend/public/merk.svg`) en de titel "Jaarplanner": geen van beide is nog het merk. De
huisstijlkit levert een volledige browserset (`favicon.ico`, `favicon.svg`, `apple-touch-icon` en de
iconen van 192 en 512 pixels), die klaarstaat in `frontend/public/merk/`.

Daarbij komt iets wat de app nog niet heeft: er is geen web-app-manifest. Een leerkracht die de app op een
tablet gebruikt, kan ze dus niet als icoon op haar startscherm zetten, en doet ze het toch, dan krijgt ze
een schermafdruk van de pagina in plaats van een icoon. Met de iconen uit de kit is dat nu goedkoop op te
lossen.

## Gewenst gedrag

- Het tabblad toont het Vizier-beeldmerk en de titel **Vizier**. Dat geldt ook voor een bladwijzer en voor
  de geschiedenis van de browser.
- Op een tablet of telefoon kan een leerkracht de app aan haar startscherm toevoegen. Ze krijgt dan het
  Vizier-app-icoon en de naam Vizier, en de app opent op een eigen scherm in plaats van in een tabblad met
  adresbalk.
- De kleur van de browserrand (de `theme-color`) klopt bij de weergave: het papier in lichte weergave, de
  donkere grond in donkere weergave.
- Het oude `merk.svg` is weg, niet blijven staan naast het nieuwe.

## Acceptatiecriteria

- [ ] Gegeven een leerkracht met de app open, wanneer ze naar haar tabbladen kijkt, dan draagt het tabblad
      het Vizier-beeldmerk en de titel "Vizier".
- [ ] Gegeven een leerkracht op een tablet, wanneer ze de app aan het startscherm toevoegt, dan staat daar
      het Vizier-app-icoon met de naam Vizier.
- [ ] Gegeven diezelfde leerkracht, wanneer ze de app vanaf het startscherm opent, dan opent ze zonder
      adresbalk, op het aanmeldscherm of op de app zelf.
- [ ] Gegeven donkere weergave, wanneer de app opent, dan is de rand die de browser zelf kleurt donker en
      niet het lichte papier.
- [ ] Gegeven de iconen in `frontend/public/merk/`, wanneer je ze vervangt door bestanden met dezelfde
      namen, dan draagt de app het nieuwe icoon zonder dat er code wijzigt.
- [ ] `frontend/public/merk.svg` bestaat niet meer en wordt nergens meer opgevraagd.

## Testscenario's

1. Open de app in een leeg browservenster. Het tabblad toont de V met de stip en het woord "Vizier".
   Let op: een browser houdt een oude favicon lang bij, dus test met een hard herladen of in een
   privévenster.
2. Zet een bladwijzer. Ook daar staat het beeldmerk met de naam Vizier.
3. Open de app op een tablet (of in de mobiele modus van de ontwikkelaarstools), kies "Toevoegen aan
   startscherm", en bekijk het icoon dat verschijnt: het Vizier-app-icoon op zijn donkere vlak.
4. Open de app vanaf dat icoon. Ze opent zonder adresbalk.
5. Zet de weergave op donker, herlaad, en kijk naar de rand die de browser zelf kleurt (op Android of in
   Safari het duidelijkst). Die is donker.

## Buiten scope

- Offline werken, een service worker of iets anders wat een echte progressive web app nog nodig heeft:
  dit ticket geeft de app een icoon en een eigen venster, meer niet.
- Meldingen op het toestel.
- Het merk in de app zelf: dat is FB-083 en FB-084.

## Open vragen

Geen.

## Werklog

- 2026-09-22 21:49 · Siebe · aangemaakt (status nieuw)
