---
id: TB-022
titel: Dekkingsoverzicht per leergebied, met een actielijst per thema en een rustigere lijst
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 15:49
opgepakt-door: dekking-overzicht
branch: ticket/TB-022-dekking-overzicht
pr:
geblokkeerd:
fr: [FR-9.1, FR-9.2]
---

## Aanleiding

De eigenaar op 2026-09-15: *"bij dekking vind ik het super onduidelijk en niet gebruiksvriendeijk, gewoon een
ellelange lijst aan doelen die niet gedekt zijn geeft geen duidelijk overzicht aan de leerkracht waaraan ze nog moet
werken"*.

Het scherm Dekking (`frontend/src/features/dekking/DekkingScherm.tsx`) toont vandaag alle doelen van de jaarfase in één
lijst, gegroepeerd per domein, met elke groep open en standaard *Alle doelen*. Niets zegt waar het grootste gat zit of
wat de leerkracht als volgende doet. Ook:

- De backend berekent per ontbrekend doel al **waarom** het ontbreekt en **welk thema** het zou dekken (`oorzaak` en
  `kandidaatThemas`, E5-05), maar het scherm, dat voor ADR-0024 opnieuw gebouwd werd, toont dat niet meer.
- Elk leerplandoel hoort bij een discipline (13 in Art. VII.0), maar het scherm kent alleen het domein.
- Onder *Enkel lacunes* telt de teller per groep alleen de zichtbare rijen en toont dus altijd 0/N.
- De tellers per groep blijven staan wanneer het scherm het totaal inhoudt (een verouderde plaatsing, besluit directie
  2026-07-28). Samen tellen ze dat totaal gewoon op: dezelfde fout die E5-02 al eens maakte.

**Beslissingen van de eigenaar, 2026-09-15:** het overzicht groepeert eerst per **leergebied** (discipline), daarna
per domein. Dat vervangt voor dit scherm het besluit van 2026-08-07 bij E5-05 (groepering blijft domein/subdomein);
de export blijft ongewijzigd. Eén ticket, met drie onderdelen: overzicht per leergebied, actielijst per thema en een
rustigere lijst. De doelsoortfilter komt niet terug.

## Voorgestelde wijziging

- **Backend (`Application/Dekking`, `Infrastructure/Persistence`):** `LeerplandoelDekking` krijgt `DisciplineNummer`
  en `DisciplineNaam` (nullable, zoals in het register; de frontend valt terug op het nummer). De opslag haalt de naam
  op via `disciplines`, net als `LeerplandoelenQuery`. De dekkingsberekening zelf verandert niet.
- **Frontend (`features/dekking`):**
  - *Overzicht per leergebied:* één ingeklapte rij per leergebied met *gedekt van totaal* en een balk, het minst
    gedekte leergebied bovenaan. Openklikken toont de domeinen, en daarbinnen de doelen. Een teller telt altijd de hele
    groep, los van de gekozen weergave.
  - *Actielijst* boven het overzicht, opgebouwd uit `oorzaak` en `kandidaatThemas`: hoogstens vijf regels per thema
    (voorstel aanvaarden, weigering terugdraaien, thema inplannen), met hoeveel ontbrekende doelen dat thema zou
    dekken, de grootste eerst, en een link naar de kalender met klas en schooljaar (ADR-0021). Daarnaast één regel voor
    de doelen die wachten op een beslissing over doelsuggesties (link naar Thema's) en één regel, zonder link, voor de
    doelen die geen enkel thema dekt. De aantallen zijn per thema en worden niet opgeteld (een doel kan onder twee
    thema's vallen), en de tekst zegt ook niets dat op een som lijkt.
  - *Rechten:* de link naar de kalender verschijnt alleen met `klasplanningBewerken(klasId)`, die naar Thema's alleen
    met `doelsuggestiesBeoordelen`. Zonder dat recht blijft de zin staan, maar zonder link.
  - *Rustigere lijst:* standaard *Nog te doen*. Elke ontbrekende rij zegt in één korte regel waarom het doel ontbreekt
    en, als dat bestaat, welk thema het oplost.
  - *Ingehouden cijfer:* zolang het totaal ingehouden wordt, toont het scherm geen tellers per leergebied of domein en
    geen actielijst. De reden per rij blijft staan (E5-05).
  - Alle teksten in `nl.json`, zonder em dashes, met bewakingen in `catalogus.test.ts` waar een zin iets beweert.

## Acceptatiecriteria

- [ ] Gegeven een klas met doelen in meerdere leergebieden, wanneer ik Dekking open, dan zie ik één ingeklapte rij per
  leergebied met *gedekt van totaal* en een balk, het minst gedekte bovenaan; openklikken toont de domeinen en daarin
  de doelen, en de teller van een groep verandert niet als ik tussen *Nog te doen* en *Alle doelen* wissel.
- [ ] Gegeven ontbrekende doelen die een thema zou dekken (voorstel, geweigerde plaatsing of niet ingepland), dan staan
  bovenaan hoogstens vijf acties per thema met hun aantal doelen, grootste eerst, elk met een link naar de kalender die
  klas en schooljaar meeneemt; doelen met een doelsuggestie die nog niet beslist is en doelen die geen enkel thema
  dekt, staan elk op één eigen regel.
- [ ] Gegeven een gebruiker die de planning van deze klas niet mag bewerken, dan staan de acties er zonder link naar de
  kalender; de link naar Thema's verschijnt alleen voor wie doelsuggesties mag beoordelen.
- [ ] Gegeven het scherm Dekking, dan staat de lijst standaard op *Nog te doen* en zegt elke ontbrekende rij in één
  regel waarom het doel ontbreekt.
- [ ] Gegeven een verouderde plaatsing die het totaal inhoudt, dan staan er geen tellers per leergebied of domein en
  geen actielijst op het scherm (ook niet in `aria-*`- of `title`-attributen), en blijft de reden per rij staan.
- [ ] Nagekeken in een echte browser op desktop en op ~390px, met contrast gemeten; frontend-tests dekken de groepering,
  het tellen per thema, de rechten en de ingehouden toestand, en de export is ongewijzigd.

## Buiten scope

- De doelsoortfilter (niet gekozen door de eigenaar op 2026-09-15).
- Dekking op minimumdoelniveau: dat blijft E5-04.
- De export (E5-06) en de dekkingsbalk op de agenda.
- Een subdomeinniveau in het overzicht, en elke wijziging aan de dekkingsberekening zelf.

## Open vragen

Geen.

## Werklog

- 2026-09-15 15:49 · dekking-overzicht · aangemaakt (status in-uitvoering)
