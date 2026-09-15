---
id: FB-002
titel: K3-leerkrachten beheren de gedeelde rapportdoelen en de sterrenschaal
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-15 14:07
opgepakt-door: kindvolg
branch: ticket/FB-002-rapportdoelen-sterrenschaal
pr:
geblokkeerd:
fr: [FR-13.2]
---

## Aanleiding

Een kind wordt in het ontwikkelingsrapport beoordeeld op gegroepeerde doelen, de **rapportdoelen**, met een
**sterrenschaal** (bijvoorbeeld een groene ster voor "volledig bereikt", een oranje ster voor "nog niet volledig"). De
eigenaar besliste dat er één set en één schaal is voor heel K3, zodat de rapporten van alle K3-klassen gelijk zijn (R4,
R5), en dat ze altijd gelden, niet per schooljaar (R7).

Dit is bouwticket 2 van ADR-0035 §6. **Bouwvolgorde:** na E6-02 en FB-001 (de tab).

## Gewenst gedrag

### Rapportdoelen (R3, R4, R7)

- Een K3-leerkracht maakt een rapportdoel met een **titel** (bijvoorbeeld "Luisteren en spreken") en kiest welke
  **K3-subdoelen** uit de eigen thema's van de school het bundelt. De volgorde van de rapportdoelen is aan te passen.
- Alleen een subdoel waarvan het doel beslist is (aanvaard of manueel) is te kiezen (D11).
- Een subdoel verlaat elk rapportdoel wanneer het verdwijnt of niet meer beslist is: het subthema wordt verwijderd, een
  hoofdleerkracht verwijdert het subdoel, het doel wordt geweigerd, of het subthema verhuist naar een andere leeftijd
  (D3, D11, D12). Het rapportdoel houdt zijn titel.

### Sterrenschaal (R5, R7)

- Een gradatie heeft een **label**, een **kleur** uit een vaste lijst en een **volgorde**.
- Een ster verschijnt altijd met haar label, nooit alleen als kleur (Art. XII).

### Wie (R6, R31, D4)

- **Elke K3-leerkracht** wijzigt de set en de schaal: een gebruiker met een klastoewijzing op een klas die K3 geeft, in
  een schooljaar dat nog loopt. Een wijziging geldt voor alle K3-klassen.
- Het scherm zegt dat een wijziging ook doorwerkt op rapporten die al geschreven zijn (R7).
- De **directie** bekijkt de set en de schaal en wijzigt ze niet (R31). Een hoofdleerkracht van K3 zonder
  klastoewijzing op een K3-klas wijzigt ze ook niet.

**Bindend:** Art. VI.7, Art. IX.4 en ADR-0035 §3.2 en §3.3.

## Acceptatiecriteria

- [ ] Gegeven een K3-leerkracht, wanneer die een rapportdoel maakt met een titel en er K3-subdoelen aan koppelt, dan ziet elke K3-leerkracht van de school hetzelfde rapportdoel met dezelfde subdoelen.
- [ ] Gegeven de keuzelijst van subdoelen, dan staan er alleen K3-subdoelen in waarvan het doel aanvaard of manueel is.
- [ ] Gegeven de sterrenschaal, wanneer een K3-leerkracht een gradatie toevoegt met een label en een kleur uit de vaste lijst, dan toont de schaal elke ster met haar label ernaast, in de gekozen volgorde.
- [ ] Gegeven een subdoel in een rapportdoel, wanneer het doel ervan geweigerd wordt of het subdoel verwijderd wordt, dan verdwijnt het uit het rapportdoel, en blijft het rapportdoel met zijn titel bestaan.
- [ ] Gegeven de directie, of een hoofdleerkracht van K3 zonder klastoewijzing op een K3-klas, wanneer die de set of de schaal opent, dan kan die ze bekijken maar niets wijzigen, ook niet via het adres.

## Testscenario's

1. Meld aan als leerkracht A van een K3-klas. Open de tab Ontwikkelingsrapport en daarin de rapportdoelen. Maak
   "Luisteren en spreken" en koppel er twee K3-subdoelen aan. Het rapportdoel staat er met die twee subdoelen.
2. Zoek in de keuzelijst een K3-subdoel waarvan het doel nog voorgesteld of geweigerd is. Het staat er niet in.
3. Open de sterrenschaal. Voeg "Volledig bereikt" (groen) en "Nog niet volledig" (oranje) toe. Elke ster staat er met
   haar label. Wissel de volgorde: de schaal volgt.
4. Het scherm zegt dat een wijziging geldt voor alle K3-klassen en ook doorwerkt op rapporten die al geschreven zijn.
5. Meld aan als leerkracht B van een andere K3-klas. Dezelfde set en schaal staan er. Hernoem een gradatie. Meld weer
   aan als A: de nieuwe naam staat er.
6. Laat het doel van een van de twee subdoelen uit stap 1 weigeren, door wie dat mag. "Luisteren en spreken" heeft nog
   één subdoel.
7. Meld aan als directie. De set en de schaal zijn te zien, zonder knoppen om te wijzigen.

## Buiten scope

- Een set of een schaal per klas of per schooljaar (R4, R5, R7).
- Rapportdoelen die leerplandoelen bundelen in plaats van subdoelen, of een titel zonder subdoelen (R3).
- Kinderen beoordelen (FB-003). Ook de regel dat een rapportdoel of gradatie die in een rapport gebruikt is, niet meer
  verwijderd kan worden (D1), komt met FB-003, want pas dan zijn er beoordelingen.

## Open vragen

- Begint de sterrenschaal leeg, of met een voorstel dat de K3-leerkrachten aanpassen, bijvoorbeeld de groene en de
  oranje ster uit het voorbeeld van de eigenaar?
- Welke kleuren staan in de vaste lijst? Art. XII geeft al kleuren aan de doelsoorten, en de tokens ook aan de
  suggestiestatus en de dekking. De `frontend-design`-stap stelt een lijst voor die daar niet mee botst, en toont ze
  aan de eigenaar.

## Werklog

- 2026-09-14 14:38 · rapport-tickets · aangemaakt (status nieuw)
- 2026-09-15 10:48 · eigenaar · nieuw → klaar-voor-bouw
- 2026-09-15 14:02 · kindvolg · klaar-voor-bouw → in-uitvoering: opgepakt, bovenop FB-001 (eigenaar 2026-09-15); de schaal start met het voorbeeld van de eigenaar
- 2026-09-15 14:07 · kindvolg · eigenaar 2026-09-15: de schaal start met zijn voorbeeld (groen 'Volledig bereikt', oranje 'Nog niet volledig'); vaste kleurenlijst van zes (groen, lichtgroen, geel, oranje, rood, blauw), elk met een donkerdere rand; op het invulscherm (FB-003) geen statusbolletje naast de subdoelen
- 2026-09-15 14:07 · kindvolg · let op: geen enkele weg in de app zet vandaag een subdoel op geweigerd (alle schrijfacties maken manueel), dus testscenario 6 kan niet via de app; D11 wordt gedekt door het filter bij het lezen, en een subdoel dat verwijderd wordt, verlaat elk rapportdoel
