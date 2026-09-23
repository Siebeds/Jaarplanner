---
id: TB-072
titel: Agenda-acties via één context in plaats van drie lagen props
soort: technisch
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 09:49
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De acties van de agenda (`magPlannen`, `onOpen`, `onOpenFiche`, `onVanDag`, `onWijzigTijd`) gaan drie niveaus diep
als props: in `features/plan/Tijdraster.tsx` van `Tijdraster` naar `Dagkolom` naar `Blok`, en in
`features/plan/Maandrooster.tsx` van `Maandrooster` naar `Maandcel` naar `Maandchip`. `Agendascherm.tsx` levert ze
als inline functies. Dat zijn zo'n twintig props die alleen doorgegeven worden, en elke nieuwe actie op een blok
moet door alle lagen heen. De Vercel-regels `architecture-compound-components` en `state-context-interface` raden
één context aan.

## Voorgestelde wijziging

- Eén agenda-context met een `{ state, actions }`-vorm, één keer aangeboden in `Agendascherm`.
- `Blok` en `Maandchip` lezen hun acties uit die context; de tussenlagen geven ze niet meer door.
- De acties in de context zijn stabiel (`useCallback` of een ref), zodat een blok niet hertekent omdat de context
  een nieuwe functie kreeg.
- Het is de eerste `createContext` in de app: houd hem klein en zet hem bij de agenda, niet in `lib/`.

## Acceptatiecriteria

- [ ] Gegeven de code, wanneer je `Dagkolom` en `Maandcel` bekijkt, dan geven ze geen actie-props meer door.
- [ ] Gegeven een blok in de week- en de maandweergave, wanneer de gebruiker het opent, verplaatst of de tijd
      wijzigt, dan werkt dat zoals voordien, ook voor een gebruiker zonder planrecht, die alleen leest.
- [ ] Gegeven een render van `Agendascherm` zonder gewijzigde gegevens, wanneer de Profiler meekijkt, dan hertekent
      een blok niet omdat de context veranderde.
- [ ] Gegeven de bestaande tests van `Tijdraster`, `Maandrooster` en `Agendascherm`, wanneer ze draaien, dan slagen
      ze.

## Buiten scope

De rerenders tijdens het slepen (TB-071); dit ticket kan daar los van gebouwd worden.

## Open vragen

Geen.

## Werklog

- 2026-09-23 09:49 · claude-vercelanalyse · aangemaakt (status nieuw)
