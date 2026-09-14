---
id: TB-003
titel: Demo-omgeving op Azure vullen met fictieve kleuterdata
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 12:05
opgepakt-door: demo-seed
branch: ticket/demo-seed
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De demo-omgeving op Azure ([ADR-0034](../../docs/adr/0034-demo-omgeving-op-azure.md)) heeft de Op.stap-doelen, vijf
schooljaren en zes accounts (Demo Directie en vijf leerkrachten), maar geen klassen en geen thema's. Wie de app daar
toont, ziet lege schermen. De eigenaar wil een herbruikbaar script dat de demo vult met fictieve kleuterinhoud,
zodat hij het na een reset opnieuw kan draaien.

## Voorgestelde wijziging

Een nieuw script `infra/seed-demo.ps1` met de data in `infra/seed-demo.data.json`, en een stap in `infra/README.md`.
Geen wijziging aan de broncode van de app.

- **Route: de app's eigen API, lokaal gestart tegen de demodatabase**, zodat elke domeinregel en validatie meedraait
  en alle inhoud via de API gaat. Zoals `migrate-db.ps1`: de connection string komt uit Key Vault en belandt in het
  script, de lokale API en de `az`-processen die die start voor Key Vault-tokens, de docker CLI en de psql-container;
  die stoppen allemaal met de run. De PostgreSQL-firewall staat alleen tijdens de run open voor het adres van de
  operator.
- **Geen onversleutelde sessiesleutel.** Een lokale API in Development zonder Key Vault-instelling zou een nieuwe,
  onversleutelde sessiesleutel in de demodatabase zetten, die de Azure-app daarna kan gaan gebruiken (ADR-0031
  beslissing 5 verbiedt precies dat). Het script start de API daarom met `DataProtection__KeyVaultSleutel`, zodat
  elke nieuwe sleutel ingepakt wordt of niet geschreven. Het geeft de operator voor de run *Key Vault Crypto User* op
  die ene sleutel, zodat de API de bestaande sleutel kan gebruiken en er geen nieuwe nodig heeft. Als laatste vangnet
  vergelijkt het de sleutelrijen voor en na: een nieuwe onversleutelde rij wordt verwijderd en de run eindigt met een
  fout. Dat is de enige rechtstreekse schrijfactie in de database.
- **Geheimen.** Het script bouwt de API voor het een geheim leest, en zonder build-servers. De PG-variabelen bestaan
  alleen rond elke psql-aanroep. Het weigert een werkboom met wijzigingen (tenzij `-AllowDirty`) en een database
  waarvan de nieuwste migratie verschilt van die van de checkout.
- **ADR-0034** krijgt een gedateerde aanvulling bij beslissingen 5 en 6 over deze procedure.
- **Aanmelden** via de ontwikkelaanmelding (alleen loopback, alleen Development) als de bestaande Demo Directie. Er
  wordt geen gebruiker aangemaakt of gewijzigd.
- **Wat erin komt, allemaal fictief** (Art. VI.2, ADR-0034):
  - vijf kleuterklassen in schooljaar 2026-2027, met de naam van een demoleerkracht in de klasnaam;
  - thema's die met een passende emoji beginnen, met kernwoordenschat en twee themadoelen uit de ingeladen
    G-leerplandoelen;
  - een paar subthema's per leeftijd (JK, K2, K3), met een onderzoeksvraag;
  - per klas algemene fiches en hoeken, zonder planning in de agenda.
- **Opnieuw draaien mag:** wat er al staat (klas, thema, subthema, fiche of hoek met dezelfde naam) wordt niet
  opnieuw aangemaakt. Een bestaand item krijgt alleen de doelkoppelingen uit het databestand die het nog mist, voor
  zover de API ze aanvaardt; zijn andere velden blijven zoals ze zijn.
- Alles wat het script opent (firewall, roltoewijzing, lokale API) wordt ook bij een fout weer gesloten.

## Acceptatiecriteria

- [x] Gegeven de demo zonder klassen, wanneer `infra/seed-demo.ps1` draait, dan staan er vijf kleuterklassen in 2026-2027, elk met de naam van een demoleerkracht, en thema's die met een emoji beginnen.
- [x] Gegeven een geslaagde run, wanneer het script een tweede keer draait, dan maakt het niets dubbel aan.
- [x] Gegeven een run, dan staat er erna geen nieuwe onversleutelde rij in `data_protection_keys`, eindigt de run met een fout als er een verscheen, en zijn de firewallregel en de tijdelijke roltoewijzing weer weg, ook als de run faalt.
- [ ] Gegeven de geseede demo, wanneer Demo Directie zich aanmeldt op de Azure-app, dan tonen Klassen, Thema's (met subthema's), Algemene fiches en Hoeken de nieuwe inhoud.

## Buiten scope

- De koppeling leerkracht ↔ klas: die bestaat nog niet in het model (E6-04); de naam in de klasnaam is een
  voorlopige, cosmetische stand-in.
- Het jaarplan en elke planning in de agenda (thema's in periodes, algemene fiches of hoeken op dagen): de eigenaar
  wil alleen de inhoud.
- Activiteiten, AI-suggesties en de Op.stap-import (de doelen staan er al).
- Een eigen databaserol voor de app (E7-05).

## Open vragen

Geen.

## Werklog

- 2026-09-14 11:06 · demo-seed · aangemaakt (status in-uitvoering)
- 2026-09-14 11:24 · demo-seed · script infra/seed-demo.ps1 en data infra/seed-demo.data.json geschreven; parse in PowerShell 5.1 en psql verify-full getest; antagonist loopt
- 2026-09-14 11:53 · demo-seed · eerste run faalde op de aanmelding (401: PowerShell pakte de id-array uit tot een string); opruimen werkte: tijdelijke rol weg, sessiesleutels ongewijzigd (1), firewall dicht; niets geschreven
- 2026-09-14 12:05 · demo-seed · run 0f865bf geslaagd: 5 klassen, 9 thema's (18 themadoelen), 9 subthema's (9 subdoelen), 15 fiches (15 doelen), 29 hoeken; tweede run maakte niets aan (alles found); sleutels ongewijzigd (1), rol weg, alleen AllowAllAzure-firewallregel over; criteria 1-3 afgevinkt; antagonist ronde 2: 2 MINOR over formulering, verwerkt; criterium 4 wacht op een blik van de eigenaar in de Azure-app
