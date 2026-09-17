---
id: TB-053
titel: AI-jaarplangeneratie werkt met thema's die een eigen begin- en einddatum hebben
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-17 09:12
opgepakt-door: tb053-generatie
branch: ticket/TB-053-ai-generatie-met-datums
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Sinds FB-035 krijgt een thema in het jaarplan een eigen begin- en einddatum, lopen twee thema's nooit op dezelfde dag
en zijn de themaperiodes uit de planning verdwenen ([ADR-0053](../../docs/adr/0053-themaplaatsing-met-eigen-datums.md)).
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
- Bewaard maar nu zonder aanroeper, voor dit ticket om te gebruiken of op te ruimen:
  `IJaarplanOpslag.ProbeerGeneratieparametersToeTeVoegenAsync`, `BestaandePlaatsing` en
  `JaarplanGeneratiePromptBuilder.BouwVoorPeriode` (het hergenereren per periode bestaat niet meer), en de naad
  `IPlanningsblokIndeling` met haar configuratie `Planning:Blokindeling`.
- De tekst van Art. I.1 punt 4 en 6 ("regenerate the whole plan or a single period") aanpassen aan wat de generatie
  dan doet.

## Acceptatiecriteria

- [x] Gegeven een klas met een leeg jaarplan, wanneer de leerkracht een jaarplan genereert, dan staan er thema's met
  eigen datums als voorstel in, zonder twee thema's op dezelfde dag en gesplitst rond vakanties.
- [x] Gegeven een jaarplan met manuele of aanvaarde thema's, wanneer de leerkracht opnieuw genereert, dan blijven die
  staan en komen er alleen voorstellen bij op vrije dagen.
- [x] Gegeven een AI-antwoord dat niet geldig is, dan wordt er niets bewaard en ziet de leerkracht een melding.
- [x] De knop "Genereer jaarplan" staat weer aan en het endpoint antwoordt niet meer 409.

## Buiten scope

- Het manuele plannen met datums (FB-035).
- De AI-kosten en -caching (TB-043).

## Open vragen

Beantwoord door de eigenaar op 2026-09-17:

- **Datums:** het model kiest thema's en voor elk een startweek uit de vrije lesweken, met oog voor het seizoen. De
  server zet het thema op de eerste vrije schooldag vanaf die week, berekent het einde met `Themakalender` en splitst
  rond vakanties. Botst het met een thema dat al staat, dan kort de server het in tot vóór die dag. Past het niet, dan
  meldt het rapport het als "paste niet".
- **Deels hergenereren (FR-8.2):** komt niet terug. Opnieuw genereren vult het hele jaar, alleen op vrije dagen;
  aanvaarde, manuele en vergrendelde thema's blijven staan.
- **Startthema's en vaste momenten (FR-5.4):** worden opgeruimd: tabel, endpoint en code. Het jaarplan zelf is de
  enige sturing.

## Werklog

- 2026-09-16 22:51 · fb035-datums · aangemaakt (status nieuw)
- 2026-09-17 08:30 · tb053-generatie · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-17 08:37 · tb053-generatie · eigenaar besliste: AI kiest thema's en startweek, server plaatst op vrije dagen; alleen het hele jaar hergenereren (FR-8.2 vervalt); startthema's en vaste momenten worden opgeruimd (FR-5.4 vervalt)
- 2026-09-17 08:59 · tb053-generatie · generatie herbouwd (startweek + kalender), parameters en planningsblokken opgeruimd met migratie, knop weer aan; ADR-0055; backend-, Postgres- en frontendtests groen
- 2026-09-17 09:04 · tb053-generatie · antagonist ronde 1: 1 MAJOR (Art. IV.5 beschreef het oude antwoordformaat) opgelost; MINORs verwerkt (II.1-voorbeeld, standaardregels gemarkeerd in ADR-0055, jaareindetest, FA-volgorde)
- 2026-09-17 09:05 · tb053-generatie · antagonist ronde 2: COMPLIANT
- 2026-09-17 09:12 · tb053-generatie · browsercontrole (Playwright, wegwerpdatabase, nep-AI): 7/7 geslaagd na fix dat een deels aanvaard thema heel blijft; criteria afgevinkt op unit-, integratie- en browsertests
- 2026-09-17 09:12 · tb053-generatie · in-uitvoering → klaar: AI-generatie met datums gebouwd (ADR-0055), parameters en planningsblokken opgeruimd, knop aan; tests, lint, format, antagonist (COMPLIANT) en browsercontrole groen
