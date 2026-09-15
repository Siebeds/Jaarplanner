---
id: FB-013
titel: Leerkracht ziet alleen de klassen van haar eigen jaarfase
soort: functioneel
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 17:35
opgepakt-door: zichtbaarheid
branch: ticket/FB-013-klassen-eigen-jaarfase
pr:
geblokkeerd:
fr: [FR-10.1, FR-10.2]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"een leerkracht mag agenda's zien van klassen uit dezelfde klasfase, maar NIET van
andere klasfases"*.

Vandaag kan elke gebruiker het jaarplan, de agenda en de dekking van elke klas inkijken (standaard I9 in Art. VI.1). De
directie werd gevraagd hoe ver dat moet reiken (vraag 4 in `docs/besluiten-gevraagd.md`) en heeft nog niet geantwoord.

**Beslissingen van de eigenaar, 2026-09-15:**

- een leerkracht ziet alleen de klassen van haar **eigen jaarfase**, en de grens geldt voor de **agenda, het jaarplan
  en de dekking**;
- een **hoofdleerkracht** ziet de klassen van de jaarfase waarvoor ze aangesteld is;
- wie **themabeheer** heeft, ziet alle klassen;
- een gebruiker **zonder recht** (geen klas, geen aanstelling, geen themabeheer, geen directie) ziet geen enkele klas;
- de **directie** ziet alles, zoals nu.

Dit ticket neemt het werk van story E6-08 en E6-09 over.

## Gewenst gedrag

- De klaskiezer toont alleen de klassen die je mag inkijken: je eigen klassen, en de andere klassen van dezelfde
  jaarfase.
- Een leerkracht met klassen in twee jaarfasen ziet de klassen van beide.
- Een klas van een andere jaarfase is ook via het adres in de browser niet te openen, en ook niet te exporteren.
- Een klas van dezelfde jaarfase die niet de jouwe is, blijft alleen-lezen, zoals nu.
- Welke jaarfase een klas geeft, volgt de ene plaats in de code die een klas aan haar leeftijden koppelt (Art. VI.1),
  ook voor een graadklas.
- Eén uitzondering: FB-014 laat een leerkracht bij een thema zien wat haar groep in vorige schooljaren deed.

## Acceptatiecriteria

- [x] Gegeven een leerkracht van een K3-klas, wanneer ze de klaskiezer opent, dan ziet ze alle K3-klassen en geen JK- of
  K2-klas.
- [x] Gegeven die leerkracht, wanneer ze het adres van de agenda, het jaarplan of de dekking van een K2-klas opent of
  exporteert, dan weigert de app, ook in de API.
- [x] Gegeven een hoofdleerkracht van K2 zonder eigen klas, dan ziet ze alle K2-klassen en geen andere.
- [x] Gegeven een gebruiker met themabeheer, dan ziet ze alle klassen; gegeven de directie, ook.
- [x] Gegeven een gebruiker zonder enig recht, dan ziet ze geen enkele klas en zegt het scherm dat in gewone taal.
- [x] Gegeven een leerkracht met een K2- en een K3-klas, dan ziet ze de klassen van beide jaarfasen.

## Testscenario's

1. Meld aan als leerkracht van een K3-klas. De klaskiezer toont alleen K3-klassen.
2. Open een andere K3-klas: agenda, jaarplan en dekking zijn te lezen, niet te wijzigen.
3. Plak het adres van de agenda van een K2-klas. De app weigert.
4. Meld aan als hoofdleerkracht van K2 zonder klas. Je ziet alle K2-klassen.
5. Meld aan als themabeheer. Je ziet alle klassen.
6. Meld aan als gebruiker zonder recht. Er is geen klas te kiezen, en het scherm zegt waarom.
7. Meld aan als directie. Alles is zichtbaar.

## Buiten scope

- Het ontwikkelingsrapport: daar geldt al een strengere regel (alleen de eigen klas, Art. VI.7).
- Delen van een agenda met een klas van een andere jaarfase: niet gevraagd.
- Wie mag wijzigen: dat blijft zoals nu (alleen de leerkrachten van de klas en de directie).

## Open vragen

- **Directie:** wie wat mag zien is vraag 4 aan de directie (Art. XIV, *Teacher visibility*, FR-10.2). Dit is een
  beslissing van de eigenaar; de bevestiging van de directie blijft open. De grens komt op één plaats in de code (de
  naad van E6-09), zodat een ander antwoord van de directie maar één plek raakt.
- **Grondwet:** Art. VI.1 noemt als standaard (I9) dat elke gebruiker elke klas leest. De wijziging van die zin en van de
  rij in ADR-0030 §3 hoort bij de bouw van dit ticket.
- Mag een K3-leerkracht de K3-klassen van **vorige schooljaren** inkijken? **Standaard** ja: dezelfde jaarfase, in elk
  schooljaar.

## Werklog

- 2026-09-15 14:09 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-15 16:27 · eigenaar · nieuw → klaar-voor-bouw: vrijgegeven voor de bouw op vraag van de eigenaar
- 2026-09-15 16:28 · zichtbaarheid · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-15 17:00 · zichtbaarheid · Gebouwd: rij KlasplanningBekijken (ADR-0039) op elke leesroute van een klas, klassenlijst gefilterd, hoeken overnemen vraagt de bronklas; frontend-zinnen voor een lege lijst en voor wie geen recht heeft; amendement Art. VI.1, VI.7, XIV. Unit 1597 groen, rechten-integratie 45 groen, frontend 743 groen, lint schoon
- 2026-09-15 17:12 · zichtbaarheid · Criteria 1-6 afgevinkt: RechtenAfdwingingTests (FB-013-sectie) en de leessweep op PostgreSQL, curl op een draaiende API, browsercontrole op wegwerpdatabase (1440 en echte 390 via CDP, geen horizontale scroll); verslag in backlog/worklogs/FB-013/browsercheck.md. Volledige suite: unit 1597, integratie 488, frontend 743 groen; dotnet format en pnpm lint schoon. Antagonist loopt
- 2026-09-15 17:35 · zichtbaarheid · Antagonist ronde 1: VIOLATIONS FOUND (1 MAJOR, 5 MINOR, 1 vraag). MAJOR hersteld: het doelenregister toonde de algemene fiches van elke klas; nu enkel van klassen die je mag inkijken (zelfde rij). MINOR hersteld: standaard Z7, formulering besluiten-gevraagd, (e) in grondwet en ADR-0030, klassen in /api/schooljaren gefilterd, Klaskiezer tijdens laden en na fout. Main binnengehaald: ADR-0039 was genomen (TB-023), dit besluit is nu ADR-0040. Verslag in backlog/worklogs/FB-013/antagonist.md
