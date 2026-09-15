---
id: FB-028
titel: AI stelt hoekenverrijkingen voor bij het lopende subthema
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 21:12
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-4.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"Hoekenverrijkingen die passen bij dat subthema voorstellen"*.

Met FB-020 vult een leerkracht per hoek een verrijking in voor het lopende subthema. Een AI-voorstel helpt haar op weg.

## Gewenst gedrag

- Waar de leerkracht de verrijkingen invult, vraagt ze "stel verrijkingen voor". Sinds FB-038 is dat het zijpaneel
  Hoekenfiches, met een blad per hoek (zie Open vragen).
- De AI krijgt het subthema (naam, onderzoeksvragen, subdoelen) en de hoeken van de klas (naam, omschrijving), en stelt per
  hoek een verrijking voor, met een korte motivatie.
- Per hoek: het voorstel overnemen (en daarna aanpassen), of weigeren. Een voorstel en de beslissing worden bewaard.
- Een hoek die al een verrijking heeft, krijgt ook een voorstel, maar zijn tekst wordt pas vervangen als de leerkracht
  dat kiest.

## Acceptatiecriteria

- [ ] Gegeven een klas met drie hoeken en een lopend subthema, wanneer de leerkracht voorstellen vraagt, dan krijgt ze per
  hoek een voorstel met een motivatie.
- [ ] Gegeven een voorstel, wanneer ze het overneemt, dan staat het als verrijking van die hoek voor die periode, en ze
  kan het nog aanpassen.
- [ ] Gegeven een hoek met een bestaande verrijking, dan blijft die staan tot de leerkracht het voorstel overneemt.
- [ ] Gegeven een geweigerd voorstel, dan verandert er niets aan de verrijking.
- [ ] De logica is getest met een nep-AI-client.

## Testscenario's

1. Open de agenda van een K2-klas in een week waarin een subthema loopt, en open links Hoekenfiches.
2. Kies "stel verrijkingen voor". Elke hoek krijgt een voorstel met een motivatie.
3. Neem het voorstel voor de boekenhoek over en pas een woord aan. Bewaar: het staat als verrijking.
4. Weiger het voorstel voor de bouwhoek. Zijn verrijking blijft zoals ze was.

## Buiten scope

- Doelen voorstellen bij een verrijking: de doelen blijven met de hand (FB-019).

## Open vragen

- **Waar staat de knop?** Sinds FB-038 vult de leerkracht een verrijking in via een blad per hoek, vanuit het zijpaneel
  Hoekenfiches. De knop kan bovenaan het paneel staan (een voorstel voor alle hoeken van het lopende subthema samen), of
  in het blad van één hoek (een voorstel voor die hoek). Te beslissen in de ontwerpstap.
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI.
- Hangt af van FB-020.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-15 21:12 · wensen-hoeken · tekst bijgewerkt na FB-038: invullen gebeurt in het zijpaneel Hoekenfiches; plaats van de knop als open vraag
