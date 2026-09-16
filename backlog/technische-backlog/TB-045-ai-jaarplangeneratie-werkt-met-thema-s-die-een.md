---
id: TB-045
titel: AI-jaarplangeneratie werkt met thema's die een eigen begin- en einddatum hebben
soort: technisch
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 22:51
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Sinds FB-035 krijgt een thema in het jaarplan een eigen begin- en einddatum, lopen twee thema's nooit op dezelfde dag
en zijn de themaperiodes uit de planning verdwenen ([ADR-0049](../../docs/adr/0049-themaplaatsing-met-eigen-datums.md)).
De AI-generatie dacht in themaperiodes en zette soms meerdere thema's in één periode. De eigenaar besliste op
2026-09-16 dat ze in een apart ticket herwerkt wordt en tot dan uitstaat: de knop "Genereer jaarplan" is
uitgeschakeld en `POST …/jaarplan/generatie` antwoordt 409.

## Voorgestelde wijziging

- Een nieuwe generatierun in `JaarplanGeneratieService` die thema's voorstelt met een begindatum. Het einde volgt uit
  `Themakalender.VoorgesteldEinde`, de run splitst bij vakanties en weigert overlap, net als een manuele plaatsing.
  Voorstellen worden bewaard als `Voorgesteld`, met motivatie.
- Het promptcontract (`JaarplanGeneratiePromptBuilder`, `JaarplanGeneratieResponseParser`) gaat van
  "planningsblok → thema's" naar "thema → begindatum". Beslis of de `IPlanningsblokIndeling`-naad nog nodig is als
  hint voor het model, of verwijderd wordt.
- Wat bewaarde startthema's en vaste momenten betekenen voor datums (Art. IX.3; een vast moment blokkeert
  vandaag niets).
- Het rapport na een run (wat nieuw is, wat bleef, wat niet paste), en het deels hergenereren (FR-8.2) als dat nog
  gewenst is.
- De generatie weer aanzetten: de knop op het planscherm en het endpoint.
- De verwijderde runcode staat in de git-geschiedenis vóór de FB-035-merge (`JaarplanGeneratieService`,
  `Spreidingsrapport`, `ParameterRapport`, `JaarplanGeneratieResultaat`).

## Acceptatiecriteria

- [ ] Gegeven een klas met een leeg jaarplan, wanneer de leerkracht een jaarplan genereert, dan staan er thema's met
  eigen datums als voorstel in, zonder twee thema's op dezelfde dag en gesplitst rond vakanties.
- [ ] Gegeven een jaarplan met manuele of aanvaarde thema's, wanneer de leerkracht opnieuw genereert, dan blijven die
  staan en komen er alleen voorstellen bij op vrije dagen.
- [ ] Gegeven een AI-antwoord dat niet geldig is, dan wordt er niets bewaard en ziet de leerkracht een melding.
- [ ] De knop "Genereer jaarplan" staat weer aan en het endpoint antwoordt niet meer 409.

## Buiten scope

- Het manuele plannen met datums (FB-035).
- De AI-kosten en -caching (TB-043).

## Open vragen

- Moet het hergenereren van een deel van het jaar (FR-8.2) terugkomen, en voor welk stuk: een datumbereik?
- Wat doen bewaarde startthema's en vaste momenten met datums? De eigenaar besliste dat een vast moment niets
  blokkeert en alleen een vakantie een thema onderbreekt.

## Werklog

- 2026-09-16 22:51 · fb035-datums · aangemaakt (status nieuw)
