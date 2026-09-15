---
id: FB-036
titel: Leerkracht brainstormt een eigen woordweb bij een subthema, met AI-voorstellen
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 19:32
opgepakt-door: woordweb
branch: ticket/FB-036-woordweb
pr: 94
geblokkeerd:
fr: [FR-3.1, FR-4.2, FR-4.3]
---

## Aanleiding

De 10-stappenmethode van de school (FA A.7) heeft als stap 3 een **brainstorm**, maar de tool heeft er niets voor. Een
leerkracht brainstormt vandaag op papier of in haar hoofd, en wat ze bedenkt, staat nergens bij het subthema.

**Beslissingen van de eigenaar, 2026-09-15:** de brainstorm is een **woordweb**: losse woorden rond het subthema. Elke
leerkracht heeft een **eigen** woordweb per subthema en kan dat van collega's inzien. Het web volgt de leerkracht over de
schooljaren heen. De AI kan woorden voorstellen. De methode zet de brainstorm vóór de subthema's (stap 3 vóór stap 4);
de eigenaar koos bewust voor het subthema, omdat daar het werk in de klas gebeurt.

## Gewenst gedrag

- Op de themapagina heeft elk subthema een woordweb: de naam van het subthema met losse woorden eromheen.
- Een leerkracht voegt woorden toe aan haar **eigen** woordweb en schrapt ze weer. Plakken van een lijst met komma's
  geeft losse woorden.
- Ze ziet ook de woordwebs van collega's bij hetzelfde subthema, elk met de naam van wie het maakte. Die kan ze lezen,
  niet wijzigen.
- Staat er al minstens één eigen woord in haar web, dan kan ze de AI om woorden vragen. De AI stelt een paar woorden
  voor, elk met een korte motivatie. Ze aanvaardt of weigert elk woord; niets komt in het web zonder dat ze het
  aanvaardt, en wat ze besliste blijft bewaard.
- Een woordweb telt nooit mee voor de dekking.

## Acceptatiecriteria

- [x] Gegeven een subthema, wanneer leerkracht A woorden toevoegt, dan staan ze in haar eigen woordweb; leerkracht B ziet
  dat web bij hetzelfde subthema met de naam van A, zonder het te kunnen wijzigen.
- [x] Gegeven een leeg eigen woordweb, dan kan de leerkracht nog geen AI-voorstellen vragen; na het eerste eigen woord
  wel.
- [x] Gegeven een AI-vraag, dan krijgt de leerkracht hoogstens vijf woorden, elk als voorstel met een motivatie en elk
  apart te aanvaarden of te weigeren; een aanvaard woord staat in het web, een geweigerd woord wordt niet opnieuw
  voorgesteld, en de beslissing is bewaard.
- [x] Gegeven een woordweb, dan verandert geen enkel dekkingscijfer als er woorden bijkomen of verdwijnen.
- [x] De AI-logica is getest met een nep-AI-client, en een modelantwoord dat niet aan het afgesproken formaat voldoet,
  wordt niet getoond en niet bewaard.

## Testscenario's

1. Meld aan als een leerkracht met een K3-klas. Open een thema en klap een K3-subthema open. Het woordweb is leeg en de
   AI-knop is nog niet te gebruiken.
2. Voeg drie woorden toe, en plak daarna "wind, regen, wolk". Je ziet zes losse woorden rond de naam van het subthema.
3. Vraag AI-voorstellen. Hoogstens vijf woorden verschijnen, elk met een motivatie. Aanvaard er twee en weiger er één.
   De twee staan in je web; vraag opnieuw en het geweigerde woord komt niet terug.
4. Meld aan als een andere leerkracht. Bij hetzelfde subthema zie je het web van de eerste leerkracht met haar naam, en
   geen knoppen om het te wijzigen. Maak je eigen web: beide staan er.
5. Herhaal stap 1 tot 3 op een smal scherm (~390px).

## Buiten scope

- Een woord uit het web overnemen in de streefwoordenschat van het subthema: de streefwoordenschat bestaat nog niet
  (E10-01 is ontworpen, niet gebouwd). Beslissing van de eigenaar, 2026-09-15: een eigen ticket, na E10-01.
- Een woordweb aan het thema, of één gedeeld web voor het hele team.
- Takken of meerdere niveaus in het web.
- Woorden overnemen in de kern- of rijke woordenschat van het thema.
- Een woord omzetten naar een subthema, onderzoeksvraag of activiteit.
- Het woordweb in de agenda en in de thema-opbouwwizard (E6-05).

## Open vragen

- **Grondwet (Art. XI), mee te nemen in dit ticket, in een aparte commit:**
  - Art. IV.8 noemt AI-hulp alleen bij stap 2 en 6. Het krijgt stap 3: de AI stelt woorden voor in het woordweb, pas
    na het eerste eigen woord, zodat ze niet vooruitloopt op de leerkracht (goedgekeurd door de eigenaar, 2026-09-15).
  - Art. IV.4 laat de AI alleen steunen op de gegevens van de school en Op.stap. Het krijgt een uitzondering voor het
    woordweb: de AI stelt woorden voor uit haar eigen taalkennis, bij het subthema, zijn onderzoeksvragen en de woorden
    in het web (goedgekeurd door de eigenaar, 2026-09-15).
  - Art. IX.2 krijgt het woordweb op het subthema, als persoonlijke inhoud.
  - ADR-0030 open vraag (a) (wie bezit persoonlijke inhoud en wie ziet ze) wordt voor het woordweb beantwoord: het hoort
    bij de leerkracht, volgt haar over de schooljaren heen, en iedereen kan het lezen. Een nieuwe ADR legt dat vast.
    Voor eigen activiteiten en subdoelen blijft (a) open (E6-10).
- **Standaarden die de eigenaar nog kan wijzigen:** hoogstens vijf voorstellen per vraag en een geweigerd woord komt
  niet terug (zoals FB-026); iedereen die de themapagina ziet, mag bij elk subthema een eigen web houden; de directie
  mag, zoals overal, elk web wijzigen; wie een subthema verwijdert, verwijdert ook de woordwebs erbij, en de bevestiging
  zegt hoeveel.
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure). Zonder AI zegt de knop dat duidelijk,
  zoals "Vraag suggesties" bij de themadoelen.

## Werklog

- 2026-09-15 18:15 · woordweb · aangemaakt (status nieuw)
- 2026-09-15 18:20 · eigenaar · nieuw → klaar-voor-bouw: eigenaar wil het meteen samen oppakken
- 2026-09-15 18:22 · woordweb · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-15 18:27 · woordweb · eigenaar: overnemen naar streefwoordenschat uit scope (eigen ticket na E10-01); AI mag vrij woorden voorstellen, met uitzondering in Art. IV.4
- 2026-09-15 19:12 · woordweb · gebouwd: woordweb per gebruiker en subthema, AI-voorstellen (max 5, motivatie, aanvaard/weiger), recht WoordwebBewerken, migratie Woordwebs; gates groen behalve de flaky Z1_Z6 (los van dit ticket); browsercontrole 19/19 op 1440 en 390px, zie worklogs/FB-036
- 2026-09-15 19:26 · woordweb · antagonist ronde 1: 1 MAJOR (wizard verwijderde andermans woordweb, omweg rond D5) en 4 MINOR, alle verwerkt; tests groen; her-audit van de MAJOR gevraagd
- 2026-09-15 19:29 · woordweb · in-uitvoering → te-testen: gebouwd en getest: woordweb per gebruiker en subthema met AI-voorstellen; backend unit 1727 en integratie groen (behalve de flaky Z1_Z6, los van dit ticket), Vitest 871, lint en format schoon; browsercontrole 19/19 op 1440 en 390px; antagonist ronde 2 COMPLIANT
- 2026-09-15 19:32 · woordweb · PR #94
