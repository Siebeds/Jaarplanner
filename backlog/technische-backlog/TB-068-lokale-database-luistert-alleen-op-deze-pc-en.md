---
id: TB-068
titel: Lokale database luistert alleen op deze pc, en settings.local.json staat in de .gitignore
soort: technisch
status: klaar
prioriteit: laag
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-24 12:45
opgepakt-door: claude-tb068
branch: ticket/TB-068-db-poort-localhost
pr: 189
geblokkeerd:
fr: []
---

## Aanleiding

Gevonden bij de securityscan van 2026-09-23.

- **De lokale databank is bereikbaar vanaf het netwerk.** `docker-compose.yml:22` publiceert poort
  `${DB_HOST_PORT:-5433}:5432` op alle interfaces. Andere toestellen op hetzelfde netwerk kunnen de ontwikkeldatabank
  bereiken, met een raadbaar wachtwoord, terwijl er een kopie van echte schooldata in kan zitten.
- **`.claude/settings.local.json` staat niet in de `.gitignore` van de repo.** Het bestand wordt vandaag alleen door de
  globale gitignore van de eigenaar genegeerd. Op een andere machine kan het per ongeluk gecommit worden, en de repo is
  publiek.

## Voorgestelde wijziging

- In `docker-compose.yml` de poort alleen op `127.0.0.1` publiceren: `"127.0.0.1:${DB_HOST_PORT:-5433}:5432"`.
- `.claude/settings.local.json` toevoegen aan de `.gitignore` van de repo.
- Nagaan dat de skill `app-starten`, de integratietests en de CI nog werken; die verbinden via localhost.

## Acceptatiecriteria

- [x] Gegeven de databank gestart met `docker compose up -d db`, wanneer een ander toestel op het netwerk poort 5433 van
  deze pc probeert, dan krijgt het geen verbinding; vanaf deze pc werkt de verbinding zoals vandaag.
- [x] Gegeven een nieuw bestand `.claude/settings.local.json`, dan toont `git status` het niet.
- [x] Gegeven de backendtests en de CI, dan slagen ze zoals vandaag.

## Buiten scope

- De testcontainers van de integratietests: die kiezen hun eigen poort.

## Open vragen

Geen.

## Werklog

- 2026-09-23 00:22 · claude-securityscan · aangemaakt (status nieuw)
- 2026-09-24 12:12 · claude-tb068 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-24 12:45 · claude-tb068 · Poort op 127.0.0.1 gezet; proefcontainer uit dezelfde compose: 127.0.0.1 en localhost verbinden, het LAN-adres 192.168.0.183 wordt geweigerd (de huidige container op 0.0.0.0 antwoordt daar wel). settings.local.json negeert git nu via de repo-.gitignore.
- 2026-09-24 12:45 · claude-tb068 · Gates: unittests 2357 groen; integratietests via Host=localhost tegen de proefcontainer 613 groen, 3 GebruikerbeheerEndpointsTests ('intussen verwijderd') faalden onder load en slagen apart (44/44), los van deze wijziging; dotnet format schoon. CI gebruikt een eigen service-container en raakt docker-compose.yml niet. Geen antagonist: alleen config.
- 2026-09-24 12:45 · claude-tb068 · in-uitvoering → klaar: DB-poort alleen op 127.0.0.1, settings.local.json in .gitignore; gates groen. Bestaande container eenmalig herstarten met docker compose up -d db.
- 2026-09-24 12:45 · claude-tb068 · PR #189
