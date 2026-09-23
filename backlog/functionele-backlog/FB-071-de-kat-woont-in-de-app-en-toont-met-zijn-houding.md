---
id: FB-071
titel: De kat slaapt rechtsboven in een mandje en opent bij een klik zijn venster
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-23 10:00
opgepakt-door: claude-fb071-uitlijning
branch: ticket/FB-071-uitlijning
pr: 165
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar besliste op 2026-09-18, in een sparring over een agentische uitbreiding, dat de Jaarplanner een AI-agent
krijgt die op de agenda van de kleuterleerkracht leeft en planlast vermindert, gepersonifieerd als een dikke oranje
gestreepte kat. De agent is de interface, niet de motor. De grondwet en de ADR's komen in TB-056.

Een kat is proactief maar niet dienstbaar. Dat past bij een agent die de leerkracht niet mag overspoelen: hij komt en
gaat, brengt af en toe iets, en zijn houding zegt of er iets is. Geen badges, geen rode bolletjes.

**Beslissingen en uitgangspunten van de eigenaar, 2026-09-18:** charmant in gedrag, volwassen in inhoud, nooit
babytaal; meldingen alleen in de app, hooguit enkele momenten per dag; de kat wordt voorgelegd aan de onderwijsadviseur
voor hij centraal in de huisstijl komt.

**Aangevuld door de eigenaar, 2026-09-18:** de kat ligt standaard rechtsboven in een mandje te slapen. Klik je op hem,
dan staat hij recht, zet hij een paar stappen en opent hij een venster waarin je met hem kan babbelen. Dat venster is
ook de deurmat: bovenaan wat hij meebracht, daaronder de chat. De chat is die van FB-031 (uitleg en opzoekvragen) en
FB-032 (voorstellen), en die horen ook bij fase 1.

**Ontwerp uitgewerkt met de eigenaar, 2026-09-22.** De kat heet Chuck. Het prototype, de generator voor zijn
bewegingen en een overdrachtsnotitie voor de bouw staan in `backlog/worklogs/FB-071/`: lees
`design-handoff.md` voor je begint. Het prototype staat ook als artifact:
https://claude.ai/artifact/MLgAot5kDtiPk8sNwcmHVb (privé, bij de eigenaar).

## Gewenst gedrag

- Chuck ligt rechtsboven in de kop van de app in een laag mandje, voor de leerkracht, de vervanger en directie. Hij
  ligt nooit op de gegevens. Er staat altijd precies één Chuck op het scherm. Hij staat alleen rechtsboven: geen
  knop van het scherm staat naast hem, zodat niemand hem voor een knop tussen de knoppen houdt.
- De klaskiezer staat niet meer in de kop van een scherm. Op een laptop staat hij onderaan in de linker zijbalk,
  boven je naam en Afmelden; op een telefoon kies je de klas onderaan in Instellingen, boven Afmelden. Knoppen die bij het scherm zelf horen, zoals "Vandaag" in
  de agenda, blijven waar ze staan.
- Zijn houding toont de toestand, en er staat altijd tekst bij:
  - hij slaapt in zijn mandje, met een stil label: er ligt niets nieuws;
  - hij ligt met zijn oren recht en zegt in een tekstballon boven zich "Ik heb iets voor je klaargezet.": er
    ligt iets klaar (een briefing, voorbereidingen, voorstellen);
  - hij ligt op de hoek van de weekstrook, zijn mandje in de kop is leeg, en hij zegt in een tekstballon boven zich
    welk doel in gevaar komt (FB-069). Hij bedekt nooit de gegevens zelf;
  - hij spint, met een stil label: alle doelen van de klas liggen op schema.
- Chuck praat alleen als hij iets heeft. Wat hij zegt, staat in een stripballon met een inktrand en een staartje naar
  zijn kop. Wat de leerkracht zelf typt, staat in een gewoon vak.
- Wie op hem klikt (of hem met het toetsenbord kiest), ziet hem opstaan en pootje per pootje uit zijn mandje stappen:
  één poot tegelijk, elke poot eerst op de rand en dan eroverheen. Daarna zet hij een paar passen zoals een kat
  stapt, met altijd drie poten op de grond, en het venster opent. Het venster opent al na ongeveer 300 ms: niemand
  wacht op de kat. Op telefoonbreedte wordt het venster een scherm over de volle breedte.
- Het venster toont bovenaan wat hij meebracht, elk met "Bekijken" en "Later", en daaronder de chat (FB-031, FB-032).
  Zolang die chat niet gebouwd is, staat daar zichtbaar dat hij nog komt, en geen invoerveld. In het venster staat
  zichtbaar dat namen en informatie over kinderen er niet in horen.
- Sluiten (ook met Escape) zet de focus meteen terug op de kat; hij loopt terug, stapt pootje per pootje zijn mandje
  in, draait zich om en gaat liggen.
- Hij komt hooguit enkele momenten per dag uit zijn mandje uit zichzelf. Wie minder beweging vraagt, ziet geen
  loopje: het venster opent meteen en hij verandert van houding zonder animatie.
- Zijn vacht is gember: warm, maar met een verzadiging ver onder die van elk signaal, en donker genoeg voor 3:1 op een
  kaart. Het mandje is kleurloos, zodat Chuck het enige warme op het scherm is.
- Een voorstel dat hij brengt, draagt in de agenda de vage voorstelring (ADR-0051); een knop die de AI aanroept blijft
  een AI-knop (ADR-0039).
- In zijn ballonnen en in de chat praat hij in de ik-vorm, in gewoon, volwassen Nederlands, nooit babytaal. De charme
  zit in wat hij doet.
- Geen kat in exports of in het ontwikkelingsrapport.

## Acceptatiecriteria

- [x] Gegeven geen open signaal of voorstel, dan slaapt Chuck rechtsboven in zijn mandje, met een zichtbaar label
  onder hem.
- [x] Gegeven iets dat klaarligt, dan staan zijn oren recht en zegt hij het in een tekstballon boven zich, met het staartje naar zijn kop.
- [x] Gegeven de agenda, het jaarplan of de dekking, dan staat er geen knop naast Chuck: de klaskiezer staat op een
  laptop onderaan in de linker zijbalk en op een telefoon onderaan in Instellingen.
- [x] Gegeven een doel in gevaar, dan is zijn mandje leeg, ligt hij op de hoek van de weekstrook zonder gegevens te
  bedekken, en zegt hij in een tekstballon welk doel. Er staat nooit meer dan één Chuck op het scherm.
- [x] Gegeven een klik op Chuck, of Enter met de focus op hem, dan stapt hij één poot tegelijk uit zijn mandje, elke
  poot eerst op de rand, en opent het venster met bovenaan wat klaarligt (elk item te bekijken of uit te stellen).
- [x] Gegeven dat hij loopt, dan staan er altijd drie poten op de grond en schuift een voet die neerstaat niet.
- [x] Gegeven een open venster, wanneer de gebruiker Escape drukt of het sluit, dan staat de focus meteen op de kat en
  stapt hij terug in zijn mandje.
- [x] Gegeven "minder beweging", dan opent het venster zonder loopje en verandert Chuck van houding zonder animatie.
- [x] Gegeven elke houding, dan draagt ze ook tekst, en het contrast haalt WCAG 2.2 AA (zijn silhouet 3:1, tekst 4.5:1),
  gemeten in een echte browser, in licht en in donker.
- [x] Gegeven een export of een ontwikkelingsrapport, dan staat er geen kat in.
- [x] Bekeken in de echte app op desktop en op ongeveer 390px.

## Testscenario's

1. Meld aan als leerkracht zonder open signaal of voorstel. Chuck slaapt rechtsboven in zijn mandje, met een label
   onder hem, en er staat geen knop naast hem. De klas kies je onderaan in de linker zijbalk.
2. Laat een lesvoorbereiding klaarzetten (FB-068). Zijn oren staan recht en boven hem staat een tekstballon.
   Klik op hem: hij staat op, stapt pootje per pootje uit zijn mandje, en het venster toont bovenaan de voorbereiding
   met "Bekijken" en "Later".
3. Druk Escape: de focus staat meteen op de kat, en hij stapt terug in zijn mandje en gaat liggen.
4. Laat een doel in gevaar komen (FB-069). Het mandje is leeg, Chuck ligt op de hoek van de weekstrook met een
   tekstballon, en de weekstrook blijft leesbaar. Er is maar één kat te zien.
5. Zet "minder beweging" aan in het besturingssysteem: het venster opent zonder loopje.
6. Herhaal op telefoonbreedte (ongeveer 390px): het venster vult de breedte en geen ballon ligt over gegevens. De klas
   kies je onderaan in Instellingen.
7. Herhaal in donkere weergave.

## Buiten scope

- De signalen zelf: TB-057, FB-068, FB-069, FB-070.
- Wat de chat kan: FB-031 (uitleg en opzoekvragen) en FB-032 (voorstellen). Tot die gebouwd zijn, toont het venster
  alleen wat hij meebracht.
- De krabpaal als inbox, oudercommunicatie en evaluaties: niet in fase 1.

## Open vragen

Beslist door de eigenaar op 2026-09-22:

- De kat heet Chuck: geen Vlaamse voornaam, dus hij botst nooit met een kind in de klas.
- Hij spreekt in de ik-vorm, nuchter, zonder kattengedrag in de taal.
- De vacht is gember; het oranje-probleem is opgelost met lage verzadiging en vorm (zie de overdrachtsnotitie).
- Een gebruiker kan hem niet verbergen.
- Bij een weigering stoot hij niets om: een weigering is een normale uitkomst.
- Hij praat in een stripballon, alleen als hij iets te melden heeft.

Beslist door de eigenaar op 2026-09-23:

- Tot de onderwijsadviseur Chuck goedkeurt, staat hij achter een schoolinstelling die alleen een admin aanzet
  (Instellingen, Chuck). Standaard staat hij uit.

Beslist door de eigenaar op 2026-09-23, na de test:

- Het stille label (bv. "Chuck slaapt") staat onder Chuck; een tekstballon staat boven hem, zoals bij een
  stripfiguur, met het staartje naar zijn kop. Nooit ernaast. Dat geldt ook op de hoek van de weekstrook.
- De klaskiezer verhuist uit de kop: op een laptop naar de linker zijbalk, op een telefoon naar de top van
  Instellingen. "Vandaag" blijft staan.
- Leerkrachten wisselen zelden van klas, dus de klaskiezer staat onderaan: in de zijbalk boven je naam en Afmelden, op
  een telefoon onderaan Instellingen.

Vastgelegd in de bouw:

- De gembervacht als uitzondering op "geen merkkleur" staat in ADR-0065 en bovenaan `index.css`. De lichte vacht is
  van 56% naar 54% helderheid gegaan: 56% haalde op de pagina maar 2,90:1, onder de 3:1 die dit ticket vraagt.

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
- 2026-09-22 23:59 · claude-fb071 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten; beslist: achter een admin-instelling tot de onderwijsadviseur Chuck goedkeurt
- 2026-09-23 00:13 · claude-fb071 · backend: Katinstelling (standaard uit, admin zet ze) en een voorstel van de kat draagt op de deurmat zijn klas, dag en uur; integratietests groen
- 2026-09-23 01:06 · claude-fb071 · choreografietest vond twee fouten uit het prototype (achterpoot sloeg de rand over, lijf sprong bij begin en einde) en zijn hersteld; vacht licht naar 54% na meting (56% gaf 2,90:1 op de pagina); alle 10 criteria afgevinkt met test of browsercontrole (mock en echte API op wegwerp-db jp_fb071, desktop en 390px, licht en donker)
- 2026-09-23 01:06 · claude-fb071 · antagonist COMPLIANT; 3 van 4 MINOR opgelost (label bij laadfout, klas in spinlabel, focus binnen het telefoonvenster), 1 genoteerd; 2255 unit- en 597 integratietests groen, 1308 frontendtests groen, format en lint schoon
- 2026-09-23 01:06 · claude-fb071 · in-uitvoering → te-testen: Chuck gebouwd: mandje in de kop, houding uit deurmat en dekking, hoek van de weekstrook bij een doel in gevaar, venster met wat hij meebracht, pootje-per-pootje-loopje uit een geteste choreografie, admin-instelling (standaard uit), ADR-0065; gates groen
- 2026-09-23 01:07 · claude-fb071 · PR #161
- 2026-09-23 09:13 · eigenaar · te-testen → klaar-voor-bouw: Bevinding van de eigenaar: tekst van Chuck (bv. 'Chuck slaapt') moet onder de kat, niet ernaast; Chuck staat verwarrend tussen de knoppen, dus de klaskiezer verhuist naar de linker zijbalk (telefoon: bovenaan Instellingen); Vandaag blijft staan
- 2026-09-23 09:14 · claude-fb071-kop · klaar-voor-bouw → in-uitvoering: opgepakt na de test: tekst onder Chuck, klaskiezer naar de zijbalk
- 2026-09-23 09:21 · claude-fb071-kop · tekst van Chuck staat onder hem; klaskiezer uit de kop naar de zijbalk (rail: icoon) en op telefoon bovenaan Instellingen; bekeken op mockdata op 1440 en 390px; lint en 443 gerelateerde tests groen
- 2026-09-23 09:23 · claude-fb071-kop · antagonist COMPLIANT; 2 MINOR opgelost (tekst 'bovenaan het scherm' wordt 'Kies eerst een klas.', lege regels), 1 gecontroleerd (alleen Chuck gebruikt de ballon met staart naar boven); 1312 frontendtests groen, lint schoon
- 2026-09-23 09:23 · claude-fb071-kop · in-uitvoering → te-testen: tekst van Chuck onder hem, klaskiezer in de zijbalk (telefoon: bovenaan Instellingen), Vandaag blijft staan; gates groen
- 2026-09-23 09:23 · claude-fb071-kop · PR #164
- 2026-09-23 09:29 · claude-fb071-kop · op vraag van de eigenaar staat de klaskiezer onderaan: in de zijbalk boven naam en Afmelden, op telefoon onderaan Instellingen; bekeken op 1440 en 390px, lint en 162 tests groen
- 2026-09-23 09:39 · claude-fb071-kop · op vraag van de eigenaar (doorgegeven via een andere sessie): tekstballonnen boven Chuck met het staartje naar zijn kop, het stille label blijft onder hem; ook op de hoek van de weekstrook; bekeken op 1500 en 390px, 108 tests groen
- 2026-09-23 09:55 · eigenaar · te-testen → klaar-voor-bouw: Bevinding van de eigenaar: Chuck steekt boven de agenda-kop uit, hij moet uitgelijnd staan met de kop; de Vandaag-knop dichter bij de datum
- 2026-09-23 09:56 · claude-fb071-uitlijning · klaar-voor-bouw → in-uitvoering: opgepakt na de test: Chuck uitgelijnd met de kop, Vandaag naast de datum
- 2026-09-23 10:00 · claude-fb071-uitlijning · antagonist COMPLIANT; 2 MINOR gecontroleerd in de browser: geen scherm met zonderKat geeft rechts mee, en de ruimte onder de titel blijft 12px (Dekking bekeken)
- 2026-09-23 10:00 · claude-fb071-uitlijning · in-uitvoering → te-testen: Chuck staat naast het hele kopblok in plaats van erboven uit te steken (telefoon: naast de titel), Vandaag direct achter de datum; bekeken op 1500 en 390px, lint en 359 tests groen
- 2026-09-23 10:00 · claude-fb071-uitlijning · PR #165
