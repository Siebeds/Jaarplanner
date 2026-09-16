---
id: FB-054
titel: AI zoekt thema's en koppelingen voor niet gedekte doelen en vult het schooljaar
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 21:53
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-4.1, FR-4.4, FR-9.2, FR-5.3]
---

## Aanleiding

De eigenaar vroeg op 2026-09-16: *"ik wil vanuit de doelen thema suggesties krijgen - bv. ik zie nog doelen staan die
niet gedekt zijn en ik als school zoek nog gepaste thema's en subthema's die deze doelen zouden kunnen coveren. ma ook
als er al thema en subthemas bestaan, ook kijken of de doelen daar niet inpassen, in general ervoor zorgen dat er
genoeg themas zijn om het schooljaar rond te komen."*

Vandaag toont het dekkingsoverzicht welke doelen ontbreken (FR-9.2), maar de AI helpt alleen bij één bestaand thema
(doelsuggesties). Niemand ziet of de thema's van de school samen het schooljaar vullen, en de AI zoekt geen plaats voor
een doel dat nergens zit.

**Beslissingen van de eigenaar, 2026-09-16:**

- Een nieuw ticket bovenop FB-024: FB-024 blijft "één thema voorstellen op basis van gekozen doelen"; dit ticket voegt
  de hiatenanalyse toe en gebruikt FB-024 voor nieuwe thema's.
- Vertrekpunt op twee plaatsen: schoolbreed (doelen die in geen enkel thema of subthema zitten) én per klas vanuit het
  dekkingsoverzicht.
- Bij bestaande thema's en subthema's stelt de AI koppelingen voor, die één voor één aanvaard of geweigerd worden.
- Een teller zonder AI toont per leeftijd het tekort aan themaweken; de AI stelt zoveel nieuwe thema's voor als nodig
  om dat tekort te vullen.
- De rechten blijven zoals ze zijn (Art. VI.1).
- Minimumdoelen én leerplandoelen doen mee: een minimumdoel wordt themadoel van een thema (ADR-0046), een leerplandoel
  subdoel van een subthema.
- **Grondwet:** de AI mag nieuwe thema's en subthema's bedenken, met namen en onderzoeksvragen uit eigen kennis, maar
  doelen komen alleen uit de geladen doelen en niets wordt bewaard zonder aanvaarden. Dat vraagt een wijziging van
  Art. IV.4 en IV.8 (Art. XI), in een eigen commit met een ADR, vóór de bouw van dit ticket of FB-024.

## Gewenst gedrag

- **Schoolbreed**, voor directie en themabeheer: een overzicht per leeftijd van de minimumdoelen en leerplandoelen die
  in geen enkel thema of subthema van de school zitten.
- **Per klas**, in het dekkingsoverzicht: een knop bij de ontbrekende doelen van die klas die dezelfde analyse start
  voor die doelen.
- **Teller zonder AI:** per leeftijd het aantal weken dat de thema's samen duren, tegenover het aantal schoolweken van
  het schooljaar, met het tekort of het overschot erbij.
- **AI-voorstellen**, elk met een korte motivatie:
  - een minimumdoel als themadoel bij een bestaand thema;
  - een leerplandoel als subdoel bij een bestaand subthema van die leeftijd;
  - nieuwe thema's met subthema's per leeftijd (zoals FB-024), zoveel als nodig om het tekort aan weken te vullen, met
    de ontbrekende doelen als themadoelen en subdoelen.
- Elk voorstel wordt apart aanvaard, aangepast of geweigerd; de status wordt bewaard. Een geweigerd voorstel komt bij
  een nieuwe vraag niet terug.
- **Wie beslist:** directie en themabeheer over nieuwe thema's en themadoelen; de hoofdleerkracht van de jaarfase over
  subdoelen bij subthema's van die leeftijd. Een leerkracht ziet de voorstellen vanuit haar dekkingsoverzicht, maar
  beslist er niet over.

## Acceptatiecriteria

- [ ] Gegeven K3-minimumdoelen die in geen enkel thema zitten, wanneer themabeheer de analyse opent, dan ziet ze die doelen per leeftijd en per doelsoort.
- [ ] Gegeven thema's die voor K3 samen 30 weken duren in een schooljaar van 36 schoolweken, dan toont de teller voor K3 een tekort van 6 weken, zonder AI-aanroep.
- [ ] Gegeven een ontbrekend minimumdoel dat bij een bestaand thema past, wanneer themabeheer voorstellen vraagt, dan krijgt ze een voorstel "themadoel bij thema X" met een motivatie; na aanvaarden staat het doel als themadoel op dat thema.
- [ ] Gegeven een tekort van 6 weken, wanneer themabeheer voorstellen vraagt, dan bevat het antwoord nieuwe thema's die samen ongeveer 6 weken duren, met subthema's per leeftijd en de ontbrekende doelen.
- [ ] Gegeven een modelantwoord met een doelcode die niet bij de ontbrekende doelen hoort, of een thema of subthema dat niet bestaat, dan wordt dat voorstel niet getoond en niet bewaard.
- [ ] Gegeven een geweigerd voorstel, wanneer opnieuw voorstellen gevraagd worden, dan komt het niet terug.
- [ ] Gegeven een leerkracht in het dekkingsoverzicht van haar klas, dan ziet ze de voorstellen maar kan ze niets aanvaarden; de server weigert het ook. Een hoofdleerkracht aanvaardt een subdoel alleen bij haar eigen jaarfase.
- [ ] De logica is getest met een nep-AI-client.

## Testscenario's

1. Meld aan als themabeheer en open de hiatenanalyse. Je ziet per leeftijd de doelen die nergens zitten, en per
   leeftijd de teller met de weken van de thema's tegenover de schoolweken.
2. Kies K3 en vraag AI-voorstellen. Je krijgt koppelingen aan bestaande thema's en subthema's en, als er een tekort is,
   nieuwe thema's met subthema's, elk met een motivatie.
3. Aanvaard een koppeling "themadoel bij thema X". Open thema X: het doel staat bij de themadoelen en verdwijnt uit de
   analyse.
4. Weiger een nieuw thema en vraag opnieuw voorstellen. Het geweigerde thema komt niet terug.
5. Aanvaard een nieuw thema. Het staat in de themalijst en de teller van K3 toont een kleiner tekort.
6. Meld aan als leerkracht van een K3-klas en open het dekkingsoverzicht. Klik de knop bij de ontbrekende doelen. Je
   ziet voorstellen, zonder knoppen om te aanvaarden.
7. Meld aan als hoofdleerkracht van K2 en probeer een subdoel bij een K3-subthema te aanvaarden: dat lukt niet.

## Buiten scope

- Eén thema voorstellen op basis van zelf gekozen doelen: FB-024 (dit ticket gebruikt het).
- Minimumdoelen voorstellen bij één thema: FB-053.
- Activiteiten voorstellen: FB-025.
- Thema's in de agenda plaatsen: dat blijft de jaarplangeneratie (FR-5).

## Open vragen

- **Grondwet:** de wijziging van Art. IV.4 en IV.8 (beslist op 2026-09-16, zie Aanleiding) moet nog geschreven worden,
  met een ADR, vóór dit ticket gebouwd wordt.
- **Hangt af van** FB-024 en FB-053.
- **Omvang van de AI-vraag:** alle ontbrekende doelen van een leeftijd passen mogelijk niet in één vraag (TB-007). Hoe
  de analyse ze opdeelt (per leeftijd, per leergebied), beslist de bouw; de teller en het overzicht zonder AI werken
  altijd.
- **Schoolweken:** telt een week met enkele vrije dagen als een volle schoolweek voor de teller?

## Werklog

- 2026-09-16 21:53 · eigenaar · aangemaakt (status nieuw)
