---
id: TB-076
titel: AI-voorstellen voor doelsuggesties en woordweb worden weer een platte lijst
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-24
bijgewerkt: 2026-09-24 10:51
opgepakt-door: claude-ai-voorstellen-lijst
branch: ticket/TB-ai-voorstellen-lijst
pr:
geblokkeerd:
fr: []
---

## Aanleiding

TB-045 maakte van de AI-voorstellen voor doelsuggesties (themapagina) en woordweb-woorden een kaartenstapel
(`Voorstelstapel`): één voorstel tegelijk. Na feedback van de leerkrachten wil de eigenaar (2026-09-24) weer een platte
lijst, zodat een leerkracht in één oogopslag ziet wat de AI voorstelt. Daarnaast staan de voorgestelde doelen na een
druk op de AI-knop onder de themadoelen, zodat je moet zoeken en scrollen.

## Voorgestelde wijziging

- `Voorstelstapel` in `frontend/src/components/ui/` wordt een platte lijst (`Voorstellijst`, in `frontend/src/features/themas/`): elk open voorstel is een
  rij met de vage ring, de toverstaf met "AI-voorstel", het statusmerk, de motivatie en de rustige icoonknoppen
  aanvaard en weiger, zoals ADR-0051 al voorschrijft en de subdoelplaatsing en de activiteitvoorstellen al doen. De
  voortgangsbalk, "n van m", de gestapelde randen en de sneltoetsen A en W verdwijnen.
- "Alle n aanvaarden" en "Alle n weigeren" boven de lijst blijven, met hun wachttijd en "Ongedaan maken".
- `ThemadetailScherm.tsx`: de open doelsuggesties staan boven de themadoelen, direct onder de AI-knop.
- `Woordweb.tsx` gebruikt dezelfde lijst. Teksten in `nl.json`.

## Acceptatiecriteria

- [x] Gegeven open doelsuggesties of voorgestelde woorden, wanneer ze verschijnen, dan staan ze allemaal tegelijk in één lijst, elk met motivatie, vage ring, "AI-voorstel" en een aanvaard- en weigerknop.
- [x] Gegeven een voorstel in de lijst, wanneer de gebruiker aanvaardt of weigert, dan wordt die beslissing bewaard en verdwijnt de rij.
- [x] Gegeven de themapagina, wanneer de AI doelen heeft voorgesteld, dan staan die boven de lijst met themadoelen.
- [x] Gegeven nog open voorstellen, wanneer de gebruiker "Alle n aanvaarden" of "Alle n weigeren" kiest, dan blijft "Ongedaan maken" werken zoals vandaag.
- [x] Gegeven een scherm van 390 px breed, dan past de lijst zonder horizontaal te scrollen.

## Buiten scope

De andere AI-voorstellen (subdoelplaatsing, activiteitvoorstellen, doelvoorstellen, weekvoorstel): die zijn al een
platte lijst. Geen backendwijziging.

## Open vragen

Geen.

## Werklog

- 2026-09-24 10:42 · claude-ai-voorstellen-lijst · aangemaakt (status in-uitvoering)
- 2026-09-24 10:49 · claude-ai-voorstellen-lijst · Voorstellijst vervangt Voorstelstapel voor doelsuggesties en woordweb; doelsuggesties boven de themadoelen; Vitest (1388) en lint groen, browserpas 1440 en 390 met ingespoten doelsuggesties
- 2026-09-24 10:50 · claude-ai-voorstellen-lijst · Antagonist: COMPLIANT. MINOR opgelost: plaats van Voorstellijst in de tekst rechtgezet, donkere modus nagekeken in de browser
- 2026-09-24 10:51 · claude-ai-voorstellen-lijst · in-uitvoering → klaar: Klaar: doelsuggesties en woordwebvoorstellen als platte lijst (ADR-0051), doelsuggesties boven de themadoelen; criteria afgevinkt op Voorstellijst.test.tsx, ThemadetailScherm.test.tsx en browserpas (1440, 390, donker); Vitest en lint groen
