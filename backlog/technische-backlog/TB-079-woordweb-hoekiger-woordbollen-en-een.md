---
id: TB-079
titel: Woordweb: hoekiger woordbollen en een uitgeschakelde AI-knop voor het eerste woord
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-24
bijgewerkt: 2026-09-24 11:48
opgepakt-door: claude-tb-woordweb-bollen
branch: ticket/TB-woordweb-bollen
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vindt de woordbollen in het woordweb te rond (pilvormig), en mist de AI-knop "Stel woorden voor" in een
leeg woordweb: sinds FB-094 staat daar alleen de zin "Na je eerste woord kan de AI er meer voorstellen.", waardoor een
leerkracht niet ziet dat er een AI-knop komt.

## Voorgestelde wijziging

In `frontend/src/features/themas/Woordweb.tsx`:

- De woordchips, de kern met de naam van het subthema, het invoerveld en de woordchips van collega's krijgen
  `rounded-md` (6px) in plaats van `rounded-full`, in lijn met TB-078.
- Zolang het eigen woordweb geen woord bevat, staat de `AiKnop` er wel, maar uitgeschakeld (`disabled`, grijs). De zin
  `woordweb.eerstZelf` blijft eronder staan en is via `aria-describedby` aan de knop gekoppeld, zodat zichtbaar blijft
  waarom hij nog niet werkt.
- De test in `Woordweb.test.tsx` volgt: in een leeg web is de knop er en is hij uitgeschakeld.

## Acceptatiecriteria

- [x] Gegeven een woordweb met woorden, wanneer ik het bekijk, dan hebben de woordchips, de naam en het invoerveld
  licht afgeronde hoeken in plaats van pilvormige.
- [x] Gegeven een leeg eigen woordweb, wanneer ik het bekijk, dan zie ik de knop "Stel woorden voor" uitgeschakeld
  (grijs, niet klikbaar), met de zin dat de AI na het eerste woord meer kan voorstellen.
- [x] Gegeven een leeg eigen woordweb, wanneer ik een eerste woord toevoeg, dan wordt de knop actief en verdwijnt de zin.

## Buiten scope

De vorm van andere chips en knoppen in de app.

## Open vragen

Geen.

## Werklog

- 2026-09-24 11:43 · claude-tb-woordweb-bollen · aangemaakt (status in-uitvoering)
- 2026-09-24 11:48 · claude-tb-woordweb-bollen · chips, kern en invoerveld rounded-md; AiKnop disabled met aria-describedby tot het eerste woord; vitest themas+i18n 188/188, pnpm lint groen, bekeken in mockmodus op 1280 en 390px
- 2026-09-24 11:48 · claude-tb-woordweb-bollen · in-uitvoering → klaar: antagonist COMPLIANT; 2 MINOR niet opgelost: zin keert terug als alle eigen woorden weg zijn terwijl voorstellen wachten (volgt W5), en ticketnummer in codecommentaar
