---
id: FB-039
titel: De rij met thema en subthema boven de agenda verdwijnt
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-16 14:48
opgepakt-door: claude-fb-039
branch: ticket/FB-039-stroken-toegankelijk
pr:
geblokkeerd:
fr: [FR-6.1]
---

## Aanleiding

Na FB-038 staat boven de agenda nog een rij met het thema en de lopende subthema's als links (de "subthemabalk"). De
eigenaar zag ze op 2026-09-15 en zei: *"ik zie nog altijd dit staan? ik wou dit weg"*.

Die rij bleef in FB-038 bewust staan: ze is de weg van het toetsenbord naar de themapagina, en de toegankelijke
vervanger van de klikbare stroken in de dagkoppen (FB-037, ADR-0042 beslissing 3). Die stroken zijn 16 px hoog en niet
met Tab bereikbaar; ze voldoen aan WCAG 2.2 AA alleen omdat de rij hetzelfde doet met een groot genoeg doel.

**Beslissingen van de eigenaar, 2026-09-15:**

- de rij verdwijnt helemaal, boven de week, de dag en de maand;
- de thema- en subthemastroken in de dagkoppen blijven klikbaar, zonder de rij als vervanger;
- dit is een nieuw ticket; FB-038 blijft zoals het gebouwd is.

**Beslissing van de eigenaar, 2026-09-16:** geen uitzondering op WCAG 2.2 AA in de grondwet. De stroken worden zelf
toegankelijk: groot genoeg om aan te tikken en bereikbaar met het toetsenbord (zie Open vragen).

**Stand op 2026-09-16:** de rij is al weg op main (PR #105, commit `2845b63`). Wat overblijft, zijn toegankelijke
stroken en een ADR die ADR-0042 beslissing 3 vervangt.

## Gewenst gedrag

- Boven de agenda staat geen rij met thema's en subthema's meer, in de week-, dag- en maandweergave, ook niet op een
  telefoon.
- De thema- en subthemastroken in de dagkoppen werken zoals nu: een klik opent de themapagina, een subthema met zijn
  hoofdstuk open.
- Elke strook heeft een aanraakdoel van minstens 24 px hoog (WCAG 2.2 SC 2.5.8).
- Elke strook is met de Tab-toets bereikbaar, toont een zichtbare focus en opent met Enter dezelfde pagina als een
  klik (SC 2.1.1 en 2.4.7). Een schermlezer leest welk thema of subthema ze opent.
- Verder verandert er niets aan de agenda.

## Acceptatiecriteria

- [x] Gegeven de week-, dag- of maandweergave met een lopend thema en subthema, dan staat er boven de agenda geen rij
  met het thema en het subthema.
- [x] Gegeven een themastrook of subthemastrook in een dagkop, wanneer de leerkracht erop klikt, dan opent de
  themapagina zoals voorheen (FB-037).
- [x] Gegeven een strook in de week-, dag- of maandweergave, dan is haar aanraakdoel minstens 24 px hoog, ook op ~390px.
- [x] Gegeven de agenda, wanneer de leerkracht met Tab door de dagkoppen gaat, dan krijgt elke strook een zichtbare
  focus, en Enter opent dezelfde pagina als een klik.
- [x] Nagekeken in een echte browser op desktop en op ~390px, ook met het toetsenbord.

## Testscenario's

1. Open de agenda in een week waarin een thema en een subthema lopen. Boven het tijdraster staat geen rij met het
   thema en het subthema meer.
2. Klik op de subthemastrook in de dagkop van maandag. De themapagina opent met dat subthema open.
3. Ga terug en schakel naar de maand en naar de dag. Ook daar staat de rij niet meer.
4. Ga terug naar de week en druk op Tab tot een strook de focus heeft. Ze is duidelijk omrand; Enter opent de
   themapagina.
5. Herhaal stap 1, 3 en 4 op ~390px, en tik daar een strook aan.

## Buiten scope

- Het zijpaneel Hoekenfiches (FB-038).

## Open vragen

- **Beantwoord door de eigenaar, 2026-09-16:** geen uitzondering in Art. VIII. De stroken worden minstens 24 px hoog en
  met Tab bereikbaar; de bouwer legt dat vast in een ADR die ADR-0042 beslissing 3 vervangt. De oorspronkelijke vraag:
- ~~**Grondwet (blokkeert de bouw).**~~ Art. VIII legt "UI/UX target: WCAG 2.2 AA" vast, uitgewerkt in ADR-0017. Zonder de
  rij voldoen de klikbare stroken daar niet meer aan: ze zijn kleiner dan 24 px en liggen te dicht op elkaar (SC 2.5.8),
  en ze zijn niet met het toetsenbord bedienbaar (SC 2.1.1). Een ticket gaat niet boven de grondwet. Vóór de bouw
  beslist de eigenaar, via Art. XI (een eigen commit met een regel in `docs/constitutie-log.md`), over een uitzondering
  in Art. VIII voor de stroken van de agenda, of kiest hij een oplossing die wel voldoet (bijvoorbeeld stroken van 24 px
  die met Tab bereikbaar zijn). Bij de bouw volgt een ADR die ADR-0042 beslissing 3 vervangt.

## Werklog

- 2026-09-15 22:20 · wensen-hoeken · aangemaakt (status nieuw)
- 2026-09-15 22:51 · claude-fb039 · PR #105
- 2026-09-16 14:27 · eigenaar · nieuw → klaar-voor-bouw: open vragen beantwoord door de eigenaar; klaar voor bouw
- 2026-09-16 14:28 · claude-fb-039 · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-16 14:36 · claude-fb-039 · stroken gebouwd: doel van 24 px, de strook met de naam is een tabstop; ADR-0045 vervangt ADR-0042 beslissing 3; vitest 973/973 en lint groen
- 2026-09-16 14:38 · claude-fb-039 · antagonist: COMPLIANT, de stroken voldoen samen met main aan WCAG 2.2 AA; vier MINOR (o.a. test gesloten maandag, ADR-zin)
- 2026-09-16 14:48 · claude-fb-039 · browsercheck FAIL (MAJOR): in de maand verbergen de 24px-stroken de activiteiten in de cel; wordt hersteld
