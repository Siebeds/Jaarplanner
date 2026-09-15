---
id: FB-022
titel: Leerkracht vult per dag een tekst in bij een ingeplande algemene fiche, zoals wero
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:10
opgepakt-door:
branch:
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

- [ ] Gegeven een algemene fiche "Wero" die elke dag na de middag ingepland is, wanneer de leerkracht op dinsdag een tekst
  invult en bewaart, dan staat die tekst bij het dinsdagmoment, ook na herladen, en de andere dagen blijven leeg.
- [ ] Gegeven dat moment, wanneer het naar een ander uur verplaatst wordt, dan blijft de tekst erbij.
- [ ] Gegeven een lang genoeg blok, dan toont het blok het begin van de tekst; anders alleen het blad.
- [ ] Gegeven een gebruiker die de klas alleen mag inkijken, dan kan ze de tekst lezen maar niet wijzigen.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

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
  **Standaard** blijven de teksten van de dagen die blijven bestaan, en waarschuwt de tool vóór het bewaren als er teksten
  verloren gaan.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
