---
id: FB-023
titel: Directie stelt de schooluren per weekdag in
soort: functioneel
status: klaar-voor-bouw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:49
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-12.1]
---

## Aanleiding

De eigenaar wil dat de AI de activiteiten van een subthema in de weekagenda voorstelt *"en laten rekening houden met start
en eindtijd van schooldag en algemene fiches"* (FB-027). De tool kent vandaag geen schooluren: het tijdraster opent
standaard op 7:00 tot 18:00, en dat is alleen weergave, geen gegeven van de school (ADR-0028).

**Beslissing van de eigenaar, 2026-09-15:** de schooluren worden **per school** ingesteld, door de directie, per weekdag.

## Gewenst gedrag

- In Instellingen stelt de directie per weekdag in wanneer de schooldag begint en eindigt, en wanneer de middagpauze
  begint en eindigt.
- Een dag kan een kortere dag zijn, bv. woensdag zonder namiddag.
- De uren gelden voor alle klassen.
- Andere gebruikers kunnen ze lezen, niet wijzigen.

## Acceptatiecriteria

- [ ] Gegeven de directie, wanneer ze voor maandag 8:30 tot 15:30 met middagpauze 12:00 tot 13:15 invult en bewaart,
  dan staan die uren er na herladen.
- [ ] Gegeven woensdag, wanneer de directie 8:30 tot 12:00 zonder middagpauze instelt, dan wordt dat bewaard.
- [ ] Gegeven een einde dat vóór het begin ligt, of een middagpauze buiten de schooldag, dan weigert de tool met een
  Nederlandse melding.
- [ ] Gegeven een leerkracht, dan ziet ze de schooluren maar kan ze ze niet wijzigen, ook niet via de API.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Meld aan als directie en open Instellingen, Schooluren. Vul maandag, dinsdag, donderdag en vrijdag in met een
   middagpauze, en woensdag tot 12:00.
2. Bewaar en herlaad. Alles staat er.
3. Probeer een einde vóór het begin. De tool weigert en zegt waarom.
4. Meld aan als leerkracht. Je ziet de uren zonder knop om te wijzigen.

## Buiten scope

- Afwijkende uren per klas: niet gekozen (beslissing 2026-09-15).
- AI-voorstellen in de agenda: FB-027.

## Open vragen

- Een instelling die niets doet, is tegen de afspraken ("never ship a control that does nothing"). Moet de agenda de uren
  ook tonen, bv. openen op het begin van de schooldag en de uren buiten de schooldag lichter tonen? Anders wordt dit ticket
  samen met FB-027 gebouwd.
- Gelden de uren voor elk schooljaar, of per schooljaar? **Standaard** één reeks voor de school.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-15 14:49 · eigenaar · nieuw → klaar-voor-bouw: op klaar-voor-bouw gezet door de eigenaar (in sessie, 2026-09-15)
