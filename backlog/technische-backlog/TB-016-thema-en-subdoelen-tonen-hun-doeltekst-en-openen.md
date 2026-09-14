---
id: TB-016
titel: Thema- en subdoelen tonen hun doeltekst en openen de doeldetail bij een klik
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 16:10
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

- [ ] Gegeven een thema met themadoelen, wanneer de themapagina opent, dan toont elke themadoelregel de code én de
  doeltekst van het leerplandoel.
- [ ] Gegeven een subthema met subdoelen, wanneer het subthema openstaat, dan toont elke subdoelregel de code én de
  doeltekst.
- [ ] Wanneer de leerkracht op een doelregel klikt, dan opent een paneel met de volledige doeldetail (tekst,
  minimumdoel, voorbeelden, toelichting, gebruikt in), zonder de knop "Koppel dit doel".
- [ ] Wanneer de leerkracht op het ontkoppelknopje van een regel klikt, dan wordt het doel ontkoppeld en opent de
  detail niet.
- [ ] De regel is met het toetsenbord bereikbaar en te openen, en is leesbaar op 390 px breed en op desktop
  (bekeken in een echte browser).

## Buiten scope

- De codes bij activiteiten (de rij toont ze alleen vanaf `lg`, als samenvatting naast het doelmerk): dat is een
  samenvatting van een rij, geen lijst van doelen.
- De doeltekst meesturen in de themaweergave van de backend; kan later als eigen ticket, na E6-02.

## Open vragen

Geen.

## Werklog

- 2026-09-14 16:10 · themadoel-tekst · aangemaakt (status in-uitvoering)
