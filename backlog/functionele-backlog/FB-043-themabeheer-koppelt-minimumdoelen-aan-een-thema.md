---
id: FB-043
titel: Themabeheer koppelt minimumdoelen aan een thema, uitklapbaar met hun leerplandoelen
soort: functioneel
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 13:46
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-2.3, FR-9.3]
---

## Aanleiding

De eigenaar vroeg op 2026-09-16, na de demo: *"Ik wil minimumdoelen kunnen koppelen aan thema's omdat deze overheen
meerdere fases gaan en door de minimumdoelen eraan te koppelen wordt automatisch de gelinkte leerplandoelen eraan
gelinkt."* en *"Maak bij de themadoelen de minimumdoelen dan ook uitklapbaar, zijnde eerst focus op welke
minimumdoelen worden gedekt door het thema en bij uitklappen van minimumdoel de gelinkte leerplandoelen [...].
Bij subthema, aangezien dit per leeftijd is, blijft het wel de leerplandoelen omdat die specifiek voor die fase/klas
zijn."*

Vandaag is een themadoel altijd een leerplandoel, en dat hoort bij één leeftijd (`…GK2…`). Een thema loopt over
meerdere leeftijden, en het minimumdoel is het niveau dat over die leeftijden heen gaat en waarop de inspectie toetst.

**Dit draait een eerdere beslissing terug:** bij FB-009 verwierp de eigenaar op 2026-09-15 nog "een eigen lijst
beoogde minimumdoelen op het thema". Met dit ticket komt die lijst er wel, als themadoelen.

Het deel "Doelen per leeftijd toont geen minimumdoelen meer" is FB-044. Hoe dit meetelt als verwachte dekking is
FB-045.

## Gewenst gedrag

- Directie en wie themabeheer heeft, koppelen **minimumdoelen** als themadoel aan een thema, en ontkoppelen ze weer.
- Een gekoppeld minimumdoel brengt vanzelf de leerplandoelen mee die er via de concordantie naartoe leiden. Die
  leerplandoelen worden niet apart gekozen en gaan mee weg als het minimumdoel ontkoppeld wordt.
- Bij de themadoelen staan eerst de **minimumdoelen** van het thema (ref en tekst), ingeklapt: zo ziet men in één
  oogopslag welke minimumdoelen het thema beoogt.
- Een minimumdoel uitklappen toont **per leeftijd** een regel met het aantal leerplandoelen ("K2 · 3 leerplandoelen").
  Een leeftijd uitklappen toont die leerplandoelen. Daar staan geen minimumdoelen meer bij.
- Een leerplandoel aanklikken opent zijn detail, zoals nu (TB-016); daar ziet men ook zijn minimumdoel.
- Bij de **subthema's** verandert niets: subdoelen blijven leerplandoelen van de leeftijd van het subthema.

## Acceptatiecriteria

- [ ] Gegeven iemand met themabeheer, wanneer ze een minimumdoel als themadoel koppelt, dan staat het bij de themadoelen
  en zijn geconcordeerde leerplandoelen hangen eronder, zonder dat ze die apart kiest.
- [ ] Gegeven een gekoppeld minimumdoel, wanneer de pagina opent, dan is het ingeklapt; uitgeklapt toont het per leeftijd
  het aantal leerplandoelen, en een leeftijd uitgeklapt toont die leerplandoelen, zonder minimumdoelen in die lijst.
- [ ] Gegeven een gekoppeld minimumdoel, wanneer het ontkoppeld wordt, dan verdwijnen ook de leerplandoelen die het
  meebracht.
- [ ] Gegeven een gewone leerkracht of hoofdleerkracht, dan ziet ze de minimumdoelen van het thema maar kan ze er geen
  koppelen of ontkoppelen; de server weigert het ook.
- [ ] Gegeven een subthema, dan koppelt men daar zoals nu leerplandoelen als subdoel, geen minimumdoelen.
- [ ] Getest aan de serverkant (koppelen, meebrengen, ontkoppelen, rechten) en nagekeken in een echte browser op desktop
  en ~390px, met het toetsenbord bedienbaar.

## Testscenario's

1. Meld aan met themabeheer en open een thema. Koppel bij de themadoelen een minimumdoel uit de kleuterschool
   (een ref met `K-`). Het staat bij de themadoelen, ingeklapt.
2. Klap het open. Je ziet per leeftijd (bv. JK, K2, K3) hoeveel leerplandoelen ernaartoe leiden.
3. Klap K3 open. Je ziet de leerplandoelen van K3; er staat geen minimumdoel tussen.
4. Klik een leerplandoel aan. Het detail opent en noemt het minimumdoel.
5. Ontkoppel het minimumdoel. Het verdwijnt, met de leerplandoelen eronder.
6. Meld aan als leerkracht. Je ziet de minimumdoelen van het thema, zonder knop om te koppelen of te ontkoppelen.
7. Open een subthema: daar koppel je nog altijd leerplandoelen.
8. Herhaal stap 1 tot 3 op ~390px.

## Buiten scope

- "Doelen per leeftijd" zonder minimumdoelen: FB-044.
- Verwachte en ingeplande dekking: FB-045.
- AI-doelsuggesties op minimumdoelniveau: de doelsuggesties blijven leerplandoelen voorstellen.

## Open vragen

- **Wat met de bestaande themadoelen, die leerplandoelen zijn?** Blijven ze naast de minimumdoelen staan, worden ze
  omgezet naar hun minimumdoel, of verdwijnt dat soort themadoel? **Standaard** blijven ze staan tot de eigenaar beslist.
- **Blijft het maximum van 2 à 3 themadoelen?** De grondwet (Art. IX) noemt themadoelen "de 2 à 3 overkoepelende doelen".
  Telt dat maximum de minimumdoelen?
- **Welke leeftijden komen mee?** Een minimumdoel `K-` leidt naar leerplandoelen van JK, K2 en K3. **Standaard** alle
  leeftijden van de concordantie, ook als het thema voor een leeftijd nog geen subthema heeft.
- **Import (FR-1):** het Excelbestand draagt vandaag leerplandoelen als themadoel. Moet het ook minimumdoelen kunnen
  dragen? **Standaard** nee, dit ticket gaat over de themapagina.
- Een koppeling tussen een thema en een minimumdoel is een nieuw soort koppeling in het gegevensmodel (Art. IX):
  de bouwer legt dat vast in een ADR.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
