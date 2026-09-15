---
id: FB-022
titel: Leerkracht vult per dag een tekst in bij een ingeplande algemene fiche, zoals wero
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 16:41
opgepakt-door: fichetekst
branch: ticket/FB-022-fiche-dagtekst
pr:
geblokkeerd:
fr: [FR-6.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"wero als vaste blok na de middag en manueel aanvullen per dag"*.

Een algemene fiche kan vandaag al elke schooldag op een vast uur in de agenda staan (ADR-0029), dus wero kan als
algemene fiche elke dag na de middag staan. Wat ontbreekt: per dag invullen wat de klas die dag in dat blok doet.

**Beslissing van de eigenaar, 2026-09-15:** wero wordt een **algemene fiche met een tekst per dag**. Dat kan dan voor elke
algemene fiche.

## Gewenst gedrag

- Bij elk ingepland moment van een algemene fiche kan de leerkracht van de klas een korte tekst voor die dag invullen,
  bv. wat ze vandaag in wero doen.
- De tekst staat in het blad van dat moment, en op het blok zelf voor zover er plaats is.
- Een tekst geldt alleen voor die ene dag; de andere dagen blijven leeg tot ze ingevuld worden.
- Wie een moment naar een andere dag of een ander uur verplaatst, houdt de tekst.

## Acceptatiecriteria

- [x] Gegeven een algemene fiche "Wero" die elke dag na de middag ingepland is, wanneer de leerkracht op dinsdag een tekst
  invult en bewaart, dan staat die tekst bij het dinsdagmoment, ook na herladen, en de andere dagen blijven leeg.
- [x] Gegeven dat moment, wanneer het naar een ander uur verplaatst wordt, dan blijft de tekst erbij.
- [x] Gegeven een lang genoeg blok, dan toont het blok het begin van de tekst; anders alleen het blad.
- [x] Gegeven een gebruiker die de klas alleen mag inkijken, dan kan ze de tekst lezen maar niet wijzigen.
- [x] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Maak in Instellingen een algemene fiche "Wero" en plan ze elke schooldag van 13:15 tot 14:00.
2. Open in de agenda het wero-moment van dinsdag en vul een tekst in. Bewaar en herlaad: de tekst staat er.
3. Open het moment van woensdag: het is leeg.
4. Verplaats het dinsdagmoment naar 13:30. De tekst staat er nog.
5. Meld aan als leerkracht van een andere klas van dezelfde jaarfase. Je kan de tekst lezen, niet wijzigen.

## Buiten scope

- Een vast blok dat de directie voor de hele school zet: niet gekozen (beslissing 2026-09-15).
- Doelen per dag: de doelen blijven op de fiche.

## Open vragen

- Wat gebeurt met de teksten als de leerkracht de hele planning van de fiche wijzigt (andere weekdagen of periode)?
  **Beslist door de eigenaar, 2026-09-15:** de app kent geen "planning wijzigen", alleen een periode weghalen en opnieuw
  inplannen. Wie een periode met ingevulde teksten weghaalt, ziet eerst bij hoeveel dagen een tekst staat en bevestigt.
  Een "planning wijzigen" die teksten bewaart, wordt een apart ticket als dat nodig blijkt.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-15 16:07 · eigenaar · nieuw → klaar-voor-bouw: naar klaar-voor-bouw op vraag van de eigenaar; open vraag beslist: waarschuwen bij verwijderen van een plaatsing met teksten
- 2026-09-15 16:08 · fichetekst · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-15 16:23 · fichetekst · gebouwd: tekst per fichemoment (max 500 tekens, leeg = wissen) met eigen endpoint en recht KlasplanningBewerken, tekst op het blok waar plaats is, bevestiging met aantal bij weghalen van een periode met teksten; unit- en frontendtests groen
- 2026-09-15 16:31 · fichetekst · gates: 30 unit (fiches), 471 integratie (1 overgeslagen: live KOV), 614 frontendtests groen; dotnet format en pnpm lint schoon
- 2026-09-15 16:38 · fichetekst · browsercontrole desktop en 390px geslaagd, alle vijf acceptatiecriteria afgevinkt (bewijs: backlog/worklogs/FB-022/verification.md); antagonist COMPLIANT, twee MINOR testpunten worden meegenomen
- 2026-09-15 16:41 · fichetekst · in-uitvoering → te-testen: gebouwd: per ingepland moment van een algemene fiche een tekst voor die dag (in het blad, op het blok waar plaats is, blijft bij verplaatsen, alleen lezen voor wie de klas niet mag plannen), bevestiging met aantal bij weghalen van een periode met teksten; gates groen, browser desktop en 390px, antagonist COMPLIANT
