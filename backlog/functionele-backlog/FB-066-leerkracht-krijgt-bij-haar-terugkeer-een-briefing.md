---
id: FB-066
titel: Leerkracht krijgt bij haar terugkeer een briefing over haar afwezigheid
soort: functioneel
status: nieuw
prioriteit: middel
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

Wanneer de vaste leerkracht terugkomt, weet ze niet wat er tijdens haar afwezigheid gebeurde. Omdat de agenda de
waarheid is, kan de tool dat tonen: het is de briefing (FB-065) in de andere richting.

**Beslissing van de eigenaar, 2026-09-18:** de terugkeerbriefing hoort bij fase 1.

## Gewenst gedrag

- Wanneer een vervanging afloopt of directie ze beëindigt, ziet de afwezige leerkracht bij het openen van de klas eerst
  een terugkeerbriefing. Ze kan ze sluiten en later terug openen.
- De terugkeerbriefing toont:
  - de periode van de vervanging en wie verving;
  - wat er tijdens die periode in de agenda stond, per dag;
  - welke plaatsingen de vervanger toevoegde, verplaatste of uit de agenda haalde;
  - welke lesvoorbereidingen de vervanger aanvaardde (FB-067, FB-068);
  - de doelen waaraan tijdens de vervanging activiteiten in de agenda werkten;
  - wat de vervanger aan de klasfiche veranderde (FB-064);
  - het thema en subthema die nu lopen.
- Directie kan de terugkeerbriefing ook lezen.

## Acceptatiecriteria

- [ ] Gegeven een vervanging die gisteren afliep, wanneer de vaste leerkracht vandaag de klas opent, dan ziet ze eerst de
  terugkeerbriefing.
- [ ] Gegeven activiteiten die de vervanger toevoegde, verplaatste of weghaalde, dan staan ze zo in de terugkeerbriefing.
- [ ] Gegeven een lesvoorbereiding die de vervanger aanvaardde, dan staat ze erin, bij haar activiteit en dag.
- [ ] Gegeven een vaste leerkracht die de terugkeerbriefing sloot, dan komt ze niet vanzelf terug, maar is ze nog te
  openen.
- [ ] Gegeven de terugkeerbriefing, dan staat er geen informatie over kinderen in.

## Testscenario's

1. Leg als directie een vervanging vast voor een K1-klas, van vorige maandag tot gisteren.
2. Zet als vervanger (datums van de vervanging) een activiteit in de agenda, verplaats er een en haal er een weg.
3. Meld aan als de vaste leerkracht en open de klas. De terugkeerbriefing toont de drie wijzigingen, per dag.
4. Sluit de terugkeerbriefing. Open de klas opnieuw: ze komt niet terug, maar je vindt ze nog terug bij de klas.

## Buiten scope

- Een dekkingscijfer van vóór en na: de dekking wordt niet bewaard (Art. V.1), dus de terugkeerbriefing noemt de doelen,
  geen verschil in cijfers.
- Mail of een melding buiten de app.

## Open vragen

- De app houdt vandaag niet bij wie een plaatsing toevoegde, verplaatste of weghaalde. Dat moet erbij komen, vanaf de
  start van de vervanging (of voor elke plaatsing). Te beslissen in de ADR van TB-056.
- Hoe lang blijft de terugkeerbriefing te openen? Standaard tot het einde van het schooljaar.
- Hangt af van FB-063 en FB-065.

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
