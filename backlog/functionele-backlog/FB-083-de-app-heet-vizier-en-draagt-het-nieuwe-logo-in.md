---
id: FB-083
titel: De app heet Vizier en draagt het nieuwe logo in de zijbalk en de aanmeldschermen
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-22
bijgewerkt: 2026-09-22 23:18
opgepakt-door: claude-fb083
branch: ticket/FB-083-vizier-logo
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De app heeft een huisstijl gekregen: een getekend logo (een V uit twee streken met een stip eronder) en een
woordmerk dat **Vizier** zegt. Vandaag draagt de app nog de werknaam "Jaarplanner" boven een driedelige
jaarbalk, een merk dat hier in de bouw is ontstaan en geen echte naam is. Een leerkracht die de app opent
ziet dus iets anders dan wat op het logo, de handleiding en de rest van de communicatie staat.

De eigenaar heeft beslist (2026-09-22) dat de naam in de app **Vizier** wordt. De repository, de
C#-namespaces, de database en de Azure-resources blijven "Jaarplanner": die hernoeming is een eigen traject
en hoort niet bij dit ticket.

De volledige huisstijlkit staat al in de repository, onder `assets/merk/`, met een handleiding in
`assets/merk/README.md`. De bestanden die de app zelf toont, staan klaar in `frontend/public/merk/` onder
vaste namen, zodat een volgend logo een kopieeractie is en geen codewijziging.

## Gewenst gedrag

Overal waar de app zich vandaag voorstelt als "Jaarplanner", staat voortaan het Vizier-logo of de naam
Vizier:

- Linksboven in de zijbalk staat het horizontale logo (het beeldmerk met het woord ernaast). Is de zijbalk
  ingeklapt tot de smalle balk, dan blijft het beeldmerk alleen staan, en blijft de naam leesbaar voor een
  schermlezer.
- De aanmeldschermen (afgemeld, en geen toegang) tonen hetzelfde logo boven hun boodschap.
- De zinnen die de productnaam noemen, noemen Vizier: "met dit account kan je Vizier niet gebruiken",
  "Vizier wordt geopend", "Vizier kan nu niet openen".
- Het logo past zich aan de weergave aan: op een lichte achtergrond de kleurversie, in donkere weergave de
  versie voor donkere grond. Ook wie in de app uitdrukkelijk licht of donker koos, krijgt de juiste versie,
  niet alleen wie zijn toestel laat beslissen.

De driedelige jaarbalk verdwijnt als merk: het logo komt in de plaats. De jaarstrip op het planscherm is
iets anders en blijft ongemoeid.

## Acceptatiecriteria

- [ ] Gegeven een aangemelde leerkracht, wanneer die de app opent met de zijbalk uitgeklapt, dan staat
      linksboven het Vizier-logo met het woordmerk, en nergens nog het woord "Jaarplanner".
- [ ] Gegeven diezelfde leerkracht, wanneer die de zijbalk inklapt tot de smalle balk, dan staat daar het
      beeldmerk alleen, en blijft "Vizier" beschikbaar voor een schermlezer.
- [ ] Gegeven een leerkracht in donkere weergave, wanneer die de zijbalk of een aanmeldscherm bekijkt, dan
      toont het logo de versie voor donkere grond, en is het leesbaar tegen die achtergrond.
- [ ] Gegeven iemand met een account zonder toegang, wanneer die zich aanmeldt, dan draagt het scherm
      "Geen toegang" het logo en noemt de tekst de app Vizier.
- [ ] Gegeven de logobestanden in `frontend/public/merk/`, wanneer je ze vervangt door bestanden met
      dezelfde namen, dan toont de app het nieuwe logo zonder dat er code wijzigt.
- [ ] Er is een ADR die de naam Vizier en het merk vastlegt, met de vaststelling dat de logokleuren gelijk
      zijn aan `--color-accent` en de inkt, en dat de repository en de infrastructuur Jaarplanner blijven.

## Testscenario's

1. Meld je aan en bekijk de zijbalk op een breed scherm. Je ziet het horizontale Vizier-logo linksboven.
2. Klap de zijbalk in. Het beeldmerk (de V met de stip) blijft staan, netjes gecentreerd in de smalle balk.
3. Zet de weergave op donker via de instellingen. Het logo wisselt naar de donkere versie en blijft goed
   leesbaar; de stip is de lichtere turkoois.
4. Zet de weergave terug op licht, en daarna op "zoals het toestel". In alle drie de standen klopt het logo.
5. Meld je af. Het afmeldscherm toont het logo en spreekt over Vizier.
6. Bekijk stap 1 en 2 ook op een smal scherm (ongeveer 390px breed). Het logo blijft heel en valt niet
   buiten zijn vak.
7. Zoek in de app naar het woord "Jaarplanner" (zijbalk, tabblad komt in FB-085, aanmeldschermen). Je vindt
   het nergens meer.

## Buiten scope

- De favicon, de titel van het tabblad en het app-icoon: dat is FB-085.
- De tussenpagina (het scherm vóór de app geladen is) en zijn wachtbeweging: dat is FB-084.
- De naam van de repository, de C#-namespaces, de database, de Azure-resources en de mappen in `docs/`:
  die blijven Jaarplanner.
- De jaarstrip op het planscherm en elk ander gebruik van de driedelige balk binnen de schermen zelf.
- Het merk op wat een leerkracht exporteert of afdrukt (Excel, lesvoorbereiding).

## Open vragen

Geen.

## Werklog

- 2026-09-22 21:49 · Siebe · aangemaakt (status nieuw)
- 2026-09-22 23:18 · claude-fb083 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
