---
id: TB-076
titel: AI-voorstellen voor doelsuggesties en woordweb worden weer een platte lijst
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-24
bijgewerkt: 2026-09-24 10:42
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

- `Voorstelstapel` in `frontend/src/components/ui/` wordt een platte lijst (`Voorstellijst`): elk open voorstel is een
  rij met de vage ring, de toverstaf met "AI-voorstel", het statusmerk, de motivatie en de rustige icoonknoppen
  aanvaard en weiger, zoals ADR-0051 al voorschrijft en de subdoelplaatsing en de activiteitvoorstellen al doen. De
  voortgangsbalk, "n van m", de gestapelde randen en de sneltoetsen A en W verdwijnen.
- "Alle n aanvaarden" en "Alle n weigeren" boven de lijst blijven, met hun wachttijd en "Ongedaan maken".
- `ThemadetailScherm.tsx`: de open doelsuggesties staan boven de themadoelen, direct onder de AI-knop.
- `Woordweb.tsx` gebruikt dezelfde lijst. Teksten in `nl.json`.

## Acceptatiecriteria

- [ ] Gegeven open doelsuggesties of voorgestelde woorden, wanneer ze verschijnen, dan staan ze allemaal tegelijk in één lijst, elk met motivatie, vage ring, "AI-voorstel" en een aanvaard- en weigerknop.
- [ ] Gegeven een voorstel in de lijst, wanneer de gebruiker aanvaardt of weigert, dan wordt die beslissing bewaard en verdwijnt de rij.
- [ ] Gegeven de themapagina, wanneer de AI doelen heeft voorgesteld, dan staan die boven de lijst met themadoelen.
- [ ] Gegeven nog open voorstellen, wanneer de gebruiker "Alle n aanvaarden" of "Alle n weigeren" kiest, dan blijft "Ongedaan maken" werken zoals vandaag.
- [ ] Gegeven een scherm van 390 px breed, dan past de lijst zonder horizontaal te scrollen.

## Buiten scope

De andere AI-voorstellen (subdoelplaatsing, activiteitvoorstellen, doelvoorstellen, weekvoorstel): die zijn al een
platte lijst. Geen backendwijziging.

## Open vragen

Geen.

## Werklog

- 2026-09-24 10:42 · claude-ai-voorstellen-lijst · aangemaakt (status in-uitvoering)
