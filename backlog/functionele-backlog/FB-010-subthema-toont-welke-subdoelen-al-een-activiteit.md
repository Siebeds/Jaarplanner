---
id: FB-010
titel: Subthema toont welke subdoelen al een activiteit hebben en welke nog niet
soort: functioneel
status: klaar-voor-bouw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:46
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-3.2, FR-4.4]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"op subthema kunnen zien welke leerplandoelen al zijn gelinkt aan activiteiten eronder
en welke nog niet"*.

Vandaag toont een subthema zijn subdoelen en zijn activiteiten naast elkaar. Ingeklapt zie je tellingen en hoeveel
activiteiten nog geen doel hebben, maar niet welke subdoelen al door een activiteit uitgewerkt worden en welke nog op
een activiteit wachten.

## Gewenst gedrag

- Bij elk subdoel van het subthema staat of er al een activiteit onder het subthema is die hetzelfde leerplandoel
  draagt, en zo ja welke en hoeveel.
- Subdoelen **zonder** activiteit vallen op, met een woord of icoon en niet alleen met kleur, zodat de hoofdleerkracht en
  de leerkrachten zien waar nog een activiteit nodig is.
- Leerplandoelen die op een activiteit staan maar **geen subdoel** van het subthema zijn, staan in een aparte groep,
  zodat zichtbaar is wat de activiteiten extra aanbieden.
- Ingeklapt toont het subthema een korte samenvatting, bv. "5 van 7 subdoelen in een activiteit".

## Acceptatiecriteria

- [ ] Gegeven een subthema met drie subdoelen, waarvan er twee op een activiteit staan, wanneer ik het subthema open,
  dan tonen die twee hun activiteiten en is het derde gemarkeerd als "nog geen activiteit", met tekst of icoon.
- [ ] Gegeven een activiteit met een leerplandoel dat geen subdoel van het subthema is, dan staat dat doel in de aparte
  groep, met de activiteit erbij.
- [ ] Gegeven een subdoel dat op twee activiteiten staat, dan toont het beide activiteiten.
- [ ] Gegeven een ingeklapt subthema, dan toont de samenvatting hoeveel subdoelen al in een activiteit zitten.
- [ ] Nagekeken in een echte browser op desktop en ~390px; de markering is ook zonder kleur te begrijpen.

## Testscenario's

1. Open een thema en een subthema met subdoelen en activiteiten.
2. Kijk bij elk subdoel: je ziet de activiteiten die hetzelfde doel dragen, of "nog geen activiteit".
3. Koppel (als hoofdleerkracht) het ontbrekende doel aan een activiteit en herlaad. Het subdoel toont nu die activiteit.
4. Koppel een doel dat geen subdoel is aan een activiteit. Het staat in de aparte groep.
5. Klap het subthema in. De samenvatting klopt met wat je zag.
6. Herhaal op ~390px.

## Buiten scope

- Doelen koppelen vanuit dit overzicht: dat blijft waar het nu gebeurt, met dezelfde rechten.
- AI die doelen bij een activiteit zoekt en als subdoel voorstelt: FB-026.

## Open vragen

- Tellen persoonlijke activiteiten (FB-015) hier mee? **Standaard** alleen de gedeelde activiteiten van het subthema,
  omdat het subthema van de hele leeftijd is.

## Werklog

- 2026-09-15 14:09 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-15 14:46 · eigenaar · nieuw → klaar-voor-bouw: op klaar-voor-bouw gezet door de eigenaar (in sessie, 2026-09-15)
