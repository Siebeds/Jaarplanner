---
id: FB-087
titel: Subthema inplannen staat in de themastrook van de agenda, bij het thema zelf
soort: functioneel
status: klaar-voor-bouw
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 10:29
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-6.3]
---

## Aanleiding

In de agenda staat rechtsboven een groene knop "Subthema inplannen". De eigenaar vindt hem lelijk en in de weg:

- Hij is het enige vol ingekleurde vlak van het scherm en trekt meer aandacht dan de agenda zelf, terwijl je hem hooguit
  één keer per subthema gebruikt.
- Hij staat in de rij van de weergaveknoppen (Maand, Week, Werkweek, Dag, Jaarplan), waar hij niet bij hoort, en lijnt
  niet uit met wat ernaast staat. Op een smaller scherm valt hij los op een eigen regel.
- Hij verschijnt en verdwijnt naargelang de getoonde dag in een thema valt, zodat de kop van het scherm verspringt
  wanneer je door de weken bladert.
- Hij plant een subthema binnen het thema dat op dat moment loopt, maar dat thema staat niet bij de knop: het staat in
  de grijze themastrook boven de dagen.
- Rechtsboven komt later Chuck in zijn mandje (FB-071).

## Gewenst gedrag

De knop "Subthema inplannen" verdwijnt uit de kop van de agenda. In de plaats daarvan staat in de themastrook boven de
dagen, naast de naam van het thema, een klein en rustig knopje "+ Subthema". Wie het zoekt, vindt het snel, maar het
trekt de aandacht niet naar zich: geen volle accentkleur, dezelfde hoogte en stijl als de andere kleine knoppen in de
agenda.

Klik je erop, dan opent de subthemaplanner zoals vandaag, voor het thema van die strook. Er verandert niets aan wat de
planner doet.

Het knopje staat er alleen voor wie de planning van de klas mag wijzigen. Wie de klas alleen mag inkijken, ziet de
themastrook zoals vandaag, zonder knopje. Waar geen thema loopt, is er geen strook en dus ook geen knopje, en de kop van
het scherm blijft op zijn plaats staan.

Het knopje staat alleen op dagen waar nog geen subthema loopt. Loopt er op een dag al een subthema, dan toont de
themastrook van die dag geen knopje. Een thema kan meerdere subthema's na elkaar hebben: zolang er binnen het thema nog
dagen zonder subthema zijn, staat het knopje daar en kan je er nog een inplannen.

Op telefoonbreedte blijft het knopje bereikbaar, desnoods alleen als plusteken met een voorleesbare naam.

## Acceptatiecriteria

- [x] Gegeven een leerkracht die de planning van de klas mag wijzigen, wanneer ze de agenda opent in een week met een
      thema, dan staat er geen knop "Subthema inplannen" meer in de kop, en staat er in de themastrook naast de naam
      van het thema een knopje "+ Subthema".
- [x] Gegeven dat knopje, wanneer de leerkracht erop klikt, dan opent de subthemaplanner voor het thema van die strook,
      en plant hij zoals vandaag.
- [x] Gegeven de agenda, wanneer de leerkracht van een week met thema naar een week zonder thema bladert, dan blijven
      de weergaveknoppen, de datum, de pijlen en "Vandaag" op dezelfde plaats staan.
- [x] Gegeven een gebruiker die de klas alleen mag inkijken, wanneer ze de agenda opent, dan toont de themastrook geen
      knopje "+ Subthema".
- [x] Gegeven het knopje, dan draagt het geen volle accentkleur, is het met het toetsenbord te bereiken en heeft het
      een zichtbare focusrand en een voorleesbare naam.
- [x] Gegeven een scherm van ongeveer 390 pixels breed, wanneer de leerkracht de agenda in een themaweek opent, dan is
      het knopje zichtbaar en bruikbaar, en blijft de naam van het thema leesbaar.
- [ ] Gegeven een thema waarin op sommige dagen al een subthema loopt, wanneer de leerkracht de agenda opent, dan toont
      de themastrook op de dagen met een subthema geen knopje "+ Subthema", en op de dagen van dat thema zonder
      subthema wel.

## Testscenario's

1. Meld je aan als leerkracht met planningsrecht op een klas. Open de agenda in Werkweek, in een week met een thema.
   Rechtsboven staat geen groene knop meer. In de grijze themastrook boven de dagen staat de naam van het thema met
   daarnaast een knopje "+ Subthema".
2. Klik op "+ Subthema". De subthemaplanner opent. Plan een subthema in: de activiteiten verschijnen op de agenda zoals
   vroeger.
3. Blader met de pijlen naar een vakantieweek of een week zonder thema. Er is geen themastrook en geen knopje, en niets
   in de kop verschuift.
4. Doe hetzelfde in de weergaven Week en Dag. Het knopje staat telkens in de themastrook.
5. Meld je aan als een gebruiker die de klas alleen mag inkijken. De themastrook toont geen knopje.
6. Druk op Tab tot het knopje de focus krijgt. Je ziet een focusrand, en Enter opent de planner.
7. Maak het venster ongeveer 390 pixels breed. Het knopje is nog zichtbaar en werkt, en de naam van het thema blijft
   leesbaar.
8. Open een themaweek waarin al een subthema loopt. Op de dagen met dat subthema staat geen "+ Subthema" in de
   themastrook. Blader naar een week van hetzelfde thema zonder subthema: daar staat het knopje wel.

## Buiten scope

- Wat de subthemaplanner zelf doet en toont.
- De maandweergave, als die geen themastrook per dag toont: daar hoeft geen knopje bij te komen.
- De andere knoppen in de kop van de agenda.
- Chuck en zijn mandje (FB-071).

## Open vragen

Geen.

## Werklog

- 2026-09-23 00:47 · Siebeds · aangemaakt (status nieuw)
- 2026-09-23 09:05 · claude-fb087 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-23 09:19 · claude-fb087 · Knop verhuisd naar de themastrook (week, werkweek, dag en maand); lint en 1313 frontendtests groen; browserpas op 1440 en 390 px, contrast 10,8:1 licht en 7,7:1 donker.
- 2026-09-23 09:20 · claude-fb087 · Criteria afgevinkt: 1-4 met Vitest (Themastroken- en Agendascherm-tests) en browserpas, 5-6 met browserpas (focusrand, contrast, 390 px).
- 2026-09-23 09:21 · claude-fb087 · Antagonist: COMPLIANT, geen CRITICAL of MAJOR. MINOR opgelost: commentaar bij onMouseDown. MINOR open: mislukt het laden van de themaperiode, dan blijft de planner laden in plaats van een fout te tonen; maandweergave heeft op telefoonbreedte geen themastrook en dus geen knop (buiten scope); plannerPlaatsingId wordt niet gewist, zonder gevolg.
- 2026-09-23 09:21 · claude-fb087 · in-uitvoering → te-testen: Knop Subthema inplannen staat in de themastrook (week, werkweek, dag, maand), niet meer in de kop; lint en 1313 tests groen, browserpas 1440/390 px, antagonist COMPLIANT.
- 2026-09-23 09:21 · claude-fb087 · PR #163
- 2026-09-23 10:29 · eigenaar · te-testen → klaar-voor-bouw: Bevinding van de eigenaar: in de themastrook, verwacht het knopje + Subthema alleen op dagen zonder subthema, gezien ook op dagen waar al een subthema loopt
