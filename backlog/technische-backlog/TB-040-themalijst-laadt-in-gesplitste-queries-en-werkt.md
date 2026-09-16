---
id: TB-040
titel: Themalijst laadt in gesplitste queries en werkt ook bij een volledig schooljaar
soort: technisch
status: klaar
prioriteit: hoog
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 21:22
opgepakt-door: tb040-splitquery
branch: ticket/TB-040-themalijst-splitquery
pr: 115
geblokkeerd:
fr: []
---

## Aanleiding

Met een volledig gevuld kleuterjaar werkt het themascherm niet meer. Dat is de data van TB-035, op de wegwerpkopie
`jaarplanner_tb035`: 14 thema's, 65 subthema's, 1466 subdoelen, en 467 activiteiten met 2053 doelkoppelingen.
`GET /api/themas` faalt na 30 s met een 500 (`Timeout during reading attempt`), en één thema openen duurt 22 s.

De oorzaak is de manier van laden. De themaboom komt in één SQL-query met `LEFT JOIN`s binnen: thema, themadoelen,
minimumdoelen, doelsuggesties, subthema's, subdoelen, activiteiten met hun doelkoppelingen, en onderzoeksvragen. Omdat
die collecties naast elkaar hangen, levert de database elke combinatie als een eigen rij (een cartesisch product). Op
`jaarplanner_tb035` geeft alleen al een deel van die joins 4,2 miljoen rijen, voor ongeveer 10.000 echte records.

Een school met een volledig schooljaar krijgt dus een themascherm dat niet laadt. TB-035 is om die reden geblokkeerd.

## Voorgestelde wijziging

De themaboom laden met gesplitste queries (`AsSplitQuery()` in EF Core): één query per collectie, zodat elke query
alleen echte rijen teruggeeft. Dat patroon staat al in `KlasBeheerService`, `EfWeekplanningOpslag` en
`EfDoelMatchOpslag`.

De plekken die een thema samen met zijn subthema's en hun collecties laden, in `backend/src/Jaarplanner.Infrastructure`:

- `SchoolcontentBeheer/SchoolcontentBeheerService.cs`: `ThemasMetSubtreeQuery` (de themalijst, en `LaadThemaAsync`
  voor elke wijziging aan een thema) en `HaalThemaOpAsync` (één thema voor een klas);
- `Persistence/ThemaDoelenoverzichtQuery.cs`: het doelenoverzicht van één thema;
- `SchoolcontentImport/SchoolcontentImportService.cs`: de bestaande thema's bij een FR-1-import.

Een gesplitste query heeft een eenduidige sortering nodig om de delen correct samen te voegen. De themalijst sorteert op
naam, dus daar komt een sortering op `Id` bij. Er verandert niets aan het datamodel, de migraties, de API-contracten of
de frontend.

Een integratietest tegen de Postgres-testcontainer bewijst dat de boom volledig en zonder dubbels binnenkomt, ook
wanneer meerdere collecties tegelijk gevuld zijn.

## Acceptatiecriteria

- [x] Gegeven de database `jaarplanner_tb035`, wanneer de directie `GET /api/themas` opvraagt, dan antwoordt de API met 200 binnen 3 seconden.
- [x] Gegeven dezelfde database, wanneer de directie één thema opent voor de K3-klas, dan antwoordt de API binnen 2 seconden.
- [x] Gegeven een thema met meerdere subthema's die elk meerdere subdoelen, activiteiten met doelkoppelingen en onderzoeksvragen hebben, wanneer de themalijst en dat ene thema geladen worden, dan staat elk van die items er precies één keer in, en is de themalijst nog altijd op naam gesorteerd.
- [x] Gegeven een wijziging aan een thema (naam, subthema, activiteit), dan slaagt die zoals voorheen en blijven alle bestaande backendtests groen.
- [x] Gegeven een FR-1-import die bestaande thema's bijwerkt, dan werkt die zoals voorheen.

## Buiten scope

- De data van TB-035 in de dev-database `jaarplanner` laden: dat doet TB-035 zelf, na deze fix.
- Paginering, of een lichtere themalijst die de subthema's niet meer meestuurt. Blijken de gesplitste queries nog te
  traag, dan wordt dat een eigen ticket.
- Andere trage schermen die met deze data opduiken: die krijgen een eigen ticket.

## Open vragen

Geen.

## Werklog

- 2026-09-16 19:23 · themaboom-splitquery · aangemaakt (status in-uitvoering)
- 2026-09-16 19:26 · themaboom-splitquery · in-uitvoering → klaar-voor-bouw: teruggegeven: de eigenaar wil het ticket nu alleen vastleggen, niet bouwen
- 2026-09-16 20:13 · tb040-splitquery · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-16 20:19 · tb040-splitquery · AsSplitQuery op de vier plekken die de themaboom laden; nieuwe Postgres-test en de hele backendsuite groen
- 2026-09-16 20:20 · tb040-splitquery · gemeten op jaarplanner_tb035 als directie: GET /api/themas 200 in 0,72 s koud en 0,2 s warm (volledige boom, geen dubbels, volgorde gelijk aan de database); thema voor K3-klas hoogstens 0,15 s; doelenoverzicht 0,13 s
- 2026-09-16 20:20 · tb040-splitquery · criteria afgevinkt: 1-2 met de meting, 3 met ThemaboomLadenPostgresTests, 4-5 met de hele backendsuite (1905 unit, 556 integratie op Postgres, waaronder de FR-1-importtests)
- 2026-09-16 20:24 · tb040-splitquery · antagonist: COMPLIANT; drie MINOR-punten opgelost (testnaam, commentaar bij ThenBy, volgorde AsSplitQuery in de import). Blijft open: geen test bewijst dat de query echt gesplitst is, de snelheid steunt op de meting
- 2026-09-16 20:24 · tb040-splitquery · in-uitvoering → klaar: themaboom laadt met gesplitste queries; themalijst op jaarplanner_tb035 in 0,72 s; backendtests, dotnet format en antagonist groen
- 2026-09-16 21:22 · tb040-splitquery · PR #115
