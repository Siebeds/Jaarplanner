---
id: TB-009
titel: Demo-seed maakt ook activiteiten aan per subthema
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 12:35
opgepakt-door: demo-seed
branch: ticket/demo-seed-activiteiten
pr:
geblokkeerd:
fr: []
---

## Aanleiding

TB-003 vulde de demo op Azure met klassen, thema's, subthema's, algemene fiches en hoeken, maar zonder activiteiten.
Een subthema zonder activiteiten toont in de demo weinig van wat een leerkracht ermee doet. De eigenaar vroeg op
2026-09-14 om activiteiten voor elke klas in de demo.

## Voorgestelde wijziging

- `infra/seed-demo.data.json`: twee activiteiten per subthema, dus zes per leeftijd (JK, K2, K3) en achttien in
  totaal. Elke activiteit krijgt een naam, een type (bijvoorbeeld uitstap, experiment, prentenboek, hoek), een lengte
  in lesuren, verwachte uitkomsten en een G-leerplandoel. Alles fictief.
- `infra/seed-demo.ps1`: per subthema de activiteiten aanmaken via de API, gekoppeld aan de onderzoeksvraag van dat
  subthema. Een activiteit met dezelfde naam in hetzelfde subthema wordt niet opnieuw aangemaakt, en krijgt alleen de
  doelen uit het databestand die ze nog mist.
- `infra/README.md`: de opsomming van wat het script aanmaakt, aangevuld.

Een activiteit hangt aan een subthema van een leeftijd, niet aan een klas (ADR-0025). Elke klas ziet dus de
activiteiten van haar leeftijd: de twee K2-klassen delen dezelfde zes, net als de twee K3-klassen.

## Acceptatiecriteria

- [ ] Gegeven de geseede demo, wanneer het script draait, dan heeft elk van de negen subthema's twee activiteiten, elk met een type, een lengte, verwachte uitkomsten, de onderzoeksvraag van het subthema en een doel.
- [ ] Gegeven een geslaagde run, wanneer het script een tweede keer draait, dan maakt het geen activiteit dubbel aan.
- [ ] Gegeven een run, dan staat er erna geen nieuwe onversleutelde rij in `data_protection_keys`, en zijn de firewallregel en de tijdelijke roltoewijzing weer weg.

## Buiten scope

- Activiteiten inplannen in de weekplanning of het jaarplan: zoals bij TB-003 alleen de inhoud.
- Activiteiten voor de thema's zonder subthema's.

## Open vragen

Geen.

## Werklog

- 2026-09-14 12:35 · demo-seed · aangemaakt (status in-uitvoering)
