---
id: TB-016
titel: Thema- en subdoelen tonen hun doeltekst en openen de doeldetail bij een klik
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 16:50
opgepakt-door: themadoel-tekst
branch: ticket/themadoel-tekst
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar, 2026-09-14, over de themapagina: "ik wil tekst bij de thema doelen, niet gewoon de nummers, dit is niet
gebruiksvriendelijk, ik wil er ook op kunnen klikken zodat ik de details kan zien." De lijst Themadoelen toont vandaag
alleen de code van het leerplandoel (bv. `6.5.GK2.3`). Een leerkracht kent die codes niet uit het hoofd en moet naar
het Doelen-register om te lezen wat er gekoppeld is. De lijst Subdoelen in elk subthema heeft precies hetzelfde
probleem: het is hetzelfde soort object op een dieper niveau (Art. IX.2), dus beide lijsten krijgen dezelfde regel.

## Voorgestelde wijziging

Alleen frontend, geen backend en geen nieuwe teksten in `nl.json`.

- Een gekoppeld doel op de themapagina (themadoel en subdoel) toont de doelsoort, de code klein erboven en de
  officiële doeltekst (maximaal twee regels). De tekst komt uit het bestaande `GET /api/leerplandoelen/{code}`, via
  `useLeerplandoel`, zodat de detail daarna meteen uit de cache komt.
- Een klik op de regel opent de bestaande `Doeldetail` in een `Blad` (zijpaneel, op een telefoon een blad van onder).
  Vanuit die detail kan de leerkracht verder naar een gerelateerd leerplandoel of naar het minimumdoel
  (`Minimumdoeldetail`), in hetzelfde paneel, zoals in het Doelen-register.
- De knop "Koppel dit doel" in `Doeldetail` wordt optioneel en staat niet in het paneel op de themapagina: daar is
  koppelen al de taak van de knop "Doel koppelen" boven de lijst.
- Ontkoppelen blijft werken zoals nu en opent de detail niet.

Code: `frontend/src/features/themas/` (`ThemadetailScherm.tsx`, `Subthemahoofdstuk.tsx`, een nieuwe regel en een
nieuw detailpaneel) en `frontend/src/features/doelen/Doeldetail.tsx`.

Waarom geen backend: de themaweergave (`SchoolcontentBeheerService`) wordt op dit moment zwaar gewijzigd op
`feature/e6-rollen-rechten` (E6-02). De doeltekst daar toevoegen zou op dezelfde plaatsen botsen. Een thema heeft
2–3 themadoelen en een handvol subdoelen per subthema, dus één verzoek per doel is aanvaardbaar.

## Acceptatiecriteria

- [x] Gegeven een thema met themadoelen, wanneer de themapagina opent, dan toont elke themadoelregel de code én de
  doeltekst van het leerplandoel.
- [x] Gegeven een subthema met subdoelen, wanneer het subthema openstaat, dan toont elke subdoelregel de code én de
  doeltekst.
- [x] Wanneer de leerkracht op een doelregel klikt, dan opent een paneel met de volledige doeldetail (tekst,
  minimumdoel, voorbeelden, toelichting, gebruikt in), zonder de knop "Koppel dit doel".
- [x] Wanneer de leerkracht op het ontkoppelknopje van een regel klikt, dan wordt het doel ontkoppeld en opent de
  detail niet.
- [x] De regel is met het toetsenbord bereikbaar en te openen, en is leesbaar op 390 px breed en op desktop
  (bekeken in een echte browser).

## Buiten scope

- De codes bij activiteiten (de rij toont ze alleen vanaf `lg`, als samenvatting naast het doelmerk): dat is een
  samenvatting van een rij, geen lijst van doelen.
- De doeltekst meesturen in de themaweergave van de backend; kan later als eigen ticket, na E6-02.

## Open vragen

Geen.

## Werklog

- 2026-09-14 16:10 · themadoel-tekst · aangemaakt (status in-uitvoering)
- 2026-09-14 16:29 · themadoel-tekst · gebouwd: themadoel- en subdoelregels tonen doelsoort, code en doeltekst, klik opent Doeldetail in een Blad; 5 nieuwe Vitest-tests, volledige suite 276/276 groen, pnpm lint groen
- 2026-09-14 16:29 · themadoel-tekst · browsercontrole (headless Chrome, wegwerpdatabank): desktop licht en donker, 390 px, Tab en Enter openen de detail, Escape sluit, geen koppelknop; op 390 px stond de status over de code, opgelost (status op de coderegel)
- 2026-09-14 16:38 · themadoel-tekst · antagonist: 6 MINOR, alle opgelost (detail wordt na elke schrijfactie opnieuw gelezen, badge Vervallen in Op.stap in de rij, commentaar rechtgezet, tests versterkt, vervolgticket TB-017 voor de backend)
- 2026-09-14 16:38 · themadoel-tekst · tweede browsercontrole: elementFromPoint geeft het ontkoppelknopje zijn eigen klik, status en lege ruimte openen de detail; focus keerde na Escape niet terug naar de regel, opgelost (Blad kreeg onCloseAutoFocus) en nagekeken: focus terug op de regel; badge zichtbaar op desktop en 390 px
- 2026-09-14 16:48 · themadoel-tekst · rechtzetting van de regel van 16:38: bevinding 2 (zwaar detailverzoek per regel) is niet opgelost maar uitgesteld naar TB-017; de kost staat nu eerlijk in de code
- 2026-09-14 16:50 · themadoel-tekst · in-uitvoering → klaar: afgewerkt: tweede antagonistronde (3 MINOR, 1 vraag) verwerkt: doelsuggesties vernieuwen de doeldetail ook, onKoppel is verplicht-maar-nullable zodat het register zijn knop niet stil kan verliezen, kost eerlijk beschreven, TB-017 zegt zijn volgorde; 284/284 Vitest, lint groen, mutatietest bewijst de nieuwe test; niet gepusht
