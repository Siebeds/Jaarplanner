---
id: TB-075
titel: Eén Inklapper-component en kleine opruiming van component-API's
soort: technisch
status: in-uitvoering
prioriteit: laag
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-24 14:06
opgepakt-door: claude-tb075
branch: ticket/TB-075-inklapper
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Een toetsing tegen de Vercel-compositiepatronen vond herhaalde en onhandige component-API's:

- **Uitklappen staat tien keer apart uitgeschreven**, telkens met een eigen knop met `aria-expanded`, een draaiende
  `IcoonChevron`, een `open`-state en een voorwaardelijke inhoud. Dat gebeurt onder meer in
  `dekking/DekkingScherm.tsx`, `koppelen/Themarij.tsx` (twee keer), `doelen/Doelenboom.tsx`,
  `import/Opstapimport.tsx`, `import/Opstaprapport.tsx`, `themas/Inklaplijst.tsx`, `Themadoelenoverzicht`,
  `Themaminimumdoelen` en `Subthemahoofdstuk`. De uitvoeringen lopen al uiteen: `aria-controls` staat er soms wel en
  soms niet, en de pijl draait soms `-rotate-90` en soms `rotate-180`.
- **`Schermkop` en `Schermvlak`** (`app/Schermkop.tsx`) hebben twee booleans, `breed` en `smal`, voor één
  instelling. Geef je ze allebei, dan wint `breed` stil, en elke aanroeper moet ze op de kop en op het vlak apart
  zetten. `Blad` heeft daar al een `maat`-enum voor.
- **`Fiche`** (`themas/Fiche.tsx`) heeft drie opmaak-booleans (`kaal`, `strak`, `stapel`) die op elkaar inwerken;
  `stapel` negeert `acties` stil.
- **`forwardRef`** wordt nog drie keer gebruikt (`kat/Katvenster.tsx`, en `Mandscene` en `LiggendeKat` in
  `kat/Tekening.tsx`), terwijl React 19 `ref` als gewone prop doorgeeft.

## Voorgestelde wijziging

- Een compound component `Inklapper` in `components/ui` (`Inklapper.Root`, `.Knop`, `.Inhoud`) die `aria-expanded`
  en `aria-controls` altijd zet en één draairichting heeft. Alle tien plekken gebruiken het.
- `Schermkop` en `Schermvlak` krijgen `maat: "normaal" | "breed" | "smal"`, en waar het kan geeft één
  `Scherm`-omhulsel die maat één keer door.
- `Fiche` krijgt één variant-prop voor zijn drie opmaken.
- `forwardRef` wordt `ref` als prop.

## Acceptatiecriteria

- [ ] Gegeven de code, wanneer je zoekt naar `aria-expanded`, dan staat het alleen nog in `Inklapper` en in
      componenten die geen uitklapper zijn, zoals menu's.
- [ ] Gegeven elke uitklapper in de app, wanneer een schermlezer de knop voorleest, dan meldt hij open of dicht en
      verwijst `aria-controls` naar de inhoud.
- [ ] Gegeven de code, wanneer je zoekt naar `forwardRef` of naar de props `breed`, `smal`, `kaal`, `strak` en
      `stapel`, dan vind je niets meer.
- [ ] Gegeven elk gewijzigd scherm, wanneer je het op desktop en op ~390px bekijkt, dan ziet het eruit zoals
      voordien, op één consistente draairichting van de pijl na.

## Buiten scope

Nieuw gedrag van de uitklappers, zoals alles ineens open- of dichtklappen.

## Open vragen

Geen.

## Werklog

- 2026-09-23 09:49 · claude-vercelanalyse · aangemaakt (status nieuw)
- 2026-09-24 13:39 · claude-tb075 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten (opdracht via orchestrerende sessie)
- 2026-09-24 13:51 · claude-tb075 · Inklapper gebouwd en op alle tien uitklappers gezet; Schermkop/Schermvlak op maat; forwardRef weg; Fiche had de opmaak-booleans al niet meer. pnpm test (1402) en pnpm lint groen.
- 2026-09-24 14:06 · claude-tb075 · Browserpas op kopie jp_tb075, main (5190) naast deze tak (5191), 1440 en 390px: dekking, leerplandoelen- en minimumdoelenboom, koppelblad, themapagina en inladen hebben dicht en na het openen dezelfde paginahoogte en dezelfde knopposities; Enter en Spatie klappen open en dicht, aria-controls wijst naar bestaande inhoud (op het koppelblad ontbrak het voordien).
