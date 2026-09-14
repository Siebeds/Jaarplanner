---
id: TB-002
titel: Algemene fiches in de agenda plaatsen (agendahelft van E10-03)
soort: technisch
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 11:01
opgepakt-door: E10-03
branch: story/E10-03-agenda
pr:
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

Alleen frontend: de backend (`AlgemeneFicheplaatsingenController`) bestaat al en is getest.

- `features/algemene-fiches/gegevens.ts`: de plaatsingen lezen, plaatsen, weghalen en één moment verplaatsen.
- Het fichepaneel naast de agenda krijgt onder de hoekenfiches een tweede lijst: de algemene fiches van de klas,
  sleepbaar naar een dag en aanklikbaar.
- Een nieuw plaatsingsblad vraagt de periode, de weekdagen (ma tot vr) en het begin- en einduur.
- Het tijdraster (dag en week) tekent de momenten van de fiches; ze zijn te verslepen en in te korten of te verlengen.
- Een detailblad voor een geplaatste fiche: periode en uren, één moment aanpassen zonder slepen, en de hele periode
  weghalen.

## Acceptatiecriteria

- [ ] Gegeven een klas met algemene fiches, wanneer ik in de agenda het fichepaneel open, dan zie ik die fiches onder
  de hoekenfiches.
- [ ] Wanneer ik een algemene fiche op een dag in het tijdraster sleep of erop klik, dan vraagt een blad de periode,
  de weekdagen en de uren, en na Inplannen staat de fiche op elke gekozen schooldag in de dag- en weekweergave.
- [ ] Wanneer ik één moment van een geplande fiche versleep of aan de onderkant groter maak, dan wordt alleen dat
  moment bewaard; hetzelfde lukt zonder slepen, via het detailblad.
- [ ] Wanneer ik een geplande fiche weghaal, dan verdwijnen al haar momenten uit de agenda.
- [ ] Nadat een fiche met doelen voor het eerst is ingepland, telt de dekking haar doelen mee zonder de pagina te
  herladen, en in Instellingen staat niet meer "Staat nog niet in de agenda".
- [ ] Vitest en `pnpm lint` groen, gecontroleerd in een echte browser op 1440 en 390 pixels, en de antagonist heeft de
  wijziging gezien.

## Buiten scope

De maandweergave tekent geen algemene fiches (ze krijgt wel een drop, die het blad opent zonder uur). De uren van een
hele periode in één keer aanpassen: daar is geen endpoint voor. De wijziging van Art. V.1 in de grondwet: die
volgt de eigen procedure van Art. XI.1 en staat als apart vinkje bij E10-03.

## Open vragen

Geen.

## Werklog

- 2026-09-14 11:01 · E10-03 · aangemaakt (status in-uitvoering)
