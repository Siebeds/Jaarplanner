---
id: FB-051
titel: Nieuwe activiteit toont de subdoelen van het subthema om aan te vinken
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-17 08:28
opgepakt-door: fb-051
branch: ticket/FB-051-subdoelen-bij-nieuwe-activiteit
pr:
geblokkeerd:
fr: [FR-3.2]
---

## Aanleiding

De eigenaar vroeg op 2026-09-16: *"bij het aanmaken van een activiteit, zou men reeds een oplijsting kunnen krijgen van
de subdoelen van het subthema waarin men die activiteit aan het maken is zodat ik kan selecteren bij welke subdoelen
dit activiteit hoort. Maak dit niet te grote blokken en overzichtelijk en daarnaast dus ook de mogelijkheid om extra
doelen die niet deel van subthema toe te voegen en de suggesties via AI (deel van ander ticket)."*

Vandaag kiest wie een activiteit aanmaakt haar doelen uit het hele doelenregister, ook als het subthema de passende
subdoelen al heeft.

## Gewenst gedrag

- In het formulier van een nieuwe activiteit staat bij de doelen een compacte lijst van de **subdoelen van het
  subthema**, elk met code en een korte tekst en een vinkje. Eén regel per subdoel, geen grote blokken.
- Een aangevinkt subdoel wordt bij het bewaren een doel van de activiteit.
- Daaronder blijft de mogelijkheid om **andere doelen** toe te voegen die geen subdoel zijn, zoals nu.
- De AI-voorstellen van FB-049 staan in dezelfde doelensectie.
- Heeft het subthema geen subdoelen, dan staat dat er in één zin, en blijft "andere doelen toevoegen" beschikbaar.
- De lijst staat er voor wie doelen mag koppelen aan activiteiten van die leeftijd, zoals de doelen vandaag.

## Acceptatiecriteria

- [ ] Gegeven een K3-subthema met vier subdoelen, wanneer men daar een nieuwe activiteit aanmaakt, dan staan die vier
  subdoelen in het formulier, elk op één regel met een vinkje.
- [ ] Gegeven twee aangevinkte subdoelen en één extra doel uit het register, wanneer men bewaart, dan draagt de activiteit
  die drie doelen.
- [ ] Gegeven een subthema zonder subdoelen, dan zegt het formulier dat, en kan men nog altijd andere doelen toevoegen.
- [ ] Gegeven iemand die geen doelen mag koppelen aan activiteiten van die leeftijd, dan staat de lijst er niet.
- [ ] De lijst is met het toetsenbord te bedienen, en nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Meld aan als hoofdleerkracht van K3. Open een K3-subthema met subdoelen en maak een nieuwe activiteit.
2. Bij de doelen staan de subdoelen van het subthema, compact onder elkaar, met een vinkje.
3. Vink er twee aan, voeg via "doel toevoegen" een doel toe dat geen subdoel is, en bewaar.
4. Open de activiteit: ze draagt de drie doelen. Bij het subthema tonen de twee subdoelen nu deze activiteit (FB-010).
5. Maak een activiteit in een subthema zonder subdoelen: het formulier zegt dat er geen subdoelen zijn.
6. Herhaal stap 1 tot 3 op ~390px.

## Buiten scope

- De AI-voorstellen zelf: FB-049.
- Een extra doel dat geen subdoel is automatisch voorstellen als subdoel: FB-026 en FB-049.
- De subdoelen aanbieden bij het bewerken van een bestaande activiteit.

## Open vragen

- Moet de lijst ook verschijnen bij het **bewerken** van een bestaande activiteit? **Standaard** alleen bij het
  aanmaken, zoals gevraagd.
- Een activiteit die in de agenda aangemaakt wordt: welk subthema geldt daar? **Standaard** het subthema dat het formulier
  al kiest; zonder subthema geen lijst.

## Werklog

- 2026-09-16 13:47 · demo-opmerkingen · aangemaakt (status nieuw)
- 2026-09-17 08:28 · fb-051 · nieuw → in-uitvoering: opgepakt: eigenaar startte /ticket-uitvoeren FB-051
