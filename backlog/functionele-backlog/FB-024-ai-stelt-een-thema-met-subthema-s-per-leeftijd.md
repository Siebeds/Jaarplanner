---
id: FB-024
titel: AI stelt een thema met subthema's per leeftijd voor op basis van de doelen
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:10
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-4.1, FR-4.2, FR-4.3]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"Thema's voorstellen op basis van minimumdoelen/leerplandoelen (of thema enkel linken
aan minimumdoelen en subthema's de leerplandoelen?) met subthema's op basis van leerplandoelen voor dat thema"*.

Vandaag helpt de AI alleen bij het kiezen van doelen voor een bestaand thema (doelsuggesties) en, in de backend, bij
stap 2 en 6 van de thema-opbouw. Die wizard heeft nog geen scherm (E6-05). Een volledig thema voorstellen kan niet.

**Beslissing van de eigenaar, 2026-09-15:** de doelen van een thema worden berekend uit wat eronder hangt (FB-009). De AI
stelt dus een thema voor met **subthema's per leeftijd die de leerplandoelen dragen**; de minimumdoelen volgen daaruit.

## Gewenst gedrag

- Wie themabeheer heeft, of de directie, kiest waarop een voorstel moet steunen: minimumdoelen en/of leerplandoelen (bv.
  de doelen die nog in geen enkel thema zitten), de leeftijden en de duur (4 tot 6 weken).
- De AI stelt een of meer thema's voor, elk met een naam, invalshoeken, 2 à 3 themadoelen, en per leeftijd subthema's
  van 1 à 2 weken die samen de duur van het thema vullen, elk met een onderzoeksvraag en subdoelen.
- Elk voorstel en elk doel erin draagt een korte motivatie.
- De gebruiker bekijkt het voorstel, past het aan, aanvaardt het geheel of een deel, of weigert het. Niets komt in de
  themalijst zonder dat iemand aanvaardt, en de status van het voorstel wordt bewaard.
- Een aanvaard voorstel wordt een gewoon thema, gebouwd via de schrijfacties van de thema-opbouw voor een nieuw thema.
- Doelen mogen in meerdere thema's terugkomen: herhaling is gewenst.

## Acceptatiecriteria

- [ ] Gegeven een keuze van tien minimumdoelen van einde kleuter en de leeftijden K2 en K3, wanneer themabeheer een
  voorstel vraagt, dan krijgt ze een thema met subthema's voor K2 en K3, subdoelen uit de doelen van die leeftijden, en
  een motivatie bij elk doel.
- [ ] Gegeven een voorstel, dan telt de duur van de subthema's per leeftijd op tot de duur van het thema.
- [ ] Gegeven een modelantwoord met een doelcode die niet bij de kandidaten hoort, dan wordt die code niet getoond en niet
  bewaard.
- [ ] Gegeven een voorstel, wanneer themabeheer het aanvaardt, dan staat het thema met zijn subthema's en subdoelen in de
  themalijst; wanneer ze weigert, verandert er niets aan de thema's en staat de weigering bewaard.
- [ ] Gegeven een leerkracht zonder themabeheer, dan kan ze geen voorstel vragen.
- [ ] De logica is getest met een nep-AI-client.

## Testscenario's

1. Meld aan als themabeheer. Kies "thema voorstellen", duid tien minimumdoelen aan, kies K2 en K3 en vijf weken.
2. Het voorstel toont een naam, invalshoeken, themadoelen, en per leeftijd subthema's die samen vijf weken duren, elk
   met doelen en een motivatie.
3. Pas de naam van een subthema aan, schrap een subdoel en aanvaard. Het thema staat in de lijst, met jouw aanpassingen.
4. Vraag een tweede voorstel en weiger het. Er komt geen thema bij.
5. Open het nieuwe thema. Het doelenoverzicht (FB-009) toont de minimumdoelen die het bereikt.

## Buiten scope

- Activiteiten voorstellen: FB-025.
- Het scherm van de wizard zelf: story E6-05.

## Open vragen

- **Grondwet:** Art. IV.8 zegt dat de AI in de doel-eerst werkwijze nooit vooruitloopt op de mens. Een volledig thema
  voorstellen doet dat wel, ook als alles pas na aanvaarden bewaard wordt. Dat vraagt een beslissing en een wijziging van
  Art. IV.8 (Art. XI) vóór de bouw.
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI.
- De kandidatenset moet begrensd blijven (TB-007): alleen de doelen van de gekozen leeftijden.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
