---
id: FB-018
titel: Doelen van fiches, hoeken, verrijkingen en activiteiten via een info-icoon in de agenda
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:53
opgepakt-door: FB-018
branch: ticket/FB-018-doelen-info-icoon
pr:
geblokkeerd:
fr: [FR-3.2, FR-6.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"een leerkracht moet ook de doelen gelinkt aan de algemene fiches kunnen raadplegen
vanuit de agenda (mss via info icoontje zodat het niet telkens open springt als je op een fiche klikt?), idem voor
hoekenfiches, hoekenverrijkingen en activiteiten"*, en ook: *"nog altijd zorgen dat je genoeg weet aan welke doelen je
werkt in jouw agenda!!"*.

Vandaag toont een activiteit haar doelen alleen in haar volledige blad, en de doelen van een algemene fiche staan alleen
in Instellingen. Wie in de agenda wil weten aan welke doelen een blok werkt, moet het blad openen of de agenda verlaten.

**Beslissing van de eigenaar, 2026-09-15:** het weten aan welke doelen je werkt, loopt via deze info-iconen; er komt geen
apart weekoverzicht.

## Gewenst gedrag

- Elke kaart in de zijbalk (hoekenfiche, algemene fiche, activiteit uit FB-017) en elk blok op het tijdraster (activiteit,
  algemene fiche, hoek) krijgt een klein info-icoon. Een verrijking (FB-020) ook.
- Een klik op het icoon toont de gekoppelde leerplandoelen (code, korte tekst, doelsoort) in een klein venster, zonder
  het blad te openen en zonder een sleepbeweging te starten.
- Vanuit dat venster opent een doel zijn detail (zoals TB-016).
- Zonder doelen zegt het venster "nog geen doelen gekoppeld".
- De doelen van hoeken en verrijkingen bestaan pas met FB-019; tot dan is het icoon er voor algemene fiches en
  activiteiten.

## Acceptatiecriteria

- [ ] Gegeven een algemene fiche met twee doelen in de zijbalk, wanneer ik op haar info-icoon klik, dan zie ik die twee
  doelen, en er opent geen plaatsingsblad.
- [ ] Gegeven een ingeplande activiteit op het tijdraster, wanneer ik op haar info-icoon klik, dan zie ik haar doelen
  zonder dat het activiteitblad opent of het blok verschuift.
- [ ] Gegeven een blok zonder doelen, dan zegt het venster dat er nog geen doelen gekoppeld zijn.
- [ ] Gegeven het venster, wanneer ik een doel aanklik, dan opent het detail van dat doel.
- [ ] Het icoon is met het toetsenbord bereikbaar, heeft een doel van minstens 24 bij 24 pixels, en is in een echte
  browser nagekeken op desktop en ~390px.

## Testscenario's

1. Open de agenda. Klik in Algemene fiches op het info-icoon van een fiche. Je ziet haar doelen; de fiche opent niet.
2. Klik op het info-icoon van een ingeplande activiteit op het tijdraster. Je ziet haar doelen; het blok verschuift niet.
3. Klik een doel aan. Het detail opent.
4. Klik op het icoon van een fiche zonder doelen. Het venster zegt dat er nog geen zijn.
5. Ga met Tab naar een icoon en druk op Enter. Het venster opent.
6. Herhaal op ~390px.

## Buiten scope

- Doelen koppelen vanuit dit venster.
- Een weekoverzicht van alle doelen (beslissing 2026-09-15: niet nodig).

## Open vragen

- Een kort blok (een kwartier) heeft weinig ruimte. Waar staat het icoon dan: in het blok, of alleen in het blad?
  Te beslissen in de ontwerpstap.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-15 14:52 · eigenaar · nieuw → klaar-voor-bouw: eigenaar vroeg in sessie om FB-018 op te nemen, zonder op FB-017 te wachten
- 2026-09-15 14:53 · FB-018 · klaar-voor-bouw → in-uitvoering: opgepakt; de activiteitkaarten uit FB-017 krijgen het icoon van wie als tweede merget (eigenaar, 2026-09-15)
