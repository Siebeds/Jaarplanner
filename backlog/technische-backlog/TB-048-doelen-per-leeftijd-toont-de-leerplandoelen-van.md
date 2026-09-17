---
id: TB-048
titel: 'Doelen per leeftijd' toont de leerplandoelen van de gekozen minimumdoelen van het thema
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-17
bijgewerkt: 2026-09-17 09:01
opgepakt-door: claude-tb-048
branch: ticket/TB-048-doelen-per-leeftijd-minimumdoelen
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar ontkoppelde op 2026-09-16 veel minimumdoelen van het thema "Brr, winter!" en zag dat de teller
"leerplandoelen" naast "Doelen per leeftijd" gelijk bleef. Zijn besluit: *"die leerplandoelen moeten eigenlijk een
oplijsting zijn van de leerplandoelen die gelinkt zijn aan de minimumdoelen die geselecteerd zijn voor dat thema"*.

Vandaag (FB-044) toont "Doelen per leeftijd" de leerplandoelen die binnen het thema gekoppeld zijn: als subdoel, aan
een activiteit, of als aanvaarde doelsuggestie. De minimumdoelen van het thema (de themadoelen, FB-043) spelen daarin
geen rol, dus minimumdoelen koppelen of ontkoppelen verandert het overzicht en zijn teller niet.

## Voorgestelde wijziging

- "Doelen per leeftijd" toont per leeftijd de leerplandoelen die via de concordantie bij de gekozen minimumdoelen van
  het thema horen (het leerplandoel verwijst naar een van die minimumdoelen), gegroepeerd op de jaar/fase van het
  leerplandoel.
- De teller in de marge en per leeftijd telt die leerplandoelen (elk één keer).
- Een minimumdoel koppelen of ontkoppelen past het overzicht en de tellers meteen aan.
- Backend: `ThemaDoelenoverzichtQuery` (`backend/src/Jaarplanner.Infrastructure/Persistence/`) leest de leerplandoelen
  op `MinimumdoelRef` van de `ThemaMinimumdoel`-koppelingen, in plaats van (of naast, zie Open vragen) de
  koppelingen onder het thema. Frontend: `Themadoelenoverzicht.tsx`, en de invalidatie na koppelen en ontkoppelen van
  een minimumdoel in `features/themas/mutaties.ts`.
- Tests: de query tegen Postgres en het scherm.
- Leeft naast TB-051 (lijsten inklappen en de ontkoppelbevestiging op dezelfde pagina); wie dit oppakt, bouwt op main
  nadat TB-051 gemerged is.

## Acceptatiecriteria

- [x] Gegeven een thema met minimumdoelen, wanneer ik de themapagina open, dan toont "Doelen per leeftijd" per leeftijd
  precies de leerplandoelen die bij die minimumdoelen horen, en de teller telt ze.
- [x] Gegeven dat ik een minimumdoel ontkoppel, wanneer de pagina bijwerkt, dan verdwijnen zijn leerplandoelen uit
  "Doelen per leeftijd" en dalen de tellers.
- [x] Gegeven dat ik een minimumdoel koppel, dan verschijnen zijn leerplandoelen in het overzicht.
- [x] Gegeven een thema zonder minimumdoelen, dan toont het blok niets of een lege melding, nooit een oude telling.
- [x] De dekkingsberekening verandert niet door dit ticket (zie Open vragen).
- [x] Nagekeken in een echte browser op desktop en ~390px.

## Buiten scope

De dekkingsberekening zelf (Art. V.1, ADR-0047). Het overzicht bij de subthema's. De lijst leerplandoelen onder elk
minimumdoel bij de themadoelen, die al zo werkt.

## Open vragen

- Vervangt deze lijst de huidige volledig, of blijven de leerplandoelen die via een subdoel, activiteit of doelsuggestie
  gekoppeld zijn ook zichtbaar (bijvoorbeeld met "via subdoel in …")? En wat met een leerplandoel dat onder het thema
  gekoppeld is maar bij geen enkel gekozen minimumdoel hoort?
- Tonen we per leerplandoel of het al ergens in het thema gekoppeld is (subdoel of activiteit), zodat zichtbaar wordt
  welke leerplandoelen van de gekozen minimumdoelen nog nergens uitgewerkt zijn?
- Dit is een weergave. Een leerplandoel telt voor de dekking vandaag alleen via een subthema, een aanvaarde
  doelsuggestie of een geplande algemene fiche (Art. V.1, ADR-0047), niet via het minimumdoel van het thema. Moet dat zo
  blijven? Zo niet, dan is dat een grondwetswijziging en een eigen ticket.

### Antwoorden van de eigenaar (2026-09-17)

- De lijst vervangt de huidige: per leeftijd de leerplandoelen van de gekozen minimumdoelen, zonder te tonen waar ze
  gekoppeld zijn.
- Een leerplandoel dat in het thema gekoppeld is maar bij geen gekozen minimumdoel hoort, staat per leeftijd in een
  aparte groep en telt niet mee.
- De dekkingsberekening blijft ongewijzigd.

## Werklog

- 2026-09-17 00:18 · lange-lijsten · aangemaakt (status nieuw)
- 2026-09-17 08:34 · claude-tb-048 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten; besluiten: rijen tonen alleen de lijst, gekoppelde leerplandoelen buiten de gekozen minimumdoelen in een aparte groep zonder telling, dekking ongewijzigd
- 2026-09-17 08:50 · claude-tb-048 · query, contract en scherm gebouwd; backend 2102 unit + 574 integratie (Postgres) groen, frontend 1191 groen, lint en format schoon
- 2026-09-17 09:01 · claude-tb-048 · antagonist: COMPLIANT, drie MINOR; twee opgelost (tekst bij een leeftijd zonder lijst, test dat ontkoppelen het overzicht herlaadt), de derde was de browsercheck
- 2026-09-17 09:01 · claude-tb-048 · in-uitvoering → klaar: gebouwd: lijst = leerplandoelen van de minimumdoelen per jaar/fase, koppelingen erbuiten apart en ongeteld, dekking ongewijzigd. Criteria afgevinkt: unit- en Postgres-tests (koppelen, ontkoppelen, leeg thema), schermtests, en in de browser (mockmodus) op 1440px en 390px, waar ontkoppelen de teller van 12 naar 10 bracht. Gates: backend 2102 + 574 groen, frontend 1192 groen, lint en format schoon
