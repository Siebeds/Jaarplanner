---
id: TB-011
titel: Hoekmoment verplaatsen weigert een dag zonder school
soort: technisch
status: in-uitvoering
prioriteit: laag
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 13:41
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

Een leerkracht kon dit ook vanuit het scherm. Het tijdraster weigert een drop alleen op een sluiting (een vakantie of
een vrije dag): de week- en de maandweergave tekenen zaterdag en zondag als gewone kolommen, omdat de server een weekend
als lesdag doorgeeft. Een hoekblok naar een zaterdag slepen schreef dus een rij op die zaterdag. Een sluiting was alleen
via een rechtstreekse API-aanroep bereikbaar, want het detailblad van een hoek heeft geen dagveld. *(Gecorrigeerd op
2026-09-14: hier stond eerst dat het raster elke gesloten dag weigert en dat het alleen via de API kon. De antagonist
wees erop dat de weekendkolommen een drop aanvaarden; zie het werklog.)* Bij de algemene fiches zat hetzelfde gat; dat is gedicht in E10-03 (TB-002,
PR #57). De antagonist wees het aan in ronde 2 van TB-002; de eigenaar vroeg op 2026-09-14 om dit ticket.

## Voorgestelde wijziging

Dezelfde regel als bij de algemene fiches (`AlgemeneFicheplaatsing.VerplaatsMoment`):

- `Hoekplaatsing.VerplaatsMoment` krijgt het `Schooljaar` en weigert een dag zonder school met dezelfde zin: "Op die
  dag is er geen school. Kies een schooldag."
- `HoekplaatsingService.VerplaatsMomentAsync` laadt het schooljaar van de klas, zoals het inplannen dat al doet.
- Een unittest in `HoekplaatsingTests` voor een zaterdag, een dag in een gesloten week en een vrije dag, met de volledige
  zin in `Assert.Equal`, en de bestaande tests aangepast aan de nieuwe parameter.

Geen productiecode in de frontend nodig: een geweigerde sleep toont de zin van de server in de meldingsstrook van de
agenda, langs hetzelfde foutpad als bij de fiches en de activiteiten. *(Gecorrigeerd op 2026-09-14: hier stond dat het
raster een gesloten dag al weigert.)*

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
- 2026-09-14 13:41 · TB-011 · antagonist ronde 1: VIOLATIONS FOUND (1 MAJOR, 2 MINOR); de MAJOR: weekendkolommen aanvaarden een drop, dus de bug was ook vanuit de kalender bereikbaar en de zin 'het raster weigert al' klopte niet
- 2026-09-14 13:41 · TB-011 · aangepakt: commentaren, interface- en hookdocumentatie en tickettekst gecorrigeerd, test op de volgorde van de controles toegevoegd; de eigenaar koos een browsercheck zonder Vitest-test en laat de weekendvraag bij E9-02
- 2026-09-14 13:41 · TB-011 · browsercheck op een wegwerpdatabase: een hoekblok van dinsdag naar zaterdag binnen de periode geeft 400 met de zin, de meldingsstrook toont hem en het blok blijft staan, op 1440 en 390 px; verslag in backlog/worklogs/TB-011/
