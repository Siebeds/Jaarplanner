---
id: TB-056
titel: Grondwet en ADR's voor de kat: proactieve AI, vervanging, lesvoorbereiding
soort: technisch
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:45
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar besliste op 2026-09-18, in een sparring over een agentische uitbreiding, dat de Jaarplanner een AI-agent
krijgt die op de agenda van de kleuterleerkracht leeft en planlast vermindert, gepersonifieerd als een dikke oranje
gestreepte kat. De agent is de interface, niet de motor: wat hij opmerkt, berekent de tool zonder AI; de AI maakt
alleen inhoud. Fase 1 zijn FB-063 tot en met FB-071, FB-031, FB-032 en TB-057.

Daarvoor verandert de eigenaar van gedacht op punten die de grondwet vandaag verbiedt:

- **Proactief:** de kat werkt ook zonder dat iemand erom vraagt (vandaag Art. IV.8: de AI loopt nooit voor op de
  leerkracht en draait alleen op vraag).
- **Lesmateriaal:** de AI mag lesvoorbereidingen maken (vandaag een non-goal in Art. I.2).
- **Voorbij de subdoelen:** bij een aanbod-gat stelt de kat voor één klas activiteiten voor op leerplandoelen die geen
  subdoel zijn (vandaag Art. IV.8 en ADR-0056 D6).
- **Vervanging:** een vervanger krijgt voor een periode alle rechten van een leerkracht op een klas (Art. VI.1).

Wat **niet** verandert: de AI stelt voor en een mens beslist (Art. IV.1), en de regels over leerlinggegevens
(Art. VI.2, VI.7) blijven zoals ze zijn.

## Voorgestelde wijziging

**Amendement** (Art. XI: een eigen commit, een rij in `docs/constitutie-log.md`, CLAUDE.md en de functionele analyse
in dezelfde wijziging):

- **Art. I.2:** "Automatic generation of the actual lesson material" verdwijnt uit de non-goals.
- **Art. IV.4:** herschreven tot één regel in plaats van losse uitzonderingen: inhoud (namen, onderzoeksvragen,
  activiteiten, woorden, lesvoorbereidingen) mag uit de kennis van het model komen; elk doel dat de AI noemt of koppelt
  is een geladen Op.stap-doel dat ze kreeg; wat naar het model gaat, is alleen schooldata en die doelen, nooit gegevens
  over kinderen (het herschrijven van een rapporttekst blijft zoals het is).
- **Art. IV.5:** de gestructureerde JSON van een lesvoorbereiding en van een activiteitvoorstel op een aanbod-gat.
- **Art. IV.8:** de kat mag proactief werken, via een achtergrondtaak; wat hij maakt blijft een voorstel. Bij een
  aanbod-gat mag hij voor één klas voorbij de subdoelen gaan.
- **Art. VI.1:** de vervanging: directie legt ze vast, de vervanger heeft tussen begin- en einddatum alle rechten van
  een leerkracht op die klas.
- **Art. IX en XII:** de nieuwe begrippen (vervanging, vervanger, klasfiche, briefing, terugkeerbriefing,
  lesvoorbereiding, signaal, aanbod-gat, gepland-gat).
- **Functionele analyse:** een nieuw hoofdstuk FR-14 voor de kat, en de scope in §2.3.

**ADR's:**

1. Vervanging, briefing en terugkeerbriefing: een klastoewijzing met datums, de rij in de matrix van ADR-0030, wat er
   gebeurt met eigen activiteiten van de vervanger na afloop.
2. Lesvoorbereiding per plaatsing: inhoud, status, op vraag voor de vaste leerkracht en rollend tijdens een vervanging.
3. De kat en de signalenlaag: proactiviteit, achtergrondtaak, meldingen alleen in de app en hooguit enkele momenten per
   dag, de principes van de presentatie.
4. Activiteitvoorstellen op een aanbod-gat: vervangt ADR-0056 D6 gedeeltelijk.

## Acceptatiecriteria

- [ ] Gegeven het amendement, dan staat het in een eigen commit met een rij in `docs/constitutie-log.md`, en zeggen
  CLAUDE.md en de functionele analyse hetzelfde.
- [ ] Gegeven Art. I.2, dan noemt het lesmateriaal niet meer als non-goal, en Art. VI.2 en VI.7 zijn ongewijzigd.
- [ ] Gegeven Art. IV.4, dan is het één regel, en vallen woordweb, subthemavoorstel, activiteitvoorstel en herschrijven
  eronder zonder dat hun betekenis verandert.
- [ ] Gegeven `docs/adr/`, dan staan de vier ADR's erin en in de index; ADR-0056 is niet herschreven, alleen gemarkeerd
  als gedeeltelijk vervangen.
- [ ] De antagonist heeft het amendement en de ADR's beoordeeld: geen CRITICAL of MAJOR open.

## Buiten scope

Code. Die komt in TB-057 en FB-063 tot en met FB-071.

## Open vragen

- Een eigen activiteit die de vervanger maakt, is volgens ADR-0049 van haar. Wat gebeurt er na afloop mee? De ADR
  stelt iets voor, de eigenaar beslist.
- Een vervanger moet een gebruiker in de Entra-tenant van de school zijn (Art. VI.1). Blijft dat een voorwaarde, ook als
  een interimaris op dag 1 nog geen schoolaccount heeft?
- Werkt de school met een eigen sjabloon voor een lesvoorbereiding? Standaard: doelen, instap, kern, afsluiting,
  materiaal, woordenschat, differentiatie, duur.
- Achtergrondtaak in de web app zelf of als aparte Azure-taak (ADR 3)?

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
