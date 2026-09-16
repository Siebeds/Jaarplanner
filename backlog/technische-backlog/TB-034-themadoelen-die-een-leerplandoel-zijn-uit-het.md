---
id: TB-034
titel: Themadoelen die een leerplandoel zijn uit het gegevensmodel halen
soort: technisch
status: nieuw
prioriteit: laag
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 15:31
opgepakt-door:
branch: main
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Sinds FB-043 is een themadoel een minimumdoel (`ThemaMinimumdoel`, ADR-0046). De oude themadoelen die een
leerplandoel zijn (`Themadoel` met een `DoelKoppeling`, tabel `themadoelen`) zijn uit de data verwijderd, maar het
gegevensmodel bleef op vraag van de eigenaar staan: de Excel-import schrijft ze nog, en de dekking (laag 1 van
`EfDekkingOpslag`), de jaarplanprompt en het doelenoverzicht per leeftijd lezen ze nog.

## Voorgestelde wijziging

- `Themadoel`, `Thema.Themadoelen`, `Thema.VoegThemadoelToe`, `Thema.MaxThemadoelen`, de tabel `themadoelen` en de route
  `DELETE /api/themas/{id}/themadoelen/{themadoelId}` verwijderen, met een migratie.
- De lezers aanpassen: de dekking (`EfDekkingOpslag`, laag 1), `JaarplanGeneratiePromptBuilder`, `MatchingPromptBuilder`,
  `ThemaOpbouwPromptBuilder`, `ThemaDoelenoverzichtQuery`, `Koppelingzichtbaarheid`, `LeerplandoelWeergaven`, de
  Op.stap-import (koppelingaantallen), de schoolcontentimport en de frontend (`themadoelen` in `ThemaWeergave`,
  `bestemmingen.ts`).
- Art. IX.2 (`DoelKoppeling`) en ADR-0046 bijwerken.

## Acceptatiecriteria

- [ ] Gegeven de code, dan bestaat er geen `Themadoel`-entiteit en geen tabel `themadoelen` meer, en de migratie
  draait op een database met en zonder rijen.
- [ ] Gegeven de dekking, de AI-vragen en het doelenoverzicht per leeftijd, dan lezen ze geen leerplandoel-themadoelen
  meer en blijven hun tests groen.
- [ ] Gegeven de backend- en frontendtests, `dotnet format` en `pnpm lint`, dan zijn ze groen.

## Buiten scope

- Hoe minimumdoelen meetellen voor de dekking: FB-045.

## Open vragen

- Pas bouwen **nadat FB-052 beslist en gebouwd is**: zolang de import leerplandoelen als themadoel inleest, heeft die
  een plek nodig. Beslist de eigenaar dat de import ze weigert of omzet, dan kan dit ticket volgen.

## Werklog

- 2026-09-16 15:31 · claude-fb043 · aangemaakt (status nieuw)
