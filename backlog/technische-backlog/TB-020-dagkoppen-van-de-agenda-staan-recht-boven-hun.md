---
id: TB-020
titel: Dagkoppen van de agenda staan recht boven hun uurkolommen
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:26
opgepakt-door: agenda-uitlijning
branch: ticket/agenda-uitlijning
pr: 73
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

- [x] Gegeven de weekweergave in een desktopbrowser met een zichtbare scrollbalk, wanneer de agenda open staat, dan valt de linkerrand van elke dagkop op dezelfde pixel als de linkerrand van de uurkolom eronder, voor elke dag van de week.
- [x] Gegeven de dagweergave, wanneer de agenda open staat, dan is de dagkop even breed als de uurkolom eronder.
- [x] Gegeven een scherm van ongeveer 390 px breed, wanneer de weekweergave open staat, dan staan de koppen ook recht boven hun kolommen en scrollt de pagina niet horizontaal.
- [x] Gegeven de weekweergave, wanneer een leerkracht met Tab op de dagknop van de laatste dag komt, dan staat de focusring er volledig: de kopregel knipt er niets van af.
- [x] Gegeven de bestaande tests van het tijdraster, wanneer ze draaien, dan slagen ze allemaal.

## Buiten scope

De maandweergave (`Maandrooster.tsx`), die geen apart scrollvak voor de uren heeft. Ook de hoogte en de standaardscrollpositie van het uurvenster blijven zoals ze zijn.

## Open vragen

Geen.

## Werklog

- 2026-09-15 14:13 · agenda-uitlijning · aangemaakt (status in-uitvoering)
- 2026-09-15 14:21 · agenda-uitlijning · gebouwd (d931026); pnpm lint groen, 131 Vitest-tests van plan groen; headless Chrome tegen een draaiende API: afwijking kop/kolom 0 px op week 1440 (7 dagen), dag 1440 en week 390 (3 dagen, geen horizontale scroll); zonder de fix 2,1 tot 15 px, de breedte van de scrollbalk; focusring van de dagknoppen valt volledig binnen de kopregel
- 2026-09-15 14:23 · agenda-uitlijning · antagonist: COMPLIANT met twee kleine opmerkingen, beide afgewerkt: een zin in het codecommentaar beweerde meer dan de code garandeert en is herschreven; criterium voor de focusring toegevoegd (gemeten: ring volledig binnen de kopregel). Niet gemeten: de kop van vandaag bij 1024 px met het hoekenpaneel open, want de testklas heeft geen schooljaar dat vandaag bevat; de kopregel knipt daar op dezelfde rand als de kaart al deed
- 2026-09-15 14:23 · agenda-uitlijning · in-uitvoering → klaar: klaar: dagkoppen en uurkolommen reserveren dezelfde strook voor de scrollbalk; lint groen, 131 tests groen, browsercontrole 0 px, antagonist COMPLIANT
- 2026-09-15 14:26 · agenda-uitlijning · PR #73
