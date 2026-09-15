---
id: TB-030
titel: Rechtermuisklik op een blok in de agenda: bewerken of van deze dag halen
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 21:11
opgepakt-door: rechtermuismenu
branch: ticket/TB-030-agenda-rechtermuismenu
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar wil in de agenda met de rechtermuisknop op een blok klikken om het te bewerken (potlood) of te
verwijderen (prullenbak). Vandaag moet een leerkracht een blok eerst openen en in het blad de knop zoeken. Bij een
algemene fiche of een hoek haalt die knop bovendien de hele periode weg: één dag weghalen kan niet.

Keuzes van de eigenaar (2026-09-15): de prullenbak haalt **enkel deze dag** weg; hij vraagt **alleen bevestiging als
er iets verloren gaat**; het menu werkt op **activiteiten, algemene fiches en hoeken** in de week- en dagweergave, en
op **activiteiten in de maandweergave**.

## Voorgestelde wijziging

**Frontend.** Een contextmenu op elk blok van het tijdraster (`Tijdraster.tsx`: activiteit, algemene fiche, hoek) en
op de activiteitlabels van de maandweergave (`Maandrooster.tsx`), met twee regels:

- *Bewerken*, met `IcoonPotlood`: opent hetzelfde blad als een klik op het blok.
- *Van deze dag halen*, met `IcoonVuilbak`: haalt alleen dit blok weg.

Alleen voor wie de klas mag plannen (`magPlannen`); voor een lezer blijft het menu van de browser. Radix
`@radix-ui/react-context-menu` levert het menu, de toetsenbordbediening en de focus; de stijl volgt de rest van
`components/ui`.

Bevestiging alleen als er iets verloren gaat: een dagtekst van dat fichemoment, of het laatste moment van een periode
(dan verdwijnt de hele plaatsing mee). Een activiteit en een gewoon moment gaan meteen weg, zoals nu in het blad.

**Backend.** Twee nieuwe routes, met hetzelfde recht als het verplaatsen van hetzelfde moment
(`KlasplanningBewerken`):

- `DELETE /api/algemene-ficheplaatsingen/{plaatsingId}/momenten/{momentId}`, met een nieuwe
  `AlgemeneFicheplaatsing.VerwijderMoment`;
- `DELETE /api/hoekplaatsingen/{plaatsingId}/momenten/{momentId}`, op de bestaande `Hoekplaatsing.VerwijderMoment`.

Is het weggehaalde moment het laatste van de plaatsing, dan verdwijnt de plaatsing mee. De dekking telt een
ficheplaatsing zolang de rij bestaat (`EfDekkingOpslag`), dus een plaatsing zonder momenten zou een onzichtbare
periode laten meetellen. Een activiteit gebruikt de bestaande `DELETE` op de weekplanning.

## Acceptatiecriteria

- [ ] Gegeven wie de klas mag plannen, wanneer die rechtsklikt op een activiteit, algemene fiche of hoek in de week- of
  dagweergave, of op een activiteit in de maandweergave, dan opent een menu met *Bewerken* (potlood) en *Van deze dag
  halen* (prullenbak) in plaats van het menu van de browser.
- [ ] Gegeven dat menu, wanneer *Bewerken* gekozen wordt, dan opent hetzelfde blad als bij een klik op het blok.
- [ ] Gegeven een algemene fiche of hoek over meerdere dagen, wanneer *Van deze dag halen* gekozen wordt, dan verdwijnt
  alleen dat blok en blijven de andere dagen van de periode staan.
- [ ] Gegeven een fichemoment met een dagtekst, of het laatste blok van een periode, wanneer *Van deze dag halen*
  gekozen wordt, dan vraagt de app eerst bevestiging en zegt ze wat er verloren gaat; een activiteit of een gewoon
  moment gaat meteen weg.
- [ ] Gegeven het laatste moment van een ficheplaatsing, wanneer het weggehaald wordt, dan verdwijnt de plaatsing mee
  en telt de fiche via die plaatsing niet meer voor de dekking (backendtest).
- [ ] Gegeven een gebruiker die de klas alleen mag inkijken, wanneer die rechtsklikt op een blok, dan verschijnt geen
  eigen menu, en de server weigert de nieuwe routes met 403.
- [ ] Gegeven een blok met focus, wanneer de menutoets of Shift+F10 ingedrukt wordt, dan opent hetzelfde menu, te
  bedienen met de pijltjes, Enter en Escape.

## Buiten scope

De hele periode weghalen via het menu: dat blijft de knop in het blad. Lang indrukken op een aanraakscherm wordt niet
beloofd; daar blijven tikken en het blad de weg. Rechtsklikken op de thema- en subthemastroken, op de subthemabalk en
op de zijbalk.

## Open vragen

Geen.

## Werklog

- 2026-09-15 21:11 · rechtermuismenu · aangemaakt (status in-uitvoering)
