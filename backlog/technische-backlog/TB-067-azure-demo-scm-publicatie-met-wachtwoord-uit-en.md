---
id: TB-067
titel: Azure-demo: SCM-publicatie met wachtwoord uit en purge protection op de Key Vault
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

Gevonden bij de securityscan van 2026-09-23, in `infra/main.bicep`:

- **SCM-publicatie met gebruikersnaam en wachtwoord staat nog aan.** FTP staat uit (`ftpsState: 'Disabled'`), maar er
  is geen `basicPublishingCredentialsPolicies` `scm` met `allow: false`. Wie een publicatieprofiel in handen krijgt, kan
  code op de demo zetten.
- **De Key Vault heeft geen purge protection.** Soft delete staat op 7 dagen, maar wie rechten op de vault heeft, kan de
  sleutel `dataprotection` definitief verwijderen. Dan zijn alle sessies ongeldig en kan de app de sessiesleutels niet
  meer lezen.

## Voorgestelde wijziging

- In `infra/main.bicep` de resources `basicPublishingCredentialsPolicies` `scm` en `ftp` met `allow: false` voor de web
  app.
- `enablePurgeProtection: true` op de Key Vault. Dat is onomkeerbaar: zo'n vault kan niet binnen de bewaartermijn
  definitief verwijderd worden.
- Nagaan dat `infra/deploy-app.ps1` niet op basic auth steunt, en `infra/README.md` bijwerken.
- Dezelfde twee instellingen horen in de template van TB-006: neem ze daar mee zodra dat ticket gebouwd wordt.

## Acceptatiecriteria

- [ ] Gegeven de gedeployde demo, wanneer iemand de publicatie-instellingen van de web app bekijkt, dan staat basic
  auth uit voor SCM en FTP.
- [ ] Gegeven die instelling, wanneer de eigenaar `deploy-app.ps1` draait, dan slaagt de deploy zoals vandaag.
- [ ] Gegeven de Key Vault van de demo, dan staat purge protection aan.
- [ ] Gegeven een what-if van `main.bicep`, dan verandert er verder niets aan de demo.

## Buiten scope

- De databank van de demo (openbaar, met de serveradmin): bewust aanvaard in ADR-0034, en voor echte gegevens al
  gevraagd in E7-05 en TB-006.
- De omgevingen van de school: TB-006.

## Open vragen

- Purge protection is onomkeerbaar, en na verwijderen blijft de vaultnaam de hele bewaartermijn bezet. Gaat de
  eigenaar daarmee akkoord voor de demo?

## Werklog

- 2026-09-23 00:22 · claude-securityscan · aangemaakt (status nieuw)
