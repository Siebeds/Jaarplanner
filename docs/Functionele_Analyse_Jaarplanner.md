# Functionele Analyse — Jaarplanner met AI-ondersteuning

> Automatische koppeling van schoolthema's aan de leerdoelen van de Vlaamse overheid.
>
> Dit is de getrouwe Markdown-conversie van `assets/Functionele_Analyse_Jaarplanner.docx`.
> De **bindende** afgeleide is [`CONSTITUTION.md`](../CONSTITUTION.md) — bij elke tegenstrijdigheid heeft de constitution voorrang voor de *bouw*, dit document voor de *scope*.

| Veld | Waarde |
| --- | --- |
| Opdrachtgever | [Naam van de basisschool] — in te vullen |
| Doelgroep | Kleuter- en lager onderwijs (2,5 – 12 jaar), Vlaanderen |
| Auteur | Siebe De Saedeleir |
| Versie | 0.7 — concept ter validatie (v0.4-tekst + Bijlage A) |
| Datum | 20 juni 2026 |
| Status | Ter review door de directie |

---

## 1. Documentbeheer

Dit document is een levend document. Wijzigingen worden bijgehouden in onderstaande versietabel.

| Versie | Datum | Auteur | Wijziging | Status |
| --- | --- | --- | --- | --- |
| 0.1 | 20-06-2026 | Siebe De Saedeleir | Eerste opzet ter nazicht | Concept |
| 0.2 | 20-06-2026 | Siebe De Saedeleir | Bron van de leerdoelen verduidelijkt: overheid via onderwijsdoelen.be | Concept |
| 0.3 | 20-06-2026 | Siebe De Saedeleir | Bron van de doelen verfijnd naar het leerplan Op.stap (KathOndVla), incl. structuur en concordantie | Concept |
| 0.4 | 20-06-2026 | Siebe De Saedeleir | Beheerpagina expliciet: klassen instellen + schoolbrede/per-klas overzichten | Concept |
| 0.5 | 29-06-2026 | (analyse) | Verfijningen op basis van Op.stap-referentiemateriaal — zie **[Bijlage A](#bijlage-a--verfijningen-op-basis-van-opstap-referentiemateriaal-post-v04)**. De v0.4-tekst hierboven blijft ongewijzigd als getrouwe weergave; de verfijningen staan in de bijlage en zijn verwerkt in [`CONSTITUTION.md`](../CONSTITUTION.md). | Concept — ter validatie |
| 0.6 | 19-08-2026 | (projecteigenaar) | **A.10** toegevoegd: FR-7.3's *"ter beslissing"* over behoud/overschrijven bij een (her)generatie is voorlopig beantwoord, en FR-8.4 wordt in hetzelfde punt verfijnd. Bijlage A bevat vanaf nu ook verfijningen die **niet** uit het Op.stap-referentiemateriaal komen; A.10 vermeldt zijn eigen herkomst. Bevestiging door de directie staat open (vraag 6 in [`besluiten-gevraagd.md`](besluiten-gevraagd.md)). | Concept, ter validatie |
| 0.7 | 13-09-2026 | (projecteigenaar) | **A.11** toegevoegd: rollen en rechten, zoals de projecteigenaar ze op 11 en 13 september 2026 besliste ([ADR-0030](adr/0030-rollen-en-rechten-in-de-app.md)). §3.1, §3.2, §4, FR-1.1, FR-3.1, FR-4.3, FR-7.2, FR-10.2, FR-12.2, §7, §11, A.5 en A.7 krijgen elk een verwijzing naar A.11; hun tekst blijft staan. De directie heeft deze regeling niet bevestigd. | Concept, ter validatie |
| 0.8 | 15-09-2026 | (projecteigenaar) | FR-10.2, §11 en A.11 bijgewerkt: een leerkracht kijkt de klassen van de eigen jaarfase in, een hoofdleerkracht die van de jaarfase waarvoor ze aangesteld is, wie themabeheer heeft en de directie alle klassen, en wie geen recht heeft geen enkele ([ADR-0040](adr/0040-klassen-inkijken-per-jaarfase.md)). De directie heeft dit niet bevestigd (vraag 4 in [`besluiten-gevraagd.md`](besluiten-gevraagd.md)). | Concept, ter validatie |
| 0.9 | 15-09-2026 | (projecteigenaar) | A.7 en A.11 bijgewerkt: de brainstorm van stap 3 is een eigen **woordweb** per leerkracht en subthema, dat collega's kunnen inzien en waar de AI woorden bij voorstelt ([ADR-0043](adr/0043-eigen-woordweb-per-subthema.md), FB-036). De directie is het niet gevraagd. | Concept, ter validatie |
| 0.10 | 16-09-2026 | (projecteigenaar) | A.11 bijgewerkt: een activiteit die een leerkracht aanmaakt, is haar **eigen activiteit**, die collega's van dezelfde jaarfase lezen en als eigen kopie gebruiken; haar doelen tellen voor een klas zodra ze in die agenda staat ([ADR-0049](adr/0049-eigen-activiteit-van-de-leerkracht.md), FB-015). De directie is het niet gevraagd. | Concept, ter validatie |
| 0.11 | 16-09-2026 | (projecteigenaar) | A.7 bijgewerkt: op de themapagina stelt de AI voor in welk bestaand of nieuw subthema de leerplandoelen van de themadoelen passen; de hoofdleerkracht van de jaarfase en de directie beslissen ([ADR-0050](adr/0050-ai-plaatst-leerplandoelen-in-subthemas.md), FB-057). De directie is het niet gevraagd. | Concept, ter validatie |
| 0.12 | 16-09-2026 | (projecteigenaar) | A.6 bijgewerkt: een thema krijgt een eigen begin- en einddatum, de themaperiodes verdwijnen uit de planning, twee thema's lopen nooit tegelijk en een vakantie deelt een thema in delen ([ADR-0053](adr/0053-themaplaatsing-met-eigen-datums.md), FB-035). Het genereren van een jaarplan (FR-5, FR-8) staat uit tot het voor datums herwerkt is. De directie is het niet gevraagd. | Concept, ter validatie |
| 0.13 | 17-09-2026 | (projecteigenaar) | A.6 bijgewerkt: het genereren staat weer aan voor thema's met datums; de AI kiest een startweek en de tool zet het thema op vrije dagen ([ADR-0055](adr/0055-ai-jaarplan-met-datums.md), TB-053). FR-8.2 en FR-5.4 vervallen. De directie is het niet gevraagd. | Concept, ter validatie |
| 0.14 | 17-09-2026 | (projecteigenaar) | A.7 bijgewerkt: onder een subthema stelt de AI activiteiten voor die aan de subdoelen werken; alleen wie vroeg en de directie zien en beslissen ze, en een aanvaard voorstel wordt de eigen activiteit van wie vroeg ([ADR-0056](adr/0056-ai-stelt-activiteiten-voor.md), FB-025). De directie is het niet gevraagd. | Concept, ter validatie |
| 0.15 | 18-09-2026 | (projecteigenaar) | A.5, A.7 en A.11 bijgewerkt: het recht dat alles ziet en bewerkt, heet **admin** in plaats van directie. Het laat hetzelfde toe, meerdere gebruikers kunnen het hebben, en een admin geeft het aan een ander en neemt het af ([ADR-0061](adr/0061-de-rol-directie-heet-admin.md), FB-072). Waar het de schoolleiding bedoelt, blijft het directie. De directie is het niet gevraagd. | Concept, ter validatie |
| 0.16 | 18-09-2026 | (projecteigenaar) | **FR-14** toegevoegd: de kat, een AI-agent die uit zichzelf opmerkt wat aandacht vraagt in een klas en voorstellen, een briefing en lesvoorbereidingen brengt; een vervanger kijkt tijdelijk mee in een klas zonder iets te wijzigen ([ADR-0057](adr/0057-vervanging-briefing-en-klasfiche.md) tot [ADR-0060](adr/0060-activiteitvoorstellen-op-een-aanbod-gat.md), TB-056). §2.3: het genereren van lesmateriaal is niet langer buiten scope. §7 bijgewerkt. De directie is het niet gevraagd. | Concept, ter validatie |

Te valideren door: de directie van de school.

> **Let op:** hoofdstukken 1–12 zijn de getrouwe weergave van v0.4. **[Bijlage A](#bijlage-a--verfijningen-op-basis-van-opstap-referentiemateriaal-post-v04)** bevat verfijningen (post-v0.4), grotendeels op basis van het Op.stap-referentiemateriaal en vanaf A.10 ook op basis van eigenaarsbeslissingen (A.10 vermeldt zijn eigen herkomst); bij tegenspraak met de v0.4-tekst geldt de bijlage. Volledige onderbouwing: [`Gap-analyse_Opstap_referentie.md`](Gap-analyse_Opstap_referentie.md).

## 2. Inleiding

### 2.1 Context en probleemstelling

De Vlaamse overheid bepaalt de leerdoelen (eindtermen) die elke klas en elke leerkracht moet nastreven. Scholen hebben hun onderwijs door de jaren heen opgebouwd rond thema's en subthema's, met bijhorende activiteiten.

Nu de doelen vernieuwd zijn, staan scholen in heel Vlaanderen voor dezelfde uitdaging: hoe koppel je de bestaande thema's aan de nieuwe doelen? Welk thema dekt welk doel af, welke doelen komen nog niet aan bod, en hoe spreid je alles zinvol over het schooljaar?

Vandaag gebeurt dit grotendeels manueel. Dat is tijdrovend en foutgevoelig, en het is moeilijk om aan te tonen dat álle doelen effectief gedekt zijn.

De school volgt het leerplan "Op.stap, leerroutes voor iedereen" van Katholiek Onderwijs Vlaanderen — het nieuwe leerplan voor het katholiek basisonderwijs. Daarin zijn de decretale minimumdoelen (de eindtermen) letterlijk verwerkt, samen met de leerplandoelen en leerroutes. De doelen waarmee de leerkrachten plannen, komen dus uit Op.stap.

### 2.2 Doelstelling van de tool

De Jaarplanner (werktitel) is een webtoepassing die:

- de bestaande thema's, subthema's en activiteiten van de school inleest, en de leerplandoelen inlaadt vanuit het leerplan Op.stap van Katholiek Onderwijs Vlaanderen (dat de decretale minimumdoelen bevat);
- met behulp van AI voorstelt welke thema's en activiteiten het best bij welke doelen passen;
- per klas een volledig jaarplan genereert, gespreid over de maanden van het schooljaar;
- dat plan toont in een flexibele kalender waarin de leerkracht alles manueel kan aanpassen (drag-and-drop);
- toelaat het volledige plan of afzonderlijke maanden opnieuw te genereren;
- een helder overzicht geeft van welke doelen gedekt zijn en welke niet (dekkings- en gap-analyse);
- leerkrachten toelaat elkaars plannen te bekijken en op elkaar af te stemmen, binnen ingestelde rechten.

### 2.3 Scope

#### Binnen scope (deze versie)

- Inlezen van thema's en activiteiten; inladen van de leerplandoelen vanuit Op.stap.
- AI-koppeling thema's ↔ doelen en AI-generatie van het jaarplan per klas.
- Flexibele kalender met drag-and-drop en manuele bewerking.
- (Her)generatie, dekkingsoverzicht, samenwerking en export.
- Gebruikersbeheer met rollen en rechten.
- Een ontwikkelingsrapport per kind voor de derde kleuter (FR-13, toegevoegd op 14-09-2026).
- De kat: een AI-agent die uit zichzelf opmerkt wat aandacht vraagt in een klas, een vervanger briefingt en lesvoorbereidingen maakt (FR-14, toegevoegd op 18-09-2026).

#### Buiten scope (mogelijk latere fase)

- Opvolging en rapportering op leerlingniveau, **behalve het ontwikkelingsrapport van de derde kleuter** (FR-13, toegevoegd op 14-09-2026, [ADR-0035](adr/0035-ontwikkelingsrapport-derde-kleuter.md)). Daarbuiten blijft het buiten scope: niets volgt een kind van het ene schooljaar of de ene klas naar de volgende.
- Integratie met bestaande schooladministratie- of leerlingvolgsystemen (bv. Smartschool, Informat).
- Toegang voor ouders of leerlingen.
- Evaluatie en puntenbeheer, behalve de sterren van het ontwikkelingsrapport (FR-13). Een ster is een label, geen punt: er komen geen totalen, gemiddelden of vergelijkingen tussen kinderen of klassen.

### 2.4 Definities en begrippen

| Begrip | Omschrijving |
| --- | --- |
| Op.stap (leerplan) | Het nieuwe leerplan voor het katholiek basisonderwijs van Katholiek Onderwijs Vlaanderen ("Op.stap, leerroutes voor iedereen"). Bevat de leerplandoelen én de decretale minimumdoelen, plus leerroutes. |
| Minimumdoel (MD) | Een door de Vlaamse overheid decretaal vastgelegd doel (eindterm); letterlijk opgenomen in Op.stap en verankerd op een mijlpaal: einde derde kleuterklas (K-), vierde leerjaar (4-) of zesde leerjaar (6-). |
| Leerplandoel | Een doel uit Op.stap met een unieke code; draagt bij aan een minimumdoel of vult het aan. Geordend per jaar/fase en per (sub)domein. |
| Doelsoort | Het type leerplandoel: MD (minimumdoel), G (gemeenschappelijk), + (verdieping), P/S/A (illustratief: precurriculum, specifiek, anderstalige nieuwkomers). |
| Concordantie | De koppeling tussen leerplandoelen en minimumdoelen, waardoor dekking ook op minimumdoelniveau zichtbaar wordt. |
| Discipline / domein | In Op.stap zijn de doelen per discipline geordend (één Excelbestand per discipline) en verder ingedeeld in domein, subdomein en cluster. |
| Leerroute | Een door Op.stap aangereikt traject dat ondersteunt bij het ontwerpen, uitvoeren en evalueren van onderwijs. |
| Thema | Een overkoepelend onderwerp waarrond gewerkt wordt, bv. "De herfst", "Bij de dokter", "De ruimte". |
| Subthema | Een onderdeel van een thema. |
| Activiteit | Een concrete les of opdracht binnen een (sub)thema. |
| Jaarplan | De spreiding van thema's en doelen over het schooljaar, voor één klas. |
| Planningsblok | Een tijdseenheid in de kalender: maand, week of themaperiode (te kiezen). |
| Dekking | De mate waarin de leerplandoelen (en via concordantie de minimumdoelen) door het jaarplan afgedekt zijn. |

## 3. Gebruikers en rollen

### 3.1 Rollen

> **Verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten).** De tool kent geen functietitels meer, maar rechten: admin, themabeheer, hoofdleerkracht (per schooljaar en per jaar/fase) en leerkracht (per klas; een klas kan meerdere leerkrachten hebben). Er is geen aparte rol voor de ICT-coördinator. De opsomming hieronder is de getrouwe v0.4-tekst.

- **Beheerder (directie / ICT-coördinator)** — werkt vanuit de beheerpagina: stelt schooljaren, klassen, leerkrachten en rechten in, beheert het inladen van de Op.stap-leerplandoelen, heeft zicht op alle jaarplannen en trekt schoolbrede en per-klas overzichten (zie FR-9 en FR-12).
- **Leerkracht** — beheert het jaarplan van de eigen klas(sen); voert thema's en activiteiten in of importeert ze; gebruikt de AI-suggesties; past de kalender manueel aan; kan plannen van collega's inkijken voor afstemming.
- **Zorgcoördinator / co-teacher (optioneel)** — leesrechten over meerdere klassen, eventueel beperkte bewerkrechten — ter beslissing. *(Verfijnd op 14-09-2026, [ADR-0035](adr/0035-ontwikkelingsrapport-derde-kleuter.md): een admin kan een gebruiker het recht **Leerlingzorg** geven. Wie het heeft, leest alle ontwikkelingsrapporten van de derde kleuter en wijzigt niets. Voor de rest geldt A.11.)*

### 3.2 Toegangsrechten

> **Vervangen door de beslissingen van 13-09-2026.** Deze tabel is vervangen door de tabel in [ADR-0030 §3](adr/0030-rollen-en-rechten-in-de-app.md#3-the-matrix-that-follows); de uitleg in gewone taal staat in [A.11](#a11-rollen-en-rechten). Ze blijft hieronder staan als de getrouwe v0.4-tekst, maar geldt niet meer. Zo voert een gewone leerkracht geen thema's meer in, importeert hij niet meer, en laat hij bij een thema geen AI-doelsuggesties maken of beoordelen.

Onderstaand voorstel is configureerbaar. "✓" = toegestaan, "–" = niet toegestaan, "lezen" = enkel inkijken.

| Actie | Beheerder | Leerkracht — eigen klas | Leerkracht — andere klas |
| --- | --- | --- | --- |
| Leerdoelen inladen/vernieuwen (overheidsbron) | ✓ | – | – |
| Klassen & leerkrachten beheren | ✓ | – | – |
| Thema's/activiteiten invoeren | ✓ | ✓ | – |
| AI-suggesties genereren | ✓ | ✓ | – |
| Jaarplan bewerken (drag-and-drop) | ✓ | ✓ | – |
| Jaarplan bekijken | ✓ | ✓ | lezen |
| (Her)genereren | ✓ | ✓ | – |
| Dekkingsoverzicht bekijken | ✓ | ✓ | lezen |
| Exporteren | ✓ | ✓ | lezen |

## 4. Gegevensmodel (functioneel)

Dit hoofdstuk beschrijft de belangrijkste "bouwstenen" van de tool in begrijpelijke taal, en hoe ze met elkaar samenhangen.

- Een schooljaar bevat meerdere klassen.
- Een klas heeft één jaarplan en is gekoppeld aan een leerjaar/leeftijdsgroep.
- De leerplandoelen komen uit het leerplan Op.stap (Katholiek Onderwijs Vlaanderen) en worden in de tool ingeladen; de school beheert de inhoud ervan niet. Elk leerplandoel heeft een unieke code, een doelsoort (MD, G, +, P, S, A), een ordening per jaar/fase (JK, K2, K3, L1–L6) en een plaats in de domein-/subdomein-/clusterstructuur.
- De minimumdoelen (de decretale eindtermen) zijn via een concordantie aan de leerplandoelen gekoppeld. Daardoor kan de dekking zowel op het niveau van de leerplandoelen als op het niveau van de minimumdoelen getoond worden.
- Een thema bevat één of meerdere subthema's en activiteiten.
- In het jaarplan worden thema's (met hun activiteiten) toegewezen aan planningsblokken (bv. maanden) en gekoppeld aan leerplandoelen.
- De koppeling thema ↔ leerplandoel kan door de AI voorgesteld en/of door de leerkracht bevestigd zijn. *(Verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten): bij een thema bevestigt een admin of wie themabeheer heeft.)*

## 5. Functionele requirements

De eisen zijn genummerd (FR-x). Per onderdeel volgt eerst een korte uitleg in gewone taal, daarna de concrete eisen.

### FR-1 — Import van thema's en activiteiten (Excel)

De school start met haar eigen, bestaande inhoud in Excel: thema's, subthema's en activiteiten. De tool laat toe die in te lezen in plaats van alles manueel in te voeren. De leerplandoelen worden hier niet ingelezen — die worden apart ingeladen vanuit het leerplan Op.stap (zie FR-2).

- **FR-1.1** — De gebruiker kan een Excel-bestand (.xlsx) opladen met thema's, subthema's en activiteiten. *(Verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten): dat zijn de admins en wie themabeheer heeft. De projecteigenaar besliste dat op 11-09-2026.)*
- **FR-1.2** — De tool valideert het bestand (verplichte kolommen aanwezig, geen lege verplichte velden) en toont duidelijke foutmeldingen per rij.
- **FR-1.3** — Vóór het definitief inlezen krijgt de gebruiker een voorbeeldweergave (preview) van wat geïmporteerd zal worden.
- **FR-1.4** — Bij herimport kan de gebruiker kiezen tussen toevoegen of bestaande gegevens bijwerken/overschrijven.
- **FR-1.5** — Een sjabloon (template) met de juiste kolomstructuur is downloadbaar, zodat duidelijk is hoe het bestand eruit moet zien.

### FR-2 — Leerplandoelen vanuit Op.stap (Katholiek Onderwijs Vlaanderen)

De doelen worden niet door de school opgesteld. De school volgt het leerplan "Op.stap, leerroutes voor iedereen" van Katholiek Onderwijs Vlaanderen. Dat leerplan bevat de leerplandoelen én de decretale minimumdoelen (de eindtermen van de Vlaamse overheid, letterlijk opgenomen) en stelt de doelen beschikbaar via een API van Katholiek Onderwijs Vlaanderen, en daarnaast als Excelbestand per discipline. *(Bijgewerkt 2026-09-11: de projecteigenaar besliste dat de API de bron is, zie ADR-0032.)*

- **FR-2.1** — De leerplandoelen en de decretale minimumdoelen worden ingeladen vanuit de Op.stap-API van Katholiek Onderwijs Vlaanderen, met behoud van de structuur: doelsoort, unieke code, jaar/fase, domein/subdomein/cluster en de concordantie met de minimumdoelen. Voorlopig worden enkel de gemeenschappelijke doelen (G) ingeladen. *(Bijgewerkt 2026-09-11, ADR-0032. Voorheen: vanuit de Op.stap-Excelbestanden, één bestand per discipline.)*
- **FR-2.2** — De tool herkent de doelsoort (MD = minimumdoel, G = gemeenschappelijk, + = verdieping, P/S/A = illustratief) en kan daarop filteren, bv. om enkel de minimumdoelen of enkel de gemeenschappelijke doelen te tonen. *(Noot 2026-09-13 bij ADR-0032, lezing van de ontwikkelaar, niet door de eigenaar bevestigd: de Op.stap-API levert MD niet als doelsoort van een leerplandoel; "enkel de minimumdoelen" wordt getoond via het minimumdoelenoverzicht.)*
- **FR-2.3** — De minimumdoelen worden via de concordantie aan de leerplandoelen gekoppeld, zodat zichtbaar is welke leerplandoelen naar een minimumdoel leiden. De dekking op minimumdoelniveau loopt via de themadoelen (zie FR-9.3).
- **FR-2.4** — De school past de officiële inhoud van de doelen niet aan; interne ordening en labels zijn wel mogelijk.
- **FR-2.5** — Wanneer Op.stap geactualiseerd wordt, kunnen de doelen opnieuw ingeladen worden; bestaande jaarplannen worden niet automatisch overschreven, maar de tool signaleert wat herbekeken moet worden.

> Opmerking: naast de leerplandoelen voorziet Op.stap ook leerroutes — trajecten die ondersteunen bij het ontwerpen, uitvoeren en evalueren van onderwijs. Het inkapselen van die leerroutes is optioneel en kan een latere uitbreiding zijn (zie hoofdstuk 9).

### FR-3 — Beheer van thema's en activiteiten

Leerkrachten beheren hun eigen inhoudelijke bouwstenen: thema's, subthema's en de bijhorende activiteiten.

- **FR-3.1** — Leerkrachten kunnen thema's, subthema's en activiteiten toevoegen, wijzigen en verwijderen. *(Verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten), en dat geldt ook voor de inleiding hierboven. Thema's beheren de admins en wie themabeheer heeft. Subthema's en subdoelen maken, wijzigen en verwijderen de admins en de hoofdleerkrachten van dat jaar. Elke leerkracht met een klas van die leeftijd past daarnaast de inhoud van de gedeelde activiteiten aan, maakt nieuwe activiteiten, en verwijdert een activiteit die hij zelf aanmaakte zolang er geen doelen aan gekoppeld zijn.)*
- **FR-3.2** — Een activiteit kan aan één of meerdere leerdoelen gekoppeld worden.
- **FR-3.3** — Thema's kunnen herbruikt worden over klassen heen (gedeelde themabibliotheek), zonder dat een wijziging in de ene klas de andere ongewenst beïnvloedt — gedeeld dan wel per klas: ter beslissing.

### FR-4 — AI-matching: thema's ↔ leerdoelen

Dit is de kern van de tool: de AI stelt voor welke thema's en activiteiten bij welke leerdoelen passen.

- **FR-4.1** — De tool stelt per thema/activiteit voor met welke leerdoelen het overeenkomt. *(Verfijnd door de beslissing van 16-09-2026, [ADR-0052](adr/0052-doelsuggesties-zijn-minimumdoelen.md): bij een thema stelt de AI alleen minimumdoelen voor als themadoel; een aanvaard voorstel wordt een themadoel, een geweigerd komt niet terug. Leerplandoelen komen via de subthema's.)*
- **FR-4.2** — Elke suggestie krijgt een korte motivatie ("waarom past dit doel hier?") zodat de leerkracht ze kan beoordelen.
- **FR-4.3** — De leerkracht kan elke suggestie aanvaarden, weigeren of aanpassen. *(Verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten): voor de doelsuggesties bij een thema zijn dat de admins en wie themabeheer heeft, en enkel zij laten ze ook maken. Dat geldt ook voor "de leerkracht" in FR-4.2.)*
- **FR-4.4** — De tool toont welke leerdoelen (nog) niet aan een thema gekoppeld zijn.
- **FR-4.5** — (Optioneel) De tool toont een zekerheids-/betrouwbaarheidsindicatie per suggestie.

### FR-5 — AI-generatie van het jaarplan

Op basis van de doelen, thema's en activiteiten stelt de tool een volledig jaarplan per klas voor.

- **FR-5.1** — De tool genereert per klas een voorstel van jaarplan: thema's met hun doelen verspreid over de planningsblokken (bv. maanden) van het schooljaar.
- **FR-5.2** — De spreiding houdt rekening met het aantal beschikbare blokken, een logische volgorde (bv. seizoensgebonden thema's in het juiste seizoen) en een evenwichtige verdeling van de leerdoelen.
- **FR-5.3** — De generatie streeft naar volledige dekking van de leerdoelen over het volledige schooljaar.
- **FR-5.4** — De leerkracht kan parameters meegeven vóór generatie (bv. vakanties, vaste momenten, gewenste startthema's).

### FR-6 — Kalender-/agendaweergave met drag-and-drop

Het jaarplan wordt visueel getoond als een agenda over het schooljaar, die de leerkracht naar eigen inzicht kan herschikken.

- **FR-6.1** — Het jaarplan wordt getoond als een kalender/agenda over het schooljaar.
- **FR-6.2** — De leerkracht kan thema's en activiteiten verslepen (drag-and-drop) tussen periodes.
- **FR-6.3** — De weergave kan geschakeld worden tussen niveaus (bv. jaaroverzicht en maandweergave) — exacte niveaus ter beslissing.
- **FR-6.4** — Knelpunten worden visueel gesignaleerd (bv. een blok met te veel inhoud, of een doel dat nergens voorkomt).
- **FR-6.5** — Wijzigingen worden direct opgeslagen en weerspiegeld in het dekkingsoverzicht.

### FR-7 — Manuele aanpassingen

De leerkracht behoudt altijd de volledige controle; alles wat de AI voorstelt kan handmatig overschreven worden.

- **FR-7.1** — Alles wat de AI voorstelt, kan manueel overschreven worden.
- **FR-7.2** — De leerkracht kan thema's, activiteiten en doelkoppelingen handmatig toevoegen, verplaatsen of verwijderen, los van de AI. *(Verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten). In het jaarplan van de eigen klas blijft dit zo. Welke doelkoppelingen een leerkracht zelf legt, hangt af van waar ze aan hangen: op een thema doen dat een admin en wie themabeheer heeft; op een gedeelde activiteit of een subdoel een admin en de hoofdleerkrachten van dat jaar (de leerkrachten van die leeftijd bewerken daar enkel de inhoud); op een algemene fiche de leerkracht van die klas. De Excel-import, en de thema-opbouwwizard voor een thema dat in de wizard van nul wordt opgebouwd, leggen voor een admin en wie themabeheer heeft ook koppelingen op themadoelen en subdoelen.)*
- **FR-7.3** — Manuele wijzigingen blijven behouden bij een latere gedeeltelijke hergeneratie (zie FR-8) — precieze regel voor behoud/overschrijven: ter beslissing.

### FR-8 — (Her)generatie

De leerkracht kan de AI opnieuw laten werken, in zijn geheel of gericht op één periode.

- **FR-8.1** — De leerkracht kan het volledige jaarplan opnieuw laten genereren.
- **FR-8.2** — De leerkracht kan één afzonderlijke maand/periode opnieuw laten genereren, zonder de rest te wijzigen.
- **FR-8.3** — Vóór het toepassen van een (her)generatie toont de tool wat er zal veranderen, met de mogelijkheid om te annuleren.
- **FR-8.4** — De leerkracht kan handmatig vastgezette ("vergrendelde") blokken uitsluiten van hergeneratie.

### FR-9 — Dekkingsoverzicht en gap-analyse

Voor de directie cruciaal: aantonen dat élk doel ergens in het jaar aan bod komt — zowel op het niveau van de leerplandoelen als, via de concordantie, op het niveau van de minimumdoelen.

- **FR-9.1** — De tool toont per klas welke leerplandoelen gedekt zijn en welke (nog) niet, in twee stappen: de **dekkingsprognose** (het doel staat op een thema of subthema) en de **dekking** (dat thema of subthema staat in de agenda van de klas). *(Verfijnd door de beslissingen van 16-09-2026, [ADR-0047](adr/0047-dekkingsprognose-en-dekking.md).)*
- **FR-9.2** — De tool toont het dekkingspercentage en een lijst van de ontbrekende doelen; er kan gefilterd worden op doelsoort (bv. enkel de minimumdoelen).
- **FR-9.3** — De tool toont ook de dekking op minimumdoelniveau, het niveau waarop de onderwijsinspectie toetst. Een minimumdoel telt via het thema waarop het als themadoel staat, niet via de concordantie. *(Verfijnd door de beslissingen van 16-09-2026, [ADR-0047](adr/0047-dekkingsprognose-en-dekking.md).)*
- **FR-9.4** — De directie kan via de beheerpagina schoolbrede en per-klas overzichten trekken (dekking en voortgang over alle klassen/leerjaren heen — zie FR-12).
- **FR-9.5** — Het dekkingsoverzicht is exporteerbaar als bewijs van dekking.

### FR-10 — Samenwerking en afstemming

Leerkrachten moeten op elkaar kunnen afstemmen, maar wel binnen duidelijke toegangsgrenzen.

- **FR-10.1** — Leerkrachten kunnen de jaarplannen van collega's bekijken (volgens hun rechten) om op elkaar af te stemmen.
- **FR-10.2** — De zichtbaarheid is instelbaar (bv. enkel binnen dezelfde graad, of schoolbreed) — ter beslissing. *(Verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten). De projecteigenaar besliste op 11-09-2026 dat een leerkracht andere klassen kan inkijken en dat de directie (nu: admin) alles ziet, en op 15-09-2026 welke: een leerkracht kijkt de klassen van de eigen jaarfase in, een hoofdleerkracht die van de jaarfase waarvoor ze aangesteld is, wie themabeheer heeft alle klassen, en wie geen recht heeft geen enkele, behalve de klas van een lopende vervanging (FR-14.2, [ADR-0040](adr/0040-klassen-inkijken-per-jaarfase.md)). Enkel lezen. Dat wordt op één plaats beslist, zodat een andere keuze van de directie maar één plek raakt. De bevestiging blijft aan de directie: vraag 4 in [`besluiten-gevraagd.md`](besluiten-gevraagd.md).)*
- **FR-10.3** — (Optioneel) Mogelijkheid om opmerkingen achter te laten of thema's te delen tussen klassen.

### FR-11 — Export en rapportering

Het jaarplan en de dekking moeten buiten de tool bruikbaar zijn — voor de klassenmap, de directie of de inspectie.

- **FR-11.1** — Een jaarplan is exporteerbaar (bv. PDF en/of Excel) voor afdruk, klassenmap of inspectie.
- **FR-11.2** — Het dekkingsoverzicht is exporteerbaar.

### FR-12 — Beheerpagina: klassen instellen en overzichten

De beheerder/directie werkt vanuit een centrale beheerpagina (admin). Daar worden schooljaren, klassen, leerkrachten en rechten ingesteld, en van daaruit worden de schoolbrede en per-klas overzichten getrokken.

- **FR-12.1** — De beheerder kan schooljaren aanmaken en de vakantie-/periodestructuur instellen.
- **FR-12.2** — De beheerder kan klassen aanmaken en beheren (naam, leerjaar), leerkrachten eraan koppelen en rechten toekennen. *(Verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten). Dit doet wie het adminrecht heeft. Een klas kan meerdere leerkrachten hebben en een leerkracht meerdere klassen. Een admin stelt per schooljaar en per jaar/fase één of meer hoofdleerkrachten aan, en geeft themabeheer en het adminrecht aan wie die kiest: dit punt laat de beheerder rechten toekennen, en de beheerder is wie het adminrecht heeft. Een klas krijgt sinds 30-08-2026 een jaar/fase in plaats van een leerjaar, zie [ADR-0025](adr/0025-subthema-per-leeftijd.md).)*
- **FR-12.3** — Vanuit de beheerpagina kan de directie schoolbrede en per-klas overzichten en rapporten trekken (o.a. dekking en voortgang over alle klassen/leerjaren heen — zie FR-9) en exporteren.
- **FR-12.4** — Een jaarplan van een vorig schooljaar kan als basis gekopieerd worden naar een nieuw jaar — al dan niet in de eerste versie: ter beslissing.

### FR-13: Ontwikkelingsrapport (derde kleuter)

*Toegevoegd op 14-09-2026, op beslissing van de projecteigenaar ([ADR-0035](adr/0035-ontwikkelingsrapport-derde-kleuter.md)). De bindende regels staan in [`CONSTITUTION.md` Art. VI.7 en IX.4](../CONSTITUTION.md#article-vi--roles-privacy--security). De directie heeft dit nog niet bevestigd (vraag 15 in [`besluiten-gevraagd.md`](besluiten-gevraagd.md)).*

Drie keer per schooljaar schrijven de leerkrachten van de derde kleuter een ontwikkelingsrapport per kind. De ouders krijgen het als PDF- of Word-bestand. Dit is het enige deel van de tool dat gegevens over kinderen bevat.

- **FR-13.1**: Een leerkracht van een K3-klas voert de kinderen van zijn klas met de hand in, één per één, met voornaam en achternaam. De tool heeft geen andere velden over een kind. Wat de leerkracht in de teksten schrijft, is vrije tekst.
- **FR-13.2**: Elke K3-leerkracht beheert één gedeelde set **rapportdoelen** voor heel K3. Een rapportdoel heeft een titel en bundelt subdoelen uit de eigen thema's. Elke K3-leerkracht beheert ook één **sterrenschaal** voor heel K3: elke gradatie heeft een label en een kleur. Set en schaal gelden altijd, niet per schooljaar, dus een wijziging werkt ook door op oude rapporten. Alleen de K3-leerkrachten passen ze aan; de directie kan ze bekijken.
- **FR-13.3**: Per kind zijn er drie vaste evaluatiemomenten. Per moment kiest de leerkracht voor elk rapportdoel een ster en schrijft hij er een tekst bij. Per moment schrijft hij ook een algemeen besluit.
- **FR-13.4**: De leerkracht kan de tekst bij een rapportdoel en het algemene besluit laten herwerken door AI.
  - Alleen die tekst gaat naar de AI. Voor hij vertrekt, worden de namen van de kinderen van de klas vervangen. De leerkracht krijgt een melding dat een bijnaam of een andere naam niet vervangen wordt.
  - Hij aanvaardt het voorstel, past het aan of weigert het. Een weigering wordt bewaard, zonder de voorgestelde tekst.
- **FR-13.5**: Per moment kan de leerkracht een kindtekening toevoegen, als foto of scan. De tool verwijdert de metagegevens van de foto, zoals de plaats waar ze genomen werd.
- **FR-13.6**: Het rapport is te downloaden als PDF en als Word, in een nieuw ontwerp. De ouder ziet per rapportdoel de titel, de ster met zijn label en de tekst. De subdoelen ziet alleen de leerkracht, in de tool.
- **FR-13.7**: Wie de rapporten van een kind leest:
  - de leerkrachten van de klas;
  - de directie;
  - wie het recht Leerlingzorg heeft.

  Leerkrachten van andere klassen zien ze niet. Na het schooljaar kan de leerkracht de rapporten nog lezen, maar niet meer wijzigen.
- **FR-13.8**: De gegevens blijven bewaard tot de directie een schooljaar wist. De directie legt een concrete bewaartermijn vast in het verwerkingsregister, en de beheerpagina toont welke schooljaren nog gegevens over kinderen bevatten en herinnert de directie eraan.
- **FR-13.9**: Een ontwikkelingsrapport telt nooit mee voor de dekking.
- **FR-13.10**: Het ontwikkelingsrapport krijgt een eigen tab in de linkerzijbalk: onderaan, in een nieuwe sectie, ver onder de fiches *(toegevoegd op 14-09-2026, op beslissing van de projecteigenaar, ADR-0035 R32)*. Alleen wie rapporten mag zien, ziet die tab *(een standaardkeuze, ADR-0035 D18)*.

### FR-14: De kat

*Toegevoegd op 18-09-2026, op beslissing van de projecteigenaar ([ADR-0057](adr/0057-vervanging-briefing-en-klasfiche.md) tot en met [ADR-0060](adr/0060-activiteitvoorstellen-op-een-aanbod-gat.md)). De bindende regels staan in [`CONSTITUTION.md` Art. IV.8 en VI.1](../CONSTITUTION.md#article-iv--ai-is-advisory-human-in-the-loop). De directie heeft dit niet bevestigd.*

De kat is een AI-agent die op de agenda van de kleuterleerkracht leeft en planlast vermindert. Hij merkt zonder AI op wat aandacht vraagt in een klas, en brengt wat helpt. Hij bereidt voor, maar beslist nooit: wat hij brengt, is een voorstel waarover een mens beslist.

- **FR-14.1**: Een admin legt een vervanging vast: de afwezige leerkracht, de klas, een begindatum, een einddatum (die mag openblijven) en de vervanger, een gebruiker van de school.
- **FR-14.2**: Tijdens de vervanging leest de vervanger de planning van die klas (jaarplan, agenda, dekking), de klasfiche, de lesvoorbereidingen en haar briefing. Ze wijzigt en beslist niets. De afwezige leerkracht behoudt haar rechten en zet de agenda achteraf recht: wat voorbij is en in de agenda staat, is gebeurd.
- **FR-14.3**: De vervanger ziet bij het openen van de klas eerst een briefing: de klasfiche, waar de klas staat (thema, subthema, onderzoeksvragen, woordenschat, woordweb), wat de voorbije dagen in de agenda stond, de komende schooldagen met hun lege momenten, en de subdoelen die nog niet aan bod kwamen. Informatie over een kind krijgt ze van de zorgcoördinator of de directie, en dat staat er zichtbaar bij.
- **FR-14.4**: Na de vervanging ziet de afwezige leerkracht eerst een terugkeerbriefing: wie haar verving, wat er in de agenda stond, welke lesvoorbereidingen er klaarlagen, en de vraag om weg te halen wat niet doorging.
- **FR-14.5**: De leerkrachten van een klas vullen een klasfiche in: dagritme, klasafspraken en rituelen, materiaal, praktische zaken. Er staat niets over een kind in.
- **FR-14.6**: Bij een geplande activiteit vraagt een leerkracht van de klas of een admin een lesvoorbereiding: doelen, instap, kern, afsluiting, materiaal, woordenschat, differentiatie en duur. Tijdens een vervanging maakt de kat ze uit zichzelf klaar: bij het vastleggen de eerste twee schooldagen, daarna elke avond de volgende.
- **FR-14.7**: De kat waarschuwt de leerkrachten van een klas wanneer een minimumdoel niet meer in de resterende lesweken past, en wanneer een thema afloopt terwijl een subthema ervan nog niet in de agenda staat.
- **FR-14.8**: Vijf schooldagen voor een thema start, stelt de kat twee à drie eigen activiteiten voor in de discipline waarvan het grootste deel van de leerplandoelen nergens in het aanbod van de klas zit (het aanbod-gat), elk met een voorgesteld moment. Past er niets in het thema, dan brengt hij niets.
- **FR-14.9**: De kat slaapt rechtsboven in een mandje. Zijn houding toont of er iets klaarligt, altijd met een label. Wie op hem klikt, opent zijn venster: bovenaan wat hij meebracht, daaronder een chat over de tool (FR-14.10). Hij meldt zich alleen in de app, hooguit enkele keren per dag.
- **FR-14.10**: In de chat legt de kat uit hoe de tool werkt, beantwoordt hij opzoekvragen over de eigen inhoud en doet hij voorstellen via de gewone voorstelflows. Hij wijzigt zelf niets en bewaart geen gesprek.
- **FR-14.11**: De kat is charmant in wat hij doet en volwassen in wat hij zegt, nooit in babytaal. Hij staat niet in een export of in een ontwikkelingsrapport.

## 6. Niet-functionele requirements

Dit zijn de kwaliteitseisen waaraan de tool moet voldoen, los van de concrete functies.

- **NFR-1** — Taal: de volledige gebruikersinterface is Nederlandstalig.
- **NFR-2** — Gebruiksvriendelijkheid: bruikbaar door leerkrachten zonder technische achtergrond; minimale training; een rustige, duidelijke interface.
- **NFR-3** — Performance: een jaarplan wordt binnen een redelijke tijd gegenereerd (richtwaarde: enkele tot tientallen seconden); de kalender reageert vlot.
- **NFR-4** — Beschikbaarheid & hosting: webtoepassing, bereikbaar via de browser, gehost in de cloud (bv. Microsoft Azure), zonder lokale installatie.
- **NFR-5** — Beveiliging: toegang via persoonlijke login; rolgebaseerde rechten; gegevens versleuteld tijdens transport en in opslag.
- **NFR-6** — Privacy (GDPR/AVG): de tool verwerkt in de eerste plaats curriculum- en personeelsgegevens (leerkrachtaccounts); géén gevoelige leerlinggegevens in de MVP, behalve in het ontwikkelingsrapport hieronder. Een verwerkingsregister en bewaartermijnen worden voorzien. *(Bijgewerkt op 14-09-2026, [ADR-0035](adr/0035-ontwikkelingsrapport-derde-kleuter.md).)*
  - Het ontwikkelingsrapport van de derde kleuter (FR-13) verwerkt wél gegevens over kinderen: voornaam, achternaam, de sterren, de teksten, het besluit en de kindtekeningen.
  - De teksten zijn vrije tekst en kunnen ook zorg- of gezondheidsinformatie bevatten (bijzondere gegevens, AVG art. 9).
  - Het verwerkingsregister en een concrete bewaartermijn moeten ook die gegevens dekken.
  - De projecteigenaar besliste dat echte gegevens mogen worden ingevoerd voordat het register en een effectbeoordeling (DPIA) er zijn. De school draagt die verantwoordelijkheid.
  - De klasfiche en de chat met de kat (FR-14) zijn vrije tekst over de klas en de tool. Beide zeggen zichtbaar dat er geen naam of informatie over een kind in hoort, en een chatgesprek wordt niet bewaard. *(Toegevoegd op 18-09-2026, [ADR-0059](adr/0059-de-kat-proactieve-agent.md).)*
- **NFR-7** — Browserondersteuning: recente versies van de courante browsers (Edge, Chrome, Firefox, Safari).
- **NFR-8** — Schaalbaarheid: ontworpen voor één school met meerdere klassen; uitbreidbaar naar meerdere scholen in een latere fase.
- **NFR-9** — Back-up & herstel: regelmatige back-ups van de gegevens.

## 7. AI-werking en kwaliteitsbewaking

- **Mens in de lus** — de AI stelt voor, de leerkracht beslist. Niets wordt zonder validatie als definitief beschouwd. *(Verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten): bij de doelsuggesties van een thema beslist een admin of wie themabeheer heeft.)* *(Bijgewerkt op 18-09-2026, FR-14: de kat bereidt ook uit zichzelf voor, zonder dat iemand erom vraagt, maar beslist nooit. Een antwoord in zijn chat verandert niets.)*
- **Transparantie** — elke AI-suggestie gaat gepaard met een korte motivatie. *(Behalve de herwerking van een tekst in het ontwikkelingsrapport, FR-13.4: daar ziet de leerkracht de oude en de nieuwe tekst naast elkaar, zonder motivatie. Bijgewerkt op 14-09-2026.)*
- **Brongegevens** — de AI werkt op basis van de door de school ingevoerde thema's en activiteiten en de leerdoelen van de overheid — niet op basis van externe, onbekende bronnen. *(Bij de herwerking van een tekst in het ontwikkelingsrapport krijgt de AI alleen die tekst, zonder de namen van de kinderen van de klas. Bijgewerkt op 14-09-2026.)* *(Bijgewerkt op 18-09-2026, [ADR-0058](adr/0058-lesvoorbereiding-per-plaatsing.md): inhoud zoals woorden, namen van thema's, activiteiten en lesvoorbereidingen mag de AI uit eigen kennis halen; elk doel dat hij noemt of koppelt, is een ingeladen Op.stap-doel.)*
- **Beperkingen** — AI-suggesties kunnen fouten of hiaten bevatten. De eindverantwoordelijkheid voor de correcte dekking ligt bij de leerkracht en de directie. De tool ondersteunt, maar vervangt geen pedagogische beoordeling.
- **Aandachtspunt** — verwerking van schoolgegevens door een AI-dienst gebeurt bij voorkeur binnen een Europese, AVG-conforme omgeving (bv. Azure AI Foundry met EU-datazone) — te bevestigen. *(Bijgewerkt 2026-09-16, ADR-0048, beslissing van de projecteigenaar: een omgeving met de Claude API is niet aan de EU gebonden.)*

## 8. Technische architectuur (indicatief)

Dit hoofdstuk is bestemd voor de ontwikkelaar en is indicatief. De directie hoeft dit niet in detail te valideren.

- **Frontend** — webtoepassing in een modern JavaScript-framework (React of Vue), met een interactieve kalender en drag-and-drop.
- **Backend** — een API in .NET (C#), verantwoordelijk voor de logica, de rechten en de communicatie met de AI-dienst.
- **Database** — PostgreSQL voor de opslag van schooljaren, klassen, leerplandoelen (met doelsoort, code, jaar/fase, domein en concordantie met de minimumdoelen), thema's, activiteiten en jaarplannen.
- **AI** — Azure AI Foundry of de Anthropic Claude API, per omgeving gekozen, voor het genereren van de doel-matching en de jaarplanning. *(Bijgewerkt 2026-09-16, ADR-0048, beslissing van de projecteigenaar: met de Claude API is de verwerking niet aan de EU gebonden.)*
- **Hosting** — Microsoft Azure.
- **Koppeling leerplandoelen** — de leerplandoelen en minimumdoelen worden door de backend ingeladen vanuit de Op.stap-API van Katholiek Onderwijs Vlaanderen en in de eigen databank bewaard; de tool raadpleegt de API nooit op het moment dat een leerkracht werkt. Wat een nieuwe versie verandert, wordt eerst ter controle getoond en pas na bevestiging doorgevoerd. *(Bijgewerkt 2026-09-11, ADR-0032. De Excel-import was het basismechanisme en is niet langer de bron. Bijgewerkt 2026-09-13, beslissing van de projecteigenaar: de Excel-import blijft beschikbaar tot de eerste import van de leerplandoelen via de API en weigert daarna elk bestand. Van doelen die via Excel buiten de gemeenschappelijke doelen (G) werden ingelezen, kan de tekst niet meer bijgewerkt worden; verdwijnt zo'n doel uit Op.stap, dan wordt het nog wel gemarkeerd.)*

### Vereenvoudigde gegevensstroom

Op.stap-doelen ophalen via de API van Katholiek Onderwijs Vlaanderen + Excel-upload van thema's/activiteiten → de backend valideert en bewaart in PostgreSQL → de backend roept de AI-dienst aan met de relevante gegevens → het resultaat (matching/jaarplan) wordt bewaard en getoond in de frontend → de leerkracht past aan → de wijzigingen gaan terug naar de database.

## 9. MVP-scope en fasering

De wens is om in de eerste versie alle functionaliteiten op te nemen ("one-shot"). Dat is haalbaar, maar de doorlooptijd is kort. Daarom leggen we hieronder vast wat absoluut essentieel is en wat eventueel als snelle vervolgrelease kan.

### 9.1 Essentieel (kern van de MVP)

- Import van thema's/activiteiten (FR-1), inladen van de leerplandoelen uit Op.stap (FR-2) en thema-/activiteitenbeheer (FR-3).
- AI-matching (FR-4) en AI-jaarplangeneratie (FR-5).
- Kalender met drag-and-drop (FR-6) en manuele bewerking (FR-7).
- (Her)generatie (FR-8) en dekkingsoverzicht (FR-9.1–9.2).
- Login, rollen en rechten; collega's kunnen plannen inkijken (FR-10.1).
- Beheerpagina: schooljaren en klassen instellen, leerkrachten en rechten, plus schoolbrede en per-klas overzichten (FR-12, FR-9.4).

### 9.2 Mogelijke snelle vervolgrelease

- Uitgebreidere rapportage en dashboards bovenop de basisoverzichten op de beheerpagina.
- Opmerkingen en delen van thema's tussen klassen (FR-10.3).
- Kopiëren van een jaarplan uit een vorig schooljaar (FR-12.4).
- Betrouwbaarheidsindicatie per AI-suggestie (FR-4.5) en uitgebreide exportlay-outs.
- Incorporeren van de Op.stap-leerroutes als extra ondersteuning bij het plannen (FR-2, opmerking).

### 9.3 Voorgestelde bouwvolgorde

1. Gegevensmodel + inladen van de Op.stap-leerplandoelen + import en beheer van thema's (de fundering).
2. AI-matching thema ↔ doel.
3. AI-jaarplangeneratie + kalenderweergave.
4. Drag-and-drop + manuele bewerking + (her)generatie.
5. Dekkingsoverzicht + export.
6. Beheerpagina (klassen/schooljaar, rollen/rechten) + schoolbrede en per-klas overzichten + samenwerking.

> Aanbeveling: hoewel naar een volledige eerste versie gestreefd wordt, beperkt een gefaseerde oplevering (kern eerst) het risico op de korte doorlooptijd en laat ze de school sneller met de tool starten.

## 10. Aannames

- De school levert haar bestaande thema's, subthema's en activiteiten aan in Excel.
- De school volgt het leerplan Op.stap van Katholiek Onderwijs Vlaanderen; de leerplandoelen en de decretale minimumdoelen worden ingeladen vanuit de Op.stap-API van Katholiek Onderwijs Vlaanderen (bijgewerkt 2026-09-11, ADR-0032).
- De tool wordt in de eerste versie door één school gebruikt.
- Er worden geen leerlinggegevens verwerkt in de MVP, behalve in het ontwikkelingsrapport van de derde kleuter (FR-13, bijgewerkt op 14-09-2026).
- De school beschikt over (of voorziet) de nodige cloud- en AI-omgeving (Azure).

## 11. Open vragen / beslissingen door de directie

Onderstaande punten bepalen mee de uitwerking. Antwoorden hierop laten toe deze analyse te verfijnen tot een definitieve versie.

- **Disciplines**: welke disciplines uit Op.stap nemen we mee in de eerste versie — alle, of een selectie om mee te starten?
- ~~**Op.stap-doelen ophalen**: importeren we de Excelbestanden manueel (download per discipline van de PRO.-site), of komt er een geautomatiseerde/online koppeling?~~ **Beslist door de projecteigenaar op 2026-09-11:** de Op.stap-API van Katholiek Onderwijs Vlaanderen, en voorlopig enkel de G-doelen (ADR-0032).
- **Ordening**: Op.stap ordent per jaar/fase (JK–L6) met minimumdoelen op mijlpalen (einde K3, L4, L6). Volgt de tool die ordening, en hoe gaan we om met graadklassen of menggroepen? *Voor de rechten voorlopig beantwoord door de beslissingen van 13-09-2026 (zie [A.11](#a11-rollen-en-rechten)): een graadklas geeft de rechten van haar ene jaar/fase. De directie is dit nog niet gevraagd; de vraag blijft van haar.*
- **Kalenderindeling**: in welke eenheden plannen leerkrachten — per maand, per week, per lesblok of per themaperiode?
- Hoeveel klassen en leerkrachten zijn er in de eerste versie?
- Zijn thema's gedeeld over de hele school (themabibliotheek) of strikt per klas?
- Zichtbaarheid tussen leerkrachten: schoolbreed, per graad, of beperkter? *Voorlopig beslist door de projecteigenaar op 11-09-2026 en 15-09-2026 (zie [A.11](#a11-rollen-en-rechten)): een leerkracht kijkt de klassen van de eigen jaarfase in, een hoofdleerkracht die van de jaarfase waarvoor ze aangesteld is, wie themabeheer heeft en een admin alle klassen. De bevestiging blijft een vraag voor de directie.*
- **Excel-structuur van de thema's/activiteiten**: welke kolommen bevatten de bestaande bestanden vandaag? (Bepaalt het importsjabloon voor FR-1.)
- **Overzichten**: welke schoolbrede en per-klas overzichten/rapporten heeft de directie nodig op de beheerpagina (bv. dekking per klas, per leergebied, schoolbreed; *welk leergebied hier bedoeld is, ligt niet vast: het leergebied/Wereldoriëntatie van de leerkrachten (Bijlage A.2) of het leergebied van het decreet (aangevuld 2026-09-14, TB-010). Dat is een vraag voor de directie*) en in welk exportformaat?
- **Exportformaten**: PDF, Excel of beide? Met welke lay-out (bv. voor inspectie of klassenmap)?
- **Hosting/AI**: akkoord met cloudhosting (Azure) en AI-verwerking binnen een EU-/AVG-conforme omgeving?
- Is meertaligheid later nodig (bv. voor anderstalige leerkrachten)?
- Wat wordt de definitieve naam van de tool?

## 12. Volgende stappen

- De directie bezorgt feedback en beantwoordt de open vragen (hoofdstuk 11).
- Op basis daarvan wordt deze analyse verfijnd tot versie 1.0, met een concrete planning en opleverdata.
- De bestaande Excel-bestanden (thema's/activiteiten) worden verzameld en de Op.stap-doelen worden via de API ingeladen als startgegevens.

---

## Bijlage A — Verfijningen op basis van Op.stap-referentiemateriaal (post-v0.4)

> Deze bijlage verfijnt hoofdstukken 1–12. **A.1 tot en met A.9** doen dat op basis van drie door de school aangeleverde bronnen: `assets/Op.stap_ordeningskader.pdf`, `assets/Uitwerken kennisrijk thema KLEUTER (Haike).pdf` en `assets/Verduidelijking Thema-Subthema-doelen.pdf`; hun onderbouwing en bronvermelding per punt staat in [`Gap-analyse_Opstap_referentie.md`](Gap-analyse_Opstap_referentie.md). **Vanaf A.10 kan een punt een andere herkomst hebben** (een eigenaars- of directiebeslissing), en dan vermeldt het punt die zelf; verwacht zo'n punt dus niet in de gap-analyse. Bij tegenspraak met de v0.4-tekst geldt deze bijlage. De verfijningen zijn verwerkt in [`CONSTITUTION.md`](../CONSTITUTION.md) (de bindende bron voor de bouw).

### A.1 Juridisch principe — wat ligt vast, wat is vrij
De Vlaamse overheid bepaalt **enkel** de minimumdoelen, de leerinhouden en dat scholen systematisch kennis opbouwen richting een leerlijn (kennisrijk curriculum). De overheid bepaalt **niet** welke thema's of subthema's een school kiest, noch hoe ze die organiseert — dat is **professionele autonomie**, en de inspectie toetst de themalaag niet. **Dekking wordt bewezen op minimumdoel-niveau, niet op themaniveau.** Dit verklaart waarom Op.stap-doelen read-only zijn en thema's volledig bewerkbaar.

### A.2 Correctie op de ordeningstaxonomie (vervangt de "domein/subdomein/cluster"-formulering)
Er zijn **twee onderscheiden structuren**:
1. **Ordeningskader** — officiële groeperingstaxonomie met exact drie niveaus: **`Discipline → Domein → Subdomein`**. Geen `cluster`, geen `leergebied` op dit niveau.
2. **Per-discipline doel-Excel** — de rijen leerplandoelen, met daarnaast `cluster` (**optioneel/nullable**), `code`, `jaarFase`, `voorbeelden`, `toelichting`, `woordenschat` en de `minimumdoelRef`-concordantie.

Regels: `cluster` is nullable; `subdomein`-namen zijn **niet globaal uniek** → groeperingssleutel `(domein, subdomein)`, rij-identiteit = `code`. `leergebied`/`Wereldoriëntatie` is leerkrachttaal, geen kaderniveau (enkel presentatiemapping). *Niet te verwarren met het **leergebied van het decreet** (aangevuld 2026-09-14, TB-010): het eerste niveau van de eigen ordening van een minimumdoel (`leergebied › rubriek › subrubriek`, uit het veld `path` van KOV), dat wél bewaard wordt, alleen-lezen is en enkel het minimumdoelenregister ordent ([`CONSTITUTION.md` Art. IX.1](../CONSTITUTION.md#ix1-curriculum-read-only-reference-data--art-iii)). Het is geen discipline en beantwoordt de open vraag over Wereldoriëntatie niet.*

### A.3 Disciplines (genummerd) — ontbrekende opsomming
`Discipline` draagt een **string-`nummer`** (bv. `"9.2"`) en een optionele `parentDiscipline`. Lijst: 1 Nederlands en communicatie · 2 Wiskunde · 3 Wetenschap en techniek · 4 Aardrijkskunde · 5 Geschiedenis · 6 Muzische vorming · 7 Lichamelijke opvoeding en motoriek · 8 ICT · 9.1 Veilige en gezonde levensstijl · 9.2 Leren leren · 9.3 Sociaal en emotioneel leren · 10 Frans · 11 Rooms-katholieke godsdienst.

### A.4 Rijker gegevensmodel voor de themalaag (verfijnt hoofdstuk 4 en FR-3)
- **Themadoel** — overkoepelende, **schoolbrede** doelen die een heel thema ankeren (verbreed/verdiept/herhaald), zonder maximum per thema. Een themadoel is een **minimumdoel**: het brengt de leerplandoelen mee die er via de concordantie naartoe leiden, op elke leeftijd. Apart van een doelkoppeling op een activiteit. *(Verfijnd door de beslissingen van 16-09-2026, [ADR-0046](adr/0046-themadoelen-zijn-minimumdoelen.md): tot dan was een themadoel een leerplandoel en had een thema er hoogstens drie.)*
- **Subdoel** — concreet, **leeftijdsgedifferentieerd** doel op niveau `(subthema × leeftijd)`, dat opbouwt richting de themadoelen. Thema's zijn **interdisciplinair**: subdoelen overspannen meerdere disciplines.
- **Rijke thema-attributen** — `duurWeken` (thema 4–6, subthema ±2), `probleemstelling` + `onderzoeksvraag` per subthema, `kernwoordenschat[]` + `rijkeWoordenschat[]`, een optioneel `activiteitType` (experiment, prentenboek, hoek, uitstap, spel, waarneming, beweging, onderzoek; zonder gekozen soort blijft het leeg), optionele `hoek` en `verwachteUitkomsten`.

### A.5 Schoolbreed vs. per klas — beslist per niveau (vervangt FR-3.3 als open binaire vraag)
**Schoolbreed gelijk:** thema, themadoelen, kernwoordenschat, kennisopbouw/leerlijn, welke minimumdoelen aan bod komen. **Per leeftijd:** subthema's, subdoelen, activiteiten, lessen. **Per klas:** de planning zelf (jaarplan, thema- en subthemaplaatsingen, dagplanning) en de hoeken. Eigendom: `Thema`/`Themadoel`/`kernwoordenschat` op schoolniveau (team/directie, gedeelde thema-bibliotheek); `Subthema`/`Subdoel`/`Activiteit` op leeftijdsniveau; `Hoek` op klasniveau. *(Wie wat mag aanpassen, is verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten): "team/directie" betekent voor een thema een admin en wie themabeheer heeft, niet elke leerkracht.)*

> **Bijgewerkt 2026-08-31 na [ADR-0025](adr/0025-subthema-per-leeftijd.md).** Deze alinea zei tot dan **"per klas/leeftijd"** voor subthema's, subdoelen en activiteiten, en dat is sinds 2026-08-30 niet meer waar: de klas is uit die scope verdwenen, zodat een subthema op K3 geldt voor élke klas die K3 geeft. *Wat per klas blijft, is de planning en niet de inhoud.* De hoeken staan er nu apart bij, want die zijn wél per klas: een hoek is meubilair in één lokaal, geen inhoud die een school één keer schrijft (eigenaarsvergadering 2026-08-30, F6/F7).
>
> **De wijziging van 2026-08-30 heeft dit bestand niet meegenomen, en Art. XI.1 eist dat wél in dezelfde change.** Elf dagen eerder was dezelfde eis wél nageleefd. Het gat is gevonden door een antagonist-audit, niet door een gate: er is niets dat een grondwetswijziging tegen de functionele analyse legt. Vandaar deze aparte alinea in plaats van een stille correctie.

### A.6 Planningsblok-granulariteit (verfijnt §2.4, FR-5, FR-6)
De pedagogische cadans is **themaperiode (4–6 wk)** en **subthemaperiode (~2 wk)**; deze lijnen niet zuiver uit op maandgrenzen. De "maand"-default uit v0.4 is dus geen vanzelfsprekendheid — de keuze blijft een open beslissing en wordt achter een duidelijke naad geïsoleerd. *(Verfijnd door de beslissingen van 16-09-2026, [ADR-0053](adr/0053-themaplaatsing-met-eigen-datums.md): er zijn geen planningsblokken meer in de planning. Een thema krijgt een eigen begindatum, die de leerkracht kiest, en een einddatum, die de tool voorstelt uit de duur van het thema in lesweken en die de leerkracht kan aanpassen. Twee thema's lopen nooit op dezelfde dag. Valt er een vakantie in, dan bewaart de tool het thema in delen. Wijzigen de vakanties, dan verschuift er niets: het thema krijgt een blijvende melding en de dekking staat op "te herzien". Het jaarplan is een tijdlijn per lesweek, met een jaarbalans (lesweken met en zonder thema) in plaats van "te vol" (FR-6.4). Een vast moment houdt geen plaatsing meer tegen. Het genereren (FR-5, FR-8) staat uit tot het voor datums herwerkt is.)* *(Verfijnd door de beslissingen van 17-09-2026, [ADR-0055](adr/0055-ai-jaarplan-met-datums.md): het genereren staat weer aan. De AI kiest thema's en voor elk een startweek; de tool zet het thema op de eerste vrije schooldag vanaf die week, stelt het einde voor zoals bij een manuele plaatsing en deelt het rond vakanties. Wat niet past, meldt de tool. Opnieuw genereren gebeurt voor het hele jaar en vervangt alleen open voorstellen. **FR-8.2** (één periode opnieuw genereren) en **FR-5.4** (parameters vooraf: vaste momenten, gewenste startthema's) vervallen; de vakanties komen uit het schooljaar.)*

### A.7 Doel-eerst authoringworkflow (verfijnt FR-3/FR-4) — **MVP-feature**
De "thema-opbouw wizard" volgens de 10-stappenmethode is een **vaste MVP-feature** (niet optioneel): (1) sterk thema → (2) themadoelen → (3) brainstorm → (4) subthema's (~2 wk) → (5) onderzoeksvragen → (6) subdoelen uit meerdere leergebieden → (7) rijk aanbod → (8) woordenschat → (9) samenhang → (10) reflectie. AI-assistentie (FR-4) plugt in op stap 2 (themadoelen) en stap 6 (subdoelen). *(Verfijnd door de beslissingen van 13-09-2026, zie [A.11](#a11-rollen-en-rechten): de wizard is voor wie themabeheer heeft, en voor een admin. Subthema's, subdoelen en activiteiten maakt die er enkel aan voor een thema dat hij in de wizard van nul opbouwt.)* *(Verfijnd door de beslissingen van 15-09-2026, [ADR-0043](adr/0043-eigen-woordweb-per-subthema.md): de brainstorm van stap 3 is een **woordweb**, losse woorden rond een subthema. Elke leerkracht heeft er per subthema een eigen woordweb, dat haar over de schooljaren volgt en dat collega's kunnen inzien maar niet wijzigen. Staat er al een eigen woord in, dan stelt de AI er woorden bij voor, elk met een korte motivatie, en de leerkracht aanvaardt of weigert elk woord. Het woordweb staat bij het subthema; of de wizard het ook toont, beslist E6-05. Het telt niet mee voor de dekking.)* *(Verfijnd door de beslissingen van 16-09-2026, [ADR-0050](adr/0050-ai-plaatst-leerplandoelen-in-subthemas.md): op de themapagina stelt de AI voor waar de leerplandoelen van de themadoelen passen, als subdoel van een bestaand subthema van die leeftijd of in een nieuw subthema met een naam en een onderzoeksvraag die de AI zelf bedenkt. De hoofdleerkracht van die jaarfase en een admin vragen de voorstellen en beslissen erover, één per één; pas een aanvaard voorstel wordt een subdoel of een subthema.)* *(Verfijnd door de beslissingen van 17-09-2026, [ADR-0056](adr/0056-ai-stelt-activiteiten-voor.md): bij stap 7 stelt de AI onder een subthema activiteiten voor die aan de subdoelen van dat subthema werken, met een naam, soort, verwachting en lengte die de AI zelf bedenkt, zonder lesmateriaal. Wie een eigen activiteit mag maken, vraagt de voorstellen; alleen zij en een admin zien ze en beslissen erover, en een aanvaard voorstel wordt de eigen activiteit van wie het vroeg.)*

### A.8 Bijkomende open vragen
Zie de bijgewerkte open-beslissingenlijst in [`CONSTITUTION.md` Art. XIV](../CONSTITUTION.md#article-xiv--open-decisions-awaiting-directie): aanwezigheid van `cluster` per discipline, `leergebied`/Wereldoriëntatie-mapping, dekkingsdiepte (binair vs. herhaling/opbouw), en de vorm van `jaarFase`-codes (1K/2K/3K ↔ JK/K2/K3).

### A.9 Nieuwe begrippen
De glossary (§2.4) wordt aangevuld met: Discipline (genummerd), Leergebied/Wereldoriëntatie, Themadoel, Subdoel, Onderzoeksvraag/probleemstelling, Kernwoordenschat vs. rijke woordenschat, Rijk aanbod/activiteittype, Hoek, Themaperiode/subthemaperiode, Leerlijn (verticale samenhang, ≠ leerroute), Professionele autonomie, Kennisrijk curriculum/kennisrijk thema. Definities: zie [`CONSTITUTION.md` Art. XII](../CONSTITUTION.md#article-xii--glossary-nl--en). *Aangevuld 2026-09-14 (TB-010):* leergebied van het decreet (≠ Leergebied/Wereldoriëntatie), rubriek en subrubriek, en de soort van een minimumdoel (te bereiken op individueel niveau, te bereiken op populatieniveau, na te streven op populatieniveau).

### A.10 FR-7.3's *"ter beslissing"* is voorlopig beantwoord (projecteigenaar, 19-08-2026)
FR-7.3 laat de precieze regel voor **behoud/overschrijven** bij een (her)generatie open. Die regel is op 19-08-2026 door de **projecteigenaar** beslist en staat sindsdien in [`CONSTITUTION.md` Art. IX.3](../CONSTITUTION.md#article-ix--core-data-model-functional): een (her)generatie verwijdert **enkel** een plaatsing die `Voorgesteld` is **en** niet `vergrendeld`. Een plaatsing waarover de leerkracht zelf beslist heeft (`Aanvaard`, `Geweigerd` of `Manueel`) blijft staan **zonder** slot, en een hergeneratie van één periode werkt op dezelfde voorwaarden: die versmalt **welke blokken** bezocht worden, nooit **wat vervangbaar is**.

**Eén randgeval hoort bij de regel en niet in een voetnoot**, want de directie bekrachtigt hem: sleept een leerkracht een kaartje binnen dezelfde periode, dan schrijft de tool niets weg. Zo'n plaatsing blijft `Voorgesteld` en verdwijnt dus wél bij een hergeneratie, ook al heeft de leerkracht ze aangeraakt. Daarom staat het predicaat hier letterlijk en niet als *"een onaangeroerd voorstel"*, wat de verleidelijke maar onware parafrase is. Uitgelegd voor de directie in vraag 6 van [`besluiten-gevraagd.md`](besluiten-gevraagd.md).

**Voorlopig, en dat woord is niet decoratief.** FR-7.3 behoudt deze beslissing voor aan de **directie**, en hun bevestiging staat open (vraag 6). Ze is toch al vastgelegd omdat het de behoudende van de twee opties is: er kan niets op gebouwd worden dat werk van een leerkracht vernietigt. Draait de directie ze om, dan wijzigen Art. IX.3 en de leerkrachtgerichte zinnen die onder E4-07 opgesomd staan samen.

**Wat dit betekent voor FR-8.4** (§5, dat hierbij verfijnd wordt): dat punt belooft dat een leerkracht *"vastgezette (vergrendelde) **blokken**"* kan uitsluiten van hergeneratie. Het mechanisme is fijner en enger dan dat: vergrendelen gebeurt **per plaatsing**, niet per blok, en het verandert alleen iets aan de uitkomst van een hergeneratie, en dan nog alleen voor een plaatsing die nog `Voorgesteld` is. Op een besliste plaatsing is het slot een label.

*Waarom dit hier staat en niet enkel in de constitutie:* Art. XI.1 vereist dat een amendement zijn afhankelijke tekst in dezelfde wijziging meeneemt, en de clausule in kwestie is **FR-7.3 in §5**, die *"ter beslissing"* blijft lezen. *(Niet §11: de open-vragenlijst daar heeft dit punt nooit bevat, en juist dat is waarom het elders voor een Art. XIV-item is aangezien.)* De v0.4-tekst wordt niet aangepast, want die is een getrouwe weergave; deze bijlage is de plek om hem te verfijnen, en bij tegenspraak geldt de bijlage.

> *Herkomst, apart vermeld omdat deze bijlage er een heeft.* Bijlage A verzamelde tot nu toe verfijningen uit het Op.stap-referentiemateriaal. A.10 komt niet daaruit maar uit een eigenaarsbeslissing van 19-08-2026, en staat hier omdat dit de enige plek is waar de v0.4-tekst verfijnd kan worden zonder hem te herschrijven. Zie de versietabel in §1.

### A.11 Rollen en rechten

*Herkomst: beslissingen van de projecteigenaar van 11-09-2026, 13-09-2026 en 14-09-2026, niet het Op.stap-referentiemateriaal. Door de projecteigenaar bekrachtigd op 14-09-2026.* De **projecteigenaar** besliste dit in een reeks vragen. De letterlijke vragen, en de gekozen en afgewezen antwoorden, staan in [ADR-0030 §1](adr/0030-rollen-en-rechten-in-de-app.md). De bindende tekst staat in [`CONSTITUTION.md` Art. VI.1](../CONSTITUTION.md#article-vi--roles-privacy--security). Dit punt verfijnt §3.1, §3.2, §4, FR-1.1, FR-3.1, FR-4.3 (en daarmee FR-4.2), FR-7.2, FR-10.2, FR-12.2, §7, §11, A.5 en A.7. Bij elk van die punten staat een verwijzing hierheen, behalve bij FR-4.2: dat wordt meegenomen in de verwijzing bij FR-4.3.

**Rechten, geen functietitels.** Enkel wie een admin toevoegde, kan aanmelden, met een Microsoft-account van de eigen schooltenant. Welke rechten iemand heeft, houdt de tool zelf bij, niet Entra. Er zijn vijf rechten, en één persoon kan er meerdere hebben. *(Vier sinds 13-09-2026; Leerlingzorg kwam erbij op 14-09-2026.)*

- **Admin** ziet en bewerkt alles. Een admin voegt gebruikers toe, koppelt leerkrachten aan klassen, stelt hoofdleerkrachten aan en geeft themabeheer, zoals FR-12.2 de beheerder laat doen; de beheerder is wie het adminrecht heeft. Een admin kan het adminrecht aan iemand anders geven en weer afnemen, dus meerdere gebruikers kunnen admin zijn. **Admin is een recht, geen functie:** de directeur of een ICT-coördinator die de app beheert, heeft het adminrecht omdat een admin het toekende, en is anders een gewone gebruiker ([ADR-0061](adr/0061-de-rol-directie-heet-admin.md)).
- **Themabeheer** hebben enkele leerkrachten of zorgcoördinatoren die een admin aanduidt. Wie het heeft, past thema's aan (met hun themadoelen en kernwoordenschat) en voert de Excel-import van thema's en activiteiten uit (FR-1), met de doelkoppelingen op themadoelen en subdoelen die daarin staan. Alleen een admin mag bij de import aanvinken dat ook menselijke beslissingen verwijderd worden: met die ene schakelaar wist een nieuwe import ook besliste themadoelen en subdoelen die niet meer in het bestand staan. Hij doorloopt ook de thema-opbouwwizard helemaal. Voor een thema dat hij daar van nul opbouwt, maakt hij in de wizard, en alleen met de eigen acties van de wizard, ook de subthema's, subdoelen en activiteiten aan, op elke leeftijd. Bestaande subthema's aanpassen blijft voor de hoofdleerkracht. Naast admin is dit het enige recht waarmee iemand **doelsuggesties** laat maken en ze aanvaardt, weigert of aanpast.
- **Hoofdleerkracht** is een gebruiker die een admin aanstelt per schooljaar en per jaar/fase; een jaar kan er meerdere hebben (bv. bij een duobaan). Een hoofdleerkracht maakt, wijzigt en verwijdert de subthema's van zijn jaar (wie een subthema verwijdert, verwijdert ook de activiteiten en doelkoppelingen eronder, zoals vandaag) en de subdoelen. Hij koppelt met de hand doelen aan de gedeelde activiteiten, past hun inhoud aan, maakt nieuwe en verwijdert elke activiteit, met of zonder doelkoppelingen. Thema's past hij enkel aan als hij ook themabeheer heeft.
- **Leerkracht** ben je van de klassen waaraan een admin je koppelt. Een klas kan meerdere leerkrachten hebben (co-teacher, duobaan). Een leerkracht bewerkt de planning van zijn klassen: jaarplan, (her)generatie, agenda, hoeken en algemene fiches. De andere klassen van zijn eigen jaarfase kan hij inkijken, die van een andere jaarfase niet (15-09-2026, [ADR-0040](adr/0040-klassen-inkijken-per-jaarfase.md)). Wie een klas van een bepaalde leeftijd heeft, past de **inhoud** van de gedeelde activiteiten onder de subthema's van die leeftijd aan, maakt er **eigen activiteiten** (hieronder) en past de **streefwoordenschat** van die subthema's aan. Een gedeelde activiteit die hij **zelf aanmaakte**, mag hij verwijderen zolang er geen doelen aan gekoppeld zijn. **Met de hand doen subdoelen, doelkoppelingen op gedeelde activiteiten, een gedeelde activiteit aanmaken en andere gedeelde activiteiten verwijderen enkel de admins en de hoofdleerkrachten van dat jaar**, want een doelkoppeling daar telt voor de dekking van elke klas van die leeftijd die het thema plant. De enige uitzonderingen zijn die van themabeheer: de import, en de wizard voor een thema dat daar van nul wordt opgebouwd. De rest van het subthema blijft voor de admins en de hoofdleerkracht, behalve wat de wizard voor zo'n thema aanmaakt.
- **Leerlingzorg** *(toegevoegd op 14-09-2026, [ADR-0035](adr/0035-ontwikkelingsrapport-derde-kleuter.md))* geeft een admin aan wie die kiest, bijvoorbeeld een zorgcoördinator. Wie het heeft, leest alle ontwikkelingsrapporten van de derde kleuter (FR-13) en wijzigt niets. De rapporten zelf vallen buiten het inkijken van andere klassen: een leerkracht leest alleen de rapporten van zijn eigen klas.

**De maker van een activiteit.** De tool onthoudt wie een activiteit aanmaakte. Bij een gedeelde activiteit bepaalt dat enkel wie ze mag verwijderen: wie ze maakte, mag ze verwijderen zolang er geen doelen aan gekoppeld zijn, ook zonder klas van die leeftijd en ook na het schooljaar. Wat al bestond of uit de import komt, heeft geen maker en is dus puur gedeeld: enkel een hoofdleerkracht of een admin verwijdert zo'n activiteit.

**Een eigen activiteit** *(15-09-2026, [ADR-0049](adr/0049-eigen-activiteit-van-de-leerkracht.md))*. Een activiteit die een leerkracht aanmaakt, is haar **eigen activiteit**: ze hoort bij haar, niet bij haar klas, en volgt haar naar een volgend schooljaar. Ze hangt onder een subthema van de leeftijd van haar klas. De leerkrachten van dezelfde jaarfase lezen ze en kunnen ze **gebruiken**: dan krijgen ze een eigen kopie met dezelfde inhoud en doelen, die ze wel kunnen aanpassen. De eigenaar koppelt zelf doelen aan haar eigen activiteit. Die tellen mee voor de dekking van een klas zodra de activiteit in de agenda van die klas staat, en nooit via het subthema. Voorlopig geldt verder: een hoofdleerkracht van die jaarfase en een admin maken nog rechtstreeks gedeelde activiteiten en kiezen dat per nieuwe activiteit; enkel wie een klas van die leeftijd heeft, of een admin, maakt of gebruikt een eigen activiteit; de eigenaar, de leerkrachten en hoofdleerkrachten van die leeftijd en de admins zien ze; enkel de eigenaar en een admin passen ze aan, koppelen er doelen aan, verplaatsen, verwijderen of plannen ze; verwijdert een admin de eigenaar als gebruiker, dan wordt de activiteit gedeeld.

**Welk schooljaar telt, voor de gedeelde inhoud.** Subthema's, en de activiteiten en subdoelen eronder, horen bij een leeftijd en niet bij een schooljaar. Een aanstelling als hoofdleerkracht, en een koppeling aan een klas voor zover die rechten geeft op de gedeelde inhoud, telt daarom zolang het schooljaar ervan niet voorbij is, ook als het nog moet beginnen. Zo kan een hoofdleerkracht in juni het volgende jaar al voorbereiden.

**Graadklassen, voorlopig, tot de directie over graadklassen beslist (§11).** Een klas heeft één jaar/fase. De leerkrachten van een graadklas bewerken dus de gedeelde inhoud van die ene leeftijd, en de andere leeftijd doet een hoofdleerkracht of een admin. In de tool staat op één plaats welke leeftijden een klas rechten geeft, zodat een beslissing van de directie over graadklassen enkel die plaats verandert.

**Wie geen van de vijf rechten heeft**, bijvoorbeeld een zorgcoördinator zonder themabeheer en zonder Leerlingzorg, kan aanmelden, maar kijkt geen enkele klas in, behalve de klas van een lopende vervanging (FR-14.2; 15-09-2026, [ADR-0040](adr/0040-klassen-inkijken-per-jaarfase.md)). Voorlopig kan hij verder niets, behalve een activiteit verwijderen die hij zelf aanmaakte en een eigen woordweb bijhouden (hieronder). Een eigen activiteit maakt hij niet; of hij eigen subdoelen mag toevoegen, wordt beslist met E6-10.

**Een eigen woordweb** *(15-09-2026, [ADR-0043](adr/0043-eigen-woordweb-per-subthema.md))*. Elke gebruiker houdt per subthema een eigen woordweb bij, de brainstorm van stap 3 (A.7). Het hoort bij die persoon en volgt haar over de schooljaren heen. Iedereen die aanmeldt, kan voorlopig de woorden van elk woordweb inkijken, maar niet de open voorstellen en geweigerde woorden van een ander; alleen wie het maakte en een admin wijzigen het. Wie een subthema verwijdert, verwijdert ook de woordwebs erbij, behalve in de wizard: die verwijdert geen subthema waarop iemand een woordweb bijhoudt. Een woordweb telt nooit mee voor de dekking.

**Waarom doelsuggesties en doelkoppelingen niet bij elke leerkracht liggen.** Een doelsuggestie hangt aan een schoolbreed thema. Aanvaardt iemand ze, dan stijgt de dekking van élke klas die dat thema plant, ook bij collega's, en dat is het cijfer dat de onderwijsinspectie leest. Op 11-09-2026 koos de eigenaar nog voor "elke leerkracht, zoals nu". Toen dat gevolg hem op 13-09-2026 werd voorgelegd, koos hij voor de directie (nu: admin) en themabeheer. Waar de v0.4-tekst zegt dat *de leerkracht* een AI-suggestie beoordeelt (§4, FR-4.2, FR-4.3, §7), lees voor de doelsuggesties bij een thema dus: een admin of wie themabeheer heeft. Voor het jaarplan van een klas blijft het de leerkracht van die klas. Om dezelfde reden liggen de doelkoppelingen op gedeelde activiteiten en subdoelen bij de admins en de hoofdleerkrachten: een koppeling daar telt voor elke klas van die leeftijd die het thema plant, en de eigenaar besliste dat op 13-09-2026, toen hem dat gevolg voor de parallelklassen werd voorgelegd. De import en de wizard zijn uitzonderingen die de eigenaar bewust maakte: wie themabeheer heeft, legt via de import of de wizard ook koppelingen die hij met de hand niet mag leggen. De eigenaar bevestigde de import nog eens nadat de vraag gecorrigeerd was, en beperkte de wizard tot een thema dat daar van nul wordt opgebouwd.

**"Configureerbaar"** (§3.2) betekent twee dingen. *Wie* welk recht heeft, stelt een admin in de tool in. *Wat* een recht toelaat, staat in één tabel, [ADR-0030 §3](adr/0030-rollen-en-rechten-in-de-app.md#3-the-matrix-that-follows), die de tabel in §3.2 vervangt. Een rij daarin wijzigen is een aanpassing aan de code. **Een rij in die tabel geldt als beslist enkel voor zover ze naar een beslissing van de eigenaar verwijst**, ook per kolom: elk vinkje voor admin steunt op de beslissing dat een admin alles ziet en bewerkt, en een streepje kent niets toe. Wat een rij haalt uit een voorlopige keuze of een open vraag uit de lijst hieronder, is voorlopig en wordt met deze tekst niet bekrachtigd. Waar de v0.4-tekst **"beheerder"** zegt (§3.1, FR-12), lees: wie het adminrecht heeft.

**Nog niet beslist.** De tool wordt gebouwd met de voorlopige keuze hieronder, tot de eigenaar anders beslist, of voor de zichtbaarheid de directie. Dezelfde lijst staat in [`CONSTITUTION.md` Art. VI.1](../CONSTITUTION.md#article-vi--roles-privacy--security) en in ADR-0030 §2 en §4:

- *I1, overleg*: de tool dwingt geen overleg, goedkeuring of stemming af tussen de leerkrachten van een jaar.
- *I2, het ontbrekende werkwoord in de beslissing van 11-09-2026*: gelezen als "aanduiden". Wie themabeheer toekent, hangt daar niet van af: dat doet een admin, volgens FR-12.2.
- *I6 en (a), eigen inhoud*: een leerkracht mag ook subdoelen **voor zichzelf** toevoegen (beslist op 11-09-2026). Voorlopig blijft de gedeelde inhoud daarnaast bestaan. Van wie eigen subdoelen zijn en wie ze ziet, wordt beslist samen met E6-10. Voor het woordweb en voor activiteiten besliste de projecteigenaar het op 15-09-2026 (ADR-0043 en ADR-0049, hierboven).
- *Z6 en (d), inkijken* (FR-10.2): een leerkracht kijkt de klassen van de eigen jaarfase in, in elk schooljaar, ook vorige. Wie welke klassen inkijkt, besliste de projecteigenaar op 15-09-2026 ([ADR-0040](adr/0040-klassen-inkijken-per-jaarfase.md)); dat het ook voor vorige schooljaren geldt, is een standaard. De bevestiging is aan de directie (vraag 4 in [`besluiten-gevraagd.md`](besluiten-gevraagd.md)).
- *I12, een klas zonder jaar/fase* geeft haar leerkrachten voorlopig geen recht op de inhoud van een leeftijd.
- *I13, een subthema naar een andere leeftijd verplaatsen*: voorlopig enkel wie hoofdleerkracht is op beide leeftijden, en een admin.
- *I15, de velden van een activiteit die niet genoemd werden* (type, onderzoeksvraag, kleur, lengte): voorlopig ook inhoud, die elke leerkracht van die leeftijd aanpast.
- *I16, de andere velden van een subthema* (naam, duur, probleemstelling, onderzoeksvragen): voorlopig voor de admins en de hoofdleerkrachten, zoals het subthema zelf. Enkel de streefwoordenschat is gedeelde inhoud.
- *I17, een maker die geen gebruiker meer is*: voorlopig worden zijn activiteiten puur gedeeld.
- *I18, een activiteit uit de wizard*: voorlopig is wie themabeheer heeft en de wizard gebruikte, de maker. Dat die maker ze dan mag verwijderen zolang er geen doelen aan gekoppeld zijn, is wel beslist (13-09-2026).
- *I19, een activiteit naar een ander thema verplaatsen*: dat is geen verwijderen of ontkoppelen, want de doelkoppelingen verhuizen mee. Ze tellen daarna wel voor de klassen die het andere thema plannen. Voorlopig verplaatst dus enkel een admin of een hoofdleerkracht een activiteit met doelkoppelingen; een activiteit zonder koppelingen mag elke leerkracht van die leeftijd verplaatsen.
- *I20, een hoofdleerkracht zonder klas*: voorlopig mag dat; de aanstelling alleen geeft het recht.
- *I21, hoe lang een koppeling aan een klas geldt voor de planning van die klas*: voorlopig zonder einddatum, want de klas hoort al bij één schooljaar.
- *I22, hoe de tool een wizardactie herkent*: voorlopig heeft de wizard eigen acties, die enkel een admin en wie themabeheer heeft gebruiken, en enkel voor een nieuw thema. Met de gewone knoppen voor subthema's, subdoelen en activiteiten krijgt themabeheer geen extra recht, behalve dat een maker zijn eigen activiteit mag verwijderen.
- *I23, wat een nieuw thema is*: voorlopig een thema dat de wizard zelf aanmaakte, tot die wizard afgerond of gesloten is.
- *I24, wanneer een wizard stopt*: voorlopig stopt een wizard als een admin of wie themabeheer heeft hem afrondt of sluit, of 14 dagen nadat hij voor het laatst iets opsloeg, wat het eerst komt. Daarna is het thema niet meer nieuw en gelden de gewone rechten.
- *I25, bewerken in de wizard*: voorlopig mag de wizard, zolang hij loopt, een subthema, subdoel of activiteit die hij zelf aanmaakte ook aanpassen en verwijderen, en niets anders.
- *I26, een thema verwijderen*: voorlopig verwijdert wie themabeheer heeft een thema enkel als er niets onder zit, behalve wat zijn eigen open wizard aanmaakte. Een ander thema verwijdert enkel een admin. Een thema dat in een jaarplan staat, verwijdert niemand.
- *I27, de wizard en werk van anderen*: voorlopig verwijdert de wizard geen activiteit met een doelkoppeling, en geen subthema waarvan een activiteit er een heeft, tenzij wie hem gebruikt ook doelen mag koppelen op die leeftijd. Hij zet ook geen subthema naar een andere leeftijd zolang er iets onder staat dat de wizard niet zelf aanmaakte. Een activiteit van de wizard waar een doel aan gekoppeld is, telt daarbij, en bij I26, als werk van iemand anders, tenzij wie het doet ook doelen mag koppelen op die leeftijd. Zet de wizard een subthema naar een andere leeftijd, dan moet dat koppelen op beide leeftijden mogen.
- *I28, de 14 dagen van de wizard*: voorlopig houden enkel de eigen acties van de wizard hem open. Het thema of zijn themadoelen aanpassen via de gewone knoppen telt niet.
- *(c), een jaar zonder hoofdleerkracht*: voorlopig doet enkel een admin, met de hand, wat de hoofdleerkracht zou doen.
- *(e), een zorgcoördinator, of wie geen van de vijf rechten heeft*: voorlopig niets meer dan themabeheer en Leerlingzorg (als een admin ze toekent), behalve een activiteit verwijderen die hij zelf aanmaakte en een eigen woordweb bijhouden (ADR-0043). Zonder recht kijkt hij geen klas in, behalve de klas van een lopende vervanging (FR-14.2).

**Nieuwe begrippen:** gebruiker, adminrecht, themabeheer, hoofdleerkracht, klastoewijzing en maker van een activiteit. Definities: zie [`CONSTITUTION.md` Art. XII](../CONSTITUTION.md#article-xii--glossary-nl--en).

**Bevestiging door de directie.** Deze regeling is door de projecteigenaar beslist, en de directie heeft ze niet bevestigd. Enkel de zichtbaarheid staat al als vraag voor de directie klaar (vraag 4). De voorlopige regeling voor graadklassen wacht op de beslissing van de directie over graadklassen (§11); die vraag is haar nog niet gesteld.

*Waarom dit hier staat en niet in §3:* Art. XI.1 vereist dat een amendement zijn afhankelijke tekst in dezelfde wijziging meeneemt. De v0.4-tekst wordt niet aangepast, want die is een getrouwe weergave; deze bijlage is de plek om hem te verfijnen, en bij tegenspraak geldt de bijlage.
