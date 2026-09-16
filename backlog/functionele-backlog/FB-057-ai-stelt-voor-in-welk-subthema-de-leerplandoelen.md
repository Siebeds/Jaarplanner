---
id: FB-057
titel: AI stelt voor in welk subthema de leerplandoelen van de themadoelen passen
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 22:53
opgepakt-door: claude-fb057
branch: ticket/FB-057-subdoelplaatsing
pr:
geblokkeerd:
fr: [FR-4.1, FR-4.2, FR-4.3, FR-4.4]
---

## Aanleiding

De eigenaar vroeg op 2026-09-16: *"op het thema scherm worden doelen per leeftijd getoond na het linken van een
minimumdoel aan het thema. ik wil AI gebruiken (nieuwe ai feature) die voorstellen doet om deze leerplandoelen toe te
voegen aan bestaande of nieuwe subthema's - dit moeten suggesties worden (AI gekleurde rand, maar niet dezelfde rand)"*.

Sinds FB-043 brengt een minimumdoel dat als themadoel aan een thema hangt, per leeftijd zijn leerplandoelen mee. Veel
van die leerplandoelen hangen nog in geen enkel subthema van die leeftijd. Wie ze een plaats wil geven, moet vandaag elk
doel zelf opzoeken en met de hand als subdoel toevoegen, en ziet niet in één oogopslag welke doelen nog nergens hangen.

**Beslissingen van de eigenaar, 2026-09-16**, na een ontwerpvoorstel met drie varianten
(https://claude.ai/artifact/P4UL5z2N4rZFuwAMKK95rA):

- De voorstellen staan **in de subthema's zelf** (variant B): een voorgesteld subdoel in het subthema waar het
  terechtkomt, een voorgesteld nieuw subthema als eigen hoofdstuk met zijn doelen.
- Een voorstel krijgt een **vage regenboogring**: een doorlopende rand van 1px in de AI-kleuren, half verzadigd, zonder
  gloed of beweging, zodat het niet als een AI-knop leest.
- Aanvaarden en weigeren zijn **kleine, stille icoontjes** (vinkje en kruisje) naast het statuslabel, geen grote knoppen.
- De AI mag ook **nieuwe subthema's** voorstellen, met een naam en een onderzoeksvraag, zodra de grondwet dat toelaat
  (zie *Open vragen*).
- Dit ticket is de **eerste stap van FB-054**: dezelfde voorstellen per thema; FB-054 bouwt er schoolbreed op verder.
- **Rechten:** wie de subthema's van een leeftijd beheert (de hoofdleerkracht van die jaarfase) en de directie vragen
  de voorstellen en beslissen erover.

## Gewenst gedrag

- Op de themapagina staat boven de subthema's van elke leeftijd hoeveel leerplandoelen van de themadoelen nog in geen
  subthema van die leeftijd hangen. Die teller werkt zonder AI.
- Bij diezelfde leeftijd staat een AI-knop, bv. "Plaats de open doelen", voor de hoofdleerkracht van die jaarfase en de
  directie.
- De AI krijgt de open leerplandoelen van die leeftijd en de bestaande subthema's van die leeftijd (naam,
  onderzoeksvragen, subdoelen), en stelt per doel een plaats voor, met een korte motivatie:
  - **als subdoel van een bestaand subthema** van die leeftijd; het voorstel staat in dat subthema, onder zijn subdoelen;
  - **in een nieuw subthema**, met een naam, een onderzoeksvraag en een lengte; het voorstel staat als eigen hoofdstuk
    bij die leeftijd, met alle doelen die de AI erin plaatst.
- Elk voorstel draagt de vage regenboogring, een staf-icoon met "AI-voorstel" of "Nieuw subthema", het statuslabel
  "Voorgesteld" en de icoontjes aanvaarden en weigeren. Een nieuw subthema heeft ook een icoontje om het eerst aan te
  passen. De icoontjes hebben een naam in de tooltip en voor de schermlezer.
- **Aanvaarden** van een subdoel maakt het leerplandoel een subdoel van dat subthema. **Aanvaarden** van een nieuw
  subthema maakt het subthema aan, met zijn doelen als subdoelen. Na de beslissing verdwijnt de ring en wordt het een
  gewone regel.
- **Weigeren** laat het doel open. Een geweigerd voorstel komt bij een nieuwe vraag niet terug.
- Elk voorstel, zijn motivatie en de beslissing worden bewaard (Art. IV.1). Een voorstel telt niet mee in de doelen
  per leeftijd of in de dekking zolang het niet aanvaard is.
- Een ingeklapt subthema met open voorstellen toont dat aan zijn kop, zodat je ze niet mist (FB-011).

## Acceptatiecriteria

- [ ] Gegeven een thema met een minimumdoel dat voor K2 vier leerplandoelen meebrengt, waarvan één al subdoel is van
  een K2-subthema, wanneer ik de themapagina open, dan staat bij K2 dat drie leerplandoelen nog in geen subthema
  hangen, zonder AI-aanroep.
- [ ] Gegeven die drie open doelen, wanneer de hoofdleerkracht van K2 "Plaats de open doelen" kiest, dan staat elk
  voorstel met een motivatie in een bestaand K2-subthema of in een voorgesteld nieuw subthema, met de vage
  regenboogring, het label "Voorgesteld" en de icoontjes aanvaarden en weigeren.
- [ ] Gegeven een voorgesteld subdoel, wanneer ik het aanvaard, dan is het een subdoel van dat subthema en telt het in
  "Doelen per leeftijd"; wanneer ik het weiger, blijft het open en komt het bij een nieuwe vraag niet terug.
- [ ] Gegeven een voorgesteld nieuw subthema, wanneer ik het aanvaard, dan bestaat het subthema bij die leeftijd met
  zijn doelen als subdoelen; het icoontje "aanpassen" laat naam, onderzoeksvraag en lengte eerst wijzigen.
- [ ] Gegeven een modelantwoord met een doelcode die niet bij de open doelen van die leeftijd hoort, of een subthema dat
  niet bestaat of bij een andere leeftijd hoort, dan wordt dat voorstel niet getoond en niet bewaard.
- [ ] Gegeven een hoofdleerkracht van K3 of een leerkracht, dan ziet die geen AI-knop bij K2 en weigert de server het
  vragen en het beslissen; de logica is getest met een nep-AI-client.

## Testscenario's

1. Meld aan als directie en koppel een minimumdoel aan een thema met K2-subthema's. Bij K2 staat hoeveel
   leerplandoelen nog in geen subthema hangen.
2. Meld aan als hoofdleerkracht van K2 en kies "Plaats de open doelen" bij K2. De knop beweegt tijdens het wachten;
   daarna staan de voorstellen in de subthema's en eventueel als nieuw subthema, elk met een vage regenboogring, een
   motivatie en twee kleine icoontjes.
3. Beweeg over het vinkje: het kleurt groen en de tooltip zegt "Aanvaard". Klik: het doel staat als gewone subdoelregel,
   de ring is weg en de teller bij K2 daalt met één.
4. Weiger een ander voorstel en vraag opnieuw. Het geweigerde voorstel komt niet terug.
5. Pas een voorgesteld nieuw subthema aan met het potlood-icoontje en aanvaard het. Het subthema staat bij K2 met zijn
   subdoelen.
6. Klap een subthema met een open voorstel in: de kop toont dat er een voorstel is.
7. Bekijk de pagina op ~390px en in de donkere weergave: de ring, de labels en de icoontjes blijven leesbaar.
8. Meld aan als hoofdleerkracht van K3: bij K2 staat geen AI-knop en er zijn geen icoontjes om te beslissen.

## Buiten scope

- De schoolbrede hiatenanalyse, de teller van themaweken en het voorstellen van nieuwe thema's: FB-054, dat op dit
  ticket bouwt.
- Minimumdoelen voorstellen als themadoel: FB-053.
- Activiteiten voorstellen binnen een subthema: FB-025.
- De vage regenboogring op de voorstellen van andere AI-functies: die volgen wanneer ze gebouwd of herwerkt worden,
  volgens de nieuwe ADR (zie *Open vragen*).

## Open vragen

- **Grondwet:** dat de AI zelf een naam en een onderzoeksvraag voor een nieuw subthema bedenkt, vraagt de wijziging van
  Art. IV.4 en IV.8 die bij FB-054 al beslist is. Die moet geschreven zijn, met een ADR, vóór het deel "nieuw subthema"
  gebouwd wordt. Het deel "bestaand subthema" mag eerder.
- **ADR-0039, besluit 5,** zegt dat de regenboog alleen bij de knop hoort en dat een voorstel de kleuren van de
  suggestiestatus houdt. De vage ring op een voorstel vraagt een nieuwe ADR die dat besluit aanpast, met de gemeten
  contrasten in beide weergaven.
- **Omvang van de AI-vraag:** als een leeftijd veel open doelen heeft, passen ze mogelijk niet in één vraag (TB-007).
  Hoe dat opgedeeld wordt, beslist de bouw.

## Werklog

- 2026-09-16 22:49 · eigenaar · aangemaakt (status nieuw)
- 2026-09-16 22:53 · claude-fb057 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
