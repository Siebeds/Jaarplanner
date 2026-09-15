---
id: TB-025
titel: Activiteitblad toont doelen met tekst, een weghaal-icoon en de duur in lesuren
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 18:04
opgepakt-door: activiteit-bewerken
branch: ticket/activiteit-bewerken
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar, 2026-09-15, over het blad waarin je een activiteit bewerkt (vanuit de themapagina en vanuit de agenda):

- "wanneer ik een activiteit bewerk, wil ik dat de doelen leesbaar zijn en aanklikbaar voor de details, nu zie ik
  enkel een nummer"
- "de delete knop is verwarrend (haal weg), ik wil daar een duidelijk geplaatste icoon zien om die weg te halen"
- "de getallen van de duratie is verwarrend, ik wil 1 lesuur, 2 lesuren, ... met daaronder dan de minuten"

## Voorgestelde wijziging

Alleen frontend, geen API- of datamodelwijziging.

- `Activiteitformulier`: de gekoppelde doelen (bewerken, nieuw en alleen-lezen) tonen dezelfde rij als op de
  themapagina (`Gekoppelddoel` in een `Doellijst`): doelsoort, code, doeltekst op twee regels, status. Een klik op de
  rij opent het doeldetail (`Doeldetailblad`) boven het blad. `Gekoppelddoel` krijgt daarvoor een optionele status,
  voor een doel dat nog niet bewaard is.
- `Activiteitformulier`: de duurknoppen tonen "1 lesuur", "2 lesuren", ... met de minuten klein eronder. De
  alleen-lezen weergave toont de duur ook in lesuren met de minuten.
- `Activiteitblad` (agenda): de tekstknop "Haal weg" wordt een vuilbakicoon rechts in de kop "In de agenda", met een
  label dat zegt dat de activiteit uit de agenda gaat (de activiteit zelf blijft bestaan).
- Teksten in `nl.json`, tests in `Activiteitformulier.test.tsx`, `Activiteitblad.test.tsx` en waar een test de oude
  tekst verwacht.

## Acceptatiecriteria

- [x] Gegeven een activiteit met gekoppelde doelen, wanneer ik ze bewerk of bekijk, dan zie ik per doel de doeltekst,
  niet enkel de code.
- [x] Gegeven dat blad, wanneer ik op een doel klik, dan opent het doeldetail, en bij sluiten sta ik terug in het
  activiteitblad.
- [x] Gegeven een nieuwe activiteit waar ik een doel aan toevoeg, dan zie ik ook dat doel met zijn tekst.
- [x] Gegeven de duurkeuze, dan lees ik "1 lesuur", "2 lesuren", "3 lesuren", "4 lesuren", met eronder de minuten.
- [x] Gegeven een ingeplande activiteit in de agenda, dan staat rechts in "In de agenda" een vuilbakicoon dat de
  activiteit van die dag haalt, en er is geen knop "Haal weg" meer.
- [x] Gecontroleerd in de echte app, op desktop en op ongeveer 390 px.

## Buiten scope

De opgeslagen duur blijft een aantal lesuren van 50 minuten (`lengteInLesuren`, ADR-0028 punt 2); de agenda zelf
blijft in kloktijden plannen. Het verwijderen van de activiteit zelf (op de themapagina) verandert niet.

## Open vragen

Geen.

## Werklog

- 2026-09-15 17:42 · activiteit-bewerken · aangemaakt (status in-uitvoering)
- 2026-09-15 18:01 · activiteit-bewerken · Gebouwd en getest: Vitest 810/810, lint groen; browsercontrole op een wegwerpdatabase (1440 en 390 px): doelen met tekst en detail, duurknoppen in lesuren (2x2 op 390), vuilbakicoon in de dagsectie.
- 2026-09-15 18:04 · activiteit-bewerken · Criterium 3 in de browser gecontroleerd: een nieuwe activiteit toont een gekozen doel met zijn tekst, zonder status tot Bewaren. Wegwerpdatabase en testservers opgeruimd.
