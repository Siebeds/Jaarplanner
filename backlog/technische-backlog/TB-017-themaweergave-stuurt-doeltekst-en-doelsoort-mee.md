---
id: TB-017
titel: Themaweergave stuurt doeltekst en doelsoort mee voor thema- en subdoelen
soort: technisch
status: in-uitvoering
prioriteit: laag
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-24 12:58
opgepakt-door: tb017-sessie
branch: ticket/TB-017-themaweergave-doeltekst
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Sinds TB-016 toont de themapagina bij elk themadoel en subdoel de doeltekst. Die tekst komt nu per regel uit
`GET /api/leerplandoelen/{code}`, het zware detailendpoint: per code draait de server de detailquery, vijf queries
voor "Gebruikt in" en een query voor de gerelateerde doelen, terwijl de regel alleen `tekst` en `doelsoort` nodig
heeft. Omdat elk subthemahoofdstuk standaard openstaat en er per thema tot negen leeftijden zijn, kan dat bij het
laden van één themapagina tientallen verzoeken worden, en na elke koppeling of ontkoppeling worden ze opnieuw
gelezen (TB-016 maakt de detail na elke schrijfactie ongeldig). De antagonist wees dit aan bij de audit van TB-016.

In TB-016 is dit bewust niet in de backend opgelost: `SchoolcontentBeheerService.cs` en `SchoolcontentBeheerDtos.cs`
werden toen zwaar gewijzigd op de E6-02-branches (`feature/e6-rollen-rechten`), en een wijziging daar zou op
dezelfde plaatsen botsen.

## Voorgestelde wijziging

- De themaweergave (`ThemaWeergave` → `ThemadoelWeergave` en `SubdoelWeergave`) krijgt per koppeling de `tekst`,
  de `doelsoort` en `nietMeerInOpstap` van het leerplandoel mee, zoals de doelsuggesties die al meekrijgen.
  Eén extra query per themaverzoek (codes → tekst) in `SchoolcontentBeheerService`, niet per koppeling.
- `Gekoppelddoel` in `frontend/src/features/themas/` leest die velden uit de koppeling en haalt de detail pas op
  wanneer de leerkracht op de regel klikt.
- De tests van TB-016 (`Gekoppelddoel.test.tsx`) blijven gelden; de fetch-stub levert de velden dan in de thema.

**Volgorde:** pas bouwen wanneer E6-02 op `main` staat. Daarvoor botst de wijziging met
`feature/e6-rollen-rechten` in `SchoolcontentBeheerService.cs` en `SchoolcontentBeheerDtos.cs`. Dat is een
volgorde, geen open beslissing; of het ticket tot dan geblokkeerd moet staan, beslist de eigenaar.

## Acceptatiecriteria

- [ ] Gegeven een thema met themadoelen en subdoelen, wanneer de themapagina opent, dan doet de frontend geen
  verzoek naar `/api/leerplandoelen/{code}` tot de leerkracht op een regel klikt.
- [ ] Gegeven een thema, wanneer de themaweergave wordt opgevraagd, dan bevat elke thema- en subdoelkoppeling de
  tekst, de doelsoort en of het doel uit Op.stap verdwenen is (integratietest tegen PostgreSQL).
- [ ] De themapagina toont na de wijziging dezelfde regels als na TB-016 (browsercontrole op desktop en 390 px).

## Buiten scope

- De doelcodes bij activiteiten.
- Het detailendpoint zelf lichter maken.

## Open vragen

Geen.

## Werklog

- 2026-09-14 16:31 · themadoel-tekst · aangemaakt (status nieuw)
- 2026-09-15 15:07 · themapagina · FB-011 (2026-09-15) laat elk subthemahoofdstuk standaard dicht staan: de detailverzoeken per subdoel vallen nu pas bij het openklappen, niet meer bij het laden van de pagina; meet tegen dat gedrag
- 2026-09-15 15:27 · themapagina · FB-010 (2026-09-15) toont bij een open subthema ook de groep 'Andere doelen in de activiteiten': dat zijn activiteitscodes die via Gekoppelddoel hun detail ophalen, dus AC1 kan pas gehaald worden als de scope ook die rijen omvat (nu staan 'de doelcodes bij activiteiten' onder Buiten scope)
- 2026-09-24 12:58 · tb017-sessie · nieuw → in-uitvoering: opgepakt: sessie kreeg de opdracht TB-017 uit te voeren; E6-02 staat op main
