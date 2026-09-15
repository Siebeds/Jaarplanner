---
id: FB-035
titel: Thema start in een gekozen week en loopt door in de volgende themaperiode
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 15:29
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-6.4]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"in sommige gevallen zullen thema's in een themaperiode overlappen (stel een
themaperiode is 6 weken, maar mijn thema die ik dan wil plannen is 5 weken, dan zal er tijdens de laatste week nog een
ander thema starten), deze optie is nu niet mogelijk volgens mij in de tool, kan dat?"*

Vandaag kan dat maar half:

- Een geplaatst thema beslaat altijd de **hele** themaperiode. Een plaatsing onthoudt alleen de start van de periode,
  geen eigen begin of einde.
- Twee thema's in één periode kan wel, en "te vol" telt hun duur op tegen de weken van de periode. Maar de tool weet
  niet dat het tweede thema pas in de laatste week begint: beide staan over de hele periode.
- Doorlopen in de volgende periode kan alleen door het thema **twee keer** te plaatsen. Dan telt het dubbel voor "te
  vol" en ziet de agenda twee losse plaatsingen.
- De subthemaplanner en de keuze van activiteiten in de agenda bieden alleen de dagen en de thema's van de huidige
  periode aan.

**Beslissingen van de eigenaar, 2026-09-15:**

1. Het thema dat in de laatste week start, **loopt door in de volgende themaperiode**.
2. De leerkracht **kiest de startweek**; het einde volgt uit de duur van het thema.
3. De themaperiodes **blijven het raster** (voor "te vol", hergenereren per periode en inzoomen).
4. Eerst alleen **manueel**; de AI-generatie blijft voorlopig hele periodes gebruiken.
5. "Te vol" telt **per periode de eigen weken** van het thema: wat in die periode valt.
6. Een **vakantie telt niet mee**: het thema loopt na de vakantie verder tot zijn weken met school op zijn.

## Gewenst gedrag

- Bij het plaatsen van een thema in een periode, en later op de kaart van die plaatsing, kiest de leerkracht in welke
  week van de periode het thema start. Week 1 is de week waarin de periode begint; zonder keuze start het thema daar,
  zoals nu.
- Het einde volgt uit de duur van het thema, geteld in weken met school. Een vakantie telt niet mee: het thema loopt
  na de vakantie verder.
- Duurt het thema langer dan wat er van de periode overblijft, dan loopt het door in de volgende periode, als **één**
  plaatsing. De leerkracht plaatst het niet twee keer.
- De kalender en de agenda tonen het thema van zijn startweek tot zijn laatste week, ook over de grens van de
  periode. In de week waarin twee thema's overlappen, staan ze allebei.
- In elke week waarin een thema loopt, kan de leerkracht er subthema's en activiteiten van plannen, ook in de weken
  die in de volgende periode vallen.
- "Te vol" telt per periode alleen de weken van een thema die in die periode vallen.
- De themaperiodes zelf blijven zoals ze zijn. Wie de planning van de klas mag bewerken, mag ook de startweek kiezen;
  wie ze alleen mag inkijken, ziet de startweek. De dekking verandert niet: een geplaatst thema telt mee zoals nu.

## Acceptatiecriteria

- [ ] Gegeven een themaperiode van 6 weken met een thema van 5 weken in week 1, wanneer de leerkracht een tweede thema
  van 5 weken toevoegt met startweek 6, dan loopt dat thema van week 6 van die periode tot en met week 4 van de
  volgende periode, als één plaatsing, en tonen kalender en agenda het zo.
- [ ] Gegeven die plaatsing, dan telt "te vol" 1 week van het tweede thema in de eerste periode (samen 6 weken, niet te
  vol) en 4 weken in de volgende periode.
- [ ] Gegeven een thema dat start in de week vóór een vakantie, dan loopt het na de vakantie verder tot zijn weken met
  school op zijn.
- [ ] Gegeven een thema dat doorloopt in de volgende periode, wanneer de leerkracht in de agenda een week van die
  volgende periode opent, dan kan ze er subthema's en activiteiten van dat thema plannen.
- [ ] Gegeven een geplaatst thema, wanneer de leerkracht de startweek op de kaart wijzigt, dan schuift het thema mee en
  blijft het één plaatsing.
- [ ] Gegeven een plan van vóór deze wijziging, dan start elk thema erin in week 1 van zijn periode en verandert er
  niets aan wat de leerkracht ziet.

## Testscenario's

1. Meld aan als leerkracht van een klas en open het plan. Kies een themaperiode van 6 weken.
2. Voeg thema A (5 weken) toe zonder een startweek te kiezen. De kaart toont startweek 1 en het thema loopt tot en met
   week 5.
3. Voeg thema B (5 weken) toe en kies startweek 6. De kaart toont dat B doorloopt in de volgende periode; de kalender
   toont B van week 6 tot en met week 4 van die volgende periode. De eerste periode is niet "te vol".
4. Open de volgende periode. B staat erin als hetzelfde thema, niet als een tweede plaatsing, en telt daar 4 weken mee
   voor "te vol".
5. Open de agenda in week 6 van de eerste periode. A en B staan er allebei. Plan een activiteit van B.
6. Open een week van de volgende periode waarin B nog loopt. Plan er een subthema en een activiteit van B.
7. Zet de startweek van B op 5. B schuift een week naar voren en de eerste periode is nu "te vol".
8. Plaats een thema van 5 weken met startweek in de week vóór de herfstvakantie. Het loopt 1 week vóór en 4 weken na
   de vakantie.

## Buiten scope

- De AI-jaarplangeneratie laat thema's niet zelf midden in een periode starten (beslissing van de eigenaar,
  2026-09-15). Dat wordt later een apart ticket.
- De themaperiodes zelf: hun lengte en hoe ze uit de vakanties volgen, veranderen niet.
- Een einddatum kiezen los van de duur van het thema.

## Open vragen

- **Grondwet en ADR:** Art. IX.3 beschrijft een jaarplan als *"per planningsblok een lijst thema's"*, en in ADR-0020
  hangt een plaatsing aan de startdatum van één blok. Een thema dat over de grens van een periode loopt, past daar niet
  zonder meer in. Vóór de bouw is een nieuwe ADR nodig, en mogelijk een amendement van Art. IX.3 (Art. XI).
- Wat als een gekozen startweek het thema voorbij het einde van het schooljaar laat lopen? Voorstel: de tool weigert
  die startweek met een zin die zegt waarom.
- Een (her)generatie van het hele jaar of van één periode moet de weken zien die een doorlopend thema al inneemt in
  een periode, ook al stelt de AI zelf geen doorlopende thema's voor. Hoe, beslist de bouw.
- Wijzigt de school haar vakanties, geldt dan voor de startweek dezelfde regel als voor een plaatsing nu (directie,
  2026-07-28: nooit stil verschuiven, een blijvende melding, dekking "te herzien")?

## Werklog

- 2026-09-15 15:29 · thema-overlap · aangemaakt (status nieuw)
