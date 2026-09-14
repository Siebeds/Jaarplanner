---
id: TB-015
titel: Hoekenfiches en algemene fiches: plus-tegel onderaan het zijpaneel om er een aan te maken
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 16:06
opgepakt-door: fiche-plus
branch: ticket/fiche-plus-in-paneel
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vroeg op 2026-09-14: *"ik wil in de linker sidepane bij de hoekenfiches en algemene fiches onderaan een
user friendly knop/fiche tile met een plus die de user kan gebruiken om een fiche/hoek nieuw aan te maken"*.

Vandaag toont het zijpaneel naast de agenda alleen de fiches die er al zijn. Wie tijdens het plannen merkt dat een hoek
of een algemene fiche ontbreekt, moet de agenda verlaten en naar Instellingen gaan. Alleen een lege lijst toont een
link daarheen; zodra er een fiche bestaat, is er in het paneel geen weg meer om er een bij te maken.

## Voorgestelde wijziging

- In `frontend/src/features/hoeken/Hoekenpaneel.tsx` komt onder de lijst een tegel in de vorm van een fiche, met een
  plus en de naam van de actie: "Hoek toevoegen" in de hoekenfiches, "Fiche toevoegen" in de algemene fiches. Dat zijn
  de bestaande sleutels `hoeken.toevoegen` en `algemeneFiches.toevoegen`, dus dezelfde actie heet in de agenda en in
  Instellingen hetzelfde, en `nl.json` verandert niet.
- De tegel opent het bestaande formulier (`Hoekformulier` of `Algemeneficheformulier`) als blad, en bewaart met de
  bestaande hooks `useMaakHoek` en `useMaakAlgemeneFiche` voor de klas van de agenda. De lijst ververst zichzelf, dus
  de nieuwe fiche staat na het bewaren meteen in het paneel, klaar om te slepen.
- Op een telefoon is het paneel zelf een blad. Het sluit eerst, zoals bij het kiezen van een fiche, zodat ze niet twee
  bladen diep zit, en gaat weer open wanneer het formulier sluit, zodat ze terugkomt bij de lijst.
- De tegel staat er ook bij een lege lijst. Hij staat er niet zolang de lijst laadt, niet als de lijst niet geladen kon
  worden (dan weet het paneel niet wat er al bestaat), en niet zonder gekozen klas.
- Tests in `Hoekenpaneel.test.tsx`.

## Acceptatiecriteria

- [ ] Gegeven de hoekenfiches in het zijpaneel, wanneer ze op "Hoek toevoegen" onderaan klikt en een naam bewaart, dan
  staat de nieuwe hoek in de lijst van het paneel zonder dat ze de agenda verlaat.
- [ ] Gegeven de algemene fiches in het zijpaneel, wanneer ze op "Fiche toevoegen" onderaan klikt en een naam bewaart,
  dan staat de nieuwe fiche in de lijst van het paneel.
- [ ] Gegeven een klas zonder hoeken of zonder algemene fiches, dan toont het paneel de tegel ook, onder de zin die zegt
  dat er nog geen zijn.
- [ ] Gegeven een lijst die niet geladen kon worden, dan toont het paneel geen tegel.
- [ ] Gegeven een telefoonbreedte (~390px), wanneer ze op de tegel tikt, dan sluit het paneelblad, opent het formulier,
  en na bewaren of annuleren staat ze weer in het paneel.
- [ ] De tegel is met het toetsenbord bereikbaar, heeft een zichtbare focusring, en is in een echte browser nagekeken
  op desktop en op ~390px.

## Buiten scope

Een fiche wijzigen of verwijderen vanuit het paneel, en doelen koppelen aan een algemene fiche: dat blijft in
Instellingen. Het afschermen van de tegel per recht hoort bij E6-02 (deel 4, het afschermen in de frontend), samen met
de andere acties van dit paneel; de server weigert al wie het recht niet heeft.

## Open vragen

Geen.

## Werklog

- 2026-09-14 16:06 · fiche-plus · aangemaakt (status in-uitvoering)
