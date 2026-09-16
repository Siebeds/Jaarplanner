---
id: FB-025
titel: AI stelt activiteiten voor binnen een subthema
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-17 00:19
opgepakt-door: claude-fb025
branch: ticket/FB-025-activiteitvoorstellen
pr:
geblokkeerd:
fr: [FR-4.1, FR-4.2, FR-4.3]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"Activiteiten binnen een subthema voorstellen op basis van leerplandoelen van dat
subthema"*.

Vandaag bedenkt een leerkracht elke activiteit zelf. De AI doet niets onder een subthema.

**Beslissing van de eigenaar, 2026-09-15:** een aanvaard voorstel wordt een **eigen activiteit** van wie aanvaardt
(FB-015). Zij beslist dus over de doelen, en delen met het subthema gaat daarna via FB-016.

## Gewenst gedrag

- Een leerkracht van een klas van die leeftijd vraagt bij een subthema "stel activiteiten voor".
- De AI krijgt het subthema (naam, onderzoeksvragen, subdoelen) en de activiteiten die er al zijn, zodat ze die niet
  herhaalt, en stelt activiteiten voor: naam, type (experiment, prentenboek, uitstap, …), wat de kleuters doen en wat er
  verwacht wordt, een lengte, de subdoelen waaraan ze werkt, en een korte motivatie.
- Per voorstel: aanvaarden (eventueel na aanpassen), of weigeren. Een voorstel en de beslissing erover worden bewaard.
- Een aanvaard voorstel wordt een eigen activiteit van de leerkracht, met de doelen die ze aanvaardt.
- Opnieuw vragen geeft nieuwe voorstellen, zonder de geweigerde terug te geven.
- De AI maakt geen lesmateriaal (Art. I.2): geen werkbladen of uitgeschreven lessen, alleen wat een activiteit in de tool
  al beschrijft.

## Acceptatiecriteria

- [ ] Gegeven een K3-subthema met vier subdoelen, wanneer een K3-leerkracht voorstellen vraagt, dan krijgt ze activiteiten
  die elk aan een of meer van die subdoelen werken, met een motivatie.
- [ ] Gegeven een voorstel, wanneer ze het aanvaardt, dan is het haar eigen activiteit onder dat subthema, met de
  aanvaarde doelen.
- [ ] Gegeven een voorstel, wanneer ze het weigert, dan komt het bij een nieuwe vraag niet terug.
- [ ] Gegeven een modelantwoord met een doel dat geen subdoel van het subthema is of een onbekende code, dan wordt dat doel
  niet getoond en niet bewaard.
- [ ] Gegeven een leerkracht van een andere leeftijd, dan kan ze voor dit subthema geen voorstellen vragen.
- [ ] De logica is getest met een nep-AI-client.

## Testscenario's

1. Meld aan als leerkracht van een K3-klas. Open een K3-subthema en kies "stel activiteiten voor".
2. Je krijgt voorstellen met naam, type, lengte, doelen en motivatie.
3. Pas de naam van een voorstel aan en aanvaard het. Het staat als eigen activiteit onder het subthema.
4. Weiger een ander voorstel. Vraag opnieuw: het geweigerde komt niet terug.
5. Plan de nieuwe activiteit in je agenda. Haar doelen tellen voor de dekking van je klas (FB-015).

## Buiten scope

- Voorstellen op basis van materialen: FB-030.
- De activiteiten zelf in de agenda laten zetten: FB-027.

## Open vragen

- Hoeveel voorstellen per keer? **Standaard** 5, instelbaar, zoals bij FB-026.
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI.
- Hangt af van FB-015.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-17 00:19 · claude-fb025 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten; grondwet mag aangepast worden zodat de AI activiteiten bedenkt
