---
id: FB-094
titel: Themapagina krijgt een overzichtelijke opbouw: kop, subthema's, dan doelen
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-24 11:12
opgepakt-door: claude-fb094b
branch: ticket/FB-094-subthema-openklappen
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vindt de themapagina "niet zo overzichtelijk" (2026-09-23). Een doorlichting in de app, op desktop en
op 390px, vond vier oorzaken:

- **Dezelfde cijfers staan er twee à drie keer.** De linkermarge toont "4 weken", "4 minimumdoelen",
  "12 leerplandoelen" en "3 subthema's", de kaarten ernaast zeggen "4 minimumdoelen" en "12 leerplandoelen" opnieuw,
  en de regel Doelkoppelingen telt nog eens. Op een telefoon worden de margecijfers losse labels boven elke kaart.
- **Geen hiërarchie.** Negen labels in kleine hoofdletters (INVALSHOEKEN, THEMADOELEN, SUBTHEMA'S, LEEFTIJD, …)
  wegen allemaal even zwaar, en de titel van een subthema is bijna zo groot als die van de pagina.
- **Het belangrijkste staat onderaan.** Een leerkracht komt vooral voor de subthema's, die helemaal onderaan staan,
  in een grijze bak die anders oogt dan de rest, onder een doelenlijst die open ~20 doelen lang is.
- **Zware, verspreide acties.** Bewerken en verwijderen van het hele thema staan als twee grote knoppen in de hoek
  van één kaart, verwijderen even opvallend als bewerken. Elk subthema herhaalt die twee knoppen: acht omlijnde
  knoppen op één scherm. "Alle thema's" is een knop onder de titel.

De eigenaar keurde het voorstel goed: https://claude.ai/artifact/KPS276EjBdvKYwoPKY7KfN (borden "Voorstel, desktop"
en "Voorstel, telefoon", met "Nu" ernaast ter vergelijking).

## Gewenst gedrag

- **Kop:** een kruimelpad "Thema's / <thema>" boven de titel in plaats van de knop "Alle thema's". Naast de titel
  staan "Bewerken" en een menu "…" met onder meer verwijderen.
- **Eén samenvattingsregel** onder de titel: aantal weken, minimumdoelen, leerplandoelen en subthema's. Elk cijfer
  staat maar één keer op de pagina; de linkermarge met cijfers verdwijnt.
- **Over het thema:** invalshoeken, kernwoordenschat en rijke woordenschat staan rustig onder de samenvatting, als
  label en waarde, zonder eigen kaart.
- **Subthema's komen vóór de doelen**, onder een echte kop "Subthema's" met "Subthema toevoegen" ernaast, per
  leeftijd gegroepeerd ("Voor K3"). Ze staan in één lijst met scheidingslijnen in plaats van losse kaarten, met een
  kleinere titel dan de pagina. Elk subthema heeft één menu "…" (bewerken, verwijderen) in plaats van twee knoppen.
- **Een opengeklapt subthema** toont de onderzoeksvraag, het woordweb en de eerste activiteiten naast elkaar, met
  "Alle … bekijken", "Activiteit toevoegen" en de AI-knop, zonder nog een laag uitklappen. De subdoelen staan als
  één regel met een link.
- **Doelen** onder een echte kop "Doelen", met de regel "Gekoppeld: … op het thema, … op subthema's, … op
  activiteiten". Daaronder de themadoelen, meteen zichtbaar, met "Minimumdoel koppelen" en "Vraag suggesties"
  bij hun kop, en "einde 3e kleuterklas" één keer in plaats van bij elk doel. Dan per leeftijd de leerplandoelen,
  ingeklapt.
- **Koppen in plaats van hoofdletterlabels:** de hoofdsecties hebben een kop in de displayletter; kleine labels
  staan in gewone zinsletters.
- **Uitklappen werkt overal gelijk:** de pijl staat altijd links van wat hij opent.
- **Op een telefoon** staat de samenvatting in twee kolommen, staan de secties onder elkaar, en heeft elke knop een
  raakvlak van minstens 44px.
- Wat vandaag ingeklapt start, blijft ingeklapt starten (FB-011, TB-051). Geen enkele functie verdwijnt.

## Acceptatiecriteria

- [x] Gegeven de themapagina van een thema met subthema's, wanneer ze opent, dan staat elk van de vier cijfers
      (weken, minimumdoelen, leerplandoelen, subthema's) precies één keer op de pagina, onder de titel.
- [x] Gegeven dezelfde pagina, wanneer de leerkracht naar beneden leest, dan komen eerst de kop en de
      themagegevens, dan de subthema's, dan de doelen.
- [x] Gegeven de kop, wanneer de gebruiker het thema wil verwijderen, dan vindt ze dat in het menu "…" naast
      "Bewerken", en niet als losse knop.
- [x] Gegeven een subthema, wanneer de gebruiker het bewerkt of verwijdert, dan doet ze dat via één menu "…" op zijn
      rij, en werkt het zoals voordien.
- [x] Gegeven een opengeklapt subthema, wanneer het opent, dan ziet de leerkracht de onderzoeksvraag, het woordweb
      en de eerste activiteiten zonder nog iets uit te klappen.
- [x] Gegeven elke uitklapper op de pagina, wanneer je hem bekijkt, dan staat de pijl links, en een schermlezer
      meldt of hij open of dicht is.
- [x] Gegeven een telefoon van ~390px, wanneer de pagina opent, dan scrolt niets horizontaal en is elke knop minstens
      44px hoog.
- [x] Gegeven een gebruiker zonder recht om het thema te bewerken, wanneer ze de pagina opent, dan ziet ze geen
      "Bewerken", geen menu met acties die ze niet mag, en leest ze alles zoals nu.

## Testscenario's

1. Open "Thema's" en kies een thema met subthema's. Boven de titel staat "Thema's / <thema>"; onder de titel één
   regel met weken, minimumdoelen, leerplandoelen en subthema's. Links staan geen losse cijfers meer.
2. Lees naar beneden: eerst invalshoeken en woordenschat, dan de kop "Subthema's", dan de kop "Doelen".
3. Open het menu "…" naast "Bewerken": verwijderen staat daar. Sluit het menu.
4. Klap een subthema open: de onderzoeksvraag, het woordweb en de eerste activiteiten staan naast elkaar. Kies
   "Alle … bekijken": alle activiteiten verschijnen.
5. Open het menu "…" van een subthema en kies bewerken: het subthemaformulier opent zoals voordien.
6. Onder "Doelen" staan de themadoelen meteen zichtbaar, met "Minimumdoel koppelen" en "Vraag suggesties" bij hun
   kop. De leerplandoelen per leeftijd staan ingeklapt.
7. Meld je aan als een leerkracht zonder themabeheer: geen "Bewerken", geen verwijderen.
8. Herhaal stap 1 tot 6 op een telefoon.

## Buiten scope

Het themaformulier zelf (FB-061), wat een subthema of activiteit inhoudelijk bevat, de lijst met thema's, en een
indeling in tabbladen.

## Open vragen

Geen.

## Werklog

- 2026-09-23 19:55 · claude-vercelanalyse · aangemaakt (status nieuw)
- 2026-09-23 19:57 · claude-fb094 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-23 20:20 · claude-fb094 · pagina herbouwd: kop met kruimelpad, Bewerken en menu, samenvatting met vier cijfers, subthema's voor de doelen; tests en lint groen, bekeken op 1440 en 390 px (licht en donker)
- 2026-09-23 20:24 · claude-fb094 · antagonist: COMPLIANT; kleine punten opgelost (kopniveaus genest, Radix-pakket vastgepind); criteria afgevinkt op vitest (ThemadetailScherm, Themaminimumdoelen) en de browserpas op 1440 en 390 px
- 2026-09-23 20:24 · claude-fb094 · in-uitvoering → te-testen: themapagina herbouwd als kop, subthema's, doelen; lint en tests groen, bekeken in de browser
- 2026-09-23 20:25 · claude-fb094 · PR #175
- 2026-09-24 11:08 · eigenaar · te-testen → klaar-voor-bouw: Bevinding van de eigenaar, bij een opengeklapt subthema zonder subdoelen: (1) het koppelformulier voor een subdoel opent rechts in het actievak van de kop Subdoelen, waardoor de kop los in het midden hangt en er een lege vlakte ontstaat; verwacht: het zoekveld onder de kop, over de volle breedte, met Annuleren in die kop en de resultaten eronder. (2) '0 subdoelen.', de kop 'Subdoelen' en 'Nog geen doelen op dit subthema' zeggen drie keer hetzelfde, en de link heet 'Subdoelen verbergen' terwijl er niets te verbergen is. (3) 'Stel activiteiten voor' staat actief terwijl een oranje attentieblok zegt dat het zonder subdoelen niet kan; verwacht: geen actieve AI-knop die niets kan, maar een rustige zin, zonder attentiekleur; hetzelfde voor 'Stel woorden voor' zolang er geen woord is. (4) Zonder subdoelen hoort 'Begin met de subdoelen' met de knop 'Subdoel koppelen' bovenaan als eerste stap, over beide kolommen; met subdoelen blijft de ene regel in de kolom Activiteiten. (5) Links in dezelfde stijl ('Subdoelen bekijken' en 'Toon alle jaren'). Ontwerp: https://claude.ai/artifact/KPS276EjBdvKYwoPKY7KfN, rij 'Een subthema openklappen: nu en voorstel'.
- 2026-09-24 11:12 · claude-fb094b · klaar-voor-bouw → in-uitvoering: opgepakt: bevindingen van de eigenaar bij een opengeklapt subthema
