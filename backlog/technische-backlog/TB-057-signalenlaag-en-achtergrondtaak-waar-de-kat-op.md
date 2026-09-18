---
id: TB-057
titel: Signalenlaag en achtergrondtaak waar de kat op reageert
soort: technisch
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

De kat (TB-056, FB-068 tot en met FB-071) werkt proactief: hij merkt dingen op zonder dat iemand iets vraagt. De app
heeft vandaag geen achtergrondtaak, en niets dat per klas bijhoudt wat er opvalt. De eigenaar besliste op 2026-09-18 dat
de detectie deterministisch is, zonder AI: de AI maakt alleen inhoud.

## Voorgestelde wijziging

- **Achtergrondtaak** in de backend (hosted service of Azure-taak, zoals de ADR van TB-056 beslist): draait op vaste
  momenten in Belgische tijd, is idempotent, en verwerkt een tik maar één keer, ook met meerdere instanties.
- **Signalenlaag** in `Application`: berekent per klas de signalen zonder AI. Een signaal heeft een soort, een klas, de
  ontvangers, een moment en of het gezien of afgehandeld is. De soorten van fase 1: vervanging gestart of geëindigd,
  lesvoorbereidingen klaar (FB-068), doel in gevaar en subthema niet gepland (FB-069), aanbod-gat voor een thema start
  (FB-070).
- **AI-taken:** wat inhoud nodig heeft (lesvoorbereiding, activiteitvoorstel), zet de laag als taak klaar; de AI-client
  blijft achter zijn interface en de taak valt onder het AI-budget van de school (FB-055, zodra dat er is).
- **Leesmodel "deurmat"** voor één gebruiker: haar signalen plus de open voorstellen die al bestaan
  (activiteitvoorstel, subdoelvoorstel, ...), met de rechtencontrole van Art. VI.1. FB-071 toont het.

## Acceptatiecriteria

- [ ] Gegeven een klas zonder aanleiding, wanneer de taak draait, dan ontstaat er geen signaal en geen AI-aanroep.
- [ ] Gegeven dezelfde toestand die twee keer verwerkt wordt, dan ontstaat er geen dubbel signaal.
- [ ] Gegeven twee instanties van de backend, dan verwerkt er maar één een tik.
- [ ] Gegeven een gebruiker, dan geeft de deurmat alleen signalen en voorstellen die zij mag zien.
- [ ] Gegeven een signaal waarvan de reden verdwenen is, dan verdwijnt het bij de volgende tik.
- [ ] De detectie is getest zonder AI, de aansturing van AI-taken met een nep-AI-client, en de opslag tegen Postgres.

## Buiten scope

De signalen zelf per use case (FB-068, FB-069, FB-070), de kat op het scherm (FB-071), meldingen buiten de app (mail,
push).

## Open vragen

- Hangt af van TB-056 (Art. IV.8 en de ADR van de kat).
- Hoe vaak tikt de taak: een paar vaste momenten per dag, of vaker met een begrenzing van wat de gebruiker ziet?

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
