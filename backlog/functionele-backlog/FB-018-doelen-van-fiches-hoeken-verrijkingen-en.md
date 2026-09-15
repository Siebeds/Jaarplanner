---
id: FB-018
titel: Doelen van fiches, hoeken, verrijkingen en activiteiten via een info-icoon in de agenda
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 15:52
opgepakt-door: FB-018
branch: ticket/FB-018-doelen-info-icoon
pr: 78
geblokkeerd:
fr: [FR-3.2, FR-6.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"een leerkracht moet ook de doelen gelinkt aan de algemene fiches kunnen raadplegen
vanuit de agenda (mss via info icoontje zodat het niet telkens open springt als je op een fiche klikt?), idem voor
hoekenfiches, hoekenverrijkingen en activiteiten"*, en ook: *"nog altijd zorgen dat je genoeg weet aan welke doelen je
werkt in jouw agenda!!"*.

Vandaag toont een activiteit haar doelen alleen in haar volledige blad, en de doelen van een algemene fiche staan alleen
in Instellingen. Wie in de agenda wil weten aan welke doelen een blok werkt, moet het blad openen of de agenda verlaten.

**Beslissing van de eigenaar, 2026-09-15:** het weten aan welke doelen je werkt, loopt via deze info-iconen; er komt geen
apart weekoverzicht.

## Gewenst gedrag

- Elke kaart in de zijbalk (hoekenfiche, algemene fiche, activiteit uit FB-017) en elk blok op het tijdraster (activiteit,
  algemene fiche, hoek) krijgt een klein info-icoon. Een verrijking (FB-020) ook.
- Een klik op het icoon toont de gekoppelde leerplandoelen (code, korte tekst, doelsoort) in een klein venster, zonder
  het blad te openen en zonder een sleepbeweging te starten.
- Vanuit dat venster opent een doel zijn detail (zoals TB-016).
- Zonder doelen zegt het venster "nog geen doelen gekoppeld".
- De doelen van hoeken en verrijkingen bestaan pas met FB-019; tot dan is het icoon er voor algemene fiches en
  activiteiten.

## Acceptatiecriteria

- [x] Gegeven een algemene fiche met twee doelen in de zijbalk, wanneer ik op haar info-icoon klik, dan zie ik die twee
  doelen, en er opent geen plaatsingsblad.
- [x] Gegeven een ingeplande activiteit op het tijdraster, wanneer ik op haar info-icoon klik, dan zie ik haar doelen
  zonder dat het activiteitblad opent of het blok verschuift.
- [x] Gegeven een blok zonder doelen, dan zegt het venster dat er nog geen doelen gekoppeld zijn.
- [x] Gegeven het venster, wanneer ik een doel aanklik, dan opent het detail van dat doel.
- [x] Het icoon is met het toetsenbord bereikbaar, heeft een doel van minstens 24 bij 24 pixels, en is in een echte
  browser nagekeken op desktop en ~390px.

## Testscenario's

1. Open de agenda. Klik in Algemene fiches op het info-icoon van een fiche. Je ziet haar doelen; de fiche opent niet.
2. Klik op het info-icoon van een ingeplande activiteit op het tijdraster. Je ziet haar doelen; het blok verschuift niet.
3. Klik een doel aan. Het detail opent.
4. Klik op het icoon van een fiche zonder doelen. Het venster zegt dat er nog geen zijn.
5. Ga met Tab naar een icoon en druk op Enter. Het venster opent.
6. Herhaal op ~390px.

## Buiten scope

- Doelen koppelen vanuit dit venster.
- Een weekoverzicht van alle doelen (beslissing 2026-09-15: niet nodig).

## Open vragen

- Een kort blok (een kwartier) heeft weinig ruimte. Waar staat het icoon dan: in het blok, of alleen in het blad?
  Te beslissen in de ontwerpstap.
  - **Beslist in de ontwerpstap (2026-09-15):** het icoon staat in het blok vanaf een half uur. Een blok van een half
    uur is 28 pixels hoog en past een doel van 24 bij 24; een kwartier is 14 pixels en past niets dat een vinger raakt.
    Een korter blok toont zijn doelen alleen in het blad dat het opent: het activiteitblad deed dat al, en het blad van
    een algemene fiche kreeg daarvoor een sectie Doelen.
- Een doel dat uit Op.stap verdwenen is, draagt in het venster het label "Vervallen in Op.stap" bij een activiteit,
  maar niet bij een algemene fiche: de doelen van een fiche komen zonder die vlag van de server, en dat was al zo voor
  dit ticket (antagonist, 2026-09-15).
  - **Aanvaard door de eigenaar (2026-09-15):** fichedoelen tonen het label voorlopig niet; geen apart ticket.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-15 14:52 · eigenaar · nieuw → klaar-voor-bouw: eigenaar vroeg in sessie om FB-018 op te nemen, zonder op FB-017 te wachten
- 2026-09-15 14:53 · FB-018 · klaar-voor-bouw → in-uitvoering: opgepakt; de activiteitkaarten uit FB-017 krijgen het icoon van wie als tweede merget (eigenaar, 2026-09-15)
- 2026-09-15 15:12 · FB-018 · info-icoon met doelvenster gebouwd: op tijdrasterblokken vanaf een half uur (activiteit, algemene fiche) en op de kaarten van algemene fiches in de zijbalk; kortere blokken tonen hun doelen in hun blad, daarvoor kreeg het fichedetailblad een doelensectie; lint en 588 frontendtests groen
- 2026-09-15 15:26 · FB-018 · browsercontrole op wegwerpdatabank jp_fb018 (headless Chrome, 1440 en 390 px): alle vijf acceptatiecriteria gezien, icoon 24x24, contrast 5,97 tot 6,51:1, focus keert terug naar het icoon; open vraag beslist: icoon vanaf een half uur, korter blok toont doelen in zijn blad
- 2026-09-15 15:45 · FB-018 · antagonist ronde 1: VIOLATIONS FOUND, een zware bevinding (op een blok van een half uur lag de rekgreep over het onderste derde van het icoon) en vijf kleinere; opgelost: icoon boven de greep (z-20), commentaar over de starttijd rechtgezet, ADR-0024 kreeg een amendement voor de popover, focustest toegevoegd; herbemeten in de browser: alle 1653 punten binnen de cirkel van 24 px raken het icoon op drie blokken; lint en 589 frontendtests groen
- 2026-09-15 15:52 · FB-018 · in-uitvoering → te-testen: gebouwd: info-icoon met doelvenster op tijdrasterblokken vanaf een half uur en op de kaarten van algemene fiches, doelen van een fiche in haar blad; antagonist ronde 2 COMPLIANT; na merge van main lint en 606 frontendtests groen; klaar om te testen
- 2026-09-15 15:52 · FB-018 · PR #78
