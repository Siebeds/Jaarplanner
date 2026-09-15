---
id: FB-030
titel: AI stelt activiteiten voor op basis van gekozen materialen
soort: functioneel
status: nieuw
prioriteit: laag
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:10
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-4.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15 bij de materialenlijst: *"of op basis van materialen activiteiten voorstellen?"*.

Een leerkracht die weet welk materiaal ze klaar heeft staan, wil activiteiten die dat materiaal gebruiken.

## Gewenst gedrag

- Wanneer de leerkracht bij een subthema activiteiten laat voorstellen (FB-025), kan ze eerst materialen uit de
  materialenlijst van haar jaarfase aanduiden (FB-029).
- De AI stelt dan activiteiten voor die die materialen gebruiken en aan de subdoelen van het subthema werken, met een
  motivatie.
- Een aanvaard voorstel wordt een eigen activiteit, met de gebruikte materialen eraan gekoppeld.

## Acceptatiecriteria

- [ ] Gegeven een K3-subthema en drie aangeduide materialen, wanneer de leerkracht voorstellen vraagt, dan gebruikt elk
  voorstel minstens een van die materialen en werkt het aan een subdoel van het subthema.
- [ ] Gegeven een aanvaard voorstel, dan heeft de nieuwe eigen activiteit die materialen gekoppeld.
- [ ] Gegeven een modelantwoord met een materiaal dat niet in de lijst staat, dan wordt dat niet gekoppeld.
- [ ] De logica is getest met een nep-AI-client.

## Testscenario's

1. Open een K3-subthema en kies "stel activiteiten voor".
2. Duid drie materialen aan en vraag de voorstellen. Elk voorstel noemt welk materiaal het gebruikt.
3. Aanvaard er een. De activiteit staat onder het subthema, met de materialen gekoppeld.

## Buiten scope

Niets.

## Open vragen

- Hangt af van FB-025 en FB-029; de bron van de materialenlijst is nog open (FB-029).
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
