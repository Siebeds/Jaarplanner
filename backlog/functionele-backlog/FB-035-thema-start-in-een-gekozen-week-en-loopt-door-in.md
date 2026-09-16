---
id: FB-035
titel: Thema start in een gekozen week en loopt door in de volgende themaperiode
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-16 23:25
opgepakt-door: fb035-datums
branch: ticket/FB-035-themas-met-datums
pr:
geblokkeerd:
fr: [FR-6.4]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"in sommige gevallen zullen thema's in een themaperiode overlappen (stel een
themaperiode is 6 weken, maar mijn thema die ik dan wil plannen is 5 weken, dan zal er tijdens de laatste week nog een
ander thema starten), deze optie is nu niet mogelijk volgens mij in de tool, kan dat?"*

Vandaag beslaat een geplaatst thema altijd een **hele** themaperiode: een plaatsing onthoudt alleen de start van de
periode. Een thema van 5 weken in een periode van 6 laat dus een week open die de tool niet kan tonen, en een thema dat
doorloopt in de volgende periode moet twee keer geplaatst worden.

Bij het verfijnen op 2026-09-16 besliste de eigenaar dat de oplossing geen startweek binnen de periode is, maar dat
**thema's niet meer in vaste periodes worden gepland**: elke plaatsing krijgt een eigen begin- en einddatum.

**Beslissingen van de eigenaar, 2026-09-15 en 2026-09-16:**

1. Een plaatsing van een thema heeft een **begindatum en een einddatum**, per dag. De themaperiodes verdwijnen uit de
   planning. De eigenaar beslist dit zelf; het vervangt de tweeledige blokindeling van directie (2026-07-14) in
   Art. IX.3, met een nieuwe ADR.
2. De leerkracht **kiest de begindatum**; de tool **stelt het einde voor** uit de duur van het thema, geteld in weken
   met school. De leerkracht kan het einde aanpassen.
3. Valt een **vakantie** in de plaatsing, dan **splitst de tool** ze zelf in delen, samen zo lang als het thema. Elk deel
   is daarna een gewone plaatsing.
4. Er lopen **nooit twee thema's tegelijk**: twee plaatsingen (van hetzelfde of van een ander thema) delen geen dag.
5. Loopt een thema voorbij het einde van het schooljaar, dan **stopt het op de laatste schooldag** en toont de kaart een
   waarschuwing.
6. Wijzigt de school haar vakanties, dan **verschuift er niets stil**: een plaatsing die niet meer klopt, krijgt een
   blijvende melding en de dekking staat op "te herzien" (dezelfde regel als directie op 2026-07-28 gaf).
7. "Te vol" verdwijnt. De tool signaleert in de plaats: **lesweken zonder thema**, een **jaarbalans**, en een **einde dat
   afwijkt van de duur** van het thema.
8. Het planscherm wordt een **tijdlijn per week** (optie A uit de mockup van 2026-09-16), en een balk kan **versleept**
   worden.
9. Bestaande plannen: een thema krijgt de **begin- en einddatum van zijn periode**. Staan er meerdere thema's in één
   periode, dan zet de tool ze **na elkaar**, in hun huidige volgorde. Een thema waarvoor geen dag overblijft, wordt
   **verwijderd** uit het plan.
10. De **AI-generatie wordt in een ander ticket herwerkt**. Tot dan staat de knop "Genereer jaarplan" uit, met een zin
    die zegt waarom.
11. **Vaste momenten** (bv. "Sportweek") **blokkeren geen plaatsing** meer. Alleen een vakantie onderbreekt een thema.
    Bewaarde vaste momenten en startthema's blijven staan voor het AI-ticket.
12. Plaatsingen die een leerkracht als AI-voorstel **geweigerd** had, worden bij het omzetten **verwijderd**. Een
    openstaand voorstel weigeren verwijdert het voorstel.

## Gewenst gedrag

- **Plaatsen.** De leerkracht voegt een thema toe en kiest een begindatum (een lesdag). De tool stelt het einde voor: de
  laatste lesdag vóór dezelfde weekdag zoveel lesweken later als de duur van het thema. Een week die volledig vakantie
  is, telt niet mee; een week met minstens één lesdag telt als lesweek.
- **Einde aanpassen.** De leerkracht kan het voorgestelde einde wijzigen. Zou het voorgestelde einde botsen met het
  volgende thema, dan stelt de tool de laatste lesdag vóór dat thema voor.
- **Vakantie.** Valt er een vakantie tussen begin en einde, dan bewaart de tool twee (of meer) plaatsingen: vóór en na
  de vakantie. Samen hebben ze de duur van het thema. Een losse vrije dag splitst niet.
- **Geen overlap.** Een plaatsing die een dag zou delen met een andere plaatsing, weigert de tool met een zin die het
  andere thema noemt. Dat geldt voor toevoegen, einde aanpassen en slepen.
- **Einde schooljaar.** Een einde voorbij de laatste schooldag wordt die laatste schooldag, en de kaart zegt dat het
  thema korter is dan zijn duur.
- **Tijdlijn.** Het planscherm toont het schooljaar als tijdlijn met een kolom per lesweek; vakanties staan gearceerd.
  Elk thema is een balk van zijn begin tot zijn einde. De delen van een thema rond een vakantie zijn met elkaar
  verbonden en tonen "deel 1/2", "deel 2/2".
- **Slepen.** Een balk naar een andere plek slepen verschuift de plaatsing; ze houdt haar aantal lesdagen. Ook met het
  toetsenbord. Komt ze over een vakantie, dan splitst de tool; komt ze op een ander thema, dan weigert de tool.
- **Kaart.** Een gekozen plaatsing toont begindatum, einddatum, het voorgestelde einde, de andere delen en de knoppen
  om de agenda te openen en de plaatsing (dit deel) te verwijderen.
- **Signalen.** Een lesweek waarin geen thema loopt, is gemarkeerd, met tekst. Bovenaan staat de jaarbalans: lesweken
  in het schooljaar, lesweken met een thema, lesweken zonder thema. Een thema waarvan de delen samen korter of langer
  zijn dan zijn duur, toont "einde aangepast" met het aantal weken.
- **Agenda.** De agenda toont op elke dag het thema dat die dag loopt. Op elke dag van een plaatsing kan de leerkracht
  subthema's en activiteiten van dat thema plannen.
- **Vakanties gewijzigd.** Valt er na een wijziging van de vakanties een vakantie in een plaatsing, of ligt ze niet
  meer in het schooljaar, dan krijgt ze een blijvende melding tot de leerkracht ze opnieuw bewaart of verwijdert. De
  dekking staat zolang op "te herzien". De tool verschuift niets.
- **AI.** De knop "Genereer jaarplan" staat uit en zegt waarom. "Deze periode opnieuw genereren" verdwijnt. De server
  weigert een generatie ook.
- **Rechten en dekking** veranderen niet: wie de planning van de klas mag bewerken, plaatst en verschuift; wie ze mag
  inkijken, ziet de tijdlijn. Een geplaatst thema telt voor de dekking zoals nu.

## Acceptatiecriteria

- [x] Gegeven een thema van 5 weken, wanneer de leerkracht het plaatst met begindatum maandag 21 september, dan stelt de
  tool vrijdag 23 oktober als einde voor en toont de tijdlijn één balk over die 5 lesweken.
- [x] Gegeven een thema van 4 weken en een herfstvakantie van 2 tot 6 november, wanneer de leerkracht het plaatst met
  begindatum maandag 19 oktober, dan bewaart de tool twee plaatsingen, 19–30 oktober en 9–20 november, en toont de
  tijdlijn ze als deel 1/2 en deel 2/2.
- [x] Gegeven een thema dat loopt van 21 september tot 23 oktober, wanneer de leerkracht een ander thema plaatst dat op
  22 oktober begint, dan weigert de tool met een zin die het eerste thema noemt; met begindatum 26 oktober lukt het.
- [x] Gegeven een geplaatst thema, wanneer de leerkracht het einde wijzigt, dan bewaart de tool dat einde en toont de
  kaart "einde aangepast" als de delen samen niet de duur van het thema hebben.
- [x] Gegeven een thema dat na de laatste schooldag zou eindigen, dan eindigt het op de laatste schooldag en toont de
  kaart een waarschuwing.
- [x] Gegeven een plan, dan markeert de tijdlijn elke lesweek zonder thema met tekst, en toont de jaarbalans het aantal
  lesweken, met en zonder thema.
- [x] Gegeven een balk op de tijdlijn, wanneer de leerkracht ze (met muis of toetsenbord) naar een vrije week sleept,
  dan schuift de plaatsing mee met hetzelfde aantal lesdagen; op een ander thema weigert de tool.
- [ ] Gegeven een plaatsing, wanneer de leerkracht in de agenda een dag ervan opent, dan kan ze er subthema's en
  activiteiten van dat thema plannen.
- [x] Gegeven een plan van vóór deze wijziging met één thema per periode, dan heeft elk thema de begin- en einddatum van
  zijn periode en ziet de leerkracht dezelfde thema's op dezelfde plaats.
- [x] Gegeven een periode van vóór deze wijziging met meerdere thema's, dan staan ze na de omzetting na elkaar, elk met
  zijn eigen duur en nooit over het volgende thema heen; een thema zonder vrije dag is verwijderd uit het plan.
- [x] Gegeven een plan van vóór deze wijziging met een geweigerd voorstel, dan is dat voorstel na de omzetting weg; en
  wanneer de leerkracht een openstaand voorstel weigert, dan verdwijnt het uit het plan.
- [ ] Gegeven een bewaard vast moment dat plaatsing blokkeerde, dan kan de leerkracht toch een thema plaatsen op die
  dag.
- [x] Gegeven een plaatsing, wanneer directie een vakantie toevoegt die erin valt, dan toont de kaart een blijvende
  melding, staat de dekking op "te herzien" en is de plaatsing niet verschoven.
- [x] De knop "Genereer jaarplan" staat uit met een zin die zegt waarom, en de server weigert een generatie.

## Testscenario's

1. Meld aan als leerkracht van een klas en open het plan. De tijdlijn toont het schooljaar per lesweek, vakanties
   gearceerd, en de jaarbalans bovenaan.
2. Voeg thema A (5 weken) toe met begindatum 21 september. Het voorgestelde einde is 23 oktober; bewaar.
3. Voeg thema B (4 weken) toe met begindatum 22 oktober. De tool weigert en noemt A. Kies 26 oktober: de tool stelt een
   einde na de herfstvakantie voor en toont B in twee delen.
4. Pas het einde van deel 2 van B een week vroeger aan. De kaart toont "einde aangepast: 3 van 4 weken".
5. Sleep A een week later. De tool weigert, want A zou op B komen. Sleep A een week vroeger: A schuift mee.
6. Een lesweek zonder thema is gemarkeerd; de jaarbalans telt ze.
7. Open de agenda op een dag van deel 2 van B. Plan er een subthema en een activiteit van B.
8. Laat directie een vakantie toevoegen die in A valt. De kaart van A toont een melding en de dekking staat op "te
   herzien". Verplaats A: de melding verdwijnt.
9. Plaats een thema dat na de laatste schooldag zou eindigen. Het stopt op de laatste schooldag, met een waarschuwing.
10. De knop "Genereer jaarplan" staat uit en zegt waarom.
11. Open een plan van vóór de wijziging met twee thema's in één periode: ze staan na elkaar.

## Buiten scope

- De AI-generatie met datums, en wat er met bewaarde startthema's en vaste momenten gebeurt: een apart TB-ticket. Tot
  dan staat de generatie uit en blijven die parameters ongewijzigd bewaard.
- Thema's die elkaar overlappen (bewust uitgesloten door de eigenaar, 2026-09-16).
- De subthemaplaatsingen en de hoekverrijking: die hebben al eigen datums en veranderen niet.
- De schoolsluitingen en het beheer van het schooljaar veranderen niet.

## Open vragen

- Geen. De vragen van 2026-09-15 zijn op 2026-09-16 beantwoord (beslissingen 1, 5, 6 en 10 hierboven).

## Werklog

- 2026-09-15 15:29 · thema-overlap · aangemaakt (status nieuw)
- 2026-09-16 22:00 · eigenaar · nieuw → klaar-voor-bouw: eigenaar: verfijnd in sessie 2026-09-16, thema's krijgen begin- en einddatum
- 2026-09-16 22:00 · fb035-datums · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-16 22:51 · fb035-datums · Backend, migratie en tijdlijn gebouwd; unittests (1952) en frontendtests (1015) groen; integratietests lopen nog.
- 2026-09-16 23:23 · fb035-datums · Antagonist ronde 1: 2 MAJOR (overlap in de migratie, Art. IV.2) opgelost; ronde 2: COMPLIANT. MINOR-punten opgelost of in TB-045.
- 2026-09-16 23:25 · fb035-datums · Afgevinkt met bewijs: 12 criteria (unit-, integratie- en migratietests, browserpas ronde 1-3 in worklogs/FB-035/browserpas.md). Niet afgevinkt: plannen in de agenda op een dag van een doorlopend thema en plaatsen op een dag met een vast moment; die zijn gebouwd maar niet apart in de browser nagekeken.
- 2026-09-16 23:25 · fb035-datums · in-uitvoering → te-testen: Thema's met eigen begin- en einddatum, tijdlijn per lesweek, omzetting van bestaande plannen, generatie uit (TB-045). Gates groen: unit 1952, integratie 546, frontend 1016, lint, dotnet format, browserpas, antagonist COMPLIANT.
