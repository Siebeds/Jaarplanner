---
id: TB-018
titel: Skill deploy-demo zet de laatste main op de Azure-demo
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 11:01
opgepakt-door: demo-deploy-skill
branch: ticket/demo-deploy-skill
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vraagt geregeld om de laatste `main` naar de Azure-demo te deployen (vier keer tussen 2026-09-13 en
2026-09-15). Het recept daarvoor stond verspreid: de sectie *Later deployments* in `infra/README.md`, losse regels in
de groepschat en een persoonlijke geheugennotitie met twee shellvalkuilen die op 2026-09-14 twee mislukte runs
kostten. Elke sessie moest opnieuw uitzoeken welke instance er is, welke commit live staat, of er migraties mee
moeten en hoe je nagaat dat de nieuwe code echt draait.

## Voorgestelde wijziging

Een nieuwe projectskill `.claude/skills/deploy-demo/SKILL.md`, die de bestaande scripts `infra/migrate-db.ps1` en
`infra/deploy-app.ps1` in de juiste volgorde gebruikt:

- groepschat-claim `deploy-azure-demo`, en in de groepschat nagaan of er nog een seed, migratie of deploy loopt;
- de live commit uitlezen via het stempel `deployed-commit.txt` (Kudu) en vergelijken met `origin/main`, en stoppen
  als dat stempel leeg is, niet op `main` staat of niet-gecommitte wijzigingen meldt;
- de vaste deploy-worktree `.claude/worktrees/deploy-main` losgekoppeld op `origin/main` zetten;
- nieuwe migraties eerst lezen (wat data kan wissen of herschrijven wacht op de eigenaar), dan draaien, en bij een
  mislukte migratie of een wijziging in `infra/main.bicep` stoppen;
- deployen met de twee shellvalkuilen vermeden;
- controleren (stempel, `/health`, `/health/ready`, `/api/klassen` 401, een nieuwe tekst in de live bundle) en
  rapporteren.

Daarnaast, zodat de claim ook echt alle schrijfacties op de demo afdekt:

- `infra/README.md`, sectie *Later deployments*: een verwijzing naar de skill (de README wint bij een verschil) en
  de afspraak dat elke schrijfactie op de demo eerst de claim `deploy-azure-demo` neemt: deploy, migratie, seed, en
  de app of de database starten, stoppen of herstarten;
- `.claude/skills/groepschat/SKILL.md`: de claim `deploy-azure-demo` in de tabel met resourcenamen.

De skill heet `deploy-demo` en niet `demo-deployen`: Art. II.2 wil Engelse namen voor tooling, en Art. II.6 geeft
alleen de ticketskills, `groepschat` en `app-starten` een Nederlandse naam. De scripts zelf veranderen niet.

## Acceptatiecriteria

- [x] Gegeven een sessie zonder voorkennis, wanneer de eigenaar vraagt om `main` naar de demo te deployen, dan past de beschrijving van de skill op die vraag en noemt de skill de webapp, de resourcegroep, de database en de Key Vault bij naam.
- [x] Gegeven dat `main` migraties heeft die de live commit niet heeft, dan laat de skill `migrate-db.ps1` lopen voor `deploy-app.ps1`, en controleert ze daarna dat de tijdelijke firewallregel weg is.
- [x] Gegeven een deploy, dan meldt de skill pas succes na de controles: het stempel is `origin/main`, `/health` en `/health/ready` geven 200, `/api/klassen` geeft 401, en de live bundle bevat een nieuwe tekst.
- [x] De leesopdrachten van de skill (live commit, migratieverschil, databasestatus, controles) zijn zoals ze er staan uitgevoerd tegen de demo.

## Buiten scope

- De omgeving aanmaken of de Bicep opnieuw uitrollen (`infra/README.md`, eerste installatie).
- De demo vullen met gegevens (`infra/seed-demo.ps1`) en AI Foundry (`infra/deploy-ai.ps1`).
- De eigen omgevingen van de school (TB-006).
- Wijzigingen aan `deploy-app.ps1` of `migrate-db.ps1`.

## Open vragen

Geen.

## Werklog

- 2026-09-15 10:33 · demo-deploy-skill · aangemaakt (status in-uitvoering)
- 2026-09-15 10:38 · demo-deploy-skill · skill geschreven; leesopdrachten van stap 1, 2, 4 en 6 letterlijk uitgevoerd tegen de demo: live ea6c5c6, main 56d92d3, twee migraties (RechtenModel, Wizardrun), database Ready, firewall schoon, health 200/200, klassen 401; criterium 4 afgevinkt; antagonist loopt
- 2026-09-15 10:49 · demo-deploy-skill · antagonist ronde 1: 3 MAJOR, 5 MINOR, verwerkt: stoppen bij een leeg, dirty of niet-main stempel; Up() lezen voor de migratie, met een bredere lijst en een faaltak, migratie in de achtergrond; claim deploy-azure-demo geregistreerd in de groepschat-tabel en infra/README.md (ook voor seed), scope daartoe verbreed; skill hernoemd naar deploy-demo (Art. II.2/II.6); herziene commando's opnieuw uitgevoerd tegen de demo; ronde 2 loopt
- 2026-09-15 11:01 · demo-deploy-skill · antagonist ronde 2: 6 MINOR, verwerkt: stap 2 heeft een GO/STOP-poort (dirty, leeg, onzin en niet-main geven STOP) en LIVE staat tussen aanhalingstekens, zodat een lege LIVE luid faalt; eerst de claim, dan pas app of database starten; chatcontrole scherper; wijzigingen aan deploy-app.ps1 en migrate-db.ps1 eerst lezen; titel met de hand naar 'Skill deploy-demo' (bestandsnaam blijft); stap 2 en 4 opnieuw letterlijk uitgevoerd tegen de demo (GO, live ea6c5c6, twee nieuwe migraties, DMR leeg); ronde 3 loopt
