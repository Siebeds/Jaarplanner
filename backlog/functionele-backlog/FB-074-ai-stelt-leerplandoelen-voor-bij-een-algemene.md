---
id: FB-074
titel: AI stelt leerplandoelen voor bij een algemene fiche
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:47
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-4.1, FR-4.2, FR-4.3]
---

## Aanleiding

Bij een activiteit kan de leerkracht de AI doelen laten zoeken ("Zoek doelen"). Bij een algemene fiche kan dat niet:
de leerkracht zoekt de passende leerplandoelen zelf. Een geplande algemene fiche telt mee voor de dekking van de klas,
dus een fiche zonder doelen laat dekking liggen.

## Gewenst gedrag

- Op een algemene fiche staat dezelfde knop als bij een activiteit om doelen te laten zoeken.
- De AI stelt leerplandoelen voor van de leeftijd van de klas van de fiche, elk met een korte motivatie.
- Een voorstel staat als **voorgesteld** tot de leerkracht het aanvaardt of weigert, net zoals bij een activiteit.
- Wie de fiche mag bewerken, mag de AI vragen en beslissen.
- Vindt de AI geen nieuw doel, dan zegt de app dat.

## Acceptatiecriteria

- [ ] Gegeven een algemene fiche van een klas, wanneer de leerkracht van die klas op de knop drukt, dan verschijnen voorgestelde leerplandoelen van de leeftijd van de klas, elk met een motivatie.
- [ ] Gegeven een voorgesteld doel op een fiche, wanneer de leerkracht het aanvaardt, dan is het na herladen gekoppeld, en telt het mee voor de dekking zodra de fiche gepland is.
- [ ] Gegeven een voorgesteld doel, wanneer de leerkracht het weigert, dan wordt het niet gekoppeld en stelt de AI het bij een volgende vraag niet opnieuw voor.
- [ ] Gegeven een gebruiker die de fiche niet mag bewerken, dan ziet die de knop niet, en weigert de app de vraag ook via het adres.
- [ ] Gegeven een vraag waarop de AI geen nieuw doel vindt, dan zegt de app dat er geen doel gevonden werd.

## Testscenario's

1. Meld aan als leerkracht van een klas van de tweede kleuter. Open een algemene fiche, bijvoorbeeld "Kringgesprek".
2. Druk op de knop om doelen te zoeken. Er verschijnen voorgestelde leerplandoelen van de tweede kleuter, elk met een
   motivatie en de vage AI-ring.
3. Aanvaard één doel en weiger een ander. Herlaad: het aanvaarde doel is gekoppeld, het geweigerde niet.
4. Plan de fiche in de agenda en open het dekkingsoverzicht van de klas: het aanvaarde doel telt mee.
5. Meld aan als leerkracht van een andere klas: op die fiche is de knop er niet.

## Buiten scope

- AI-voorstellen bij het aanmaken van een fiche (zie FB-049 voor activiteiten).
- Minimumdoelen koppelen aan een fiche: een minimumdoel telt alleen via een themadoel.

## Open vragen

Geen.

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
