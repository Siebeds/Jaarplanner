---
id: FB-068
titel: Kat maakt tijdens een vervanging de lesvoorbereidingen rollend klaar
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:45
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar besliste op 2026-09-18, in een sparring over een agentische uitbreiding, dat de Jaarplanner een AI-agent
krijgt die op de agenda van de kleuterleerkracht leeft en planlast vermindert, gepersonifieerd als een dikke oranje
gestreepte kat. De agent is de interface, niet de motor. De grondwet en de ADR's komen in TB-056.

Een vervanger heeft geen tijd om elke activiteit zelf voor te bereiden, en zeker niet de eerste dag. De kat brengt
cadeautjes: zoals een kat een muis op de deurmat legt, liggen er 's ochtends voorbereide lessen klaar.

**Beslissingen van de eigenaar, 2026-09-18:** tijdens een vervanging maakt de kat de lesvoorbereidingen rollend klaar:
bij het vastleggen de eerste twee schooldagen, daarna elke avond de volgende schooldag. Voor de vaste leerkracht nooit
proactief, alleen op vraag (FB-067).

## Gewenst gedrag

- Wanneer directie een vervanging vastlegt, maakt de kat voorstellen van lesvoorbereiding (zoals FB-067) voor de geplande
  activiteiten van de eerste twee schooldagen van de vervanging.
- Daarna maakt hij elke avond de voorstellen voor de geplande activiteiten van de volgende schooldag.
- Een plaatsing die al een voorbereiding heeft (voorgesteld, aanvaard of geweigerd), krijgt er geen nieuwe.
- Dagen zonder school (vakantie, sluiting) slaat hij over.
- Een voorstel bij een plaatsing die uit de agenda verdwijnt, verdwijnt mee.
- Na de einddatum van de vervanging maakt hij voor die klas niets meer.
- De vervanger ziet dat er voorbereidingen klaarliggen (de kat, FB-071; tot die er is, een zichtbare vermelding in de
  briefing).

## Acceptatiecriteria

- [ ] Gegeven een vervanging die maandag start, wanneer directie ze vrijdag vastlegt, dan liggen er voorstellen klaar voor
  de geplande activiteiten van maandag en dinsdag.
- [ ] Gegeven een lopende vervanging, dan liggen 's ochtends de voorstellen voor de geplande activiteiten van die dag klaar.
- [ ] Gegeven een plaatsing met een aanvaarde of geweigerde voorbereiding, dan maakt de kat er geen nieuwe.
- [ ] Gegeven een vakantiedag of sluiting in de vervanging, dan slaat de kat die dag over.
- [ ] Gegeven een vervanging die geëindigd is, dan maakt de kat daarna niets meer voor die klas.
- [ ] Gegeven een vaste leerkracht zonder vervanging, dan maakt de kat nooit uit zichzelf een voorbereiding.

## Testscenario's

1. Leg als directie een vervanging vast voor een K3-klas die morgen start, met een gevulde agenda.
2. Meld aan als de vervanger. Bij de activiteiten van morgen en overmorgen liggen voorstellen van voorbereiding klaar.
3. Aanvaard er een, weiger er een.
4. De volgende ochtend liggen ook de voorstellen van de dag daarna klaar; de geweigerde is niet terug.
5. Meld aan als leerkracht van een andere klas zonder vervanging: er liggen geen voorbereidingen klaar die je niet vroeg.

## Buiten scope

- De vorm en de inhoud van een voorbereiding: FB-067.
- Hoe de kat het toont: FB-071.
- Een mail of een melding buiten de app.

## Open vragen

- Om hoe laat draait de avondronde?
- Wat als het AI-budget van de school op is (FB-055): zegt de kat dat, en in welke woorden?
- Hangt af van TB-056, TB-057, FB-063 en FB-067.

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
