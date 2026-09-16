---
id: TB-044
titel: AI-knop toont tijdens het nadenken vonken uit de toverstok en springende puntjes
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 23:37
opgepakt-door: claude-ai-voorstellen
branch: ticket/TB-ai-voorstellen
pr: 123
geblokkeerd:
fr: []
---

## Aanleiding

Wie op een AI-knop drukt, wacht enkele seconden. Nu schuift alleen de regenboogrand zijwaarts, en dat valt amper op:
de eigenaar ziet niet duidelijk dat de knop aan het nadenken is. De eigenaar koos het ontwerp op 2026-09-16 uit
de voorstellen in https://claude.ai/artifact/HsoYvQxTxZM8Yj1UUJTT5Z: de vonken van variant C met de springende
puntjes van variant A.

## Voorgestelde wijziging

- `AiKnop` (`frontend/src/components/ui/Knop.tsx`): terwijl `bezig` waar is, stijgen kleine vonkjes in de vijf
  AI-kleuren op uit de toverstok, en krijgt het label drie springende puntjes achteraan.
- `knop-ai` in `frontend/src/index.css`: de nieuwe keyframes; de bestaande veeg en gloed blijven. Onder
  `prefers-reduced-motion` staat alles stil.
- Geldt voor elke `AiKnop` (woordweb, doelsuggesties, plan, rapport). ADR-0039 blijft gelden: de ring en zijn
  betekenis veranderen niet, alleen de beweging tijdens een run. De toelichting in `index.css` wordt bijgewerkt.

## Acceptatiecriteria

- [x] Gegeven een AI-knop, wanneer een run loopt, dan stijgen gekleurde vonkjes op uit de toverstok en springen drie puntjes achter het label.
- [x] Gegeven een AI-knop in rust, wanneer niets loopt, dan staan er geen vonken of puntjes.
- [x] Gegeven "minder beweging" in het besturingssysteem, wanneer een run loopt, dan beweegt er niets en meldt het label de bezigheid nog altijd in tekst.
- [x] Gegeven een schermlezer, wanneer een run loopt, dan leest die de vonken en puntjes niet voor (`aria-hidden`) en blijft `aria-busy` gezet.

## Buiten scope

De vorm en kleuren van de ring zelf, en wat er na een run verschijnt.

## Open vragen

Geen.

## Werklog

- 2026-09-16 22:59 · claude-ai-voorstellen · aangemaakt (status in-uitvoering)
- 2026-09-16 23:21 · claude-ai-voorstellen · AiKnop toont tijdens een run vonken uit de toverstok en drie springende puntjes; Vitest, lint en browserpas (1440, vonken boven de knop zichtbaar) groen
- 2026-09-16 23:33 · claude-ai-voorstellen · in-uitvoering → klaar: Klaar: vonken en springende puntjes op elke AI-knop; criteria afgevinkt op Knop.test.tsx en browserpas; Vitest (1020), lint groen; antagonist COMPLIANT; geen backendwijziging, dus dotnet format niet nodig
- 2026-09-16 23:37 · claude-ai-voorstellen · PR #123
