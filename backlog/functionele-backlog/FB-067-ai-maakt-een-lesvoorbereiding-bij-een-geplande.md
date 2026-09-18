---
id: FB-067
titel: AI maakt een lesvoorbereiding bij een geplande activiteit
soort: functioneel
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:45
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar besliste op 2026-09-18, in een sparring over een agentische uitbreiding, dat de Jaarplanner een AI-agent
krijgt die op de agenda van de kleuterleerkracht leeft en planlast vermindert, gepersonifieerd als een dikke oranje
gestreepte kat. De agent is de interface, niet de motor. De grondwet en de ADR's komen in TB-056.

Een activiteit in de agenda zegt wat er gebeurt, niet hoe. Een leerkracht, en zeker een vervanger, bereidt elke
activiteit nog zelf voor.

**Beslissingen van de eigenaar, 2026-09-18:** de AI maakt lesvoorbereidingen (de non-goal "lesmateriaal" verdwijnt uit
Art. I.2, zie TB-056); een voorbereiding hangt aan de plaatsing (die dag, in die klas); ze is er voor de vervanger én de
vaste leerkracht; voor de vaste leerkracht alleen op vraag. De vorm die de eigenaar goedkeurde: doelen, instap, kern,
afsluiting, materiaal, woordenschat, differentiatie, duur.

## Gewenst gedrag

- Bij een activiteit in de agenda van haar klas vraagt een leerkracht, een vervanger tijdens de vervanging, of directie
  "maak een lesvoorbereiding".
- De AI krijgt: de activiteit (naam, soort, verwachte uitkomsten, lengte) met de tekst van haar gekoppelde doelen, het
  subthema (onderzoeksvragen, woordenschat, de woorden van het woordweb), het thema, de dag en de uren van de plaatsing,
  en de klasfiche (FB-064). Nooit gegevens over kinderen.
- Ze stelt een voorbereiding voor met: de doelen (alleen de gekoppelde doelen van de activiteit), instap, kern,
  afsluiting, materiaal, woordenschat, differentiatie (eenvoudiger en uitdagender, zonder namen) en een duur die in de
  uren van de plaatsing past, met een korte motivatie.
- De leerkracht aanvaardt ze (eventueel na aanpassen), of weigert ze. Opnieuw vragen geeft een nieuw voorstel.
- Een aanvaarde voorbereiding staat bij die plaatsing: wie de agenda van de klas leest, ziet ze. Verplaatst de activiteit
  naar een andere dag, dan gaat de voorbereiding mee.
- De knop is een AI-knop (ADR-0039), en een voorstel draagt de vage voorstelring (ADR-0051).
- Een voorbereiding telt nooit mee voor de dekking.

## Acceptatiecriteria

- [ ] Gegeven een geplande activiteit met twee gekoppelde doelen, wanneer de leerkracht een voorbereiding vraagt, dan krijgt
  ze een voorstel met die doelen, instap, kern, afsluiting, materiaal, woordenschat, differentiatie en een duur die in de
  uren van de plaatsing past.
- [ ] Gegeven een modelantwoord met een doel dat niet aan de activiteit gekoppeld is of een onbekende code, dan wordt dat
  doel niet getoond en niet bewaard.
- [ ] Gegeven een voorstel, wanneer ze het aanpast en aanvaardt, dan staat de aangepaste versie bij die plaatsing; wanneer
  ze het weigert, verdwijnt het.
- [ ] Gegeven een gebruiker die de agenda van de klas niet mag bewerken, dan kan ze geen voorbereiding vragen of
  beslissen, ook niet rechtstreeks via de API.
- [ ] Gegeven wat naar het model gaat, dan staat er geen informatie over kinderen in.
- [ ] De logica is getest met een nep-AI-client; het scherm is bekeken op desktop en op ongeveer 390px.

## Testscenario's

1. Meld aan als leerkracht van een K2-klas. Open een activiteit in je agenda en kies "maak een lesvoorbereiding".
2. Je krijgt een voorstel met doelen, instap, kern, afsluiting, materiaal, woordenschat, differentiatie en duur.
3. Pas de instap aan en aanvaard. Open de activiteit opnieuw: de aangepaste voorbereiding staat erbij.
4. Verplaats de activiteit naar een andere dag. De voorbereiding gaat mee.
5. Vraag bij een andere activiteit een voorbereiding en weiger ze. Ze verdwijnt.

## Buiten scope

- Proactief klaarzetten tijdens een vervanging: FB-068.
- Werkbladen, kopieerbladen of afbeeldingen.
- De voorbereiding bewaren bij de activiteit zelf, voor volgende jaren of collega's.

## Open vragen

- Werkt de school met een eigen sjabloon? Tot dan de vorm hierboven.
- Wat kost een voorbereiding, en telt ze voor het AI-budget van de school (FB-055)?
- Hangt af van TB-056 (Art. I.2, IV.4, IV.5 en de ADR over de lesvoorbereiding).

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
