---
id: TB-020
titel: Dagkoppen van de agenda staan recht boven hun uurkolommen
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:13
opgepakt-door: agenda-uitlijning
branch: ticket/agenda-uitlijning
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar zag op 2026-09-15 dat in de week- en dagweergave van de agenda de dagkoppen (met de thema- en subthemabanden) niet recht boven hun uurkolommen staan. Maandag klopt nog, maar naar rechts toe schuift elke kolom verder op: bij vrijdag scheelt het al zo'n negen pixels. Een leerkracht die vanuit een dagkop naar beneden kijkt, leest zo de rand van de verkeerde kolom.

De oorzaak: de koppen staan buiten het scrollvak met de uren, zodat ze blijven staan terwijl de uren schuiven. Het scrollvak heeft een verticale scrollbalk, en die neemt breedte weg van de uurkolommen maar niet van de koppen.

## Voorgestelde wijziging

In `frontend/src/features/plan/Tijdraster.tsx` reserveren de kopregel en het scrollvak allebei dezelfde strook voor de scrollbalk (`scrollbar-gutter: stable`). De kopregel krijgt daarvoor `overflow-hidden`, want de strook bestaat alleen op een element dat zelf kan scrollen. Er staat niets in de kopregel dat erbuiten hoort te hangen, en de kaart eromheen knipt al af. Met een overlay-scrollbalk (macOS, telefoons) reserveren beide niets, dus ook daar blijven ze gelijk.

Geen nieuwe kleur of typografie: de strook boven de scrollbalk is leeg en heeft de kleur van de kaart.

## Acceptatiecriteria

- [ ] Gegeven de weekweergave in een desktopbrowser met een zichtbare scrollbalk, wanneer de agenda open staat, dan valt de linkerrand van elke dagkop op dezelfde pixel als de linkerrand van de uurkolom eronder, voor elke dag van de week.
- [ ] Gegeven de dagweergave, wanneer de agenda open staat, dan is de dagkop even breed als de uurkolom eronder.
- [ ] Gegeven een scherm van ongeveer 390 px breed, wanneer de weekweergave open staat, dan staan de koppen ook recht boven hun kolommen en scrollt de pagina niet horizontaal.
- [ ] Gegeven de bestaande tests van het tijdraster, wanneer ze draaien, dan slagen ze allemaal.

## Buiten scope

De maandweergave (`Maandrooster.tsx`), die geen apart scrollvak voor de uren heeft. Ook de hoogte en de standaardscrollpositie van het uurvenster blijven zoals ze zijn.

## Open vragen

Geen.

## Werklog

- 2026-09-15 14:13 · agenda-uitlijning · aangemaakt (status in-uitvoering)
