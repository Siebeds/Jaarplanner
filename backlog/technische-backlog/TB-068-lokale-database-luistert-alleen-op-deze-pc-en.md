---
id: TB-068
titel: Lokale database luistert alleen op deze pc, en settings.local.json staat in de .gitignore
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

- [ ] Gegeven de databank gestart met `docker compose up -d db`, wanneer een ander toestel op het netwerk poort 5433 van
  deze pc probeert, dan krijgt het geen verbinding; vanaf deze pc werkt de verbinding zoals vandaag.
- [ ] Gegeven een nieuw bestand `.claude/settings.local.json`, dan toont `git status` het niet.
- [ ] Gegeven de backendtests en de CI, dan slagen ze zoals vandaag.

## Buiten scope

- De testcontainers van de integratietests: die kiezen hun eigen poort.

## Open vragen

Geen.

## Werklog

- 2026-09-23 00:22 · claude-securityscan · aangemaakt (status nieuw)
