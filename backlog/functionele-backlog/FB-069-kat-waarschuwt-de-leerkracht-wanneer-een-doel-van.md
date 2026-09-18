---
id: FB-069
titel: Kat waarschuwt de leerkracht wanneer een doel van haar klas in gevaar komt
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 18:11
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-6.4, FR-9.1, FR-9.3]
---

## Aanleiding

De eigenaar besliste op 2026-09-18, in een sparring over een agentische uitbreiding, dat de Jaarplanner een AI-agent
krijgt die op de agenda van de kleuterleerkracht leeft en planlast vermindert, gepersonifieerd als een dikke oranje
gestreepte kat. De agent is de interface, niet de motor. De grondwet en de ADR's komen in TB-056.

Het dekkingsoverzicht toont wat gedekt is, maar niemand waarschuwt de leerkracht wanneer het te laat dreigt te worden.
Een leerkracht kijkt er pas naar als ze eraan denkt.

**Beslissingen van de eigenaar, 2026-09-18:** de kat bewaakt de dekking van de klas, naast de vervanging, in fase 1. De
detectie is zonder AI. De agenda is de waarheid: de dekking verandert niet.

## Gewenst gedrag

De kat meldt de vaste leerkrachten van de klas en directie twee soorten knelpunten:

- **Minimumdoel in gevaar:** een minimumdoel van de mijlpaal van de klas dat in de dekkingsprognose zit maar niet gedekt
  is, terwijl de vrije lesweken die in het schooljaar overblijven minder zijn dan de lesweken van het kortste thema dat
  het als themadoel draagt. De melding noemt het doel, dat thema en hoeveel lesweken er nog vrij zijn.
- **Subthema niet gepland:** een thema loopt binnen vijf schooldagen af in de agenda van de klas, en een subthema ervan
  op de leeftijd van de klas staat niet in de agenda. De melding zegt "Plaats subthema ..." en welke leerplandoelen het
  anders niet dekt.

Elke melding linkt naar de plek waar de leerkracht iets kan doen (de agenda of het dekkingsoverzicht). Een melding
verdwijnt vanzelf zodra haar reden weg is. Een vervanger krijgt deze meldingen niet.

## Acceptatiecriteria

- [ ] Gegeven een minimumdoel in de prognose dat alleen gedragen wordt door een thema van vier lesweken, en nog drie vrije
  lesweken, dan krijgt de leerkracht een melding met het doel, het thema en "3 lesweken vrij".
- [ ] Gegeven hetzelfde doel en nog vijf vrije lesweken, dan komt er geen melding.
- [ ] Gegeven een thema dat over vier schooldagen afloopt en een subthema ervan op de leeftijd van de klas dat niet in de
  agenda staat, dan krijgt de leerkracht "Plaats subthema ..." met de leerplandoelen die het anders niet dekt.
- [ ] Gegeven een melding, wanneer de leerkracht het thema of subthema plaatst, dan verdwijnt de melding.
- [ ] Gegeven een vervanger of een leerkracht van een andere klas, dan krijgt ze de melding niet.
- [ ] De detectie is getest zonder AI.

## Testscenario's

1. Meld aan als leerkracht van een K3-klas waarvan het jaarplan vol staat, met een minimumdoel dat alleen via een niet
   geplaatst thema van vier lesweken gedekt kan worden, en nog drie vrije lesweken.
2. Je krijgt een melding met dat doel, dat thema en het aantal vrije lesweken. Klik erop: je komt in het jaarplan.
3. Plaats een thema dat binnen vier schooldagen afloopt, zonder een van zijn K3-subthema's in de agenda.
4. Je krijgt "Plaats subthema ...". Plaats het subthema: de melding verdwijnt.

## Buiten scope

- Activiteiten voorstellen voor een lage discipline: FB-070.
- Minimumdoelen die in geen enkel thema zitten: dat is de hiatenanalyse van FB-054.
- De dekking laten zakken voor iets wat niet gebeurde: de agenda is de waarheid.

## Open vragen

- "Vijf schooldagen" voor een subthema dat niet gepland is: juist, of instelbaar?
- Kan de leerkracht een melding uitstellen ("Later"), en voor hoe lang? Standaard tot de volgende schooldag
  (ADR-0059 D4).
- Hangt af van TB-056 en TB-057.

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
- 2026-09-18 18:11 · claude-tb056 · open vragen aangevuld met de standaardkeuzes van TB-056 (ADR-0059, ADR-0060)
