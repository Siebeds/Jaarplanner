---
id: FB-090
titel: Thema en subthema lopen in de week als één doorlopende balk
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 11:32
opgepakt-door: claude-fb090
branch: ticket/FB-090-doorlopende-themabalk
pr: 170
geblokkeerd:
fr: []
---

## Aanleiding

In de week- en werkweekweergave staat het thema bovenaan elke dag als een eigen grijs balkje, en het subthema
eronder ook. Alleen de eerste dag draagt de naam; de andere dagen tonen lege grijze balken in twee tinten. De
eigenaar bekeek dat op 2026-09-23: de lege balken lezen als laadblokken ("hier komt nog iets"), en een thema dat de
hele week loopt, ziet eruit als vijf losse stukjes.

Een subthema dat van de vorige week doorloopt, begint met "…" ("… Het weer in de herfst"). Dat leest als een
afgekapte tekst in plaats van "loopt door".

Het grijs zelf blijft: een thema krijgt bewust geen kleur, omdat de kleuren al vergeven zijn (Art. XII, en de uitleg
in `features/plan/Themastroken.tsx`). Het probleem is de onderbreking.

## Gewenst gedrag

- Een thema dat over meerdere dagen van de getoonde week loopt, staat als **één doorlopende balk** over die dagen,
  zonder onderbreking tussen de kolommen, met de naam en het icoon één keer, links.
- Hetzelfde voor een subthema, in de rij eronder.
- Waar een thema of subthema binnen de week eindigt of begint, eindigt of begint de balk ook daar, zodat je ziet
  waar het ene ophoudt en het volgende start.
- Een balk die van de vorige week doorloopt of in de volgende week verder gaat, toont dat met een klein pijltje aan
  die kant, niet met "…".
- De balk blijft een link naar de themapagina, en de knop om een subthema in te plannen (FB-087) blijft in de
  themabalk staan.
- In de dagweergave en in de maandweergave verandert niets.

## Acceptatiecriteria

- [x] Gegeven een week waarin één thema van maandag tot vrijdag loopt, wanneer de leerkracht de werkweek opent, dan
      ziet ze één grijze balk over de vijf dagen met de naam één keer, en geen lege balkjes.
- [x] Gegeven een week waarin een thema op woensdag eindigt en een ander op donderdag begint, wanneer de week opent,
      dan staan er twee balken met elk hun naam, en zie je duidelijk waar de ene stopt.
- [x] Gegeven een subthema dat vorige week begon, wanneer de week opent, dan begint zijn balk met een pijltje naar
      links en niet met "…".
- [x] Gegeven een gebruiker die de klas mag plannen, wanneer ze naar de themabalk kijkt, dan staat de knop om een
      subthema in te plannen er nog, en werkt hij zoals voordien.
- [x] Gegeven het toetsenbord, wanneer de gebruiker door de themabalken tabt, dan is er één tabstop per thema per
      rij, die de naam van het thema voorleest.
- [x] Gegeven een telefoon van ~390px, wanneer de week opent, dan blijft de naam leesbaar of wordt ze netjes
      ingekort, zonder dat de balk buiten de kolommen steekt.

## Testscenario's

1. Open de agenda in werkweekweergave op een week midden in een thema. Bovenaan loopt één grijze balk over de vijf
   dagen met de naam van het thema. Eronder één balk voor het subthema.
2. Ga naar een week waarin een thema eindigt en het volgende begint. Je ziet twee balken met elk hun naam.
3. Ga naar een week waarin het subthema vorige week begon. De balk begint met een pijltje, niet met "…".
4. Klik op de themabalk: de themapagina opent. Klik op "+ Subthema": de subthemaplanner opent zoals voordien.
5. Tab door de balken: elk thema is één stop.
6. Bekijk dezelfde week op een telefoon.

## Buiten scope

Een kleur voor het thema, de maandweergave en de dagweergave.

## Open vragen

Geen.

## Werklog

- 2026-09-23 10:59 · claude-vercelanalyse · aangemaakt (status nieuw)
- 2026-09-23 11:17 · claude-fb090 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-23 11:27 · claude-fb090 · doorlopende balken gebouwd in de weekkop (dag- en maandweergave ongewijzigd), tests en lint groen; browsercheck volgt
- 2026-09-23 11:31 · claude-fb090 · antagonist COMPLIANT; MINOR commentaar opgelost; criteria afgevinkt op Vitest (1-5) en browsercheck mock 1440/390px licht+donker (1,2,3,6); knop '+ Subthema' alleen in Vitest gezien, mockdata heeft geen dag zonder subthema
- 2026-09-23 11:31 · claude-fb090 · in-uitvoering → te-testen: doorlopende thema- en subthemabalk in week en werkweek; lint en 1340 tests groen
- 2026-09-23 11:32 · claude-fb090 · PR #170
