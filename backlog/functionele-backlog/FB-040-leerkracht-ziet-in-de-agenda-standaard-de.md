---
id: FB-040
titel: Leerkracht ziet in de agenda standaard de werkweek, zonder zaterdag en zondag
soort: functioneel
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-17 00:05
opgepakt-door: claude-4de79c75
branch: ticket/FB-040-werkweek
pr:
geblokkeerd:
fr: [FR-6.3]
---

## Aanleiding

De agenda opent vandaag op de week (TB-012): zeven dagen naast elkaar, zaterdag en zondag inbegrepen. Een leerkracht
plant vrijwel alles van maandag tot vrijdag, dus twee van de zeven kolommen zijn meestal leeg en de schooldagen worden
er smaller door. De eigenaar wil een werkweek die groter en overzichtelijker is, zonder de week te verliezen: in het
weekend moet nog iets gepland kunnen worden.

Keuzes van de eigenaar (2026-09-15): de agenda opent **altijd** op de werkweek; op een telefoon toont de werkweek
**3 dagen zonder weekend**; staat er in het weekend iets gepland, dan toont de werkweek **een korte aanwijzing**.

## Gewenst gedrag

- Naast Maand, Week en Dag komt een weergave **Werkweek**: maandag tot vrijdag, zonder zaterdag en zondag, zodat de
  schooldagen meer plaats krijgen.
- De agenda opent altijd op de werkweek, ook als de leerkracht de vorige keer een andere weergave koos.
- **Week** blijft bestaan zoals nu, met zaterdag en zondag, zodat een leerkracht nog iets in het weekend kan plannen.
- Vorige en Volgende in de werkweek gaan naar de vorige of volgende maandag tot vrijdag.
- Op een telefoon toont de werkweek 3 dagen naast elkaar, zoals de week nu, maar zaterdag en zondag worden overgeslagen:
  na vrijdag komt maandag.
- Staat er iets gepland op een zaterdag of zondag die de werkweek overslaat, dan toont de werkweek een korte aanwijzing
  met hoeveel, en een link die die week in de weekweergave opent.

## Acceptatiecriteria

- [ ] Gegeven een leerkracht die de agenda opent via de zijbalk, dan staat Werkweek aangeduid en toont de agenda maandag
  tot vrijdag, zonder zaterdag en zondag.
- [ ] Gegeven de werkweek, wanneer de leerkracht Week kiest, dan ziet ze maandag tot zondag en kan ze op zaterdag een
  activiteit plannen; opent ze de agenda later opnieuw, dan staat Werkweek weer aangeduid.
- [ ] Gegeven de werkweek, wanneer de leerkracht op Volgende klikt, dan toont de agenda maandag tot vrijdag van de
  volgende week.
- [ ] Gegeven een activiteit op zaterdag, wanneer de leerkracht die week in de werkweek bekijkt, dan ziet ze een
  aanwijzing met het aantal, en de link erin opent die week in de weekweergave.
- [ ] Gegeven een telefoon (~390px), wanneer de leerkracht in de werkweek bladert, dan ziet ze telkens 3 dagen en nooit
  een zaterdag of zondag.
- [ ] Gegeven de werkweek op desktop en op ~390px, dan zijn alle teksten Nederlands en haalt het scherm WCAG 2.2 AA.

## Testscenario's

1. Meld aan als leerkracht en open Agenda via de zijbalk. Werkweek staat aangeduid; je ziet maandag tot vrijdag, met
   bredere dagen dan in Week.
2. Klik op Volgende. Je ziet maandag tot vrijdag van de volgende week.
3. Kies Week. Zaterdag en zondag verschijnen. Plan een activiteit op zaterdag.
4. Kies Werkweek. Zaterdag is weg, en een aanwijzing meldt 1 activiteit in het weekend. Klik op de link: dezelfde week
   opent in Week, met de activiteit op zaterdag.
5. Ga naar een ander scherm en open de agenda opnieuw. Werkweek staat weer aangeduid.
6. Herhaal op een telefoon (~390px). Je ziet 3 dagen; blader verder tot over een weekend: na vrijdag komt maandag.

## Buiten scope

- De maand- en de dagweergave veranderen niet.
- De laatst gekozen weergave onthouden: niet gekozen (eigenaar, 2026-09-15).
- Per school instellen welke dagen de werkweek telt: de werkweek is maandag tot vrijdag, zoals de schooluren (FB-023).

## Open vragen

Geen.

## Werklog

- 2026-09-15 22:56 · claude · aangemaakt (status nieuw)
- 2026-09-16 23:54 · claude-4de79c75 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten (/ticket-uitvoeren FB-040)
- 2026-09-17 00:05 · claude-4de79c75 · Werkweek gebouwd (Maand, Week, Werkweek, Dag), opent standaard; weekendaanwijzing telt activiteiten en algemene fiches apart; vitest 1036 groen, lint groen
