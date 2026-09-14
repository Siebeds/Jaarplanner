---
id: TB-011
titel: Hoekmoment verplaatsen weigert een dag zonder school
soort: technisch
status: in-uitvoering
prioriteit: laag
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 13:14
opgepakt-door: TB-011
branch: ticket/TB-011-hoekmoment-schooldag
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Een hoek staat per schooldag als apart moment in het uurrooster, en één moment kan naar een andere dag of een ander
uur verplaatst worden. Bij dat verplaatsen controleert de server alleen twee dingen: dat de nieuwe dag binnen de
periode van de hoek valt, en dat de hoek die dag niet al op dat uur begint (`Hoekplaatsing.VerplaatsMoment`). Of er die
dag school is, controleert hij niet. Een zaterdag, een dag in een vakantie of een vrije dag binnen de periode wordt dus
aanvaard, en telt daarna mee als "schooldag" van de hoek. Bij het inplannen van een hoek worden zulke dagen wel
overgeslagen.

Een leerkracht kan dit vandaag niet vanuit het scherm: het tijdraster aanvaardt geen drop op een gesloten dag, en het
detailblad van een hoek heeft geen dagveld. Via een rechtstreekse API-aanroep kan het wel, en elk scherm dat later een
dag laat kiezen, maakt het bereikbaar. Bij de algemene fiches zat hetzelfde gat; dat is gedicht in E10-03 (TB-002,
PR #57). De antagonist wees het aan in ronde 2 van TB-002; de eigenaar vroeg op 2026-09-14 om dit ticket.

## Voorgestelde wijziging

Dezelfde regel als bij de algemene fiches (`AlgemeneFicheplaatsing.VerplaatsMoment`):

- `Hoekplaatsing.VerplaatsMoment` krijgt het `Schooljaar` en weigert een dag zonder school met dezelfde zin: "Op die
  dag is er geen school. Kies een schooldag."
- `HoekplaatsingService.VerplaatsMomentAsync` laadt het schooljaar van de klas, zoals het inplannen dat al doet.
- Een unittest in `HoekplaatsingTests` voor een zaterdag, een dag in een gesloten week en een vrije dag, met de volledige
  zin in `Assert.Equal`, en de bestaande tests aangepast aan de nieuwe parameter.

Geen frontendwijziging nodig: het raster weigert een gesloten dag al.

## Acceptatiecriteria

- [x] Gegeven een hoekplaatsing, wanneer één moment naar een zaterdag, een vakantiedag of een vrije dag binnen de
  periode verplaatst wordt, dan weigert de server dat met "Op die dag is er geen school. Kies een schooldag." en blijft
  het moment staan waar het stond.
- [x] Gegeven een hoekplaatsing, wanneer één moment naar een gewone schooldag binnen de periode verplaatst wordt, dan
  lukt dat zoals vandaag.
- [x] De nieuwe unittest dekt de zaterdag, de gesloten week en de vrije dag; de backendtests (unit en integratie op
  PostgreSQL) en `dotnet format` zijn groen.

## Buiten scope

Momenten die al op een dag staan die pas na het inplannen gesloten werd (een sluiting die later aan het schooljaar is
toegevoegd): wat daarmee moet gebeuren, is een aparte vraag. De uren van een hele hoekperiode aanpassen (`ZetUren`)
verandert de dagen niet en valt er dus buiten.

## Open vragen

Geen.

## Werklog

- 2026-09-14 12:56 · E10-03 · aangemaakt (status nieuw)
- 2026-09-14 13:01 · TB-011 · nieuw → in-uitvoering: opgepakt, met akkoord van de eigenaar om het vanuit nieuw meteen op te pakken
- 2026-09-14 13:14 · TB-011 · gebouwd: Hoekplaatsing.VerplaatsMoment weigert een dag zonder school, de service laadt het schooljaar; criteria afgevinkt op nieuwe domein- en servicetest; unit 1135 groen, integratie op PostgreSQL 357 groen, dotnet format schoon
