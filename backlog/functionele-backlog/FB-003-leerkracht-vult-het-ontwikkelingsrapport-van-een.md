---
id: FB-003
titel: Leerkracht vult het ontwikkelingsrapport van een kind in, per evaluatiemoment
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-15 17:16
opgepakt-door: rapport-invullen
branch: ticket/FB-003-rapport-invullen
pr:
geblokkeerd:
fr: [FR-13.3, FR-13.7, FR-13.9]
---

## Aanleiding

Drie keer per schooljaar (R8) beoordeelt de leerkracht elk kind op de K3-rapportdoelen, schrijft er een tekst bij, en
schrijft een algemeen besluit (R9). Dat is de kern van het ontwikkelingsrapport, en vandaag gebeurt het met de hand.

Dit is bouwticket 3 van ADR-0035 §6. **Bouwvolgorde:** na E6-02, FB-001 (de kinderen) en FB-002 (de rapportdoelen en de
schaal).

## Gewenst gedrag

- Per kind zijn er drie vaste evaluatiemomenten: Rapport 1, 2 en 3, zonder datums (R8).
- Per moment kiest de leerkracht voor elk rapportdoel een **ster** uit de K3-schaal en schrijft er een **tekst** bij.
  Een ster is niet verplicht zolang de leerkracht er nog geen koos.
- Per moment schrijft de leerkracht een **algemeen besluit** (R9).
- Bij elk rapportdoel ziet de leerkracht de subdoelen die het bundelt. De ouder ziet ze later niet (R11).
- Elk rapportdoel van de K3-set staat op het rapport. Een rapportdoel dat later bijkomt, staat er vanaf dan, zonder ster
  of tekst voor de momenten ervoor (D2).
- **Vanaf dit ticket** kan een rapportdoel of gradatie die in een rapport gebruikt is, niet meer verwijderd worden, wel
  hernoemd of verschoven (D1). Een nieuwe naam staat daarna op elk rapport, ook op oude (R7).
- **Wie** (R16, R17, R26):
  - de leerkrachten van de klas vullen in tijdens het schooljaar, en lezen daarna alleen nog;
  - de directie leest en vult in, ook na het schooljaar;
  - Leerlingzorg leest, zodra FB-008 er is;
  - niemand anders leest een rapport, ook geen leerkracht van een andere K3-klas.
- Een rapport telt nooit mee voor de dekking (FR-13.9).
- Nergens een punt, totaal, gemiddelde of vergelijking tussen kinderen of klassen (Art. I.2). Een ster is een label.

**Bindend:** Art. VI.7, Art. IX.4 (elke tekst en het besluit dragen een status; een tekst die de leerkracht zelf typt
is `manueel`) en ADR-0035 §3.1 tot §3.3. Geen namen, teksten of sterren in een log.

## Acceptatiecriteria

- [ ] Gegeven een kind in een K3-klas, wanneer de leerkracht Rapport 1 opent, dan staat elk rapportdoel van de K3-set er met zijn titel, de subdoelen die het bundelt, een keuze uit de sterren van de schaal en een tekstvak, en is er een vak voor het algemeen besluit.
- [ ] Gegeven een ingevuld en bewaard Rapport 1, wanneer de leerkracht Rapport 2 opent, dan is dat leeg, en staat Rapport 1 na herladen nog zoals het ingevuld werd.
- [ ] Gegeven een leerkracht van een andere klas, of een gebruiker zonder recht op het rapport, wanneer die het rapport probeert te openen, ook via het adres, dan weigert de app; de directie kan het lezen en invullen.
- [ ] Gegeven een schooljaar dat voorbij is, wanneer de leerkracht van de klas het rapport opent, dan kan die het lezen maar niets wijzigen.
- [ ] Gegeven een gradatie of rapportdoel die in een bewaard rapport gebruikt is, wanneer een K3-leerkracht ze wil verwijderen, dan weigert de app met een uitleg; hernoemen lukt, en de nieuwe naam staat daarna op het rapport.
- [ ] Gegeven ingevulde rapporten, wanneer iemand het dekkingsoverzicht van de klas opent, dan is dat hetzelfde als ervoor.

## Testscenario's

1. Meld aan als K3-leerkracht en open het kind "Fien Proefmans", Rapport 1. Elk rapportdoel staat er met zijn
   subdoelen, een sterkeuze en een tekstvak. Onderaan staat een vak voor het algemeen besluit.
2. Noteer wat het dekkingsoverzicht van de klas toont.
3. Kies bij "Luisteren en spreken" de ster "Volledig bereikt", schrijf een tekst en een algemeen besluit, en bewaar.
   Herlaad de pagina: alles staat er nog.
4. Open Rapport 2: het is leeg. Open Rapport 1 opnieuw: het is ongewijzigd.
5. Open het dekkingsoverzicht: hetzelfde als in stap 2.
6. Probeer de gradatie "Volledig bereikt" te verwijderen: de app weigert met een uitleg. Hernoem ze in "Bereikt":
   Rapport 1 toont "Bereikt".
7. Meld aan als leerkracht van een andere klas en plak het adres van Rapport 1: de app weigert.
8. Meld aan als directie, open Rapport 1 en wijzig de tekst: dat lukt.
9. Kies als leerkracht van de klas een schooljaar dat voorbij is: het rapport is te lezen, en niets is te wijzigen.
10. Kijk overal na: nergens een totaal, een gemiddelde of een vergelijking tussen kinderen.

## Buiten scope

- De AI-herwerking van een tekst (FB-004), de kindtekening (FB-005), het downloaden (FB-006) en het recht Leerlingzorg
  (FB-008).
- Punten, totalen, gemiddelden, vergelijkingen tussen kinderen of klassen, en opvolging van een kind over schooljaren
  heen (Art. I.2).
- Een naam of een datum per evaluatiemoment (R8).

## Open vragen

Geen.

## Werklog

- 2026-09-14 14:38 · rapport-tickets · aangemaakt (status nieuw)
- 2026-09-15 16:48 · eigenaar · nieuw → klaar-voor-bouw: klaar voor bouw (eigenaar)
- 2026-09-15 16:48 · rapport-invullen · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-15 17:16 · rapport-invullen · Backend en scherm gebouwd: rapport per kind en moment, ster en tekst per rapportdoel, algemeen besluit, bewaren zonder knop; een gebruikte ster of rapportdoel kan niet meer weg (D1).
