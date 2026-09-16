---
id: FB-043
titel: Themabeheer koppelt minimumdoelen aan een thema, uitklapbaar met hun leerplandoelen
soort: functioneel
status: te-testen
prioriteit: hoog
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 15:30
opgepakt-door: claude-fb043
branch: ticket/FB-043-minimumdoelen-als-themadoel
pr: 112
geblokkeerd:
fr: [FR-2.3, FR-9.3]
---

## Aanleiding

De eigenaar vroeg op 2026-09-16, na de demo: *"Ik wil minimumdoelen kunnen koppelen aan thema's omdat deze overheen
meerdere fases gaan en door de minimumdoelen eraan te koppelen wordt automatisch de gelinkte leerplandoelen eraan
gelinkt."* en *"Maak bij de themadoelen de minimumdoelen dan ook uitklapbaar, zijnde eerst focus op welke
minimumdoelen worden gedekt door het thema en bij uitklappen van minimumdoel de gelinkte leerplandoelen [...].
Bij subthema, aangezien dit per leeftijd is, blijft het wel de leerplandoelen omdat die specifiek voor die fase/klas
zijn."*

Vandaag is een themadoel altijd een leerplandoel, en dat hoort bij één leeftijd (`…GK2…`). Een thema loopt over
meerdere leeftijden, en het minimumdoel is het niveau dat over die leeftijden heen gaat en waarop de inspectie toetst.

**Dit draait een eerdere beslissing terug:** bij FB-009 verwierp de eigenaar op 2026-09-15 nog "een eigen lijst
beoogde minimumdoelen op het thema". Met dit ticket komt die lijst er wel, als themadoelen.

**Beslissing van de eigenaar, 2026-09-16:** het maximum van 2 à 3 themadoelen vervalt: *"max van aantal
themadoelen moet weg, er kunnen heel veel doelen worden gelinkt."* Vandaag weigert een thema een vierde themadoel, en de
import (FR-1) houdt er hoogstens drie over. De grondwet noemt de themadoelen nog "de 2 à 3 overkoepelende doelen"
(Art. IX.2 en XII); die tekst wordt mee aangepast, met de reden in `docs/constitutie-log.md`.

Het deel "Doelen per leeftijd toont geen minimumdoelen meer" is FB-044. Hoe dit meetelt als verwachte dekking is
FB-045.

## Gewenst gedrag

- Directie en wie themabeheer heeft, koppelen **minimumdoelen** als themadoel aan een thema, en ontkoppelen ze weer.
- Een gekoppeld minimumdoel brengt vanzelf de leerplandoelen mee die er via de concordantie naartoe leiden. Die
  leerplandoelen worden niet apart gekozen en gaan mee weg als het minimumdoel ontkoppeld wordt.
- Bij de themadoelen staan eerst de **minimumdoelen** van het thema (ref en tekst), ingeklapt: zo ziet men in één
  oogopslag welke minimumdoelen het thema beoogt.
- Een minimumdoel uitklappen toont **per leeftijd** een regel met het aantal leerplandoelen ("K2 · 3 leerplandoelen").
  Een leeftijd uitklappen toont die leerplandoelen. Daar staan geen minimumdoelen meer bij.
- Een leerplandoel aanklikken opent zijn detail, zoals nu (TB-016); daar ziet men ook zijn minimumdoel.
- Een thema heeft **geen maximum** aan themadoelen meer bij het koppelen op de themapagina. De import (FR-1) blijft
  ongemoeid (zie *Buiten scope*).
- Een themadoel is voortaan altijd een **minimumdoel**. Op de themapagina voegt men geen leerplandoel meer toe als
  themadoel. De bestaande themadoelen die een leerplandoel zijn, verwijdert een migratie uit de data, in elke
  omgeving; het datamodel zelf blijft.
- Bij de **subthema's** verandert niets: subdoelen blijven leerplandoelen van de leeftijd van het subthema.

## Acceptatiecriteria

- [x] Gegeven iemand met themabeheer, wanneer ze een minimumdoel als themadoel koppelt, dan staat het bij de themadoelen
  en zijn geconcordeerde leerplandoelen hangen eronder, zonder dat ze die apart kiest.
- [x] Gegeven een gekoppeld minimumdoel, wanneer de pagina opent, dan is het ingeklapt; uitgeklapt toont het per leeftijd
  het aantal leerplandoelen, en een leeftijd uitgeklapt toont die leerplandoelen, zonder minimumdoelen in die lijst.
- [x] Gegeven een gekoppeld minimumdoel, wanneer het ontkoppeld wordt, dan verdwijnen ook de leerplandoelen die het
  meebracht.
- [x] Gegeven een gewone leerkracht of hoofdleerkracht, dan ziet ze de minimumdoelen van het thema maar kan ze er geen
  koppelen of ontkoppelen; de server weigert het ook.
- [x] Gegeven een thema met al drie themadoelen, wanneer er een vierde en een vijfde gekoppeld worden, dan staan ze er
  alle vijf.
- [x] Gegeven een bestaand thema met themadoelen die leerplandoelen zijn, na de migratie zijn die verdwenen, en op de
  themapagina kan men geen leerplandoel meer als themadoel toevoegen.
- [x] Gegeven een subthema, dan koppelt men daar zoals nu leerplandoelen als subdoel, geen minimumdoelen.
- [x] Getest aan de serverkant (koppelen, meebrengen, ontkoppelen, rechten) en nagekeken in een echte browser op desktop
  en ~390px, met het toetsenbord bedienbaar.

## Testscenario's

1. Meld aan met themabeheer en open een thema. Koppel bij de themadoelen een minimumdoel uit de kleuterschool
   (een ref met `K-`). Het staat bij de themadoelen, ingeklapt.
2. Klap het open. Je ziet per leeftijd (bv. JK, K2, K3) hoeveel leerplandoelen ernaartoe leiden.
3. Klap K3 open. Je ziet de leerplandoelen van K3; er staat geen minimumdoel tussen.
4. Klik een leerplandoel aan. Het detail opent en noemt het minimumdoel.
5. Ontkoppel het minimumdoel. Het verdwijnt, met de leerplandoelen eronder.
6. Meld aan als leerkracht. Je ziet de minimumdoelen van het thema, zonder knop om te koppelen of te ontkoppelen.
7. Koppel als themabeheer nog vier minimumdoelen aan hetzelfde thema. Ze worden alle vier aanvaard; er is geen maximum.
   Er is geen knop om een leerplandoel als themadoel toe te voegen.
8. Open een subthema: daar koppel je nog altijd leerplandoelen.
9. Herhaal stap 1 tot 3 op ~390px.

## Buiten scope

- "Doelen per leeftijd" zonder minimumdoelen: FB-044.
- Verwachte en ingeplande dekking: FB-045.
- De AI-doelsuggesties bij het thema en de wizardstap 'themadoelen': ze blijven werken zoals nu; een apart ticket
  beslist wat ermee gebeurt.
- De Excel-import (FR-1), ook haar maximum van drie themadoelen. Dat ze minimumdoelen moet kunnen dragen, komt in een
  eigen ticket.
- Het datamodel van de themadoelen die leerplandoelen zijn opruimen: een ander ticket.

## Open vragen

Beantwoord door de eigenaar op 2026-09-16:

- **Wat met de bestaande themadoelen, die leerplandoelen zijn?** Een themadoel wordt enkel nog een minimumdoel; de
  leerplandoelen blijven zichtbaar als uitklapping eronder. De bestaande leerplandoel-themadoelen verwijdert een
  migratie in elke omgeving, ook op de Azure-demo. Het datamodel blijft.
- **Dekking in de tussentijd:** die daalt door het verwijderen; de gekoppelde minimumdoelen tellen nog niet mee.
  FB-045 lost dat op.
- **Welke leeftijden komen mee?** Alle leeftijden van de concordantie, ook als het thema voor een leeftijd nog geen
  subthema heeft.
- **Import (FR-1):** ja, later ook minimumdoelen, maar in een eigen ticket. Dit ticket laat de import ongemoeid.
- **AI-doelsuggesties bij het thema en de wizardstap 'themadoelen':** ongemoeid, een apart ticket.
- Het schrappen van het maximum wijzigt de grondwet (Art. IX.2 en XII): de bouwer past die tekst aan en noteert het in
  `docs/constitutie-log.md`, met de beslissing van de eigenaar van 2026-09-16.
- Een koppeling tussen een thema en een minimumdoel is een nieuw soort koppeling in het gegevensmodel (Art. IX):
  de bouwer legt dat vast in een ADR.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
- 2026-09-16 14:03 · demo-opmerkingen · beslissing eigenaar: het maximum van 2 à 3 themadoelen vervalt, ook bij de import; in de tekst verwerkt
- 2026-09-16 14:19 · eigenaar · nieuw → klaar-voor-bouw: open vragen beantwoord in de sessie; klaar voor bouw
- 2026-09-16 14:19 · claude-fb043 · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-16 14:27 · claude-fb043 · geblokkeerd: Tegenstrijdige antwoorden: in deze sessie zei de eigenaar 'bestaande leerplandoel-themadoelen verwijderen via migratie, import ongemoeid (ook het maximum)'; een niet-gecommitte versie op main zegt 'ze blijven staan naast de minimumdoelen' en 'bij de import valt het maximum weg'. Welke geldt?
- 2026-09-16 14:29 · claude-fb043 · niet langer geblokkeerd
- 2026-09-16 14:29 · claude-fb043 · eigenaar bevestigt: bestaande leerplandoel-themadoelen verwijderen (datamodel blijft), import ongemoeid; de niet-gecommitte tekst op main is achterhaald
- 2026-09-16 14:41 · claude-fb043 · backend klaar: koppeling thema-minimumdoel (zonder maximum), POST/DELETE /api/themas/{id}/minimumdoelen met themabeheerrecht, POST .../themadoelen weg, migratie wist de leerplandoel-themadoelen; unit- en integratietests groen
- 2026-09-16 14:58 · claude-fb043 · frontend klaar: themadoelen op de themapagina zijn minimumdoelen (uitklapbaar per leeftijd), geen 'Koppel aan thema' meer in het doelenregister; ADR-0046, grondwet Art. IX.2/XII/IV.8 en constitutie-log bijgewerkt; alle tests, lint en dotnet format groen
- 2026-09-16 15:07 · claude-fb043 · criteria afgevinkt: koppelen, meebrengen, ontkoppelen en geen maximum in xUnit en Vitest; rechten in RechtenAfdwingingTests (leerkracht en hoofdleerkracht geweigerd) en Vitest (knoppen verborgen); migratie in ThemaMinimumdoelenMigratieTests; browser op een wegwerpdatabase als directie, desktop en 390px, met toetsenbord (koppelen, uitklappen, detail, ontkoppelen, focus terug), contrast 4,97 en 6,51; leerkrachtweergave niet in de browser bekeken
- 2026-09-16 15:07 · claude-fb043 · antagonist ronde 1: 1 MAJOR (Art. XI.1: grondwetswijziging in eigen commit en functionele analyse mee aanpassen), opgelost; ronde 2: COMPLIANT; kleine punten opgelost, rapport in backlog/worklogs/FB-043/antagonist.md
- 2026-09-16 15:07 · claude-fb043 · in-uitvoering → te-testen: gebouwd: minimumdoelen als themadoel zonder maximum, uitklapbaar per leeftijd; oude leerplandoel-themadoelen gewist via migratie; import, AI en dekking ongemoeid; ADR-0046; alle gates groen
- 2026-09-16 15:30 · claude-fb043 · PR #112
