---
id: FB-101
titel: Leerkracht past het uur van een fiche aan voor één dag of voor de hele periode
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-24
bijgewerkt: 2026-09-24 17:44
opgepakt-door: claude-fb101
branch: ticket/FB-101-fiche-uur-periode
pr:
geblokkeerd:
fr: [FR-6.1]
---

## Aanleiding

De eigenaar (2026-09-24): "bij het aanpassen van een uur van een algemene fiche activiteit wil ik ook de optie om alle
andere mee te updaten (maar ook de mogelijkheid om 1 enkele te updaten)". Vandaag verandert het bewerkscherm van een
fiche enkel het uur van de ene dag die ze opende. Wie turnen een half uur later wil zetten, moet elke dag apart
aanpassen. Voor hoeken kan het uur van de hele periode al wel.

## Gewenst gedrag

- In het bewerkscherm van een ingeplande algemene fiche kiest de leerkracht bij het uur tussen **alleen deze dag** en
  **alle dagen van deze periode**. Standaard staat "alleen deze dag" aan.
- "Alle dagen van deze periode" geeft elke dag van deze ingeplande periode het nieuwe begin- en einduur, ook voorbije
  dagen en ook dagen die eerder apart verschoven waren (eigenaar 2026-09-24). De dagen zelf en hun teksten blijven.
- Het lukt voor alle dagen samen of voor geen enkele: nooit een half aangepaste periode.
- Slepen of uitrekken in de agenda blijft één dag, zonder extra vraag (eigenaar 2026-09-24).
- Wie de klas alleen mag inkijken, ziet de keuze niet.

## Acceptatiecriteria

- [ ] Gegeven een fiche op elke maandag van een periode, wanneer de leerkracht op één maandag het uur wijzigt met "alleen deze dag", dan verandert enkel die maandag.
- [ ] Gegeven dezelfde fiche, wanneer ze het uur wijzigt met "alle dagen van deze periode", dan hebben alle dagen van die periode het nieuwe uur, en blijven de dagen en de dagteksten ongewijzigd.
- [ ] Gegeven een uur dat de server weigert (bv. einde voor begin), dan verandert geen enkele dag en toont het scherm de reden.
- [ ] Gegeven "alle dagen van deze periode" gekozen, dan kan de dag in hetzelfde scherm niet tegelijk verzet worden, en zegt het scherm dat een andere dag enkel met "alleen deze dag" kan.
- [ ] Gegeven een gebruiker zonder planningsrecht op de klas, dan kan ze het uur van de periode niet aanpassen, ook niet rechtstreeks via de server.

## Testscenario's

1. Meld aan als leerkracht en plan een algemene fiche op elke maandag en donderdag van een periode van enkele weken, van 9:00 tot 10:00.
2. Open één maandag, zet het uur op 10:00 tot 11:00, kies "alleen deze dag" en bewaar: enkel die maandag staat verschoven.
3. Open een andere dag, zet 13:00 tot 14:00, kies "alle dagen van deze periode" en bewaar: elke maandag en donderdag van de periode staat op 13:00 tot 14:00, ook de apart verschoven maandag, en de dagteksten staan er nog.
4. Sleep een fiche-blok naar een ander uur: alleen dat blok verschuift, zonder vraag.
5. Meld aan als leerkracht van een andere klas van dezelfde jaarfase en open de fiche: de keuze is er niet.

## Buiten scope

- Een keuze na slepen of uitrekken in de agenda.
- "Enkel vanaf deze dag" of "enkel dezelfde weekdag".
- Het uur van alle periodes van dezelfde fiche samen.

## Open vragen

Geen.

## Werklog

- 2026-09-24 17:18 · Siebe · aangemaakt (status nieuw)
- 2026-09-24 17:44 · claude-fb101 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten (akkoord 'maak en bouw' 2026-09-24); gebouwd bovenop FB-100 omdat beide hetzelfde fichescherm raken
