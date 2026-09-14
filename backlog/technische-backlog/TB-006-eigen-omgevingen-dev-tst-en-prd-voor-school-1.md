---
id: TB-006
titel: Eigen omgevingen dev, tst en prd voor school 1 (sjceik)
soort: technisch
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 14:36
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eerste school (achtervoegsel `sjceik`) krijgt een eigen installatie van Jaarplanner, los van de demo-omgeving. De
demo blijft voor pitches aan andere scholen (ADR-0034, TB-003). De eigenaar wil voor de school drie omgevingen: dev,
tst en prd (beslissing van 2026-09-14). Vandaag beschrijft `infra/main.bicep` alleen de demo, met vaste namen en de
goedkoopste SKU's.

## Voorgestelde wijziging

- De Bicep krijgt de school en de omgeving als parameter, met een eigen resource group per omgeving
  (`rg-jaarplanner-sjceik-dev`, `-tst`, `-prd`) in Belgium Central. Namen krijgen school en omgeving mee; een Key
  Vault-naam mag hoogstens 24 tekens tellen.
- De SKU's zijn per omgeving een parameter. Dev en tst mogen goedkoop blijven. Prd niet op F1, want ADR-0034 noemt F1
  en de openbare databank ongeschikt voor productie.
- Elke omgeving krijgt een eigen Entra-app-registratie met eigen redirect-URI's, en een eigen Key Vault met de
  connection string, het client secret en de sleutel voor de sessiesleutels.
- `infra/deploy-app.ps1` en `infra/migrate-db.ps1` krijgen de omgeving als parameter. `infra/README.md` beschrijft de
  stappen per omgeving.
- Een nieuw ADR over hosting per school en per omgeving. Voor deze installatie vervangt het de demo-uitzondering van
  ADR-0034. Het wijzigt ook beslissing 3 van ADR-0036 (TB-004): die noemt de evaluatie-resource "apart from everything
  else", en dev en tst gaan hem delen.
- Voor prd, vóór er echte gegevens in komen:
  - een eigen databaserol voor de app met alleen DML-rechten (E7-05);
  - geen firewallregel die elk Azure-adres toelaat;
  - back-ups en een geteste restore (E7-09);
  - E6-02 op `main` (de gate van E7-11).

## Acceptatiecriteria

- [ ] Gegeven de parameters school `sjceik` en omgeving `dev`, wanneer de template gedeployed wordt, dan staat alles in
  een eigen resource group in Belgium Central, dragen de namen school en omgeving, en wordt er niets met de demo gedeeld.
- [ ] Gegeven dezelfde template met omgeving `tst` of `prd`, dan verschillen alleen de parameters (namen, SKU's,
  netwerk), niet de template zelf.
- [ ] Gegeven een gedeployde dev-omgeving, wanneer de eigenaar de app opent, dan meldt hij zich aan via de eigen
  app-registratie van die omgeving, en lopen de migraties met `migrate-db.ps1` voor die omgeving.
- [ ] Gegeven de parameters voor prd, dan beschrijft de template een databaserol zonder DDL-rechten, geen firewallregel
  die elk Azure-adres toelaat en App Service B1, en slaagt een what-if zonder dat prd gedeployed wordt. De restore is
  beschreven; de restoreproef hoort bij de eerste deploy van prd.
- [ ] Gegeven de publieke repo, dan staan er geen geheimen, wachtwoorden of tenantgegevens van de school in git.

## Buiten scope

- Prd deployen. De template beschrijft prd, maar de eigenaar deployt het pas als er echt iets op gebeurt, zodat er geen
  kosten lopen voor een lege omgeving (eigenaar, 2026-09-14).
- De Foundry-resource voor AI: die komt uit TB-004. Hoe dev en tst hem gebruiken, volgt later.
- CI/CD-pipelines: deployen blijft een handeling vanaf de pc van de eigenaar.
- Een eigen domeinnaam.
- Leerkrachten uitnodigen en aan klassen koppelen (E6-04).

## Open vragen

Beantwoord door de eigenaar op 2026-09-14:

- **SKU's en budget.** Dev en tst blijven goedkoop: App Service F1 en elk een eigen PostgreSQL B1ms (ongeveer €16 per
  maand per server na het gratis jaar). Prd krijgt App Service B1 en PostgreSQL B1ms (ongeveer €27 per maand), maar
  wordt nog niet gedeployed (zie Buiten scope).
- **Entra-tenant.** De leerkrachten melden zich aan in de tenant van de school, met hun eigen schoolaccount. De
  app-registratie van elke omgeving komt daar, en vraagt een beheerder van de school. De rechten blijven in de app
  (Art. VI.1); alleen de aanmelding gebeurt in de schooltenant.
- **Echte gegevens** komen alleen in prd, en pas na E6-02 op `main` en de hardening hierboven. Dev en tst krijgen enkel
  fictieve gegevens.
- **Foundry.** Dev en tst gebruiken de gedeelde evaluatie-resource uit TB-004 (`rg-jaarplanner-ai`, Sweden Central).
  Prd krijgt later een eigen Foundry-resource, met eigen quota, rollen en kosten.

Nog open:

- **De tenant-id van de school en wie er admin consent geeft.** Nodig bij de eerste deploy van dev, niet voor de
  template; het komt niet in git.

## Werklog

- 2026-09-14 11:32 · ai-doelsuggesties · aangemaakt (status nieuw)
- 2026-09-14 11:36 · ai-doelsuggesties · geblokkeerd: wacht op de eigenaar: SKU's en budget per omgeving, welke Entra-tenant, waar en wanneer echte gegevens
- 2026-09-14 14:36 · ai-doelsuggesties · niet langer geblokkeerd
- 2026-09-14 14:36 · ai-doelsuggesties · eigenaar besliste: dev/tst goedkoop, prd B1 maar nog niet deployen; tenant van de school; echte gegevens alleen in prd; Foundry gedeeld voor dev/tst, eigen voor prd
