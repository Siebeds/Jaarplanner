---
id: TB-027
titel: Test Z1_Z6 vergelijkt klassen in een vaste volgorde en faalt daardoor willekeurig
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 19:57
opgepakt-door: woordweb
branch: ticket/flaky-z1z6
pr: 97
geblokkeerd:
fr: []
---

## Aanleiding

De integratietest `RechtenAfdwingingTests.Een_leerkracht_leest_de_klassen_van_haar_jaarfase_ook_van_vorig_jaar_en_geen_andere_Z1_Z6`
faalt ongeveer de helft van de keren, ook op `main`. Op 2026-09-15 maakte hij de backend-gates van PR #94 (FB-036) rood,
terwijl dezelfde commit in een tweede CI-run slaagde. Lokaal faalde hij één keer op drie, los gedraaid. Een rode gate
die niets met de wijziging te maken heeft, kost elke PR een herstart en maakt een echte fout moeilijker te zien.

## Voorgestelde wijziging

Regel 426 vergelijkt `[K3Blauw, K3Groen]`, in de volgorde waarin de klassen aangemaakt werden, met de klassen van het
schooljaar gesorteerd op hun GUID (`.Order()`). Omdat een GUID willekeurig is, klopt die volgorde maar in de helft van
de gevallen. De test sorteert voortaan beide kanten voor de vergelijking. Alleen
`backend/tests/Jaarplanner.IntegrationTests/Postgres/RechtenAfdwingingTests.cs` verandert.

## Acceptatiecriteria

- [x] Gegeven de test Z1_Z6, wanneer hij tien keer na elkaar draait tegen PostgreSQL, dan slaagt hij elke keer.
- [x] De test controleert nog altijd dat de leerkracht in het lopende schooljaar precies K3 blauw en K3 groen ziet.

## Buiten scope

De regel die de test bewaakt (ADR-0040) en de code van het klassenoverzicht veranderen niet.

## Open vragen

Geen.

## Werklog

- 2026-09-15 19:51 · woordweb · aangemaakt (status in-uitvoering)
- 2026-09-15 19:56 · woordweb · in-uitvoering → klaar: beide kanten gesorteerd voor de vergelijking; test 10 van 10 groen tegen PostgreSQL, dotnet format schoon
- 2026-09-15 19:57 · woordweb · PR #97
