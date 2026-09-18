---
id: TB-056
titel: Grondwet en ADR's voor de kat: proactieve AI, vervanging, lesvoorbereiding
soort: technisch
status: klaar
prioriteit: hoog
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 19:21
opgepakt-door: claude-tb056
branch: ticket/TB-056-grondwet-kat
pr: 146
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
- **Vervanging:** een vervanger kijkt voor een periode mee in één klas, alleen lezend (Art. VI.1; zo beslist door de
  eigenaar in dit ticket, zie het Werklog).

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
- **Art. VI.1:** de vervanging: directie legt ze vast, de vervanger leest tussen begin- en einddatum de klas en wijzigt
  of beslist niets; de vaste klasleerkracht zet de agenda achteraf recht.
- **Art. IX en XII:** de nieuwe begrippen (vervanging, vervanger, klasfiche, briefing, terugkeerbriefing,
  lesvoorbereiding, signaal, aanbod-gat, gepland-gat).
- **Functionele analyse:** een nieuw hoofdstuk FR-14 voor de kat, en de scope in §2.3.

**ADR's:**

1. Vervanging, briefing, terugkeerbriefing en klasfiche: een eigen relatie "Vervanger" met alleen leesrijen in de
   matrix van ADR-0030 (ADR-0057).
2. Lesvoorbereiding per plaatsing: inhoud, status, op vraag voor de vaste leerkracht en rollend tijdens een vervanging.
3. De kat en de signalenlaag: proactiviteit, achtergrondtaak, meldingen alleen in de app en hooguit enkele momenten per
   dag, de principes van de presentatie.
4. Activiteitvoorstellen op een aanbod-gat: vervangt ADR-0056 D6 gedeeltelijk.

## Acceptatiecriteria

- [x] Gegeven het amendement, dan staat het in een eigen commit met een rij in `docs/constitutie-log.md`, en zeggen
  CLAUDE.md en de functionele analyse hetzelfde.
- [x] Gegeven Art. I.2, dan noemt het lesmateriaal niet meer als non-goal, en Art. VI.2 en VI.7 zijn ongewijzigd.
- [x] Gegeven Art. IV.4, dan is het één regel, en vallen woordweb, subthemavoorstel, activiteitvoorstel en herschrijven
  eronder zonder dat hun betekenis verandert.
- [x] Gegeven `docs/adr/`, dan staan de vier ADR's erin en in de index; ADR-0056 is niet herschreven, alleen gemarkeerd
  als gedeeltelijk vervangen.
- [x] De antagonist heeft het amendement en de ADR's beoordeeld: geen CRITICAL of MAJOR open.

## Buiten scope

Code. Die komt in TB-057 en FB-063 tot en met FB-071.

## Open vragen

- Beantwoord in dit ticket (eigenaar, 2026-09-18): de vervanger leest alleen, dus maakt ze geen eigen activiteiten;
  een vervanger blijft een gebruiker van de Entra-tenant; geen AI-samenvatting in de briefing (ADR-0057 V2, V4, V6).
- Werkt de school met een eigen sjabloon voor een lesvoorbereiding? Tot dan de vorm van ADR-0058 L2.
- De achtergrondtaak draait standaard in de web app zelf (ADR-0059 D1), een standaardkeuze.

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
- 2026-09-18 17:59 · claude-tb056 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-18 18:04 · claude-tb056 · eigenaar beslist: de vervanger leest alleen (agenda, klasfiche, voorbereidingen, briefing) en beslist niets; de vaste klasleerkracht zet de agenda achteraf recht; geen AI-samenvatting in de briefing in fase 1; een vervanger blijft een gebruiker van de Entra-tenant
- 2026-09-18 18:12 · claude-tb056 · amendement (Art. I.1, I.2, IV.1, IV.3, IV.4, IV.5, IV.8, VI.1, VI.2, VIII, IX.2, IX.3, XII), ADR-0057 tot ADR-0060, CLAUDE.md, FA (FR-14) en log geschreven; FB-063 tot FB-070 bijgewerkt; antagonist ronde 1 loopt
- 2026-09-18 18:18 · claude-tb056 · antagonist ronde 1: VIOLATIONS FOUND, 2 MAJOR (IV.2 zonder uitzondering voor het chatantwoord; 'zonder recht leest geen klas' naast de vervanger) en MINOR; alle MAJOR en de MINOR hersteld, behalve de vraag over een namenfilter in de chat (aan de eigenaar)
- 2026-09-18 18:19 · claude-tb056 · antagonist ronde 2: COMPLIANT, beide MAJOR gesloten; criteria afgevinkt (commits 2278f161 en f33bc17d, ADR-index en log nagekeken)
- 2026-09-18 18:19 · claude-tb056 · in-uitvoering → klaar: amendement op de grondwet (Art. I.1, I.2, IV.1-IV.5, IV.8, VI.1, VI.2, VIII, IX.2, IX.3, XII, XIV), ADR-0057 tot ADR-0060, CLAUDE.md, FA (FR-14) en log; FB-063 tot FB-070 bijgewerkt voor de vervanger die alleen leest; antagonist COMPLIANT na ronde 2; geen code, dus geen tests of lint
- 2026-09-18 19:21 · claude-tb056 · PR #146
