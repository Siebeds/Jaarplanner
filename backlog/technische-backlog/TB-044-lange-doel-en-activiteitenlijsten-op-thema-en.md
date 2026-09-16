---
id: TB-044
titel: Lange lijsten op de themapagina starten ingeklapt, met laad meer en zoeken
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 23:53
opgepakt-door: lange-lijsten
branch: ticket/lange-lijsten-inklappen
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vroeg op 2026-09-16: *"Ik opende zonet het thema Brr, winter lokaal en merk op dat deze veel minimumdoelen
bevat en ik daardoor moet scrollen en scrollen. Doe dit beter. [...] Het zelfde wanneer ik een subthema open doe met veel
subdoelen en activiteiten."*

Vandaag toont de themapagina elk themadoel (minimumdoel) meteen, en een opengeklapt subthema elke activiteit en elk
subdoel. Bij een rijk thema wordt de pagina daardoor erg lang, en wie wil weten of een bepaald doel of een bepaalde
activiteit erbij zit, moet de hele lijst doorlopen.

## Voorgestelde wijziging

- Een herbruikbare lijstcomponent in `frontend/src/features/themas/` voor lange lijsten op de themapagina: standaard
  ingeklapt, met het aantal op de vouwknop; opengeklapt de eerste vijf items in een vaste, logische volgorde, met een
  knop "Laad x meer" tot alles getoond is.
- Naast de vouwknop een klein zoekicoon. Het opent een zoekveld dat de hele lijst filtert, ook als ze ingeklapt is,
  zodat je zonder uitklappen en zonder herhaald "Laad meer" ziet of iets aanwezig is.
- Toegepast op de themadoelen (minimumdoelen) van het thema, en in een subthema op de activiteiten, de subdoelen en
  de andere doelen van de activiteiten.
- Volgorde: minimumdoelen op referentie, subdoelen en andere doelen op code (natuurlijke volgorde), activiteiten op
  naam.
- Zoeken kijkt naar de code of referentie en de doeltekst (die pas wordt opgehaald wanneer het zoekveld opengaat), en
  bij een activiteit naar de naam, de soort en de hoek.
- De activiteitregels in een subthema krijgen geen "+" (doel koppelen) meer: een doel koppel je aan een activiteit
  door de activiteit te openen (eigenaar, 2026-09-16).
- Op het overzicht van alle thema's verdwijnt het getal "klassen" (het telde leeftijden), en toont de kaart het aantal
  minimumdoelen van het thema in plaats van alle doelkoppelingen samen (eigenaar, 2026-09-16).
- Een opengeklapt subthema begint met het woordweb, daarna de onderzoeksvragen (onder een eigen kop). De koppen
  Activiteiten, Subdoelen en Andere doelen zijn zelf de vouwknop, met het aantal ernaast, en daarachter een klein "+"
  (activiteit toevoegen, doel koppelen) en het zoekicoon, in plaats van woordknoppen en een extra regel eronder. De
  bewerk- en verwijderknop van het subthema staan alleen nog naast de titel, zodat de lijsten de volle breedte krijgen.
  In de marge naast de themadoelen staat "minimumdoelen" in plaats van "doelen" (eigenaar, 2026-09-16).
- Het zoekveld is klein (smal en 32px hoog), en staat op gsm samen met zijn sluitknop op een eigen regel.
- Teksten in `nl.json`; bestaande tests aangepast en nieuwe tests voor de lijstcomponent.

## Acceptatiecriteria

- [ ] Gegeven een thema met themadoelen, wanneer ik het thema open, dan is de lijst themadoelen ingeklapt en toont de
  vouwknop hoeveel het er zijn.
- [ ] Gegeven een opengeklapte lijst met meer dan vijf items, wanneer ik ze bekijk, dan zie ik er vijf in een vaste
  volgorde en een knop "Laad x meer" die er telkens tot vijf bijzet, tot alle items er staan.
- [ ] Gegeven een opengeklapt subthema, wanneer ik het bekijk, dan zijn de activiteiten, de subdoelen en de andere
  doelen elk ingeklapt, met hun aantal.
- [ ] Gegeven een ingeklapte lijst, wanneer ik op het zoekicoon klik en een deel van een code, doeltekst of
  activiteitnaam typ, dan zie ik meteen de overeenkomende items, of een melding dat er geen zijn; Escape sluit het
  zoekveld.
- [ ] Gegeven een opengeklapt subthema, wanneer ik de activiteiten bekijk, dan staat naast een activiteit geen "+" om
  een doel te koppelen; dat kan in het activiteitblad.
- [ ] Gegeven het overzicht van alle thema's, wanneer ik een kaart bekijk, dan staat er geen aantal klassen meer en wel
  het aantal minimumdoelen van het thema.
- [ ] Gegeven een opengeklapt subthema, wanneer ik het bekijk, dan staat het woordweb boven de onderzoeksvragen, en
  klap ik de activiteiten en subdoelen open met hun kop, waarnaast een klein "+" en het zoekicoon staan.
- [ ] Toevoegen, ontkoppelen en een doel of activiteit openen werken zoals voordien, en alles werkt met het toetsenbord.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

## Buiten scope

De lijsten van het doelenregister, de agenda en het dekkingsoverzicht. Een zoekfunctie over de hele themapagina.
Onthouden welke lijst open stond na het verlaten van de pagina.

## Open vragen

Geen.

## Werklog

- 2026-09-16 22:43 · lange-lijsten · aangemaakt (status in-uitvoering)
- 2026-09-16 22:52 · lange-lijsten · Inklaplijst gebouwd en toegepast op themadoelen, activiteiten, subdoelen en andere doelen; vitest 1020 groen, lint groen.
- 2026-09-16 23:04 · lange-lijsten · Browsercheck op kopie jaarplanner_tb044 (desktop en 390px): lijsten ingeklapt, laad meer, zoeken, geen plus in activiteitregels, themakaarten zonder klassen; vitest 1023 groen.
- 2026-09-16 23:53 · lange-lijsten · Subthemahoofdstuk herschikt (woordweb eerst, koppen als vouwknop met klein plus- en zoekicoon, kaartknoppen naast de titel); browser desktop en 390px nagekeken; vitest 1023 groen.
