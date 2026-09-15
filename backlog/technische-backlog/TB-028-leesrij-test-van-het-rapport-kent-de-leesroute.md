---
id: TB-028
titel: Leesrij-test van het rapport kent de leesroute van de kindtekening
soort: technisch
status: klaar
prioriteit: hoog
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 20:19
opgepakt-door: kindtekening
branch: ticket/TB-028-rapportleesrij-tekening
pr: 100
geblokkeerd:
fr: []
---

## Aanleiding

FB-005 (kindtekening) en FB-008 (Leerlingzorg) zijn kort na elkaar gemerged. Sindsdien faalt de backend-check op
`main`: `RapportleesrijTests` (FB-008) laat het leesrecht van het rapport (`OntwikkelingsrapportLezen`) op precies twee
routes toe, en FB-005 voegde er een derde aan toe, de afbeelding van de tekening. Elke nieuwe PR krijgt zo een rode
backend-check.

## Voorgestelde wijziging

- De tekeningroute (`GET …/rapporten/{moment}/tekening`) komt bij de leesroutes van `RapportleesrijTests`, met de reden
  erbij: de tekening is een deel van het rapport (Art. VI.7), Leerlingzorg leest het rapport (R18), en de tekening tonen
  op het rapportscherm is lezen, geen downloaden (D5 gaat over de download van FB-006).
- Een integratietest in `KindtekeningEndpointsTests` bewijst dat Leerlingzorg de tekening ziet en ze niet kan
  vervangen of verwijderen.

## Acceptatiecriteria

- [x] Gegeven `main` met FB-005 en FB-008, wanneer de backendtests draaien, dan slaagt `RapportleesrijTests`.
- [x] Gegeven een rapport met een tekening, wanneer een gebruiker met Leerlingzorg het adres van de tekening opent, dan
  ziet die de tekening; vervangen of verwijderen weigert de app.
- [x] Gegeven een nieuwe route die het leesrecht van het rapport draagt (zoals een download), dan faalt
  `RapportleesrijTests` nog altijd tot die route een eigen recht krijgt.

## Buiten scope

- De download van het rapport (FB-006) en welk recht die krijgt.

## Open vragen

Geen.

## Werklog

- 2026-09-15 20:01 · kindtekening · aangemaakt (status in-uitvoering)
- 2026-09-15 20:15 · kindtekening · in-uitvoering → klaar: leesrij-test kent nu drie leesroutes (met de tekening); nieuwe test: Leerlingzorg ziet de tekening en wijzigt ze niet; backend unit 1749 en integratie 541 groen, 0 gefaald; format schoon; geen antagonist: alleen een testlijst, de route zelf werd in FB-005 geauditeerd
- 2026-09-15 20:19 · kindtekening · PR #100
