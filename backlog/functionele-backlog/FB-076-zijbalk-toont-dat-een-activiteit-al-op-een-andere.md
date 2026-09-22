---
id: FB-076
titel: Zijbalk toont dat een activiteit al op een andere dag ingepland is, en op welke
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-22 21:51
opgepakt-door: claude-fb076
branch: ticket/FB-076-ingepland
pr:
geblokkeerd:
fr: [FR-6.1]
---

## Aanleiding

In de zijbalk van de agenda ziet de leerkracht niet welke activiteiten al ergens ingepland zijn. Ze moet de weken
doorzoeken om te weten of een activiteit al gebruikt is, en plant er soms een tweede keer een in zonder het te merken.

## Gewenst gedrag

- In de zijbalk heeft een activiteit die al in de agenda van de klas staat, een **kleurstreep links** en een **icoon of
  label**, zodat ze niet alleen door kleur herkenbaar is.
- De activiteit zegt op welke dag (of dagen) ze ingepland is.
- Een activiteit die nog nergens staat, ziet eruit zoals vandaag.
- Wordt de activiteit uit de agenda gehaald, dan verdwijnt de markering.
- Een activiteit inplannen die al ingepland is, blijft mogelijk.

## Acceptatiecriteria

- [ ] Gegeven een activiteit die op een dag in de agenda van de klas staat, wanneer de leerkracht de zijbalk bekijkt, dan heeft ze een kleurstreep links, een icoon of label en de dag waarop ze staat.
- [ ] Gegeven een activiteit die nog nergens ingepland is, dan heeft ze geen markering.
- [ ] Gegeven een ingeplande activiteit, wanneer de leerkracht ze uit de agenda haalt, dan verdwijnt de markering zonder herladen.
- [ ] Gegeven een activiteit die op twee dagen staat, dan noemt de zijbalk beide dagen, of het aantal en de eerste dag.
- [ ] Gegeven de markering, dan haalt de tekst ervan een contrast van minstens 4,5:1, gemeten in de browser.

## Testscenario's

1. Meld aan als leerkracht van een klas en open de agenda.
2. Sleep een activiteit uit de zijbalk naar dinsdag. In de zijbalk krijgt ze een streep links, een icoon en "di 14/10"
   (of de dag waarop je ze plantte).
3. Sleep dezelfde activiteit ook naar donderdag: de zijbalk noemt beide dagen.
4. Haal beide weg uit de agenda: de markering verdwijnt.
5. Bekijk het op een breedte van ongeveer 390px: de markering en de dag zijn leesbaar.

## Buiten scope

- Verhinderen dat een activiteit twee keer ingepland wordt.
- Markeren in andere klassen dan die van de agenda.

## Open vragen

Geen. De kleur kiest de bouwsessie met de frontend-design-skill, en ze mag niet botsen met de doelsoorten, de status van
voorstellen of de dekking.

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
- 2026-09-22 21:51 · claude-fb076 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten, samen ontworpen met FB-077
