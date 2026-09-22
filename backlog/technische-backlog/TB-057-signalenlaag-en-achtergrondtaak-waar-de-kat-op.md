---
id: TB-057
titel: Signalenlaag en achtergrondtaak waar de kat op reageert
soort: technisch
status: klaar
prioriteit: hoog
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-22 20:13
opgepakt-door: claude-tb057
branch: ticket/TB-057-signalenlaag
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

- [x] Gegeven een klas zonder aanleiding, wanneer de taak draait, dan ontstaat er geen signaal en geen AI-aanroep.
- [x] Gegeven dezelfde toestand die twee keer verwerkt wordt, dan ontstaat er geen dubbel signaal.
- [x] Gegeven twee instanties van de backend, dan verwerkt er maar één een tik.
- [x] Gegeven een gebruiker, dan geeft de deurmat alleen signalen en voorstellen die zij mag zien.
- [x] Gegeven een signaal waarvan de reden verdwenen is, dan verdwijnt het bij de volgende tik.
- [x] De detectie is getest zonder AI, de aansturing van taken met een nepafhandelaar, en de opslag tegen Postgres.

## Buiten scope

De signalen zelf per use case (FB-068, FB-069, FB-070), de kat op het scherm (FB-071), meldingen buiten de app (mail,
push).

**Twee inperkingen die de eigenaar op 2026-09-22 goedkeurde:**

- **De vervangingssoorten zijn niet gebouwd.** ADR-0059 K7 noemt ook "vervanging gestart of geëindigd" en
  "lesvoorbereidingen klaar", maar er bestaat geen `Vervanging` in het model: FB-063 en FB-068 zijn geparkeerd, dus
  geen enkele detector kan ze maken. Ze komen in de enum met de functie die ze voortbrengt.
- **Er gaat hier geen enkele AI-aanroep uit.** De seam `IKattaak` staat er en is bewezen met een nepafhandelaar; de
  eerste echte AI-taak is FB-070. Het criterium over de **nep-AI-client** hoort dus bij FB-070, niet hier. Dat ticket
  staat op `main` en is van de eigenaar: die regel moet daar nog bij.

## Open vragen

- Hangt af van TB-056 (Art. IV.8 en de ADR van de kat). Opgelost: TB-056 is gemerged (PR 146).
- Hoe vaak tikt de taak: beslist door ADR-0059 D1, 07:00 en 19:00 Brusselse tijd. Instelbaar via `Kat:Tikmomenten`.

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
- 2026-09-22 19:01 · claude-tb057 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten (kat zonder vervanging: TB-057, FB-069, FB-070, FB-071)
- 2026-09-22 19:58 · claude-tb057 · gebouwd: Signaal + migratie, Signaalronde met detector- en taakseam, achtergrondtaak met tikrij als lease, deurmat met rechtencontrole; 2167 unit- en 580 integratietests groen, dotnet format schoon
- 2026-09-22 20:13 · claude-tb057 · in-uitvoering → klaar: signalenlaag, achtergrondtaak met tikrij als lease, detector- en taakseam en deurmat met rechtencontrole; antagonist COMPLIANT na een MAJOR (klasleeftijd via de ene mapping) in ronde 2, vijf MINORs in backlog/worklogs/TB-057/antagonist.md; alle gates groen
