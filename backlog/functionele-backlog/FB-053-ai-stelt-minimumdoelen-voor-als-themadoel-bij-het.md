---
id: FB-053
titel: AI stelt minimumdoelen voor als themadoel, bij het thema en in de wizard
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 15:31
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-4.1, FR-4.2, FR-4.3]
---

## Aanleiding

Sinds FB-043 is een themadoel een **minimumdoel** (ADR-0046). De AI-doelsuggesties bij het thema (*Vraag
suggesties*) en de stap *themadoelen* van de thema-opbouwwizard stellen echter nog **leerplandoelen** voor, en een
aanvaarde suggestie wordt zo geen themadoel. Ook de AI-vragen van de jaarplangeneratie en van de doelsuggesties zien
bij een thema dat met de hand is opgebouwd geen themadoelen meer, omdat ze alleen leerplandoel-themadoelen lezen.

De eigenaar besliste op 2026-09-16 dat een apart ticket beslist wat hiermee gebeurt (FB-043, *Buiten scope*).

## Gewenst gedrag

- Directie en themabeheer vragen bij een thema AI-voorstellen voor **minimumdoelen** als themadoel. Elk voorstel heeft
  een korte motivatie en wordt één voor één aanvaard of geweigerd; pas na aanvaarden staat het minimumdoel als
  themadoel op het thema.
- De stap *themadoelen* van de wizard stelt op dezelfde manier minimumdoelen voor.
- De AI houdt bij het voorstellen van subdoelen en bij de jaarplangeneratie rekening met de minimumdoelen van het
  thema.

## Acceptatiecriteria

- [ ] Gegeven een thema zonder themadoelen, wanneer themabeheer AI-voorstellen vraagt, dan krijgt ze minimumdoelen met
  een motivatie, als voorstel en nog niet gekoppeld.
- [ ] Gegeven een voorstel, wanneer ze het aanvaardt, dan staat het minimumdoel als themadoel op het thema; weigert ze
  het, dan komt het bij een volgende vraag niet terug.
- [ ] Gegeven de wizard, wanneer men bij de stap themadoelen voorstellen vraagt, dan zijn het minimumdoelen.
- [ ] Gegeven een thema met minimumdoelen, wanneer de AI subdoelen of een jaarplan voorstelt, dan krijgt ze die
  minimumdoelen mee.
- [ ] Gegeven een leerkracht of hoofdleerkracht, dan kan ze geen voorstellen vragen of beoordelen; de server weigert
  het ook.

## Testscenario's

1. Meld aan met themabeheer en open een thema zonder themadoelen.
2. Klik *Vraag suggesties*. Je ziet minimumdoelen met een motivatie, elk met Aanvaard en Weiger.
3. Aanvaard er één. Het staat bij de themadoelen en klapt open per leeftijd.
4. Weiger er één en vraag opnieuw voorstellen. Het geweigerde komt niet terug.
5. Start de wizard en ga naar de stap themadoelen. De voorstellen zijn minimumdoelen.
6. Meld aan als leerkracht en open het thema. Je ziet geen knop om voorstellen te vragen.

## Buiten scope

- AI-voorstellen voor subdoelen van een subthema: die blijven leerplandoelen (FB-026, FB-049).
- Het gegevensmodel van de bestaande doelsuggesties die een leerplandoel zijn opruimen: de gegevens verdwijnen wel
  (zie hieronder), de structuur in de code mag een apart ticket blijven.

## Open vragen

Beantwoord door de eigenaar op 2026-09-16:

- **Vervangt dit de huidige doelsuggesties bij het thema?** Ja. Bij een thema stelt de AI alleen nog minimumdoelen
  voor; leerplandoelen komen via de subthema's en hun subdoelen.
- **Wat met de bestaande voorstellen?** Alles weg: de leerplandoel-doelsuggesties op thema-niveau verdwijnen, open én
  aanvaarde, en tellen niet meer mee voor de dekking. Dat wijzigt de constitutie: Art. V.1 laat een aanvaarde
  doelsuggestie van een thema vandaag meetellen voor dekkingsprognose en dekking, en Art. IX beschrijft
  `doelsuggesties[]` als leerplandoel-koppelingen. Die artikels worden eerst aangepast (met een regel in
  `docs/constitutie-log.md`) voor dit gebouwd wordt.
- **Welke minimumdoelen zoekt de AI af?** Volgens de leeftijden van de subthema's van het thema: een kleutersubthema
  brengt de mijlpaal K mee, een subthema in de lagere school de mijlpaal die bij dat leerjaar hoort. Een thema zonder
  subthema's laat de gebruiker eerst kiezen, zoals nu. Lokaal telt mijlpaal K 208 minimumdoelen (ongeveer 11.000
  tokens), tegen ongeveer 37.000 tokens voor de K3-leerplandoelen van vandaag.

- **Welke mijlpaal hoort bij welk leerjaar:** zoals de dekking al rekent (`Jaarfasen.MijlpalenVoor`, ADR-0047): de
  kleuterjaren bij K, L1 tot L4 bij 4, L5 en L6 bij 6.

## Werklog

- 2026-09-16 15:31 · claude-fb043 · aangemaakt (status nieuw)
