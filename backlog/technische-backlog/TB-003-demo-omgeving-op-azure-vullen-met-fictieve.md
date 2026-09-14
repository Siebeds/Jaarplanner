---
id: TB-003
titel: Demo-omgeving op Azure vullen met fictieve kleuterdata
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 11:06
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
  en er geen SQL rechtstreeks in de tabellen gaat. Zoals `migrate-db.ps1`: de connection string komt uit Key Vault en
  staat alleen in de omgeving van het proces, en de PostgreSQL-firewall staat alleen tijdens de run open voor het
  adres van de operator.
- **De sessiesleutels blijven ongemoeid.** Een lokale API in Development kan de sessiesleutel in
  `data_protection_keys` niet openen zonder de Key Vault-sleutel, en zou dan een nieuwe, onversleutelde sleutel in
  de demodatabase zetten, die de Azure-app daarna kan gaan gebruiken (ADR-0031 beslissing 5 verbiedt precies dat).
  Het script geeft daarom de operator tijdelijk *Key Vault Crypto User* op die ene sleutel, start de API met
  `DataProtection__KeyVaultSleutel`, en telt de sleutels voor en na de run: verandert het aantal, dan stopt het met
  een fout.
- **Aanmelden** via de ontwikkelaanmelding (alleen loopback, alleen Development) als de bestaande Demo Directie. Er
  wordt geen gebruiker aangemaakt of gewijzigd.
- **Wat erin komt, allemaal fictief** (Art. VI.2, ADR-0034):
  - vijf kleuterklassen in schooljaar 2026-2027, met de naam van een demoleerkracht in de klasnaam;
  - thema's die met een passende emoji beginnen, met kernwoordenschat en twee themadoelen uit de ingeladen
    G-leerplandoelen;
  - een paar subthema's per leeftijd (JK, K2, K3), met een onderzoeksvraag;
  - per klas algemene fiches en hoeken, zonder planning in de agenda.
- **Opnieuw draaien mag:** wat er al staat (klas, thema, subthema, fiche of hoek met dezelfde naam) wordt
  overgeslagen, niet dubbel aangemaakt.
- Alles wat het script opent (firewall, roltoewijzing, lokale API) wordt ook bij een fout weer gesloten.

## Acceptatiecriteria

- [ ] Gegeven de demo zonder klassen, wanneer `infra/seed-demo.ps1` draait, dan staan er vijf kleuterklassen in 2026-2027, elk met de naam van een demoleerkracht, en thema's die met een emoji beginnen.
- [ ] Gegeven een geslaagde run, wanneer het script een tweede keer draait, dan maakt het niets dubbel aan.
- [ ] Gegeven een run, dan is het aantal rijen in `data_protection_keys` erna gelijk aan dat ervoor, en zijn de firewallregel en de tijdelijke rolverdeling weer weg, ook als de run faalt.
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
