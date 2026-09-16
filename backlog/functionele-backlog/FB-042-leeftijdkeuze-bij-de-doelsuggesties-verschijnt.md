---
id: FB-042
titel: Leeftijdkeuze bij de doelsuggesties verschijnt pas na 'Vraag suggesties'
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 14:34
opgepakt-door: claude-fb-042
branch: ticket/FB-042-leeftijdkeuze-na-klik
pr:
geblokkeerd:
fr: [FR-4.1]
---

## Aanleiding

De eigenaar merkte op 2026-09-16 in de demo-omgeving: *"bij de themadoelen staat een knop vraag suggesties en daarnaast
veel blokjes met voor JK, K2,... die "voor" en blokjes moeten pas getoond worden als ze op vraag suggesties hebben
geklikt en er dus niet standaard staan"*.

Vandaag staat naast "Vraag suggesties" altijd het woord "voor" met een blokje per leeftijd. Dat maakt de kop van de
themadoelen druk, ook voor wie geen suggesties wil vragen.

## Gewenst gedrag

- Bij de themadoelen staat alleen de knop "Vraag suggesties", zonder "voor" en zonder leeftijdblokjes.
- Een klik op de knop vraagt nog niets aan de AI: hij toont de leeftijdkeuze ("voor" met de blokjes), vooraf ingesteld
  zoals nu op de leeftijden van de subthema's, met een knop om de vraag te versturen en een knop om te annuleren.
- Pas de knop om te versturen vraagt de suggesties, voor de gekozen leeftijden.
- Annuleren sluit de leeftijdkeuze zonder iets te vragen.
- Wie geen doelsuggesties mag maken (alleen directie en themabeheer mogen dat), ziet zoals nu geen knop.

## Acceptatiecriteria

- [x] Gegeven een thema en iemand met themabeheer, wanneer de themapagina opent, dan staat bij de themadoelen alleen
  "Vraag suggesties", zonder "voor" en zonder leeftijdblokjes.
- [x] Gegeven die pagina, wanneer "Vraag suggesties" aangeklikt wordt, dan verschijnt de leeftijdkeuze met de leeftijden
  van de subthema's aangevinkt, en er is nog niets aan de AI gevraagd.
- [x] Gegeven de leeftijdkeuze, wanneer de gebruiker K2 uitvinkt en verstuurt, dan worden alleen suggesties voor de
  overige gekozen leeftijden gevraagd.
- [x] Gegeven de leeftijdkeuze, wanneer de gebruiker annuleert, dan verdwijnt ze en is er niets gevraagd.
- [x] Gegeven de leeftijdkeuze zonder aangevinkte leeftijd, dan kan niet verstuurd worden en staat er waarom.
- [x] Nagekeken in een echte browser op desktop en op ~390px, met het toetsenbord bedienbaar.

## Testscenario's

1. Meld aan met themabeheer en open een thema met subthema's voor K2 en K3. Bij de themadoelen staat alleen
   "Vraag suggesties".
2. Klik erop. De leeftijdkeuze verschijnt met K2 en K3 aangevinkt, en een knop om te versturen en een om te annuleren.
3. Annuleer. De keuze verdwijnt; er zijn geen nieuwe suggesties.
4. Klik opnieuw, vink K2 uit en verstuur. Er komen alleen suggesties voor K3.
5. Meld aan als gewone leerkracht. Er staat geen knop "Vraag suggesties".
6. Herhaal stap 1 tot 4 op ~390px.

## Buiten scope

Hoe de suggesties zelf getoond, aanvaard of geweigerd worden: dat blijft zoals nu.

## Open vragen

Geen.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
- 2026-09-16 14:27 · eigenaar · nieuw → klaar-voor-bouw: open vragen beantwoord door de eigenaar; klaar voor bouw
- 2026-09-16 14:28 · claude-fb-042 · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-16 14:32 · claude-fb-042 · leeftijdkeuze verschijnt pas na 'Vraag suggesties', met Verstuur (AI-knop) en Annuleer; Vitest 968 groen, lint groen; browsercheck en antagonist volgen
- 2026-09-16 14:34 · claude-fb-042 · antagonist: COMPLIANT; de ring op 'Vraag suggesties' volgt ADR-0039 zoals 'Genereren' op het jaarplan; vier MINOR
