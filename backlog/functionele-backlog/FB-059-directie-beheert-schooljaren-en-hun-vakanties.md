---
id: FB-059
titel: Directie beheert schooljaren en hun vakanties onder Instellingen
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 23:54
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-12.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-16, bij het bekijken van FB-035: *"hoe worden schoolvakanties nu bijgehouden? en moet dat
niet via de instellingen worden ingesteld?"*

Vandaag krijgt een schooljaar zijn vakanties en vrije dagen alleen bij het aanmaken, via de API. Er is geen scherm voor,
en achteraf kan niemand een vakantie wijzigen, toevoegen of schrappen. FR-12.1 vraagt dat de beheerder schooljaren
aanmaakt en de vakantiestructuur instelt; epic-story E6-03 beschreef dat, maar is nooit gebouwd. Dit ticket vervangt
E6-03.

Sinds FB-035 hangt de planning rechtstreeks aan de vakanties: een vakantie deelt een thema in delen, en een thema waar
na een wijziging een vakantie in valt, krijgt een blijvende melding en zet de dekking op "te herzien". Zonder scherm
kan de school die regel niet gebruiken.

## Gewenst gedrag

- Onder **Instellingen** staat een onderdeel **Schooljaren**, alleen voor directie. Wie geen directie is, ziet het niet.
- Directie ziet de schooljaren met hun begin- en einddatum en maakt een nieuw schooljaar aan: naam, eerste en laatste
  dag.
- Per schooljaar ziet directie de **sluitingen**, chronologisch: naam, van, tot en soort (**vakantie** of **vrije
  dag**). Directie voegt er een toe, wijzigt er een of verwijdert er een.
- Een vakantie onderbreekt een thema; een vrije dag niet. Het scherm zegt dat in één korte zin bij de keuze.
- Twee sluitingen die elkaar overlappen, of een sluiting buiten het schooljaar, weigert de tool met een zin die zegt
  waarom.
- Wijzigt directie een vakantie en valt die daardoor in een geplaatst thema, dan verschuift er niets: het thema krijgt
  in het jaarplan de bestaande melding en de dekking staat op "te herzien", zoals FB-035 bepaalt. Het scherm zegt na
  het bewaren hoeveel thema's in hoeveel klassen daardoor aandacht vragen.
- Directie kan de naam en de eerste en laatste dag van een schooljaar wijzigen, en een schooljaar zonder klassen
  verwijderen.

## Acceptatiecriteria

- [ ] Gegeven een directielid, wanneer het Instellingen opent, dan ziet het het onderdeel Schooljaren; een leerkracht
  ziet het niet en de server weigert haar wijzigingen.
- [ ] Gegeven een schooljaar, wanneer directie een vakantie toevoegt, wijzigt of verwijdert, dan toont de agenda en de
  tijdlijn van het jaarplan de nieuwe vakantie meteen.
- [ ] Gegeven een vakantie die overlapt met een andere sluiting, of buiten het schooljaar valt, dan weigert de tool met
  een zin die zegt waarom en wordt er niets bewaard.
- [ ] Gegeven een geplaatst thema, wanneer directie een vakantie toevoegt die erin valt, dan blijft het thema staan,
  toont het jaarplan de melding en zegt het scherm na het bewaren dat er thema's aandacht vragen.
- [ ] Gegeven een schooljaar met klassen, wanneer directie het wil verwijderen, dan weigert de tool en zegt ze waarom.

## Testscenario's

1. Meld aan als directie en open Instellingen → Schooljaren. Het schooljaar staat erin met zijn sluitingen.
2. Voeg een vakantie "Sportweek" toe van maandag tot vrijdag in een week waarin een thema loopt. Bewaar: het scherm zegt
   dat er thema's aandacht vragen.
3. Open het jaarplan van die klas: het thema heeft de melding, de dekking staat op "te herzien", en de tijdlijn toont de
   nieuwe vakantie.
4. Pas de datums van dat thema aan: de tool splitst het rond de vakantie en de melding verdwijnt.
5. Voeg een vrije dag toe binnen een thema: het thema blijft één geheel en krijgt geen melding.
6. Probeer een vakantie die overlapt met een bestaande: de tool weigert met een zin.
7. Meld aan als leerkracht: Schooljaren staat niet onder Instellingen.

## Buiten scope

- Vakanties automatisch ophalen uit de officiële schoolkalender van de Vlaamse overheid.
- Thema's automatisch verschuiven na een wijziging van de vakanties (FB-035: er verschuift nooit iets vanzelf).
- De schooluren per weekdag (FB-023).

## Open vragen

- Mag directie de eerste of laatste dag van een schooljaar wijzigen als er al thema's gepland zijn? Voorstel: ja, en
  thema's die dan buiten het schooljaar vallen krijgen de melding, zoals bij een vakantie.
- Wordt E6-03 in de epic-backlog als vervangen door dit ticket gemarkeerd? Voorstel: ja, bij het oppakken.

## Werklog

- 2026-09-16 23:54 · eigenaar · aangemaakt (status nieuw)
