---
id: FB-102
titel: Activiteiten in de zijbalk tonen eerst wat nog in te plannen is, in compacte kaarten
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-24
bijgewerkt: 2026-09-24 17:53
opgepakt-door: claude-fb102
branch: ticket/FB-102-activiteiten-zijbalk
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vindt het paneel Activiteiten in de zijbalk van de agenda niet overzichtelijk (2026-09-24):

- Elke kaart herhaalt wat voor alle kaarten geldt: "Eigen" en "Ingepland op ma 5 okt" staan drie keer onder elkaar.
  Daardoor is elke kaart ongeveer 180px hoog en passen er maar drie op het scherm.
- Wat een leerkracht hier vooral wil weten, wat ze nog moet inplannen, zie je niet in één oogopslag: "Ingepland
  op …" staat als derde regel, in dezelfde grijze stijl als "Eigen".
- De doelen staan er twee keer: het doel-icoon rechtsboven (FB-018) en de pil "3 doelen", met een grijs bolletje
  dat niets betekent.
- De keuzelijst van het subthema staat in een grotere letter dan de rest van het paneel en kapt "Het weer in de
  herfst" af zonder beletselteken. "Loopt in week 41" staat in klein vetjes.

De eigenaar keurde het voorstel goed: https://claude.ai/artifact/5imQK3EgrTCcn5XioozPEC, rij "Activiteiten in de
zijbalk" (bord "Activiteiten, voorstel", met "Activiteiten, nu" ernaast).

## Gewenst gedrag

- **De kop blijft zoals hij is:** het icoon en "ACTIVITEITEN", met de knop om te sluiten.
- **Subthema:** de keuzelijst staat in gewone tekstmaat. Een lange naam loopt door naar een tweede regel in plaats
  van afgekapt te worden. "Loopt in week …" staat eronder in gewone tekst.
- **Twee groepen:** bovenaan "Nog in te plannen" met hun aantal en één keer de hint "Sleep een activiteit naar de
  agenda.", daaronder "Ingepland" met hun aantal. Een groep zonder activiteiten valt weg.
- **Compacte kaarten** die je naar de agenda sleept zoals nu, met een zichtbare sleepgreep. Per kaart:
  - de naam;
  - bij een ingeplande activiteit de datum kort, op één regel, met een agenda-icoon ("ma 5 okt"); is ze meer
    dan eens ingepland, dan de eerste komende datum;
  - bij een niet ingeplande activiteit "Nog niet ingepland";
  - rechts één knop met het aantal doelen ("3 doelen", "1 doel") die de doelinfo opent. Het aparte doel-icoon en
    het grijze bolletje vallen weg.
- **Eigen of gedeeld** staat niet meer op elke kaart. Zijn alle activiteiten in het paneel van dezelfde soort, dan
  staat dat één keer onderaan ("Alle drie zijn je eigen activiteiten."). Staan beide soorten door elkaar, dan draagt
  alleen de kleinste groep een label op haar kaarten.
- Op een laptop passen minstens zes kaarten zonder te scrollen.

## Acceptatiecriteria

- [ ] Gegeven een subthema met één niet ingeplande en twee ingeplande activiteiten, wanneer de leerkracht het paneel
      opent, dan staat de niet ingeplande onder "Nog in te plannen, 1" en de andere twee onder "Ingepland, 2".
- [ ] Gegeven een ingeplande activiteit, wanneer het paneel opent, dan toont haar kaart de datum op één regel, en
      staat "Ingepland op" niet voluit op de kaart.
- [ ] Gegeven een kaart, wanneer de leerkracht op de knop "3 doelen" klikt, dan opent de doelinfo zoals nu via het
      doel-icoon, en er staat geen apart doel-icoon meer op de kaart.
- [ ] Gegeven drie eigen activiteiten, wanneer het paneel opent, dan staat "Eigen" op geen enkele kaart, en één keer
      onderaan dat ze allemaal eigen zijn.
- [ ] Gegeven een subthema met een lange naam, wanneer het paneel opent, dan staat de hele naam in de keuzelijst,
      zo nodig op twee regels.
- [ ] Gegeven een kaart, wanneer de leerkracht ze naar de agenda sleept, dan wordt de activiteit ingepland zoals nu,
      en verhuist de kaart naar de groep "Ingepland".
- [ ] Gegeven een laptop van 1440×900, wanneer het paneel zes activiteiten heeft, dan zijn ze alle zes zichtbaar
      zonder te scrollen.

## Testscenario's

1. Open de agenda en het paneel Activiteiten, kies een subthema met ingeplande en niet ingeplande activiteiten.
   Bovenaan staat "Nog in te plannen" met het aantal, daaronder "Ingepland".
2. Kijk naar een ingeplande kaart: naam, datum op één regel, rechts "x doelen". Geen "Eigen", geen doel-icoon.
3. Klik op "x doelen": de doelinfo opent.
4. Sleep een kaart uit "Nog in te plannen" naar de agenda: ze wordt ingepland en staat daarna onder "Ingepland",
   met haar datum.
5. Kies een subthema met een lange naam: de keuzelijst toont de hele naam.
6. Bekijk het paneel op een telefoon: het opent als blad en toont hetzelfde.

## Buiten scope

Een aparte kleur voor activiteiten die meer dan eens ingepland zijn (niet gewenst), de keuze tussen eigen en gedeeld
zelf (FB-073), en de andere secties van de zijbalk.

## Open vragen

Geen.

## Werklog

- 2026-09-24 17:20 · claude-vercelanalyse · aangemaakt (status nieuw)
- 2026-09-24 17:53 · claude-fb102 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
