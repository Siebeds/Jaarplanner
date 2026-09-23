---
id: TB-070
titel: Vercel agent-skills op projectniveau installeren voor Claude Code
soort: technisch
status: klaar
prioriteit: laag
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 09:15
opgepakt-door: vercel-agent-skills
branch: ticket/vercel-agent-skills
pr: 162
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar wil de skills van Vercel (vercel-labs/agent-skills) in de Claude Code-sessies op dit project kunnen
gebruiken, voor richtlijnen over React, UI en schrijven. Nu staan in `.claude/skills` alleen de eigen projectskills.

## Voorgestelde wijziging

Installeer met `npx skills add vercel-labs/agent-skills` alle 9 skills van het pakket op projectniveau voor Claude
Code. Ze komen er als kopie, niet als symlinks, want symlinks werken slecht in git op Windows. Het gaat om
vercel-composition-patterns, deploy-to-vercel, vercel-react-best-practices, vercel-react-native-skills,
vercel-react-view-transitions, vercel-cli-with-tokens, vercel-optimize, web-design-guidelines en writing-guidelines.
Alleen bestanden onder `.claude/skills/` veranderen, plus eventueel een lockbestand van de CLI. Er verandert geen
app-code.

## Acceptatiecriteria

- [x] Gegeven de branch, wanneer je `.claude/skills/` bekijkt, dan staat elk van de 9 skills er als eigen map met een `SKILL.md`.
- [x] Gegeven de installatie, wanneer je de diff bekijkt, dan verandert er niets buiten `.claude/skills/` en een lockbestand van de skills-CLI.
- [x] Gegeven de geïnstalleerde skills, wanneer je ze doorzoekt, dan bevatten ze geen geheimen of tokens.

## Buiten scope

De skills aanpassen aan dit project, en CLAUDE.md of de constitutie wijzigen. De Vercel-deployskills veranderen niets
aan de hosting: Jaarplanner blijft op Azure.

## Open vragen

Geen.

## Werklog

- 2026-09-23 09:13 · vercel-agent-skills · aangemaakt (status in-uitvoering)
- 2026-09-23 09:14 · vercel-agent-skills · in-uitvoering → klaar: 9 skills als kopie in .claude/skills geïnstalleerd plus skills-lock.json; elke map heeft een SKILL.md, diff raakt niets anders, geheimenscan leeg. Let op: deploy-to-vercel uploadt het project zonder login naar Vercel.
- 2026-09-23 09:15 · vercel-agent-skills · PR #162
