---
id: FB-078
titel: Leerkracht neemt hoekverrijkingen van vorig jaar over bij hetzelfde subthema
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:47
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-12.4]
---

## Aanleiding

Een hoekverrijking hoort bij één hoek van een klas en één plaatsing van een subthema in de agenda (ADR-0041). Het
volgende schooljaar is die plaatsing er niet meer, en schrijft de leerkracht bij hetzelfde subthema alles opnieuw,
terwijl ze haar verrijkingen van vorig jaar wil hergebruiken.

## Gewenst gedrag

- Staat een subthema in de agenda van de leerkracht, en had **haar klas van vorig schooljaar** bij hetzelfde subthema
  hoekverrijkingen, dan biedt de app die aan om over te nemen.
- Een verrijking gaat naar de hoek met **dezelfde naam** in de klas van dit jaar. Heeft die klas zo'n hoek niet, dan
  zegt de app welke verrijking niet overgenomen kan worden.
- Overnemen maakt een kopie: de leerkracht past ze daarna aan zonder dat vorig jaar verandert.
- Staat er bij een hoek al een verrijking, dan vraagt de app of ze die vervangt, en overschrijft ze niets zonder te
  vragen.

## Acceptatiecriteria

- [ ] Gegeven een subthema in de agenda van dit jaar, en verrijkingen bij hetzelfde subthema in de klas van de leerkracht vorig jaar, wanneer ze de hoekverrijkingen van dat subthema opent, dan biedt de app aan die over te nemen.
- [ ] Gegeven een overname, dan staat elke verrijking bij de hoek met dezelfde naam, en blijft de verrijking van vorig jaar ongewijzigd wanneer de leerkracht de kopie aanpast.
- [ ] Gegeven een verrijking van vorig jaar voor een hoek die de klas dit jaar niet heeft, dan zegt de app dat die niet overgenomen werd.
- [ ] Gegeven een hoek die dit jaar al een verrijking heeft, wanneer de leerkracht overneemt, dan vraagt de app eerst of die vervangen wordt.
- [ ] Gegeven een subthema zonder verrijkingen vorig jaar in haar klas, dan biedt de app niets aan.

## Testscenario's

1. Zorg dat de leerkracht vorig schooljaar in een klas stond met een hoek "Bouwhoek" en een verrijking bij het
   subthema "Bladeren".
2. Meld aan als die leerkracht in het nieuwe schooljaar. Plan "Bladeren" in de agenda en open de hoekverrijkingen: de
   app biedt de verrijkingen van vorig jaar aan.
3. Neem ze over: de verrijking staat bij "Bouwhoek". Wijzig de tekst.
4. Open vorig schooljaar: de oorspronkelijke tekst staat er nog.
5. Verwijder in de klas van dit jaar een hoek die vorig jaar een verrijking had, en neem opnieuw over: de app zegt welke
   verrijking niet overgenomen kon worden.

## Buiten scope

- Verrijkingen van andere klassen of van oudere schooljaren dan het vorige.
- Verrijkingen delen met collega's.

## Open vragen

- "Haar klas van vorig schooljaar": stond de leerkracht vorig jaar in meer dan één klas, of kreeg ze een klas van een
  andere leeftijd, welke klas geldt dan? De bouwsessie legt dit voor aan de eigenaar.

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
