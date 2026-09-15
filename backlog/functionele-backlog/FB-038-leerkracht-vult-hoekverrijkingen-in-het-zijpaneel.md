---
id: FB-038
titel: Leerkracht vult hoekverrijkingen in het zijpaneel in; hoeken gaan niet meer in de agenda
soort: functioneel
status: te-testen
prioriteit: hoog
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 21:59
opgepakt-door: hoeken-zijpaneel
branch: ticket/FB-038-hoeken-zijpaneel
pr:
geblokkeerd:
fr: [FR-3.1]
---

## Aanleiding

De eigenaar zag FB-020 op 2026-09-15 en zei: *"de hoekenverrijking stories zijn wat verkeerd uitgevallen, dit was niet
mijn bedoeling"*. Over de subthemabalk boven de agenda met "Hoekverrijking invullen": *"dit moet weg, dat is niet de
bedoeling. de hoekenverrijking wil ik zien hier in de sidepane"* (het zijpaneel Hoekenfiches). En: *"ik wil GEEN hoeken
meer in de agenda kunnen plaatsen want dit is niet nodig. ik wil gewoon tijdens het geselecteerde themaperiode in de
agenda zien welke verrijkingen ik zal doen in welke hoeken maar daarom moet ik ze niet in de agenda kunnen plaatsen"*.

Vandaag vult een leerkracht een verrijking in via een blad dat ze opent vanuit de subthemabalk. In het zijpaneel staat de
verrijking onder elke hoek, maar ze kan ze daar niet invullen, en een klik op een hoek plant die hoek in de agenda.

**Beslissingen van de eigenaar, 2026-09-15:**

- van de subthemabalk verdwijnt alleen het verrijkingsdeel: de links naar het thema en het subthema blijven, want dat is
  de weg van het toetsenbord naar de themapagina (FB-037);
- in het zijpaneel opent een klik op een hoek een blad waarin ze de verrijking van die hoek invult;
- een verrijking blijft per hoek en per subthemaperiode, zoals in FB-020; het blad toont de subthema's die lopen in de
  week waarin de agenda staat;
- hoeken plaatsen gaat uit de agenda, maar de bestaande plaatsingen worden alleen verborgen, niet gewist;
- verwijdert ze een hoek met verborgen plaatsingen, dan gaan die stil mee weg; de bevestiging noemt alleen de
  verrijkingen;
- wie de agenda van een klas mag bekijken maar niet plannen, ziet het zijpaneel Hoekenfiches met de verrijkingen, alleen
  lezen;
- FB-020 is klaar; dit ticket vervangt de ingang die FB-020 bouwde.

## Gewenst gedrag

- **Subthemabalk:** boven het tijdraster en de maand staat nog steeds per thema in beeld een link naar zijn themapagina,
  en per lopend subthema een link naar zijn hoofdstuk. Er staat geen regel over hoekverrijkingen meer in, en een klik
  opent geen blad met verrijkingen.
- **Zijpaneel Hoekenfiches:** elke hoek toont zijn naam, zijn omschrijving en daaronder zijn verrijking voor elk
  subthema dat loopt in de week waarin de agenda staat. Een hoek zonder verrijking toont dat ze er een kan invullen.
- **Invullen:** een klik op een hoek opent een blad met die hoek als titel en een tekstveld per subthema dat die week
  loopt. Na bewaren staat de tekst onder de hoek in het paneel. Een leeg veld bewaren haalt de verrijking weg. Loopt er
  die week geen subthema, dan zegt het blad dat en is er niets in te vullen.
- Een subthema dat in de agenda alleen via zijn activiteiten loopt, krijgt bij het eerste bewaren de periode die de
  agenda toont, zoals nu; het blad zegt dat vooraf.
- **Lezers:** wie de klas mag bekijken maar niet plannen, opent hetzelfde paneel en hetzelfde blad zonder velden en
  zonder "Hoek toevoegen".
- **Geen hoeken meer in de agenda:** een hoek kan niet meer naar een dag gesleept of vanuit het paneel ingepland worden.
  Er staan geen hoekblokken meer in de week- en dagweergave en geen hoekstroken in de maand. Het blad om een hoek in te
  plannen en het detailblad van een ingeplande hoek zijn weg.
- **Een hoek verwijderen** lukt ook als hij vroeger ingepland was. De bevestiging noemt hoeveel verrijkingen mee weggaan
  en zegt niets over de agenda.
- Een hoekenfiche blijft wel te maken vanuit het paneel ("Hoek toevoegen") en in Instellingen.

## Acceptatiecriteria

- [x] Gegeven een week waarin een subthema loopt, dan toont de subthemabalk de links naar het thema en het subthema, en
  geen regel over hoekverrijkingen; een klik erop opent geen verrijkingenblad.
- [x] Gegeven het zijpaneel Hoekenfiches in een week waarin een subthema loopt, wanneer de leerkracht op een hoek klikt,
  een verrijking invult en bewaart, dan staat die tekst onder die hoek in het paneel, en in een week van een ander
  subthema niet.
- [x] Gegeven een gebruiker die de agenda van de klas mag bekijken maar niet plannen, dan ziet ze in het zijpaneel de
  hoeken met hun verrijkingen, zonder velden en zonder "Hoek toevoegen".
- [x] Gegeven een klas met hoeken, dan kan de leerkracht geen hoek meer in de agenda plaatsen: niet door slepen en niet
  door te klikken, en de week-, dag- en maandweergave tonen geen hoeken.
- [x] Gegeven een hoek die vroeger in de agenda stond, wanneer de leerkracht hem verwijdert, dan lukt dat, en de
  bevestiging noemt alleen het aantal verrijkingen.
- [x] Nagekeken in een echte browser op desktop en op ~390px.

## Testscenario's

1. Open de agenda van een K2-klas in een week waarin een subthema loopt. Boven de agenda staan het thema en het
   subthema als links, zonder "Hoekverrijking invullen".
2. Open links Hoekenfiches. Klik op de bouwhoek. Er opent een blad met de bouwhoek als titel en een veld voor het
   lopende subthema. Vul een verrijking in en bewaar.
3. Onder de bouwhoek in het paneel staat de tekst. Blader naar een week van het volgende subthema: onder de bouwhoek
   staat nog niets.
4. Probeer een hoek uit het paneel naar een dag te slepen: dat gaat niet. In de week, de dag en de maand staan geen
   hoeken.
5. Ga naar Instellingen, Hoeken, en verwijder een hoek die vroeger in de agenda stond. De bevestiging noemt de
   verrijkingen; de hoek verdwijnt.
6. Meld aan als een leerkracht van dezelfde jaarfase die de klas alleen mag bekijken. Open Hoekenfiches: de
   verrijkingen staan er, zonder velden en zonder "Hoek toevoegen".
7. Herhaal stap 1 tot 3 op ~390px.

## Buiten scope

- De tabellen en de API van de hoekplaatsingen: ze blijven slapend bestaan (beslissing van de eigenaar).
- Doelen op een hoek of een verrijking: FB-019.
- AI die verrijkingen voorstelt: FB-028.
- Het overzicht voor de directie: FB-021.
- Hoekentijd als blok in de agenda: wie dat toch wil, gebruikt een algemene fiche.

## Open vragen

Geen.

## Werklog

- 2026-09-15 21:10 · wensen-hoeken · aangemaakt (status nieuw)
- 2026-09-15 21:12 · eigenaar · nieuw → klaar-voor-bouw: op klaar-voor-bouw gezet door de eigenaar (in sessie, 2026-09-15): meteen bouwen
- 2026-09-15 21:12 · hoeken-zijpaneel · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-15 21:59 · hoeken-zijpaneel · gebouwd: verrijking per hoek in het zijpaneel Hoekenfiches (blad per hoek, een veld per subthema van de week), ook voor wie alleen mag bekijken; subthemabalk alleen links; hoeken niet meer in de agenda (tabellen en API slapend); hoek verwijderen neemt verborgen plaatsingen mee; ADR-0044
- 2026-09-15 21:59 · hoeken-zijpaneel · antagonist COMPLIANT, 4 kleine bevindingen: 3 opgelost (b34a071), 1 genoteerd (focus op telefoon, zoals de tegel van TB-015); backlog/worklogs/FB-038/antagonist.md
- 2026-09-15 21:59 · hoeken-zijpaneel · browsercontrole geslaagd (headless Chrome, 1440 en 390, licht en donker, wegwerpdatabank jp_fb038): 30/30, contrast 4,64 tot 16,58:1, console leeg; criteria afgevinkt; backlog/worklogs/FB-038/verification.md
- 2026-09-15 21:59 · hoeken-zijpaneel · in-uitvoering → te-testen: klaar om te testen: gates groen (lint, Vitest 952, unit 1801, Postgres 32, dotnet format), antagonist COMPLIANT, browser 30/30
