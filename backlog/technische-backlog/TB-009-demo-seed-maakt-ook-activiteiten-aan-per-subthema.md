---
id: TB-009
titel: Demo-seed maakt ook activiteiten aan per subthema
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 13:13
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
  subthema met de tekst uit het databestand (anders de eerste, met een waarschuwing als het subthema er geen heeft).
  Een activiteit met dezelfde naam in hetzelfde subthema wordt niet opnieuw aangemaakt, en krijgt alleen de doelen uit
  het databestand die ze nog mist. Een doel dat het databestand bij een activiteit onder `doelenWeg` zet, haalt het
  script bij elke run weg, ook als iemand het later met de hand koppelde; een andere koppeling raakt het nooit aan, en
  een code mag niet tegelijk in `doelen` en `doelenWeg` staan. Zo zijn na de audit drie doelen vervangen die slecht
  bij hun activiteit pasten; die drie regels zijn daarna weer uit het databestand gehaald.
- `infra/README.md`: de opsomming van wat het script aanmaakt, aangevuld.

Een activiteit hangt aan een subthema van een leeftijd, niet aan een klas (ADR-0025). Elke klas ziet dus de
activiteiten van haar leeftijd: de twee K2-klassen delen dezelfde zes, net als de twee K3-klassen.

## Acceptatiecriteria

- [x] Gegeven de geseede demo, wanneer het script draait, dan heeft elk van de negen subthema's twee activiteiten, elk met een type, een lengte, verwachte uitkomsten, de onderzoeksvraag van het subthema en een doel.
- [x] Gegeven een geslaagde run, wanneer het script een tweede keer draait, dan maakt het geen activiteit dubbel aan.
- [x] Gegeven een run, dan staat er erna geen nieuwe onversleutelde rij in `data_protection_keys`, en zijn de firewallregel en de tijdelijke roltoewijzing weer weg.
- [x] Gegeven de drie activiteiten met een vervangen doel, wanneer het script met hun `doelenWeg` draait, dan dragen ze alleen nog hun nieuwe doelen, verandert geen andere koppeling, en haalt een tweede run niets meer weg.

## Buiten scope

- Activiteiten inplannen in de weekplanning of het jaarplan: zoals bij TB-003 alleen de inhoud.
- Activiteiten voor de thema's zonder subthema's.

## Open vragen

Geen.

## Werklog

- 2026-09-14 12:35 · demo-seed · aangemaakt (status in-uitvoering)
- 2026-09-14 13:13 · demo-seed · run 0ca70c4: 18 activiteiten en 18 doelen aangemaakt; tweede run: alles found; databasecontrole: 2 activiteiten per subthema, alle 18 aan de onderzoeksvraag van hun eigen subthema; antagonist ronde 1 COMPLIANT met 2 MINOR, verwerkt in fc0d70e: onderzoeksvraag op tekst gekozen, 3 zwakke doelen vervangen via doelenWeg (run: 3 weg, 4 gekoppeld; herhaalde run: niets meer); sleutels telkens ongewijzigd (1), rol en firewallregel telkens weer weg; antagonist ronde 2 loopt
