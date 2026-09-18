---
id: FB-032
titel: Chatbot doet voorstellen die de gebruiker aanvaardt of weigert
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-18 17:56
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar besliste op 2026-09-15 dat de chatbot ook **voorstellen doet**. Dit is het tweede deel, na FB-031.

**Aangevuld door de eigenaar, 2026-09-18:** de chatbot is de kat (FB-071). Hij slaapt rechtsboven in een mandje;
wie op hem klikt, opent zijn venster, met bovenaan wat hij meebracht en daaronder deze chat. Dit ticket hoort bij fase 1
van de kat (FB-063 tot en met FB-071).

## Gewenst gedrag

- In het chatvenster van de kat (FB-071) vraagt een gebruiker iets te doen, bv. "stel activiteiten voor bij het subthema Bladeren" of "stel
  mijn week voor".
- De chatbot doet dat via de bestaande voorstelflows (FB-025, FB-026, FB-027, FB-028) en toont de voorstellen, die de
  gebruiker aanvaardt of weigert, net zoals op het scherm zelf.
- De chatbot wijzigt zelf nooit iets: er verandert pas iets als de gebruiker een voorstel aanvaardt.
- Hij kan alleen wat de gebruiker zelf mag doen (Art. VI.1).

## Acceptatiecriteria

- [ ] Gegeven de vraag "stel activiteiten voor bij dit subthema", dan toont de chatbot voorstellen met een motivatie, en
  er verandert niets tot de gebruiker er een aanvaardt.
- [ ] Gegeven een aanvaard voorstel, dan is het resultaat hetzelfde als bij aanvaarden op het scherm zelf.
- [ ] Gegeven een vraag om iets te doen wat de gebruiker niet mag, dan weigert de chatbot en zegt waarom.
- [ ] Gegeven een vraag die bij geen voorstelflow hoort, dan zegt de chatbot wat hij wel kan.
- [ ] De logica is getest met een nep-AI-client.

## Testscenario's

1. Open als K3-leerkracht de chatbot en vraag activiteiten voor een K3-subthema. Je krijgt voorstellen.
2. Aanvaard er een. Het staat als eigen activiteit onder het subthema, zoals bij FB-025.
3. Vraag de activiteiten van een K2-subthema aan te passen. De chatbot weigert.
4. Vraag "stel mijn week voor". Je krijgt de voorgestelde blokken van FB-027.

## Buiten scope

- Nieuwe soorten voorstellen die niet ook op een scherm bestaan.

## Open vragen

- Hangt af van FB-031 en van de voorstelflows die het oproept.
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-18 17:56 · kat-sparring · tekst aangevuld: de chatbot is de kat (FB-071), fase 1; prioriteit laag naar middel (eigenaar)
