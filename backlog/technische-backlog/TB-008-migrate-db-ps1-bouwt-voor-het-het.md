---
id: TB-008
titel: migrate-db.ps1 bouwt voor het het databasewachtwoord leest
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 12:23
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

Alleen `infra/migrate-db.ps1`:

- de API bouwen met `dotnet build --disable-build-servers` **voor** de connection string uit Key Vault gelezen wordt;
- `dotnet ef database update --no-build`, zodat er niets bouwt terwijl het wachtwoord in de omgeving staat;
- de beschrijving bovenaan het script aanpassen.

Bewust niet `dotnet build-server shutdown`: dat stopt ook de build-servers van andere sessies op deze pc. Een
bijkomend gevolg: een verse checkout heeft geen aparte `dotnet restore` meer nodig, want de build herstelt de
pakketten zelf.

## Acceptatiecriteria

- [ ] Gegeven een verse checkout, wanneer `migrate-db.ps1` draait, dan bouwt het de API zonder aparte `dotnet restore`, en dat voor het de connection string leest.
- [ ] Gegeven een run, dan start het script geen build-server (geen MSBuild-node of compilerserver) die na het script blijft draaien.
- [ ] Gegeven de demo zonder openstaande migraties, wanneer het script draait, dan eindigt het zonder fout, past het geen migratie toe en is de tijdelijke firewallregel daarna weg.

## Buiten scope

- `infra/seed-demo.ps1`: dat doet het al zo sinds TB-003.
- Een eigen databaserol voor de app, zodat het beheerderswachtwoord alleen nog voor migraties dient (E7-05).

## Open vragen

Geen.

## Werklog

- 2026-09-14 12:23 · demo-seed · aangemaakt (status in-uitvoering)
