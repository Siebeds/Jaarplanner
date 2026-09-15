---
id: FB-010
titel: Subthema toont welke subdoelen al een activiteit hebben en welke nog niet
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 16:15
opgepakt-door: themapagina
branch: ticket/FB-010-subdoelen-in-activiteiten
pr: 82
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

- [x] Gegeven een subthema met drie subdoelen, waarvan er twee op een activiteit staan, wanneer ik het subthema open,
  dan tonen die twee hun activiteiten en is het derde gemarkeerd als "nog geen activiteit", met tekst of icoon.
- [x] Gegeven een activiteit met een leerplandoel dat geen subdoel van het subthema is, dan staat dat doel in de aparte
  groep, met de activiteit erbij.
- [x] Gegeven een subdoel dat op twee activiteiten staat, dan toont het beide activiteiten.
- [x] Gegeven een ingeklapt subthema, dan toont de samenvatting hoeveel subdoelen al in een activiteit zitten.
- [x] Nagekeken in een echte browser op desktop en ~390px; de markering is ook zonder kleur te begrijpen.

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
- 2026-09-15 15:08 · themapagina · klaar-voor-bouw → in-uitvoering: opgepakt; gestapeld op ticket/FB-011-subthemas-ingeklapt
- 2026-09-15 15:19 · themapagina · gebouwd (c0cc072) en nagekeken: Vitest 582 groen, lint groen; headless Chrome op echte Op.stap-doelen, desktop en 390px: activiteiten per subdoel, merk 'Nog geen activiteit' (ring en woorden), groep 'Andere doelen in de activiteiten', samenvatting 'x van y'; contrast gemeten 8,0 en 7,58:1; alleen beslist gekoppelde doelen tellen, alleen de gedeelde activiteiten van het subthema (standaard uit de open vraag)
- 2026-09-15 15:22 · themapagina · contrast gemeten in licht en donker thema (samengestelde achtergronden): merk 'Nog geen activiteit' 9,39 en 8,0:1, regel met activiteiten en samenvatting 6,51 en 7,58:1
- 2026-09-15 15:30 · themapagina · antagonist: COMPLIANT; de drie kleine bevindingen opgelost: het cijfer telt nu dezelfde subdoelen als de lijst, nieuwe tests voor de gewone telling, een lege groep en een niet-beslist subdoel, commentaar en TB-017 bijgewerkt
- 2026-09-15 15:30 · themapagina · in-uitvoering → te-testen: subthema toont per subdoel zijn activiteiten of 'Nog geen activiteit', de andere doelen apart, en 'x van y' ingeklapt; Vitest groen, lint groen, browser desktop en 390px, contrast licht en donker gemeten, antagonist COMPLIANT
- 2026-09-15 16:15 · themapagina · PR #82
