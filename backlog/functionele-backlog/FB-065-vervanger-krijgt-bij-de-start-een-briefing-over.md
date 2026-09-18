---
id: FB-065
titel: Vervanger krijgt bij de start een briefing over de klas
soort: functioneel
status: nieuw
prioriteit: hoog
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

Een vervanger komt in een klas die ze niet kent, vaak zonder overdracht. Alles wat ze nodig heeft om te starten, staat
verspreid in de app: het thema, het subthema, de agenda, de doelen.

**Beslissingen van de eigenaar, 2026-09-18:** de kat briefingt de vervanger; de agenda is de waarheid, dus wat er de
voorbije dagen in de agenda stond, is gebeurd; de melding is alleen in de app.

## Gewenst gedrag

Wanneer de vervanger tijdens de vervanging de klas opent, ziet ze eerst de briefing. Die is altijd actueel: verandert de
agenda, dan verandert de briefing. Ze toont, in deze volgorde:

- de klasfiche (FB-064);
- waar de klas staat: het thema en het subthema van vandaag, met de onderzoeksvragen, de kern- en streefwoordenschat en
  de woordwebs van de leerkrachten van de klas bij dat subthema;
- wat de voorbije twee weken in de agenda stond;
- de komende schooldagen: activiteiten, hoeken, algemene fiches en schooluren, met de lege momenten aangewezen;
- de subdoelen van het lopende subthema waaraan nog geen activiteit in de agenda van de klas werkte.

De briefing zegt in zichtbare tekst dat informatie over individuele kinderen van de zorgcoördinator of de directie komt.
De afwezige leerkracht en directie kunnen de briefing ook lezen.

## Acceptatiecriteria

- [ ] Gegeven een lopende vervanging, wanneer de vervanger de klas opent, dan ziet ze de briefing als eerste, en kan ze
  die later terug openen.
- [ ] Gegeven een thema en subthema die vandaag lopen, dan toont de briefing hun naam, onderzoeksvragen en woordenschat.
- [ ] Gegeven activiteiten in de agenda van de voorbije twee weken, dan staan ze in de briefing; een activiteit die de
  leerkracht uit de agenda haalde, niet.
- [ ] Gegeven een schooldag in de komende week met een moment zonder planning binnen de schooluren, dan wijst de
  briefing dat moment aan.
- [ ] Gegeven een subdoel van het lopende subthema waaraan geen geplande activiteit werkte, dan staat het bij de open
  subdoelen.
- [ ] Gegeven de briefing, dan staat er geen informatie over kinderen in, en zegt ze waar de vervanger die krijgt.

## Testscenario's

1. Leg als directie een vervanging vast voor een K3-klas met een lopend thema en subthema en een gevulde agenda.
2. Meld aan als de vervanger en open de klas. De briefing staat voor je, met bovenaan de klasfiche.
3. Controleer het thema, het subthema, de woordenschat, de voorbije twee weken en de komende dagen tegen de agenda.
4. Haal als vaste leerkracht een activiteit van morgen uit de agenda. Meld aan als de vervanger: de briefing toont ze
   niet meer bij de komende dagen.
5. Bekijk de briefing op telefoonbreedte (ongeveer 390px): alles is leesbaar zonder zijwaarts te scrollen.

## Buiten scope

- Lesvoorbereidingen (FB-067, FB-068).
- De terugkeerbriefing (FB-066).
- Informatie over kinderen (Art. VI.2).

## Open vragen

- Geen AI-samenvatting in fase 1 (eigenaar, TB-056, ADR-0057 V6).
- Hoe ver kijkt de briefing terug en vooruit? Standaard twee weken terug en vijf schooldagen vooruit (ADR-0057 D5).
- Hangt af van FB-063 en FB-064. De vervanger leest alleen (ADR-0057 V2): de briefing heeft geen knoppen die iets
  wijzigen.

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
- 2026-09-18 18:11 · claude-tb056 · tekst bijgewerkt na TB-056: de vervanger leest alleen en beslist niets (ADR-0057)
