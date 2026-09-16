---
id: TB-046
titel: Frontend draait alleen, met vaste K3-nepdata, om kleine aanpassingen snel te bekijken
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 23:41
opgepakt-door: frontend-mockmodus
branch: ticket/frontend-mockmodus
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Om een kleine aanpassing aan een scherm te bekijken, start de eigenaar vandaag altijd de volledige app: de API, de
database in Docker en Vite. Op een machine met 16 GB werkgeheugen is dat te zwaar: op 2026-09-16 stopte Claude Code de
API twee keer omdat het geheugen vol zat. Bovendien hangt wat je ziet af van wat er toevallig in de lokale database staat.

## Voorgestelde wijziging

Een tweede opstartmodus van de frontend, zonder backend: `pnpm dev:mock`.

- **De pagina vangt zelf elke `fetch` naar `/api` op** en antwoordt met nepdata. Geen MSW: dat vraagt een nieuwe
  dependency en een service-workerbestand in `public/`, dat dan ook in de productiebuild zou belanden. De mocklaag
  staat onder `frontend/src/mocks/`, wordt alleen in deze modus geladen en komt nooit in `pnpm build` terecht.
- **De nepdata volgt de types uit `frontend/src/lib/types.ts`**, zodat `pnpm lint` faalt wanneer het API-contract
  verandert en de nepdata niet.
- **De toestand leeft in het geheugen van de pagina.** Schrijfacties (slepen in de agenda, een koppeling toevoegen of
  verwijderen) werken, en herladen zet alles terug op de vaste beginstand.
- **Een route zonder nabootsing antwoordt met een duidelijke fout** (501) die methode en pad noemt, en een klein label
  rechts onderaan somt zulke routes op, zodat een scherm nooit gewoon leeg lijkt.
- **De gebruiker is directie**, zonder aanmeldpagina, zodat elk scherm bereikbaar is.
- **De vaste inhoud, allemaal fictief:**
  - schooljaar 2026-2027 met één klas van jaarfase K3;
  - één thema van 4 weken met zijn minimumdoelen en de leerplandoelen die ermee concorderen;
  - twee subthema's van 1 week voor K3, elk met een onderzoeksvraag, subdoelen (K3-leerplandoelen) en
    activiteiten die samen alle subdoelen dragen;
  - het thema in het jaarplan van de klas, en de subthema's in de agenda: het eerste in de week van 16 november 2026,
    het tweede in de week van 23 november 2026;
  - een volle agenda van maandag 16 tot en met vrijdag 27 november 2026: activiteiten van 8u30 tot 15u30, met de
    middagpauze van 12u tot 13u vrij, en op woensdag alleen tot 12u (woensdagnamiddag geen school);
  - wat de schermen verder nodig hebben om die inhoud te tonen (disciplines, doelregisters, hoeken, algemene fiches,
    schooluren), en een vereenvoudigde dekking: een doel telt zodra zijn subthema of thema ingepland staat.
  - de doelen zijn verzonnen, in de vorm van Op.stap maar met nummers (`.8x`) die Op.stap niet gebruikt.
- **De skill `app-starten`** krijgt de keuze: standaard frontend en backend samen, alleen de frontend met nepdata
  wanneer de eigenaar dat vraagt.

## Acceptatiecriteria

- [ ] Gegeven een machine zonder draaiende API of database, wanneer `pnpm dev:mock` start, dan opent http://localhost:5177 zonder aanmeldpagina op de app, als directie.
- [ ] Gegeven de mockmodus, wanneer je het thema opent, dan zie je zijn minimumdoelen, twee subthema's van 1 week voor K3 met hun leerplandoelen, en hun activiteiten.
- [ ] Gegeven de agenda van de K3-klas in de weken van 16 en 23 november 2026, dan staan er op maandag, dinsdag, donderdag en vrijdag activiteiten van 8u30 tot 15u30 met niets tussen 12u en 13u, en op woensdag alleen tussen 8u30 en 12u.
- [ ] Gegeven de mockmodus, wanneer je een activiteit in de agenda versleept, dan blijft ze op haar nieuwe plaats tot je de pagina herlaadt, en na herladen staat alles weer op de beginstand.
- [ ] Gegeven een scherm dat een niet nagebootste route aanroept, dan noemt het mocklabel die route, en krijgt het scherm een fout in plaats van een lege lijst.
- [ ] Gegeven `pnpm build`, dan bevat de productiebuild geen mockcode en geen nepdata; `pnpm lint` en `pnpm test` zijn groen, en `app-starten` beschrijft beide opstartmodi.

## Buiten scope

- Backendwijzigingen, rechten per rol en de echte dekkingsberekening: daarvoor blijft de volledige opstart nodig.
- Het ontwikkelingsrapport en andere leerlingdata.
- AI-knoppen: die antwoorden in de mockmodus met de fout "niet nagebootst".
- Andere klassen, jaarfasen en thema's dan het ene K3-thema.

## Open vragen

Geen. De eigenaar koos op 2026-09-16 voor alleen de frontend op vraag. De sessie stelde voor: woensdagnamiddag vrij,
en een thema van 4 weken met twee subthema's van 1 week, zodat beide in 16 tot 27 november vallen.

## Werklog

- 2026-09-16 23:24 · frontend-mockmodus · aangemaakt (status in-uitvoering)
- 2026-09-16 23:41 · frontend-mockmodus · mockmodus gebouwd: pnpm dev:mock, eigen fetch-onderschepping in frontend/src/mocks (geen MSW), K3-thema met volle agenda 16-27 nov; lint, 1015 tests en build groen, productiebuild zonder mockcode
