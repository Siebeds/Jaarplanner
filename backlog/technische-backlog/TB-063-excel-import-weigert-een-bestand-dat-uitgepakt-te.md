---
id: TB-063
titel: Excel-import weigert een bestand dat uitgepakt te groot is (zip-bom)
soort: technisch
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 00:21
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Gevonden bij de securityscan van 2026-09-23. Een `.xlsx` is een zip-bestand. De imports geven de upload rechtstreeks
aan ClosedXML (`new XLWorkbook(stream)` in `Infrastructure/SchoolcontentImport/ClosedXmlSchoolcontentParser.cs:39` en
in `Infrastructure/OpstapImport/ClosedXmlOpstapParser.cs`), dat elk werkblad en de gedeelde teksten volledig in het
geheugen uitpakt. `RequestSizeLimit` (10 MB voor de schoolcontent, 20 MB voor Op.stap) begrenst alleen het
gecomprimeerde bestand. Een bestand van enkele MB dat uitgepakt duizend keer groter wordt, kan de API zonder geheugen
zetten, en dan ligt de app plat voor de hele school.

Alleen wie themabeheer of curriculumbeheer heeft, kan uploaden. Het risico is dus een vergissing, een kwaadwillige
collega of een overgenomen account.

## Voorgestelde wijziging

- Vóór ClosedXML het bestand openen met `System.IO.Compression.ZipArchive` en weigeren als het geen geldige zip is, als
  het meer onderdelen heeft dan een drempel, of als de opgetelde uitgepakte grootte (`Length` van de onderdelen) boven
  een drempel ligt. Eén gedeelde controle voor beide imports.
- Een weigering is een Nederlandse melding in de bestaande foutweergave van de import.
- Code: `Infrastructure/SchoolcontentImport`, `Infrastructure/OpstapImport`, eventueel een gedeelde helper, en tests met
  een klein, sterk comprimeerbaar testbestand dat in de test zelf gebouwd wordt.

## Acceptatiecriteria

- [ ] Gegeven een `.xlsx` waarvan de uitgepakte grootte boven de drempel ligt, wanneer themabeheer het in de
  schoolcontent-import laadt, dan weigert de server met een Nederlandse melding, zonder het bestand in ClosedXML te
  openen.
- [ ] Gegeven hetzelfde bestand in de Op.stap-Excelimport, dan weigert de server het op dezelfde manier.
- [ ] Gegeven een bestand dat geen geldige zip is, dan krijgt de gebruiker een duidelijke melding in plaats van een
  serverfout.
- [ ] Gegeven een echte importfile van de school, dan verloopt de import zoals vandaag.

## Buiten scope

- De maximale uploadgrootte zelf: die blijft zoals ze is.
- Andere uploads: de kindtekening wordt al op het aantal pixels gecontroleerd vóór het decoderen.

## Open vragen

- De drempels. Voorstel: hoogstens 100 MB uitgepakt en 1.000 onderdelen, ruim boven een echte importfile.

## Werklog

- 2026-09-23 00:21 · claude-securityscan · aangemaakt (status nieuw)
