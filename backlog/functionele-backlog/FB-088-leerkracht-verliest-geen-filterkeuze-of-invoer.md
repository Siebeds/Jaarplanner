---
id: FB-088
titel: Leerkracht verliest geen filterkeuze of invoer bij herladen of wegklikken
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 09:49
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Een leerkracht verliest vandaag op twee plekken werk dat ze niet wou verliezen:

- **In het dekkingsoverzicht** kiest ze een bereik, een niveau, wat ze wil zien (alleen de gaten of alles) en een
  doelsoort. Herlaadt ze de pagina of gaat ze even naar een ander scherm, dan staat alles weer op de beginstand. Een
  gefilterd overzicht kan ze ook niet als link doorsturen naar een collega of de directie.
- **In een zijpaneel** (een activiteit, een subthema, een algemene fiche, een hoek of een klas bewerken) sluit een
  klik naast het paneel of op Annuleren het formulier zonder waarschuwing, ook als ze al iets getypt had. Alleen het
  themaformulier waarschuwt daar al voor (FB-061).

## Gewenst gedrag

- **Dekkingsoverzicht:** de gekozen filters blijven staan na herladen en na terugkeren met de terugknop. Wie de
  link kopieert en doorstuurt, geeft de ontvanger hetzelfde gefilterde overzicht, als die de klas mag zien.
- **Zijpanelen met een formulier:** wie het paneel sluit (naast het paneel klikken, Escape, het kruisje of
  Annuleren) terwijl er onbewaarde wijzigingen zijn, krijgt eerst dezelfde vraag als in het themaformulier: de
  wijzigingen weggooien of verder bewerken. Zonder wijzigingen sluit het paneel meteen, zoals nu.

## Acceptatiecriteria

- [ ] Gegeven een dekkingsoverzicht met een ander bereik, niveau en doelsoort dan de beginstand, wanneer de
      leerkracht de pagina herlaadt, dan staan dezelfde filters er nog.
- [ ] Gegeven zo'n gefilterd dekkingsoverzicht, wanneer een collega van dezelfde jaarfase de link opent, dan ziet
      ze hetzelfde bereik, niveau en dezelfde doelsoort.
- [ ] Gegeven het paneel van een activiteit waarin de leerkracht de naam wijzigde, wanneer ze naast het paneel
      klikt, dan vraagt de app om de wijzigingen weg te gooien of verder te bewerken, en blijft het paneel open.
- [ ] Gegeven diezelfde vraag, wanneer ze "Verder bewerken" kiest, dan staat haar getypte tekst er nog.
- [ ] Gegeven een paneel zonder wijzigingen, wanneer ze het sluit, dan sluit het meteen, zonder vraag.

## Testscenario's

1. Open Dekking, kies een ander bereik, het niveau leerplandoelen en een doelsoort. Herlaad de pagina: dezelfde
   keuzes staan er nog.
2. Kopieer de adresbalk en open ze in een nieuw venster: hetzelfde gefilterde overzicht verschijnt.
3. Open in de agenda een activiteit, wijzig de naam en klik naast het paneel: de vraag om weg te gooien of verder te
   bewerken verschijnt. Kies "Verder bewerken": de gewijzigde naam staat er nog.
4. Klik opnieuw naast het paneel en kies "Weggooien": het paneel sluit en de activiteit heeft haar oude naam.
5. Open een subthema, een algemene fiche en een klas zonder iets te wijzigen en sluit het paneel: het sluit meteen.

## Buiten scope

Het ontwikkelingsrapport, dat al automatisch bewaart, en de filters van andere schermen dan Dekking.

## Open vragen

- Welke zijpanelen precies? Voorstel: elk paneel met een formulier dat pas bewaart op een knop (activiteit,
  subthema, algemene fiche, hoek, hoekverrijking, klas, uitnodiging). Panelen die meteen bewaren, vallen erbuiten.
- Moeten de opengeklapte groepen in dekking ook in de link, of alleen de vier filters? Voorstel: alleen de filters.

## Werklog

- 2026-09-23 09:49 · claude-vercelanalyse · aangemaakt (status nieuw)
