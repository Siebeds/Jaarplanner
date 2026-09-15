---
id: FB-023
titel: Directie stelt de schooluren per weekdag in
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 15:36
opgepakt-door: FB-023
branch: ticket/FB-023-schooluren
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

- [x] Gegeven de directie, wanneer ze voor maandag 8:30 tot 15:30 met middagpauze 12:00 tot 13:15 invult en bewaart,
  dan staan die uren er na herladen.
- [x] Gegeven woensdag, wanneer de directie 8:30 tot 12:00 zonder middagpauze instelt, dan wordt dat bewaard.
- [x] Gegeven een einde dat vóór het begin ligt, of een middagpauze buiten de schooldag, dan weigert de tool met een
  Nederlandse melding.
- [x] Gegeven een leerkracht, dan ziet ze de schooluren maar kan ze ze niet wijzigen, ook niet via de API.
- [x] Nagekeken in een echte browser op desktop en ~390px.

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
  **Antwoord eigenaar, 2026-09-15:** ja. De agenda opent op het begin van de schooldag en arceert de uren buiten de
  schooldag en de middagpauze, met woorden erbij. Elk uur blijft planbaar.
- Gelden de uren voor elk schooljaar, of per schooljaar? **Standaard** één reeks voor de school.
  **Antwoord eigenaar, 2026-09-15:** één reeks voor de school.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-15 14:49 · eigenaar · nieuw → klaar-voor-bouw: op klaar-voor-bouw gezet door de eigenaar (in sessie, 2026-09-15)
- 2026-09-15 14:52 · FB-023 · klaar-voor-bouw → in-uitvoering: opgepakt; eigenaar koos: de agenda toont de schooluren (opent op het begin, lichter buiten de schooldag en de middagpauze), één reeks voor de school
- 2026-09-15 15:16 · FB-023 · backend klaar: Schooldaguren per weekdag (ma-vr), GET voor iedereen, PUT alleen directie; 25 unittests en 8 integratietests (Postgres) groen; ADR-0038
- 2026-09-15 15:35 · FB-023 · browser (headless Chrome, wegwerpdatabase) op 1440 en 390: bewaren en herladen, woensdag zonder pauze, beide weigeringen in het Nederlands met de weekdag; de agenda opent op 8:00 en arceert met woorden; contrast van de labels 6,1:1 licht en 8,4:1 donker. Als leerkracht aanmelden lukt niet in de ontwikkelaanmelding (een niet-gekoppelde uitnodiging heeft geen link); lezen en de 403 op PUT zijn gedekt door de integratietest en de schermtest
- 2026-09-15 15:36 · FB-023 · antagonist: COMPLIANT, geen BLOCKER of MAJOR. MINOR 2 en 3 opgelost (ADR-0038 noemt de vervangen standaard van 7:00; drie meldingen die alleen een misvormd verzoek raakt zijn Engels). MINOR 1 (bijschrift matrixrij ADR-0030) en 4 (woordenlijst Art. XII) niet: geratificeerde tekst en de grondwet zijn aan de eigenaar
- 2026-09-15 15:36 · FB-023 · in-uitvoering → te-testen: gebouwd: Instellingen, Schooluren (directie vult in, anderen lezen); de agenda opent op het begin van de schooldag en arceert de uren daarbuiten. Unit-, integratie- en frontendtests, dotnet format en pnpm lint groen
