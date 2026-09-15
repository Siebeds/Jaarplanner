---
id: FB-039
titel: De rij met thema en subthema boven de agenda verdwijnt
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 22:20
opgepakt-door:
branch:
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
- de thema- en subthemastroken in de dagkoppen blijven klikbaar zoals nu, zonder vervanger; wie met het toetsenbord
  werkt, bereikt een themapagina via het menu Thema's. De eigenaar koos dit met de wetenschap dat het afwijkt van
  WCAG 2.2 AA (zie Open vragen);
- dit is een nieuw ticket; FB-038 blijft zoals het gebouwd is.

## Gewenst gedrag

- Boven de agenda staat geen rij met thema's en subthema's meer, in de week-, dag- en maandweergave, ook niet op een
  telefoon.
- De thema- en subthemastroken in de dagkoppen werken zoals nu: een klik opent de themapagina, een subthema met zijn
  hoofdstuk open.
- Verder verandert er niets aan de agenda.

## Acceptatiecriteria

- [ ] Gegeven de week-, dag- of maandweergave met een lopend thema en subthema, dan staat er boven de agenda geen rij
  met het thema en het subthema.
- [ ] Gegeven een themastrook of subthemastrook in een dagkop, wanneer de leerkracht erop klikt, dan opent de
  themapagina zoals voorheen (FB-037).
- [ ] Nagekeken in een echte browser op desktop en op ~390px.

## Testscenario's

1. Open de agenda in een week waarin een thema en een subthema lopen. Boven het tijdraster staat geen rij met het
   thema en het subthema meer.
2. Klik op de subthemastrook in de dagkop van maandag. De themapagina opent met dat subthema open.
3. Ga terug en schakel naar de maand en naar de dag. Ook daar staat de rij niet meer.
4. Herhaal stap 1 en 3 op ~390px.

## Buiten scope

- De stroken groter maken of met Tab bereikbaar maken: de eigenaar koos om ze te laten zoals ze zijn.
- Het zijpaneel Hoekenfiches (FB-038).

## Open vragen

- **Grondwet (blokkeert de bouw).** Art. VIII legt "UI/UX target: WCAG 2.2 AA" vast, uitgewerkt in ADR-0017. Zonder de
  rij voldoen de klikbare stroken daar niet meer aan: ze zijn kleiner dan 24 px en liggen te dicht op elkaar (SC 2.5.8),
  en ze zijn niet met het toetsenbord bedienbaar (SC 2.1.1). Een ticket gaat niet boven de grondwet. Vóór de bouw
  beslist de eigenaar, via Art. XI (een eigen commit met een regel in `docs/constitutie-log.md`), over een uitzondering
  in Art. VIII voor de stroken van de agenda, of kiest hij een oplossing die wel voldoet (bijvoorbeeld stroken van 24 px
  die met Tab bereikbaar zijn). Bij de bouw volgt een ADR die ADR-0042 beslissing 3 vervangt.

## Werklog

- 2026-09-15 22:20 · wensen-hoeken · aangemaakt (status nieuw)
