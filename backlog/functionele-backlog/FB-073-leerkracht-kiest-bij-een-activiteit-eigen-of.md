---
id: FB-073
titel: Leerkracht kiest bij een activiteit eigen of gedeeld, collega's plannen een kopie
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:47
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-3.1, FR-10.3]
---

## Aanleiding

Een leerkracht maakt eigen activiteiten (ADR-0049) die parallelleerkrachten van dezelfde jaarfase ook zouden kunnen
gebruiken. Vandaag is niet duidelijk dat collega's ze zien, heeft de maker geen keuze of een activiteit gedeeld wordt,
en vindt een collega ze niet vlot terug bij het inplannen. Een leerkracht die een activiteit per ongeluk alleen voor
zichzelf maakte, moet die achteraf nog kunnen delen.

## Gewenst gedrag

- Bij het aanmaken van een activiteit kiest de leerkracht duidelijk tussen **eigen** en **gedeeld**:
  - **eigen**: alleen de maker (en de admin) ziet de activiteit;
  - **gedeeld**: de collega's van dezelfde jaarfase zien de activiteit en kunnen ze inplannen.
- Het formulier zegt in gewone taal wat de keuze betekent, bijvoorbeeld wie de activiteit te zien krijgt.
- De maker kan een eigen activiteit achteraf delen, en een gedeelde activiteit weer eigen maken.
- In de zijbalk van de agenda staan de gedeelde activiteiten van collega's in een **aparte sectie**, die de leerkracht
  met een schakelaar toont of verbergt.
- Plant een collega een gedeelde activiteit in, dan krijgt die een **eigen kopie**. Die kopie is van haar: ze kan ze
  aanpassen of verwijderen, en dat raakt het origineel en de kopieën van anderen niet.
- Bestaande eigen activiteiten worden **eigen** (alleen voor de maker) tot de maker ze deelt.
- De dekking verandert niet: de kopie is een eigen activiteit van wie ze inplant, en telt zoals elke eigen activiteit
  die in de agenda van de klas staat.

## Acceptatiecriteria

- [ ] Gegeven het formulier voor een nieuwe activiteit, wanneer de leerkracht het opent, dan kiest ze tussen eigen en gedeeld, en zegt het formulier wie de activiteit bij elke keuze te zien krijgt.
- [ ] Gegeven een eigen activiteit van leerkracht A, wanneer een collega van dezelfde jaarfase de zijbalk opent, dan ziet die de activiteit niet, ook niet via het adres.
- [ ] Gegeven een gedeelde activiteit van leerkracht A, wanneer collega B de schakelaar voor gedeelde activiteiten aanzet, dan staat de activiteit in een aparte sectie van de zijbalk en kan B ze inplannen.
- [ ] Gegeven collega B die een gedeelde activiteit inplant, wanneer B daarna de titel wijzigt of de activiteit verwijdert, dan blijft het origineel van A ongewijzigd.
- [ ] Gegeven een eigen activiteit, wanneer de maker ze deelt, dan ziet een collega van dezelfde jaarfase ze na herladen in de sectie met gedeelde activiteiten.
- [ ] Gegeven een activiteit die al bestond vóór deze wijziging, dan is ze eigen, en ziet alleen de maker ze.

## Testscenario's

1. Meld aan als leerkracht A van de derde kleuter. Maak een activiteit en kies "gedeeld". Het formulier zegt dat je
   collega's van de derde kleuter ze zien.
2. Maak een tweede activiteit en kies "eigen".
3. Meld aan als collega B van de derde kleuter. Open de agenda en zet de schakelaar voor gedeelde activiteiten aan: de
   gedeelde activiteit van A staat in een aparte sectie, de eigen activiteit niet.
4. Sleep de gedeelde activiteit naar een dag. Open ze en wijzig de titel. Meld aan als A: de titel van A's activiteit
   is ongewijzigd.
5. Als A: deel de eigen activiteit. Meld aan als B: ze staat nu ook in de sectie met gedeelde activiteiten.
6. Meld aan als een leerkracht van een andere jaarfase: geen van A's activiteiten is zichtbaar.

## Buiten scope

- Delen met leerkrachten van een andere jaarfase.
- Gedeelde activiteiten onder een subthema (die van de hoofdleerkracht): hun rechten en hun dekking blijven zoals ze zijn.
- Wijzigingen aan het origineel doorgeven aan kopieën die al ingepland zijn.

## Open vragen

- Dit wijzigt ADR-0049, waar een eigen activiteit gelezen en gekopieerd wordt door de collega's van de jaarfase. De
  bouwsessie legt de nieuwe regel vast in een ADR die ADR-0049 op dit punt vervangt.

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
