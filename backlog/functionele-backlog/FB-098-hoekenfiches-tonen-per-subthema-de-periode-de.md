---
id: FB-098
titel: Hoekenfiches tonen per subthema de periode, de stand van de verrijkingen en wat erna komt
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 23:26
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vindt het paneel Hoekenfiches in de agenda niet overzichtelijk (2026-09-23):

- Elke kaart herhaalt hetzelfde subthema ("Het weer in de herfst"), zes keer onder elkaar.
- De beschrijving van de hoek ("Blokken, bouwplaten en voertuigen") neemt de helft van elke kaart in, terwijl een
  leerkracht haar eigen hoeken kent; bij een lange beschrijving wordt ze afgekapt.
- Welke hoeken al verrijkt zijn, zie je niet in één oogopslag: alle kaarten zien er hetzelfde uit en het verschil
  staat in een klein regeltje onderaan.
- Het paneel zegt niet voor welke periode de verrijkingen gelden, en niet wat erna komt.
- Zes kaarten zijn te hoog voor het scherm, dus je moet scrollen om de laatste hoek te zien.

De eigenaar koos variant A uit https://claude.ai/artifact/5imQK3EgrTCcn5XioozPEC (bord "A. Per subthema, met periode
en wat erna komt"), met de huidige kop "HOEKENFICHES" en zijn icoon behouden.

## Gewenst gedrag

- **De kop blijft zoals hij is:** het icoon en "HOEKENFICHES", met de knop om te sluiten.
- **Het lopende subthema staat in een eigen blok**, met bovenaan de periode ("Nu, 12 tot 23 oktober") en de naam
  van het subthema als kop. Het subthema staat dus één keer, niet op elke hoek.
- **De stand in één oogopslag:** onder de naam een balkje met "1 van 6" (hoeveel hoeken al een verrijking hebben
  voor dit subthema). Het getal staat er altijd bij, zodat de stand niet alleen aan het balkje hangt.
- **Per hoek één rij:** de naam van de hoek, en eronder ofwel de verrijking met een vinkje, ofwel "+ Verrijking
  invullen". De beschrijving van de hoek staat niet meer in het paneel; ze blijft in de fiche van de hoek, die opent
  als de leerkracht op de naam klikt. Het doel-icoon van een hoek (FB-018) blijft.
- **Wat erna komt:** onder het blok staat het volgende subthema van de klas, met "Hierna, vanaf <datum>", zijn naam,
  de stand ("0 van 6") en de knop "Al voorbereiden", die de verrijkingen van dat subthema laat invullen.
- **Lopen er in de getoonde week twee subthema's**, dan krijgt elk zijn eigen blok, in volgorde van begindatum.
- **Is er geen volgend subthema** (het laatste van het schooljaar, of nog niets gepland), dan valt dat deel weg.
- De kaarten worden niet versleept. De tegel om een hoek toe te voegen (TB-015) blijft onderaan.
- Alle zes hoeken van een gewone klas passen op een laptop zonder te scrollen.

## Acceptatiecriteria

- [ ] Gegeven een klas met zes hoeken en een lopend subthema, wanneer de leerkracht het paneel opent, dan staat de
      naam van het subthema één keer, met zijn periode, en niet bij elke hoek.
- [ ] Gegeven één verrijkte hoek van de zes, wanneer het paneel opent, dan staat er "1 van 6", en toont de verrijkte
      hoek zijn verrijking met een vinkje en de andere "+ Verrijking invullen".
- [ ] Gegeven een hoek met een beschrijving, wanneer het paneel opent, dan staat die beschrijving niet in het paneel,
      en wie op de naam klikt, ziet ze in de fiche van de hoek.
- [ ] Gegeven een klas waarvan het volgende subthema al gepland is, wanneer het paneel opent, dan staat onderaan
      "Hierna, vanaf <datum>" met de naam van dat subthema en zijn stand, en opent "Al voorbereiden" het invullen
      voor dat subthema.
- [ ] Gegeven het laatste subthema van het schooljaar, wanneer het paneel opent, dan staat er geen deel "Hierna".
- [ ] Gegeven een week waarin twee subthema's lopen, wanneer het paneel opent, dan heeft elk zijn eigen blok met zijn
      eigen periode en stand.
- [ ] Gegeven een laptop van 1440×900 en zes hoeken, wanneer het paneel opent, dan zijn alle zes zichtbaar zonder te
      scrollen.

## Testscenario's

1. Open de agenda in een week van een subthema en open Hoekenfiches. Bovenaan staat "HOEKENFICHES" met het icoon.
   Daaronder "Nu, <begin> tot <einde>" en de naam van het subthema, met een balkje en "x van 6".
2. Vul bij een lege hoek een verrijking in. Na het bewaren staat ze met een vinkje bij die hoek en telt de stand één
   hoger.
3. Klik op de naam van een hoek: de fiche van de hoek opent, met haar beschrijving.
4. Kijk onderaan: "Hierna, vanaf <datum>" met het volgende subthema. Kies "Al voorbereiden" en vul een verrijking
   in. Het deel "Hierna" toont nu "1 van 6".
5. Ga naar een week van het laatste subthema van het jaar: het deel "Hierna" staat er niet.
6. Ga naar een week waarin twee subthema's lopen: er staan twee blokken.
7. Bekijk het paneel op een telefoon: het opent als blad en toont hetzelfde.

## Buiten scope

De algemene fiches in hetzelfde zijpaneel, AI-voorstellen voor verrijkingen (FB-028) en verrijkingen van vorig jaar
overnemen (FB-078).

## Open vragen

- Het paneel kent vandaag de subthema's van de getoonde week. Om "wat erna komt" te tonen, moet het ook het volgende
  subthema van de klas kennen (uit de planning). De bouwer gaat na of die gegevens al beschikbaar zijn of dat de API
  ze moet leveren.

## Werklog

- 2026-09-23 23:26 · claude-vercelanalyse · aangemaakt (status nieuw)
