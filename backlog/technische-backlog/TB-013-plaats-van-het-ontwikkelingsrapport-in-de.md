---
id: TB-013
titel: Plaats van het ontwikkelingsrapport in de linkerzijbalk vastleggen (R32)
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 13:42
opgepakt-door: kindrapport
branch: ticket/TB-013-ontwikkelingsrapport-zijbalk
pr:
geblokkeerd:
fr: [FR-13]
---

## Aanleiding

Na de merge van PR #58 (TB-005) voegde de eigenaar toe wat hij verwachtte maar nog niet gezegd had: *"het
kindvolgsysteem/rapport moet ook een nieuwe linker sidepane tabje worden ONDERAAN, dus nog veel onder de fiches in een
nieuwe sectie"*. TB-005 staat op `main` als klaar, dus de toevoeging komt via dit ticket, zodat de bouwtickets van het
ontwikkelingsrapport ze meekrijgen.

## Voorgestelde wijziging

Geen broncode. Alleen documenten:

- **ADR-0035:**
  - §1.7: R32, letterlijk;
  - §3.10: de uitwerking, met twee standaardkeuzes:
    - D17: een eigen sectie onderaan de zijbalk, onder een lijn, net boven Instellingen;
    - D18: de tab alleen voor wie rapporten mag zien;
  - een open punt voor het bouwticket: wat er op een telefoon gebeurt, waar de onderbalk vijf tabs heeft;
  - bouwticket 1 brengt de tab mee.
- **Functionele analyse:** FR-13.10.
- **Grondwet:** in het ratificatielog de telling van de uitspraken (R1 tot R32). R32 raakt de grondwet zelf niet.

## Acceptatiecriteria

- [ ] Gegeven ADR-0035, dan staat R32 letterlijk in §1.7, en staan de uitwerking en de standaardkeuzes D17 en D18 apart in §3.10.
- [ ] Gegeven FR-13 in de functionele analyse, dan zegt FR-13.10 dat het ontwikkelingsrapport een eigen tab krijgt onderaan de linkerzijbalk, in een nieuwe sectie onder de fiches, alleen voor wie rapporten mag zien.
- [ ] Gegeven de lijst met bouwtickets in ADR-0035 §6, dan brengt bouwticket 1 die tab mee, samen met het eerste scherm erachter.
- [ ] Gegeven de antagonist-audit, dan is het oordeel COMPLIANT, of is elke bevinding verwerkt of uitdrukkelijk opzijgezet.

## Buiten scope

- De tab bouwen: dat doet bouwticket 1 van het ontwikkelingsrapport, met de `frontend-design`-skill.
- Wat er op een telefoon gebeurt: dat beslist het bouwticket en toont het aan de eigenaar.

## Open vragen

Geen.

## Werklog

- 2026-09-14 13:42 · kindrapport · aangemaakt (status in-uitvoering)
