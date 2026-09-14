---
id: TB-008
titel: migrate-db.ps1 bouwt voor het het databasewachtwoord leest
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 12:58
opgepakt-door: demo-seed
branch: ticket/migrate-db-build-first
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Bij TB-003 vond de antagonist dat `infra/migrate-db.ps1` het databasewachtwoord in de omgeving zet en `dotnet ef`
daarna zelf laat bouwen. De build-servers die daarbij starten (MSBuild-nodes en de compilerserver) blijven na het
script draaien en houden het wachtwoord in hun omgeving. Het is het beheerderswachtwoord van de demodatabase, en
volgens [ADR-0034](../../docs/adr/0034-demo-omgeving-op-azure.md) beslissing 6 is juist dat wachtwoord wat andere
Azure-adressen buitenhoudt. `infra/seed-demo.ps1` doet het sinds TB-003 al goed; dit ticket trekt `migrate-db.ps1`
gelijk.

## Voorgestelde wijziging

`infra/migrate-db.ps1`, en een gedateerde aanvulling bij beslissing 5 van ADR-0034:

- de API bouwen met `dotnet build --disable-build-servers` **voor** de connection string uit Key Vault gelezen wordt;
- `dotnet ef database update --no-build`, zodat er niets compileert terwijl het wachtwoord in de omgeving staat;
- `MSBUILDDISABLENODEREUSE` zetten zolang het wachtwoord er staat: `dotnet-ef` evalueert de projecten nog met
  MSBuild, en zonder die instelling kan dat op een herbruikbaar MSBuild-proces van een andere sessie gebeuren;
- de beschrijving bovenaan het script aanpassen;
- in ADR-0034 vastleggen welke processen het wachtwoord tijdens een migratie zien.

Bewust niet `dotnet build-server shutdown`: dat stopt ook de build-servers van andere sessies op deze pc. Een
bijkomend gevolg: een verse checkout heeft geen aparte `dotnet restore` meer nodig, want de build herstelt de
pakketten zelf.

## Acceptatiecriteria

- [x] Gegeven een verse checkout, wanneer `migrate-db.ps1` draait, dan bouwt het de API zonder aparte `dotnet restore`, en dat voor het de connection string leest.
- [x] Gegeven een run, dan start het script geen build-server (geen MSBuild-node of compilerserver) die na het script blijft draaien.
- [x] Gegeven de demo zonder openstaande migraties, wanneer het script draait, dan eindigt het zonder fout, past het geen migratie toe en is de tijdelijke firewallregel daarna weg.

## Buiten scope

- `infra/seed-demo.ps1`: dat doet het al zo sinds TB-003.
- Een eigen databaserol voor de app, zodat het beheerderswachtwoord alleen nog voor migraties dient (E7-05).

## Open vragen

Geen.

## Werklog

- 2026-09-14 12:23 · demo-seed · aangemaakt (status in-uitvoering)
- 2026-09-14 12:39 · demo-seed · getest op een verse checkout (geen bin/obj): build zonder aparte restore, EF 'No migrations were applied', firewallregel weer weg; tweede run met procesboomvolging: geen MSBuild-node, compilerserver, dotnet-ef- of API-proces van het script bleef draaien; criteria afgevinkt; antagonist loopt
- 2026-09-14 12:58 · demo-seed · antagonist: 3 MINOR, verwerkt: MSBUILDDISABLENODEREUSE zolang het wachtwoord gezet is (dotnet-ef evalueert nog met MSBuild), ADR-0034 beslissing 5 aangevuld, en bewijs voor --no-build: dotnet-ef laadt Jaarplanner.Api/bin/Debug/net10.0 (ook Infrastructure.dll) en 'migrations list --no-build' gaf dezelfde 25 migraties als de broncode; het oude script faalde op een verse checkout (NETSDK1004); herhaalde run na de fix: geen migraties toegepast, omgeving hersteld, firewall schoon
- 2026-09-14 12:58 · demo-seed · in-uitvoering → klaar: migrate-db.ps1 bouwt voor het wachtwoord gelezen wordt, zonder build-servers, EF met --no-build en zonder MSBuild-nodehergebruik; ADR-0034 aangevuld; gates: antagonist verwerkt, runs tegen de demo zonder openstaande migraties
