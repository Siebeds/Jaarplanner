---
id: TB-065
titel: Weekplanning toont een eigen activiteit alleen aan wie ze mag lezen
soort: technisch
status: nieuw
prioriteit: laag
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 00:22
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Gevonden bij de securityscan van 2026-09-23. Een eigen activiteit (ADR-0049) mag gelezen worden volgens de regel
`EigenActiviteitLezen`: door haar eigenaar, de collega's van haar jaarfase en een admin. De themaweergave houdt zich
daaraan (`SchoolcontentBeheerService`, en `ThemaDoelenoverzicht` filtert met `!IsEigen`).

De weekplanning niet. `WeekplanningService.ProjecteerAsync` (`Application/Planning/Weekplanning/WeekplanningService.cs`)
geeft de naam en de doelcodes van elke ingeplande activiteit, eigen activiteiten inbegrepen, aan iedereen die
`KlasplanningBekijken` heeft. Dat is ook themabeheer voor elke klas, en een leerkracht van een oude klas zonder
einddatum. Die zien zo de eigen activiteit van een leerkracht buiten hun jaarfase.

Het kan zijn dat dit zo bedoeld is: volgens ADR-0040 leest wie de planning van een klas mag lezen, de hele planning.

## Voorgestelde wijziging

Afhankelijk van het besluit van de eigenaar:

- **Als de weekplanning de regel van ADR-0049 moet volgen:** `ProjecteerAsync` toont naam en doelen van een ingeplande
  eigen activiteit alleen aan wie `EigenActiviteitLezen` heeft. Anderen zien op hetzelfde moment een neutraal blok
  ("Eigen activiteit"), zodat de planning klopt zonder de inhoud te tonen.
- **Als ADR-0040 voorgaat:** geen codewijziging, wel een zin in ADR-0049 dat een ingeplande eigen activiteit in de
  weekplanning zichtbaar is voor wie de klasplanning leest.

## Acceptatiecriteria

- [ ] Gegeven het besluit van de eigenaar, dan staat in ADR-0049 of in een nieuw ADR wie een ingeplande eigen
  activiteit in de weekplanning ziet.
- [ ] Gegeven dat besluit, wanneer themabeheer buiten de jaarfase de weekplanning opent van een klas met een ingeplande
  eigen activiteit, dan ziet die precies wat het besluit zegt, en een test legt dat vast.
- [ ] Gegeven de eigenaar van de activiteit of een collega van haar jaarfase, dan ziet die de activiteit zoals vandaag.

## Buiten scope

- Wie een eigen activiteit mag bewerken: dat blijft zoals ADR-0049 het zegt.
- De rechten op de klasplanning zelf (ADR-0040).

## Open vragen

- **Voor de eigenaar:** mag wie de planning van een klas leest, daarin ook de naam en de doelen zien van een eigen
  activiteit van een leerkracht, ook als die lezer buiten haar jaarfase valt (themabeheer, een oude klas)? Tot dit
  beslist is, bouwt niemand dit ticket.

## Werklog

- 2026-09-23 00:22 · claude-securityscan · aangemaakt (status nieuw)
