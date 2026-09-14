---
id: TB-006
titel: Eigen omgevingen dev, tst en prd voor school 1 (sjceik)
soort: technisch
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 11:36
opgepakt-door:
branch:
pr:
geblokkeerd: wacht op de eigenaar: SKU's en budget per omgeving, welke Entra-tenant, waar en wanneer echte gegevens
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
  ADR-0034.
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
- [ ] Gegeven prd, dan gebruikt de app een databaserol zonder DDL-rechten, laat de databank geen willekeurig Azure-adres
  toe en is de restore beschreven en één keer geprobeerd.
- [ ] Gegeven de publieke repo, dan staan er geen geheimen, wachtwoorden of tenantgegevens van de school in git.

## Buiten scope

- De Foundry-resource voor AI: die komt uit TB-004. Hoe elke omgeving hem gebruikt, volgt later.
- CI/CD-pipelines: deployen blijft een handeling vanaf de pc van de eigenaar.
- Een eigen domeinnaam.
- Leerkrachten uitnodigen en aan klassen koppelen (E6-04).

## Open vragen

- **SKU's en maandbudget per omgeving.** Het gratis jaar dekt maar één PostgreSQL B1ms. Elke extra server kost ongeveer
  €16 per maand, een App Service B1 ongeveer €11 (prijzen uit ADR-0034).
- **In welke Entra-tenant loggen de leerkrachten in?** Die van de eigenaar (met eigen of gastaccounts) of die van de
  school. Dat bepaalt de app-registratie en raakt ADR-0030.
- **Waar komen echte gegevens:** alleen in prd, of ook in tst? En wanneer: E7-11 vraagt eerst E6-02.
- **Eén Foundry-resource voor alle omgevingen, of een eigen voor prd?**

## Werklog

- 2026-09-14 11:32 · ai-doelsuggesties · aangemaakt (status nieuw)
- 2026-09-14 11:36 · ai-doelsuggesties · geblokkeerd: wacht op de eigenaar: SKU's en budget per omgeving, welke Entra-tenant, waar en wanneer echte gegevens
