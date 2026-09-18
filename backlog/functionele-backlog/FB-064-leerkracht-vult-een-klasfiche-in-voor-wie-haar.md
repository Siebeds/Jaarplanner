---
id: FB-064
titel: Leerkracht vult een klasfiche in voor wie haar klas overneemt
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 18:11
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

Wat een vervanger de eerste ochtend het meest nodig heeft, staat niet in de app: het dagritme, de klasafspraken en
rituelen, waar het materiaal staat, praktische zaken zoals de turndag. Zonder dat is de briefing (FB-065) een
samenvatting van de planning, en geen start.

**Beslissing van de eigenaar, 2026-09-18:** een klasfiche, zonder kinderen, die de vaste leerkracht invult, hoort bij
fase 1.

## Gewenst gedrag

- Elke klas heeft per schooljaar een klasfiche met rubrieken: dagritme, klasafspraken en rituelen, materiaal (waar staat
  wat), praktisch (turnen, speelplaatsbeurt, vaste momenten), en een vrije rubriek.
- De leerkrachten van de klas en directie bewerken ze. Een vervanger leest ze tijdens de vervanging, maar wijzigt niets
  (FB-063, ADR-0057).
- Wie de klas mag inkijken (ADR-0040), leest ze.
- Bij het invullen staat zichtbaar dat er geen namen of informatie over kinderen in de fiche horen.
- Een lege fiche zegt dat ze nog niet ingevuld is.

## Acceptatiecriteria

- [ ] Gegeven een leerkracht van de klas, wanneer ze de klasfiche invult en bewaart, dan ziet ze die terug bij de klas.
- [ ] Gegeven een leerkracht van een andere klas van dezelfde jaarfase, dan leest ze de fiche maar kan ze niets wijzigen.
- [ ] Gegeven een vervanger tijdens de vervanging, dan leest ze de fiche maar kan ze niets wijzigen; na de vervanging
  leest ze ze niet meer.
- [ ] Gegeven het invulscherm, dan staat er zichtbaar dat namen en informatie over kinderen er niet in horen.
- [ ] Gegeven een klas zonder ingevulde fiche, dan zegt de klas dat de fiche nog niet ingevuld is.
- [ ] Bekeken op desktop en op ongeveer 390px.

## Testscenario's

1. Meld aan als leerkracht van een K2-klas. Open de klas en kies Klasfiche. Er staat dat ze nog niet ingevuld is.
2. Vul het dagritme en de klasafspraken in en bewaar. Je ziet ze terug.
3. Meld aan als leerkracht van een andere K2-klas. Je leest de fiche, maar kan ze niet bewerken.
4. Meld aan als vervanger van de eerste klas tijdens een vervanging. Je leest de fiche, maar kan ze niet bewerken.

## Buiten scope

- Informatie over kinderen (Art. VI.2): de fiche gaat over de klas.
- AI: de fiche is wat de leerkracht schrijft.

## Open vragen

- Vrije tekst per rubriek, of een dagritme als uurschema naast de schooluren (FB-023)?
- Neemt een nieuw schooljaar de fiche van vorig jaar over als vertrekpunt?
- Een graadklas: één fiche, ook met twee jaarfasen?
- Hangt af van TB-056 (Art. IX.2 en ADR-0057: een klasfiche per klas en schooljaar, elke rubriek hoogstens 2000
  tekens, een nieuw schooljaar begint leeg; dat zijn standaardkeuzes).

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
- 2026-09-18 18:11 · claude-tb056 · tekst bijgewerkt na TB-056: de vervanger leest alleen en beslist niets (ADR-0057)
