---
id: FB-001
titel: K3-leerkracht beheert de kinderen van de klas, via een nieuwe tab onderaan de zijbalk
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-15 14:43
opgepakt-door: kindvolg
branch: ticket/FB-001-kinderen-van-de-klas
pr:
geblokkeerd:
fr: [FR-13.1, FR-13.7, FR-13.10]
---

## Aanleiding

De leerkrachten van de derde kleuter schrijven drie keer per jaar een ontwikkelingsrapport per kind, voor de ouders
(FR-13, [ADR-0035](../../docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md)). Dat begint bij de kinderen: vandaag kent
de tool geen kinderen, en het rapport heeft nog geen plaats in de app.

Dit is bouwticket 1 van ADR-0035 §6. **Bouwvolgorde:** na E6-02, omdat de rechten van ADR-0035 §3.3 in de ene
rechtenlaag van E6-02 komen.

## Gewenst gedrag

### De tab (R32, D17, D18)

- Onderaan de linkerzijbalk komt een nieuwe sectie, met een eigen lijn, ver onder de fiches, met de tab
  **Ontwikkelingsrapport**. Vanaf `lg` staat ze net boven Instellingen, dat het laatste blijft voor de aanmeldregel.
- De schakelaars Hoekenfiches en Algemene fiches blijven waar ze staan.
- Alleen wie rapporten mag zien, ziet de tab: een gebruiker met een klastoewijzing op een klas die K3 geeft, en de
  directie. Leerlingzorg krijgt de tab met FB-008.
- De tab komt samen met het eerste scherm erachter, zodat hij nooit naar een leeg scherm leidt.

### De kinderen van de klas (R14, R15, D8, D9, R26)

- Een leerkracht van de klas, of de directie, voegt een kind toe met **voornaam en achternaam**, met de hand, één per
  één. Het scherm vraagt niets anders: geen geboortedatum, adres, ouder of nummer uit een ander systeem.
- De naam van een kind kan gewijzigd worden.
- Een kind kan altijd verwijderd worden, met alle rapporten van het kind (voor een kind dat de school verlaat, of een
  ouder die om wissing vraagt). De bevestiging zegt dat de rapporten mee verdwijnen.
- Alleen een klas die K3 geeft, kan kinderen hebben. Dat bepaalt de ene plaats in de code die een klas aan zijn
  leeftijden koppelt (Art. VI.1).
- Na het einde van het schooljaar kan de leerkracht de kinderen nog zien, maar niet meer toevoegen, wijzigen of
  verwijderen. De directie kan dat nog wel.
- Een leerkracht van een andere klas ziet de kinderen van deze klas niet (R17).

**Bindend:** Art. VI.7 en ADR-0035 §3.3, §3.8, §3.9 en §3.10. Namen van kinderen komen nooit in een log, en de bouw
test met verzonnen namen.

## Acceptatiecriteria

- [ ] Gegeven een leerkracht met een klastoewijzing op een K3-klas, wanneer die de app opent, dan staat onderaan de linkerzijbalk, in een eigen sectie onder een lijn en ver onder de fiches, de tab Ontwikkelingsrapport; een gebruiker zonder K3-klas en zonder directierecht ziet die tab niet.
- [ ] Gegeven die tab, wanneer de leerkracht een kind toevoegt met voornaam en achternaam, dan staat het kind in de lijst van de klas, en vraagt het scherm geen enkel ander gegeven over het kind.
- [ ] Gegeven een kind in de lijst, wanneer de leerkracht de naam wijzigt of het kind verwijdert, dan is dat na herladen bewaard, en zegt de bevestiging bij het verwijderen dat de rapporten van het kind mee verdwijnen.
- [ ] Gegeven een leerkracht van een andere klas, wanneer die de kinderen van deze klas probeert te openen, ook via het adres in de browser, dan weigert de app.
- [ ] Gegeven een schooljaar dat voorbij is, wanneer de leerkracht van de klas de lijst opent, dan kan die de kinderen zien maar niet toevoegen, wijzigen of verwijderen; de directie kan dat nog wel.
- [ ] Gegeven een klas die geen K3 geeft, dan kan niemand er een kind aan toevoegen.

## Testscenario's

1. Meld aan als leerkracht met een klastoewijzing op een K3-klas. Onderaan de zijbalk staat, onder een lijn en boven
   Instellingen, de tab Ontwikkelingsrapport.
2. Open de tab en voeg "Fien Proefmans" en "Staf Voorbeeld" toe. Beide staan in de lijst. Er is geen veld voor iets
   anders dan voornaam en achternaam.
3. Wijzig "Staf" in "Stef" en herlaad de pagina. De nieuwe naam staat er.
4. Verwijder "Stef Voorbeeld". De bevestiging zegt dat de rapporten van het kind mee verdwijnen. Na bevestigen is het
   kind weg.
5. Meld aan als leerkracht van een K2- of een L-klas. De tab staat er niet. Plak het adres van de kinderenlijst uit
   stap 2: de app weigert.
6. Meld aan als directie. De tab staat er, en de kinderen van elke K3-klas zijn te zien en te wijzigen.
7. Kies als leerkracht een schooljaar dat voorbij is. De lijst is te zien, zonder knoppen om toe te voegen, te wijzigen
   of te verwijderen.
8. Herhaal stap 1 en 2 op een telefoonbreedte (~390px). Het rapport is bereikbaar op de manier die de ontwerpstap
   koos (zie *Open vragen*).

## Buiten scope

- Rapporten invullen (FB-003), en de rapportdoelen en de sterrenschaal (FB-002).
- Een lijst namen plakken, of namen overnemen uit Informat, Smartschool of een ander leerlingensysteem (R15; een
  koppeling blijft buiten scope, Art. I.2).
- Een kind met zijn rapporten naar een andere klas verhuizen (D10): het wordt verwijderd in de ene klas en toegevoegd
  in de andere. Dat wordt een ticket als de school erom vraagt.
- Het recht Leerlingzorg (FB-008).
- Graadklassen: een klas die in de tool als K2 staat, krijgt geen kinderen, ook niet voor zijn K3-kinderen, tot de
  directie vraag 14 in `docs/besluiten-gevraagd.md` beantwoordt.

## Open vragen

Te beslissen in de `frontend-design`-stap van dit ticket en te tonen aan de eigenaar (ADR-0035 §3.10):

- De onderbalk op een telefoon heeft vandaag vijf tabs, en de navigatie zegt zelf dat vijf is wat past. Wordt het
  rapport daar een zesde tab, of is het op een telefoon op een andere manier bereikbaar?
- Bedoelt de eigenaar met *"ONDERAAN"* helemaal onderaan, onder Instellingen, in plaats van net erboven (D17)?

## Werklog

- 2026-09-14 14:38 · rapport-tickets · aangemaakt (status nieuw)
- 2026-09-15 10:48 · eigenaar · nieuw → klaar-voor-bouw
- 2026-09-15 10:48 · kindvolg · klaar-voor-bouw → in-uitvoering: opgepakt; ontwerpkeuzes eigenaar: laptop boven Instellingen, telefoon via Instellingen
- 2026-09-15 11:06 · kindvolg · frontend gebouwd: tab onderaan de zijbalk boven Instellingen (vanaf lg), op de telefoon via Instellingen, scherm Kinderen per K3-klas; pnpm lint groen, schermtests groen; backend loopt nog
- 2026-09-15 11:25 · kindvolg · browsercheck geslaagd op 1440 en 390 (K3-leerkracht tijdens en na het schooljaar, K2-leerkracht, directie); '0 kinderen' naast de lege lijst weggehaald; verslag in backlog/worklogs/FB-001/browsercheck.md
- 2026-09-15 13:59 · kindvolg · antagonist ronde 1: VIOLATIONS FOUND (1 MAJOR, 9 MINOR, 1 vraag); de eigenaar besliste de vraag (een K3-klas met kinderen blijft K3); fixronde 1 geschreven: klassenlijst zegt zelf welke klas kinderen kan hebben, zinnen scherper, no-store getest; verslag in backlog/worklogs/FB-001/
- 2026-09-15 14:20 · kindvolg · antagonist ronde 2: MAJOR opgelost, 5 MINOR; fixronde 2: test pint 'volg de server' in beide richtingen, een mislukte lading zegt niet meer 'geen schooljaar', contrast gemeten in licht en donker (alles haalt de norm), browseraddendum en controle-uitslagen vastgelegd; frontend 65 bestanden, 649 tests groen
- 2026-09-15 14:32 · kindvolg · antagonist ronde 3: 3 MINOR; fixronde 3: 'fout' geldt alleen voor een mislukte eerste lading (een mislukte herlading houdt de lijsten en de getypte naam), zin zegt minder, eigen test voor de hook, verouderde regel in het browserverslag doorgehaald; oxlint en tsc schoon, 66 bestanden en 653 tests groen
- 2026-09-15 14:43 · kindvolg · antagonist ronde 4: F, G en H opgelost (met mutatietests nagegaan), 1 MINOR in een codecommentaar; fixronde 4 past die ene bijzin aan (geen codewijziging)
