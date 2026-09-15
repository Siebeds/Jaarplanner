---
id: FB-009
titel: Thema toont welke leerplandoelen en minimumdoelen het per leeftijd bereikt
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 16:16
opgepakt-door: themapagina
branch: ticket/FB-009-doelen-per-leeftijd
pr: 83
geblokkeerd:
fr: [FR-2.3, FR-9.3]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"op thema, naast leerplandoelen, ook bijhouden aan welke minimumdoelen zal voldaan
worden"*.

Vandaag toont een thema alleen zijn 2 à 3 themadoelen en zijn doelsuggesties. Wie wil weten welke leerplandoelen en
welke minimumdoelen een thema samen met zijn subthema's en activiteiten bereikt, moet elk subthema openen en elk doel
apart aanklikken (TB-016). Er is geen overzicht, en de minimumdoelen, het niveau waarop de inspectie toetst, zijn nergens
per thema samengeteld.

**Beslissing van de eigenaar, 2026-09-15:** de doelen van een thema worden **berekend uit wat eronder hangt**. Er komt
geen nieuw soort koppeling tussen een thema en een minimumdoel, en de 2 à 3 themadoelen blijven de ankers van het thema.

## Gewenst gedrag

Op de themapagina staat een overzicht van de doelen die dit thema bereikt, **per leeftijd** (de jaarfasen waarvoor het
thema subthema's heeft).

- **Leerplandoelen:** per leeftijd alle leerplandoelen die in het thema beslist gekoppeld zijn (aanvaard of manueel):
  de themadoelen, de aanvaarde doelsuggesties, de subdoelen van de subthema's van die leeftijd, en de doelen van de
  activiteiten onder die subthema's. Een doel dat op meerdere plaatsen voorkomt, staat één keer, met waar het
  voorkomt (bv. "subdoel in Bladeren vallen, 2 activiteiten"). Herhaling is goed en mag zichtbaar zijn.
- **Minimumdoelen:** per leeftijd de minimumdoelen die deze leerplandoelen via de concordantie bereiken, met per
  minimumdoel de leerplandoelen van dit thema die ernaartoe leiden.
- Een voorgestelde of geweigerde koppeling telt niet mee.
- Het overzicht is een **vooruitblik** op wat het thema aanbiedt, geen dekking: het zegt niets over een klas. De
  dekking blijft per klas in het dekkingsoverzicht.
- Een doel aanklikken opent zijn detail, zoals bij de themadoelen (TB-016).

## Acceptatiecriteria

- [x] Gegeven een thema met een K3-subthema waarvan een subdoel en een activiteit elk een ander leerplandoel dragen,
  wanneer ik de themapagina open, dan staan bij K3 beide leerplandoelen en de minimumdoelen waarnaar ze via de
  concordantie leiden.
- [x] Gegeven een leerplandoel dat zowel subdoel als activiteitsdoel is in hetzelfde thema, dan staat het één keer,
  met de plaatsen waar het voorkomt.
- [x] Gegeven een doelsuggestie die voorgesteld of geweigerd is, dan telt ze in het overzicht niet mee; na aanvaarden
  wel.
- [x] Gegeven een leerplandoel zonder concordantie, dan staat het bij de leerplandoelen en levert het geen minimumdoel op.
- [x] Het overzicht gebruikt het woord "gedekt" niet, en is in een echte browser nagekeken op desktop en op ~390px.

## Testscenario's

1. Open een thema met subthema's voor twee leeftijden, bv. K2 en K3. Het overzicht toont twee groepen, K2 en K3.
2. Kijk bij K3: de subdoelen van de K3-subthema's en de doelen van hun activiteiten staan erbij, elk doel één keer.
3. Kijk bij K3 naar de minimumdoelen: elk minimumdoel toont welke leerplandoelen van dit thema ernaartoe leiden.
4. Koppel (als hoofdleerkracht) een nieuw leerplandoel aan een K3-activiteit en herlaad de themapagina. Het doel en zijn
   minimumdoel staan er nu bij.
5. Genereer (als themabeheer) doelsuggesties en weiger er een. Het geweigerde doel staat niet in het overzicht.
6. Klik een doel aan. Het detail opent.
7. Herhaal stap 1 tot 3 op ~390px.

## Buiten scope

- Dekking per klas op minimumdoelniveau: dat is story E5-04.
- Een eigen lijst beoogde minimumdoelen op het thema: verworpen door de eigenaar op 2026-09-15.
- Doelen koppelen of ontkoppelen vanuit dit overzicht: dat blijft waar het nu gebeurt.

## Open vragen

- Themadoelen en doelsuggesties hangen aan het hele thema, niet aan een leeftijd. **Standaard** staan ze bij de
  jaarfase van het leerplandoel zelf (een doel `…GK2…` bij K2). Is dat goed?

## Werklog

- 2026-09-15 14:09 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-15 14:46 · eigenaar · nieuw → klaar-voor-bouw: op klaar-voor-bouw gezet door de eigenaar (in sessie, 2026-09-15)
- 2026-09-15 15:30 · themapagina · klaar-voor-bouw → in-uitvoering: opgepakt; gestapeld op ticket/FB-010-subdoelen-in-activiteiten
- 2026-09-15 15:48 · themapagina · gebouwd: nieuw endpoint GET /api/themas/{id}/doelenoverzicht (drie queries per thema) en een blok 'Doelen per leeftijd' op de themapagina; unittests 7 groen (plaatsen per leeftijd, een doel een keer, voorgesteld/geweigerd telt niet, aanvaarde suggestie wel, concordantie, codevolgorde), Vitest 589 groen, backend 1457 unit en 129 integratie groen, lint en dotnet format schoon
- 2026-09-15 15:48 · themapagina · browser op echte Op.stap-doelen, desktop en 390px: rijen per leeftijd met tellingen, lijsten met 'Via …', minimumdoel opent in het blad, scenario 4 (nieuw K3-doel gekoppeld, na herladen erbij); contrast licht en donker 6,51 tot 7,58:1; geen consolefouten. Open vraag: standaard toegepast (themadoelen bij de jaarfase van hun leerplandoel)
- 2026-09-15 16:07 · themapagina · antagonist: een MAJOR (een aanvaarde doelsuggestie stond als 'themadoel', terwijl ze dat niet is, Art. IX.2): opgelost met een eigen plaats 'aanvaarde doelsuggestie' en een verbeterde test; de kleine bevindingen ook (HTTP-integratietest 200/404, test voor 'geen minimumdoel', commentaar); unit 7, integratie 6, Vitest 60 groen, lint en format schoon
- 2026-09-15 16:08 · themapagina · in-uitvoering → te-testen: thema toont per leeftijd de leerplandoelen en de minimumdoelen die ze bereiken, via een nieuw endpoint; browser desktop en 390px op echte Op.stap-doelen, contrast licht en donker gemeten, antagonist-MAJOR opgelost
- 2026-09-15 16:10 · themapagina · tweede controle antagonist, alleen op de MAJOR: opgelost, COMPLIANT, geen nieuwe blokkerende bevinding
- 2026-09-15 16:16 · themapagina · PR #83
