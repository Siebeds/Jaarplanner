---
id: FB-100
titel: Bewerkscherm van een ingeplande fiche of activiteit is rustig en consequent
soort: functioneel
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-24
bijgewerkt: 2026-09-24 17:18
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-6.1]
---

## Aanleiding

De eigenaar (2026-09-24): "de activiteiten in de kalender bewerken moet beter". Vandaag:

- staat onder elke algemene fiche in de agenda het woord "algemene fiche": "dat vervuilt de agenda". Sinds FB-077 is een
  fiche al herkenbaar aan een eigen vlak en een icoon.
- staat in het bewerkscherm het einduur op een eigen, brede rij, en de dag en het beginuur niet: "die UI is verkeerd".
- is weghalen een grote zwarte knop en bewaren een kleinere knop ergens anders, met aparte knoppen voor de tekst en
  voor het uur: "we moeten daar consistentie behouden en ook met symbolen werken, het scherm is nu erg vervuild".

## Gewenst gedrag

- Een algemene fiche in de agenda toont onder haar naam niet langer "algemene fiche". Vlak en icoon blijven, en een
  schermlezer noemt haar nog altijd een algemene fiche. Een activiteit houdt haar subthemanaam eronder (eigenaar
  2026-09-24: enkel "algemene fiche" mag weg).
- In het bewerkscherm van een ingeplande fiche en van een ingeplande activiteit staan dag, beginuur en einduur samen
  op één rij. Op een telefoon (~390px) blijven ze netjes geordend, zonder dat één veld alleen op een volle rij belandt.
- Het bewerkscherm van een ingeplande fiche heeft onderaan **één** knop Bewaren, die alles bewaart wat gewijzigd is
  (tekst van de dag, dag en uur), en een knop Sluiten.
- Weghalen is een klein prullenbakicoon met een naam voor schermlezers en een tooltip, in het fichescherm en het
  activiteitscherm op dezelfde plek. Het vraagt een bevestiging wanneer er iets mee verloren gaat, zoals vandaag.

## Acceptatiecriteria

- [ ] Gegeven een algemene fiche in de agenda, wanneer het blok hoog genoeg is voor een tweede regel, dan staat daar niet "algemene fiche", en een schermlezer kondigt het blok nog steeds als algemene fiche aan.
- [ ] Gegeven het bewerkscherm van een ingeplande fiche of activiteit op desktop, dan staan dag, van en tot op één rij; op ~390px staat geen van de drie alleen op een volle rij terwijl de andere twee samen staan.
- [ ] Gegeven een gewijzigde dagtekst en een gewijzigd uur bij een fiche, wanneer de leerkracht één keer op Bewaren drukt, dan zijn beide bewaard.
- [ ] Gegeven het bewerkscherm, dan is weghalen een icoonknop met een toegankelijke naam, geen gevulde zwarte knop, en is het in het fichescherm en het activiteitscherm dezelfde knop op dezelfde plek.
- [ ] Gegeven een fiche met dagteksten, wanneer de leerkracht op het prullenbakicoon drukt, dan vraagt de app eerst een bevestiging, zoals vandaag.

## Testscenario's

1. Meld aan als leerkracht en open de agenda van een week met een algemene fiche en een activiteit.
2. Het fiche-blok toont naam, uur, vlak en icoon, maar niet meer het woord "algemene fiche". Het activiteitblok toont zijn subthema nog.
3. Klik op de fiche: dag, van en tot staan op één rij. Onderaan staan Bewaren en Sluiten; weghalen is een prullenbakicoon.
4. Wijzig de tekst van de dag én het einduur en druk één keer op Bewaren: beide wijzigingen staan in de agenda.
5. Klik op een activiteit: dag, van en tot op één rij, en hetzelfde prullenbakicoon op dezelfde plek.
6. Herhaal 3 en 5 op een breedte van ongeveer 390px.

## Buiten scope

- Het uur van alle dagen van een fiche tegelijk aanpassen: dat is FB-101.
- Het formulier van de activiteit zelf (naam, soort, doelen) in het activiteitscherm.

## Open vragen

Geen.

## Werklog

- 2026-09-24 17:18 · Siebe · aangemaakt (status nieuw)
