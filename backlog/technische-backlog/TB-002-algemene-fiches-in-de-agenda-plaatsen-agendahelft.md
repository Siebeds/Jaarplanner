---
id: TB-002
titel: Algemene fiches in de agenda plaatsen (agendahelft van E10-03)
soort: technisch
status: klaar
prioriteit: hoog
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 12:38
opgepakt-door: E10-03
branch: story/E10-03-agenda
pr: 57
geblokkeerd:
fr: [FR-6.2]
---

## Aanleiding

In Instellingen kan een leerkracht algemene fiches aanmaken (onthaal, turnen) en er doelen aan koppelen, maar ze kan
ze nergens in de agenda plaatsen zoals een hoekenfiche. Daardoor tellen hun doelen ook nooit mee voor de dekking. Dit
is de agendahelft van story **E10-03** ([ADR-0029](../../docs/adr/0029-algemene-fiches.md), beslissing 7), die
wachtte op het tijdraster van E10-04; dat staat intussen op `main`.

*Een story krijgt normaal geen ticket (ADR-0033, beslissing 8). Dit ticket bestaat op uitdrukkelijke vraag van de
eigenaar (2026-09-14: "ik wil ook zien in het kanban board dat je hier mee bezig bent"). De story blijft de bron:
haar vinkjes in `backlog/E10-eigenaarsvergadering.md` worden mee afgevinkt.*

## Voorgestelde wijziging

Vooral frontend: de endpoints (`AlgemeneFicheplaatsingenController`) bestaan al en zijn getest. Eén regel in de
backend komt erbij, omdat dit scherm hem voor het eerst bereikbaar maakt: één moment verplaatsen weigert een dag
zonder school (`AlgemeneFicheplaatsing.VerplaatsMoment`), zoals het inplannen al deed.

- `features/algemene-fiches/gegevens.ts`: de plaatsingen lezen, plaatsen, weghalen en één moment verplaatsen.
- Een tweede schakelaar in de zijbalk (en een tweede chip op een telefoon), *Algemene fiches*, opent een eigen paneel
  met de algemene fiches van de klas, sleepbaar naar een dag en aanklikbaar. Niet gegroepeerd met de hoekenfiches:
  zo besliste de eigenaar op 2026-09-14, na een eerste versie met één paneel *Fiches* voor beide.
- Een nieuw plaatsingsblad vraagt de periode, de weekdagen (ma tot vr) en het begin- en einduur.
- Het tijdraster (dag en week) tekent de momenten van de fiches; ze zijn te verslepen en in te korten of te verlengen.
- Een detailblad voor een geplaatste fiche: periode en uren, één moment aanpassen zonder slepen, en de hele periode
  weghalen.

## Acceptatiecriteria

- [x] Gegeven een klas met algemene fiches, wanneer ik in de agenda op *Algemene fiches* klik (in de zijbalk, of de
  chip op een telefoon), dan zie ik die fiches in een eigen paneel, los van de hoekenfiches.
- [x] Wanneer ik een algemene fiche op een dag in het tijdraster sleep of erop klik, dan vraagt een blad de periode,
  de weekdagen en de uren, en na Inplannen staat de fiche op elke gekozen schooldag in de dag- en weekweergave.
- [x] Wanneer ik één moment van een geplande fiche versleep of aan de onderkant groter maak, dan wordt alleen dat
  moment bewaard; hetzelfde lukt zonder slepen, via het detailblad.
- [x] Wanneer ik een geplande fiche weghaal, dan verdwijnen al haar momenten uit de agenda.
- [x] Nadat een fiche met doelen voor het eerst is ingepland, telt de dekking haar doelen mee zonder de pagina te
  herladen, en in Instellingen staat niet meer "Staat nog niet in de agenda".
- [x] Vitest en `pnpm lint` groen, gecontroleerd in een echte browser op 1440 en 390 pixels, en de antagonist heeft de
  wijziging gezien.

## Buiten scope

De maandweergave tekent geen algemene fiches (ze krijgt wel een drop, die het blad opent zonder uur). De uren van een
hele periode in één keer aanpassen: daar is geen endpoint voor. De wijziging van Art. V.1 zelf: die staat al op
`main` (`7fc20bc`, 2026-09-11).

## Open vragen

Geen.

## Werklog

- 2026-09-14 11:01 · E10-03 · aangemaakt (status in-uitvoering)
- 2026-09-14 11:16 · E10-03 · Frontend gebouwd: fichepaneel met algemene fiches, plaatsingsblad, detailblad en momenten in het tijdraster; pnpm lint schoon, Vitest 247/247 groen.
- 2026-09-14 11:26 · E10-03 · Browsercontrole 1440: plaatsen via slepen, blokken in de week, dekking 0 naar 1 van 14 zonder herladen, één dag aanpassen via het detailblad werkt. Antagonist ronde 1: VIOLATIONS FOUND (2 MAJOR, 5 MINOR, 2 vragen); herstel loopt.
- 2026-09-14 11:40 · E10-03 · Eigenaar 2026-09-14: geen gegroepeerd paneel 'Fiches', maar twee aparte schakelaars in de zijbalk (Hoekenfiches en Algemene fiches), elk met een eigen lijst. Omgebouwd.
- 2026-09-14 11:46 · E10-03 · Criteria 1 tot 5 afgevinkt op bewijs: browser 1440 en 390 (twee schakelaars, slepen en klikken naar het blad, ma en wo sep tot jun geschreven zonder herfstvakantie, één dag aanpassen zonder slepen, vakantiedag en zaterdag geweigerd, weghalen haalt alle momenten weg, dekking 0 naar 1 naar 0 van 14, Instellingen zegt 'Staat 1 keer in de agenda'); Vitest 256/256, backend unit 1133 en integratie 357 op PostgreSQL groen. Criterium 1 herschreven naar de beslissing van de eigenaar (twee schakelaars).
- 2026-09-14 11:56 · E10-03 · Antagonist ronde 2: geen MAJOR meer, 4 MINOR opgelost (serverzin en nl.json-tweeling vastgepind, ADR-0029 beslissing 7 aangevuld met de beslissing van de eigenaar, foutmelding in plaats van 'nog geen fiches' bij een mislukte lijst, commentaar rechtgezet); de 390-controle was gebeurd. Vitest 257/257, lint schoon, backend unit groen. Ronde 3 loopt.
- 2026-09-14 12:07 · E10-03 · Antagonist ronde 3: 2 MINOR opgelost (een mislukte verversing verbergt de geladen lijst niet meer, met test; de aanvulling in ADR-0029 klopt nu ook voor de telefoon). Vitest 258/258, lint schoon. Laatste ronde loopt.
- 2026-09-14 12:14 · E10-03 · in-uitvoering → klaar: Klaar: algemene fiches plannen in de agenda met een eigen schakelaar naast Hoekenfiches, plaatsingsblad (periode, weekdagen, uren), detailblad en momenten in het tijdraster, plus de schooldagregel bij één moment verplaatsen. Poorten groen: Vitest 258/258, lint, backend unit 1133 en integratie 357 op PostgreSQL, browser 1440 en 390, antagonist ronde 4 COMPLIANT.
- 2026-09-14 12:35 · E10-03 · PR #57
- 2026-09-14 12:38 · E10-03 · Eigenaar 2026-09-14: dit ticket voor een story was eenmalig. ADR-0033 beslissing 8 blijft staan: een story krijgt normaal geen ticket; dit ticket is geen precedent.
