---
id: TB-019
titel: Azure MCP-instelling (.mcp.json) in de repo
soort: technisch
status: klaar
prioriteit: laag
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:29
opgepakt-door: wensen-tickets
branch: ticket/mcp-json-in-repo
pr: 74
geblokkeerd:
fr: []
---

## Aanleiding

In de gedeelde checkout `C:\Source\Jaarplanner` stond een ongevolgd bestand `.mcp.json`: de instelling van de Azure
MCP-server voor Claude Code (`@azure/mcp@2.0.5` via `npx`, aanmelden met de Azure CLI). Omdat het niet gevolgd was,
hield het elke `git status` op `main` onrein, en de skill `ticket-aanmaken` vraagt een schone werkboom voor een FB-ticket.

De eigenaar besliste op 2026-09-15 het bestand in de repo te zetten, zodat elke sessie dezelfde instelling heeft. Er
staat geen geheim in: de aanmelding loopt via `az login` (`AZURE_TOKEN_CREDENTIALS=AzureCliCredential`).

## Voorgestelde wijziging

- `.mcp.json` in de root van de repo, met dezelfde inhoud als het bestand dat in de gedeelde checkout stond.
- Geen wijziging aan de broncode van de app.

## Acceptatiecriteria

- [x] Gegeven de branch, dan staat `.mcp.json` in de root, byte voor byte gelijk aan het bestand uit de gedeelde checkout.
- [x] Gegeven het bestand, dan bevat het geen sleutel, token, wachtwoord of connection string, alleen de serverinstelling
  en de keuze voor aanmelden via de Azure CLI.
- [x] Gegeven het bestand, dan is de versie van de server vastgepind (`@azure/mcp@2.0.5`), zodat een nieuwere versie een
  bewuste wijziging is.

## Buiten scope

- Andere MCP-servers.
- Instellingen in Azure zelf.

## Open vragen

Geen. Let bij de merge op: de ongevolgde kopie in `C:\Source\Jaarplanner` moet eerst weg, anders weigert `git pull` het
bestand van `main` over te nemen. Ze is gelijk aan wat hier gecommit wordt, dus er gaat niets verloren.

## Werklog

- 2026-09-15 14:11 · wensen-tickets · aangemaakt (status in-uitvoering)
- 2026-09-15 14:24 · wensen-tickets · in-uitvoering → klaar: .mcp.json toegevoegd, byte voor byte gelijk aan de kopie uit de gedeelde checkout (cmp), geen geheimen, versie vastgepind; geen broncode, dus geen tests of antagonist; criteria afgevinkt
- 2026-09-15 14:29 · wensen-tickets · PR #74
