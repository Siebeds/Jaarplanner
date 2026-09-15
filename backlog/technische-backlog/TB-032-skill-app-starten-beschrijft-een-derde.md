---
id: TB-032
titel: Skill app-starten beschrijft een derde ontwikkelmachine (Docker per gebruiker)
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 23:08
opgepakt-door: machine-c
branch: ticket/app-starten-machine-c
pr: 106
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar werkt nu ook op een derde pc. De skill `app-starten` kent alleen machine A (PostgreSQL als
Windows-service) en machine B (Docker Desktop in `Program Files`). Op deze derde pc past geen van beide: er stond
geen .NET, geen Node en geen `.env`, en Docker Desktop 4.91.0 staat er per gebruiker geïnstalleerd, in
`%LOCALAPPDATA%\Programs\DockerDesktop`. De Docker-engine startte niet. `docker info` gaf alleen *"request returned
500 Internal Server Error for API route"*. De echte reden (*"Virtual Machine Platform not enabled … No
virtualization available"*) stond wel in `com.docker.backend.exe.log`, maar als `[W]`-regel en niet als `[E]`-regel
zoals de skill zegt, en daarna vult dat log zich elke 45 seconden met dezelfde fout over de event streamer. Ze staat
ook in `monitor.log`.
Een volgende sessie op deze pc verliest dezelfde tijd als het recept dat niet zegt.

## Voorgestelde wijziging

Alleen `.claude/skills/app-starten/SKILL.md`:

- de machinetabel krijgt een kolom machine C, met hoe je de drie uit elkaar houdt;
- stap 2 noemt het pad van Docker Desktop per gebruiker en waar de reden van een engine die niet start echt staat;
- een korte lijst van wat een nieuwe pc nodig heeft (.NET SDK 10.0.4xx, Node 24 met corepack, WSL met Virtual
  Machine Platform, virtualisatie in de BIOS, `.env`, de user-secret, `dotnet tool restore`), met wat op machine C
  op 2026-09-15 al gedaan is;
- de tekst zegt eerlijk dat de Docker-route op machine C nog niet end to end gedraaid is.

## Acceptatiecriteria

- [x] Gegeven een sessie op machine C, wanneer ze de machinetabel bovenaan de skill volgt, dan herkent ze machine C aan het pad van Docker Desktop en niet aan een gebruikersnaam.
- [x] Gegeven een Docker-engine die niet start, wanneer een sessie stap 2 volgt, dan verwijst de skill naar `monitor.log` en naar `com.docker.backend.exe.log`, met de melding over ontbrekende virtualisatie als voorbeeld.
- [x] Gegeven een nieuwe pc zonder dev-tools, wanneer een sessie de skill leest, dan vindt ze de lijst van wat geïnstalleerd en ingesteld moet worden, met de versies die de repo vraagt (`global.json`, `engines` in `frontend/package.json`).
- [x] Gegeven de skill na deze wijziging, dan beweert ze nergens dat de app op machine C al gedraaid heeft.

## Buiten scope

De app zelf op machine C starten: dat kan pas nadat de eigenaar SVM Mode in de BIOS aanzet en herstart. Geen
wijziging aan code, `docker-compose.yml` of `.env.example`.

## Open vragen

Geen. Zodra de app op machine C end to end gedraaid heeft, zet een volgende sessie dat in de skill, zoals voor
machine B.

## Werklog

- 2026-09-15 22:45 · machine-c · aangemaakt (status in-uitvoering)
- 2026-09-15 22:48 · machine-c · Aanleiding rechtgezet: de reden staat ook in com.docker.backend.exe.log, als [W]-regel onder herhaalde event-streamer-fouten; grep 'failed to start' vindt ze op machine C. Criteria afgevinkt na nalezen van de nieuwe tekst; command -v docker en de paden gecontroleerd op machine C.
- 2026-09-15 22:48 · machine-c · in-uitvoering → klaar: Skill app-starten beschrijft machine C en wat een nieuwe pc nodig heeft. Alleen documentatie: geen tests, dotnet format of pnpm lint van toepassing, geen antagonist (geen significante wijziging).
- 2026-09-15 23:07 · machine-c · PR #106
- 2026-09-15 23:08 · machine-c · Git-identiteit in de skill rechtgezet: vraag ze aan de eigenaar; machine C gebruikt het GitHub-account dyllisd met het no-reply-adres, niet Siebeds uit de geschiedenis.
