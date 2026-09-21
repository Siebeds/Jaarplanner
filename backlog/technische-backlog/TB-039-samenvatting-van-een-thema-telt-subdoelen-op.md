---
id: TB-039
titel: Samenvatting van een thema telt subdoelen op dezelfde manier als 'Doelen per leeftijd'
soort: technisch
status: in-uitvoering
prioriteit: laag
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-21 22:04
opgepakt-door: claude-tb-039
branch: ticket/TB-039-samenvatting-koppelingen
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Bij de browsercontrole van FB-044 (2026-09-16) toonde de samenvatting bovenaan een thema "7 op subthema's", terwijl
"Doelen per leeftijd" op dezelfde pagina "6 leerplandoelen" telde. Twee getallen voor hetzelfde lijken op een fout.

**Sinds TB-048 (klaar, PR 140) klopt die vergelijking niet meer.** "Doelen per leeftijd" toont nu de leerplandoelen
van de gekozen minimumdoelen van het thema, gekoppeld of niet. Dat blok en de samenvatting meten met opzet iets
anders, en ze gelijk maken zou fout zijn. De titel van dit ticket dekt de lading dus niet meer.

Wat wel overblijft: de samenvatting telt koppelingen, terwijl het label "Doelen" aan doelen doet denken. Neem een
thema met twee subthema's voor K2, "Winterkleren" met de subdoelen P1 en P2 en "Sneeuw en ijs" met P2 en P3. Dat zijn
vier subdoelen, maar drie verschillende leerplandoelen. De samenvatting zegt "4 op subthema's"; wie de twee subthema's
openklapt, telt er drie. Niets verbiedt dat dubbele: `SubdoelConfiguration` legt geen unieke index op een leerplandoel
binnen een thema.

## Voorgestelde wijziging

De eigenaar koos op 2026-09-21 voor de tekstoplossing: de telling blijft koppelingen tellen, en de tekst zegt dat ook.

`themabalans.subdoelen` telt bewust rijen. De doc-comment van `themabalans.ts` beschrijft `totaal` als wat een delete
van het thema meeneemt, en `ThemadetailScherm.tsx` gebruikt dat getal in de verwijderbevestiging. Distinct tellen zou
die tweede betekenis stukmaken. Dus:

- `thema.doelenOpSubthemas` in `frontend/src/i18n/nl.json` wordt een tekst die "koppeling" benoemt in plaats van
  alleen de plaats. De twee buren (`doelenOpThema`, `doelenOpActiviteiten`) blijven er leesbaar naast staan.
- Een korte toelichting bij `themabalans.subdoelen` legt vast dat dit koppelingen zijn, en waarom.

## Acceptatiecriteria

- [ ] Gegeven een thema waarin een leerplandoel onder twee subthema's hangt, dan benoemt de samenvatting dat ze
  koppelingen telt, zodat het verschil met de opengeklapte subthema's verklaard is.
- [ ] De getallen zelf veranderen niet: geen enkel thema toont een ander cijfer dan vandaag.
- [ ] Een frontendtest dekt het geval met een dubbele koppeling.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

## Buiten scope

De dekking (FB-045). De telling van "Doelen per leeftijd", die TB-048 heeft vastgelegd. De titel van dit ticket in de
frontmatter: die wijzigt alleen de eigenaar, want de CLI kent geen hernoeming.

## Open vragen

Geen. De eigenaar besliste op 2026-09-21 voor de tekstoplossing.

## Werklog

- 2026-09-16 15:58 · claude-fb-reeks · aangemaakt (status nieuw)
- 2026-09-21 22:04 · claude-tb-039 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten, en koos de tekstoplossing
