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
| Versie | 0.5 — concept ter validatie (v0.4-tekst + Bijlage A) |
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

Te valideren door: de directie van de school.

> **Let op:** hoofdstukken 1–12 zijn de getrouwe weergave van v0.4. **[Bijlage A](#bijlage-a--verfijningen-op-basis-van-opstap-referentiemateriaal-post-v04)** bevat verfijningen (post-v0.4) op basis van het Op.stap-referentiemateriaal; bij tegenspraak met de v0.4-tekst geldt de bijlage. Volledige onderbouwing: [`Gap-analyse_Opstap_referentie.md`](Gap-analyse_Opstap_referentie.md).

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

#### Buiten scope (mogelijk latere fase)

- Opvolging en rapportering op leerlingniveau.
- Integratie met bestaande schooladministratie- of leerlingvolgsystemen (bv. Smartschool, Informat).
- Toegang voor ouders of leerlingen.
- Automatisch genereren van het concrete lesmateriaal zelf.
- Evaluatie en puntenbeheer.

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

- **Beheerder (directie / ICT-coördinator)** — werkt vanuit de beheerpagina: stelt schooljaren, klassen, leerkrachten en rechten in, beheert het inladen van de Op.stap-leerplandoelen, heeft zicht op alle jaarplannen en trekt schoolbrede en per-klas overzichten (zie FR-9 en FR-12).
- **Leerkracht** — beheert het jaarplan van de eigen klas(sen); voert thema's en activiteiten in of importeert ze; gebruikt de AI-suggesties; past de kalender manueel aan; kan plannen van collega's inkijken voor afstemming.
- **Zorgcoördinator / co-teacher (optioneel)** — leesrechten over meerdere klassen, eventueel beperkte bewerkrechten — ter beslissing.

### 3.2 Toegangsrechten

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
- De koppeling thema ↔ leerplandoel kan door de AI voorgesteld en/of door de leerkracht bevestigd zijn.

## 5. Functionele requirements

De eisen zijn genummerd (FR-x). Per onderdeel volgt eerst een korte uitleg in gewone taal, daarna de concrete eisen.

### FR-1 — Import van thema's en activiteiten (Excel)

De school start met haar eigen, bestaande inhoud in Excel: thema's, subthema's en activiteiten. De tool laat toe die in te lezen in plaats van alles manueel in te voeren. De leerplandoelen worden hier niet ingelezen — die worden apart ingeladen vanuit het leerplan Op.stap (zie FR-2).

- **FR-1.1** — De gebruiker kan een Excel-bestand (.xlsx) opladen met thema's, subthema's en activiteiten.
- **FR-1.2** — De tool valideert het bestand (verplichte kolommen aanwezig, geen lege verplichte velden) en toont duidelijke foutmeldingen per rij.
- **FR-1.3** — Vóór het definitief inlezen krijgt de gebruiker een voorbeeldweergave (preview) van wat geïmporteerd zal worden.
- **FR-1.4** — Bij herimport kan de gebruiker kiezen tussen toevoegen of bestaande gegevens bijwerken/overschrijven.
- **FR-1.5** — Een sjabloon (template) met de juiste kolomstructuur is downloadbaar, zodat duidelijk is hoe het bestand eruit moet zien.

### FR-2 — Leerplandoelen vanuit Op.stap (Katholiek Onderwijs Vlaanderen)

De doelen worden niet door de school opgesteld. De school volgt het leerplan "Op.stap, leerroutes voor iedereen" van Katholiek Onderwijs Vlaanderen. Dat leerplan bevat de leerplandoelen én de decretale minimumdoelen (de eindtermen van de Vlaamse overheid, letterlijk opgenomen) en stelt de doelen per discipline beschikbaar als Excelbestand.

- **FR-2.1** — De leerplandoelen worden ingeladen vanuit de Op.stap-Excelbestanden (één bestand per discipline), met behoud van de structuur: doelsoort, unieke code, jaar/fase, domein/subdomein/cluster en de concordantie met de minimumdoelen.
- **FR-2.2** — De tool herkent de doelsoort (MD = minimumdoel, G = gemeenschappelijk, + = verdieping, P/S/A = illustratief) en kan daarop filteren, bv. om enkel de minimumdoelen of enkel de gemeenschappelijke doelen te tonen.
- **FR-2.3** — De minimumdoelen worden via de concordantie aan de leerplandoelen gekoppeld, zodat dekking ook op minimumdoelniveau aangetoond kan worden (zie FR-9).
- **FR-2.4** — De school past de officiële inhoud van de doelen niet aan; interne ordening en labels zijn wel mogelijk.
- **FR-2.5** — Wanneer Op.stap geactualiseerd wordt, kunnen de doelen opnieuw ingeladen worden; bestaande jaarplannen worden niet automatisch overschreven, maar de tool signaleert wat herbekeken moet worden.

> Opmerking: naast de leerplandoelen voorziet Op.stap ook leerroutes — trajecten die ondersteunen bij het ontwerpen, uitvoeren en evalueren van onderwijs. Het inkapselen van die leerroutes is optioneel en kan een latere uitbreiding zijn (zie hoofdstuk 9).

### FR-3 — Beheer van thema's en activiteiten

Leerkrachten beheren hun eigen inhoudelijke bouwstenen: thema's, subthema's en de bijhorende activiteiten.

- **FR-3.1** — Leerkrachten kunnen thema's, subthema's en activiteiten toevoegen, wijzigen en verwijderen.
- **FR-3.2** — Een activiteit kan aan één of meerdere leerdoelen gekoppeld worden.
- **FR-3.3** — Thema's kunnen herbruikt worden over klassen heen (gedeelde themabibliotheek), zonder dat een wijziging in de ene klas de andere ongewenst beïnvloedt — gedeeld dan wel per klas: ter beslissing.

### FR-4 — AI-matching: thema's ↔ leerdoelen

Dit is de kern van de tool: de AI stelt voor welke thema's en activiteiten bij welke leerdoelen passen.

- **FR-4.1** — De tool stelt per thema/activiteit voor met welke leerdoelen het overeenkomt.
- **FR-4.2** — Elke suggestie krijgt een korte motivatie ("waarom past dit doel hier?") zodat de leerkracht ze kan beoordelen.
- **FR-4.3** — De leerkracht kan elke suggestie aanvaarden, weigeren of aanpassen.
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
- **FR-7.2** — De leerkracht kan thema's, activiteiten en doelkoppelingen handmatig toevoegen, verplaatsen of verwijderen, los van de AI.
- **FR-7.3** — Manuele wijzigingen blijven behouden bij een latere gedeeltelijke hergeneratie (zie FR-8) — precieze regel voor behoud/overschrijven: ter beslissing.

### FR-8 — (Her)generatie

De leerkracht kan de AI opnieuw laten werken, in zijn geheel of gericht op één periode.

- **FR-8.1** — De leerkracht kan het volledige jaarplan opnieuw laten genereren.
- **FR-8.2** — De leerkracht kan één afzonderlijke maand/periode opnieuw laten genereren, zonder de rest te wijzigen.
- **FR-8.3** — Vóór het toepassen van een (her)generatie toont de tool wat er zal veranderen, met de mogelijkheid om te annuleren.
- **FR-8.4** — De leerkracht kan handmatig vastgezette ("vergrendelde") blokken uitsluiten van hergeneratie.

### FR-9 — Dekkingsoverzicht en gap-analyse

Voor de directie cruciaal: aantonen dat élk doel ergens in het jaar aan bod komt — zowel op het niveau van de leerplandoelen als, via de concordantie, op het niveau van de minimumdoelen.

- **FR-9.1** — De tool toont per klas welke leerplandoelen gedekt zijn en welke (nog) niet.
- **FR-9.2** — De tool toont het dekkingspercentage en een lijst van de ontbrekende doelen; er kan gefilterd worden op doelsoort (bv. enkel de minimumdoelen).
- **FR-9.3** — Via de concordantie toont de tool ook de dekking op minimumdoelniveau — het niveau waarop de onderwijsinspectie toetst.
- **FR-9.4** — De directie kan via de beheerpagina schoolbrede en per-klas overzichten trekken (dekking en voortgang over alle klassen/leerjaren heen — zie FR-12).
- **FR-9.5** — Het dekkingsoverzicht is exporteerbaar als bewijs van dekking.

### FR-10 — Samenwerking en afstemming

Leerkrachten moeten op elkaar kunnen afstemmen, maar wel binnen duidelijke toegangsgrenzen.

- **FR-10.1** — Leerkrachten kunnen de jaarplannen van collega's bekijken (volgens hun rechten) om op elkaar af te stemmen.
- **FR-10.2** — De zichtbaarheid is instelbaar (bv. enkel binnen dezelfde graad, of schoolbreed) — ter beslissing.
- **FR-10.3** — (Optioneel) Mogelijkheid om opmerkingen achter te laten of thema's te delen tussen klassen.

### FR-11 — Export en rapportering

Het jaarplan en de dekking moeten buiten de tool bruikbaar zijn — voor de klassenmap, de directie of de inspectie.

- **FR-11.1** — Een jaarplan is exporteerbaar (bv. PDF en/of Excel) voor afdruk, klassenmap of inspectie.
- **FR-11.2** — Het dekkingsoverzicht is exporteerbaar.

### FR-12 — Beheerpagina: klassen instellen en overzichten

De beheerder/directie werkt vanuit een centrale beheerpagina (admin). Daar worden schooljaren, klassen, leerkrachten en rechten ingesteld, en van daaruit worden de schoolbrede en per-klas overzichten getrokken.

- **FR-12.1** — De beheerder kan schooljaren aanmaken en de vakantie-/periodestructuur instellen.
- **FR-12.2** — De beheerder kan klassen aanmaken en beheren (naam, leerjaar), leerkrachten eraan koppelen en rechten toekennen.
- **FR-12.3** — Vanuit de beheerpagina kan de directie schoolbrede en per-klas overzichten en rapporten trekken (o.a. dekking en voortgang over alle klassen/leerjaren heen — zie FR-9) en exporteren.
- **FR-12.4** — Een jaarplan van een vorig schooljaar kan als basis gekopieerd worden naar een nieuw jaar — al dan niet in de eerste versie: ter beslissing.

## 6. Niet-functionele requirements

Dit zijn de kwaliteitseisen waaraan de tool moet voldoen, los van de concrete functies.

- **NFR-1** — Taal: de volledige gebruikersinterface is Nederlandstalig.
- **NFR-2** — Gebruiksvriendelijkheid: bruikbaar door leerkrachten zonder technische achtergrond; minimale training; een rustige, duidelijke interface.
- **NFR-3** — Performance: een jaarplan wordt binnen een redelijke tijd gegenereerd (richtwaarde: enkele tot tientallen seconden); de kalender reageert vlot.
- **NFR-4** — Beschikbaarheid & hosting: webtoepassing, bereikbaar via de browser, gehost in de cloud (bv. Microsoft Azure), zonder lokale installatie.
- **NFR-5** — Beveiliging: toegang via persoonlijke login; rolgebaseerde rechten; gegevens versleuteld tijdens transport en in opslag.
- **NFR-6** — Privacy (GDPR/AVG): de tool verwerkt in de eerste plaats curriculum- en personeelsgegevens (leerkrachtaccounts); géén gevoelige leerlinggegevens in de MVP. Een verwerkingsregister en bewaartermijnen worden voorzien.
- **NFR-7** — Browserondersteuning: recente versies van de courante browsers (Edge, Chrome, Firefox, Safari).
- **NFR-8** — Schaalbaarheid: ontworpen voor één school met meerdere klassen; uitbreidbaar naar meerdere scholen in een latere fase.
- **NFR-9** — Back-up & herstel: regelmatige back-ups van de gegevens.

## 7. AI-werking en kwaliteitsbewaking

- **Mens in de lus** — de AI stelt voor, de leerkracht beslist. Niets wordt zonder validatie als definitief beschouwd.
- **Transparantie** — elke AI-suggestie gaat gepaard met een korte motivatie.
- **Brongegevens** — de AI werkt op basis van de door de school ingevoerde thema's en activiteiten en de leerdoelen van de overheid — niet op basis van externe, onbekende bronnen.
- **Beperkingen** — AI-suggesties kunnen fouten of hiaten bevatten. De eindverantwoordelijkheid voor de correcte dekking ligt bij de leerkracht en de directie. De tool ondersteunt, maar vervangt geen pedagogische beoordeling.
- **Aandachtspunt** — verwerking van schoolgegevens door een AI-dienst gebeurt bij voorkeur binnen een Europese, AVG-conforme omgeving (bv. Azure AI Foundry met EU-datazone) — te bevestigen.

## 8. Technische architectuur (indicatief)

Dit hoofdstuk is bestemd voor de ontwikkelaar en is indicatief. De directie hoeft dit niet in detail te valideren.

- **Frontend** — webtoepassing in een modern JavaScript-framework (React of Vue), met een interactieve kalender en drag-and-drop.
- **Backend** — een API in .NET (C#), verantwoordelijk voor de logica, de rechten en de communicatie met de AI-dienst.
- **Database** — PostgreSQL voor de opslag van schooljaren, klassen, leerplandoelen (met doelsoort, code, jaar/fase, domein en concordantie met de minimumdoelen), thema's, activiteiten en jaarplannen.
- **AI** — Azure AI Foundry voor het genereren van de doel-matching en de jaarplanning.
- **Hosting** — Microsoft Azure.
- **Koppeling leerplandoelen** — de leerplandoelen worden ingeladen vanuit de Op.stap-Excelbestanden (Katholiek Onderwijs Vlaanderen), één per discipline, met behoud van de kolomstructuur (doelsoort, code, jaar/fase, domein/subdomein/cluster, concordantie). De gestructureerde Excel-import is het basismechanisme; een eventuele geautomatiseerde koppeling kan later onderzocht worden.

### Vereenvoudigde gegevensstroom

Op.stap-Excelbestanden inladen (leerplandoelen) + Excel-upload van thema's/activiteiten → de backend valideert en bewaart in PostgreSQL → de backend roept de AI-dienst aan met de relevante gegevens → het resultaat (matching/jaarplan) wordt bewaard en getoond in de frontend → de leerkracht past aan → de wijzigingen gaan terug naar de database.

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
- De school volgt het leerplan Op.stap van Katholiek Onderwijs Vlaanderen; de leerplandoelen worden ingeladen vanuit de Op.stap-Excelbestanden (één per discipline), waarin de decretale minimumdoelen verwerkt zijn.
- De tool wordt in de eerste versie door één school gebruikt.
- Er worden geen leerlinggegevens verwerkt in de MVP.
- De school beschikt over (of voorziet) de nodige cloud- en AI-omgeving (Azure).

## 11. Open vragen / beslissingen door de directie

Onderstaande punten bepalen mee de uitwerking. Antwoorden hierop laten toe deze analyse te verfijnen tot een definitieve versie.

- **Disciplines**: welke disciplines uit Op.stap nemen we mee in de eerste versie — alle, of een selectie om mee te starten?
- **Op.stap-doelen ophalen**: importeren we de Excelbestanden manueel (download per discipline van de PRO.-site), of komt er een geautomatiseerde/online koppeling?
- **Ordening**: Op.stap ordent per jaar/fase (JK–L6) met minimumdoelen op mijlpalen (einde K3, L4, L6). Volgt de tool die ordening, en hoe gaan we om met graadklassen of menggroepen?
- **Kalenderindeling**: in welke eenheden plannen leerkrachten — per maand, per week, per lesblok of per themaperiode?
- Hoeveel klassen en leerkrachten zijn er in de eerste versie?
- Zijn thema's gedeeld over de hele school (themabibliotheek) of strikt per klas?
- Zichtbaarheid tussen leerkrachten: schoolbreed, per graad, of beperkter?
- **Excel-structuur van de thema's/activiteiten**: welke kolommen bevatten de bestaande bestanden vandaag? (Bepaalt het importsjabloon voor FR-1.)
- **Overzichten**: welke schoolbrede en per-klas overzichten/rapporten heeft de directie nodig op de beheerpagina (bv. dekking per klas, per leergebied, schoolbreed) en in welk exportformaat?
- **Exportformaten**: PDF, Excel of beide? Met welke lay-out (bv. voor inspectie of klassenmap)?
- **Hosting/AI**: akkoord met cloudhosting (Azure) en AI-verwerking binnen een EU-/AVG-conforme omgeving?
- Is meertaligheid later nodig (bv. voor anderstalige leerkrachten)?
- Wat wordt de definitieve naam van de tool?

## 12. Volgende stappen

- De directie bezorgt feedback en beantwoordt de open vragen (hoofdstuk 11).
- Op basis daarvan wordt deze analyse verfijnd tot versie 1.0, met een concrete planning en opleverdata.
- De bestaande Excel-bestanden (thema's/activiteiten) worden verzameld en de Op.stap-leerplandoelen (per discipline) worden klaargezet als startgegevens.

---

## Bijlage A — Verfijningen op basis van Op.stap-referentiemateriaal (post-v0.4)

> Deze bijlage verfijnt hoofdstukken 1–12 op basis van drie door de school aangeleverde bronnen: `assets/Op.stap_ordeningskader.pdf`, `assets/Uitwerken kennisrijk thema KLEUTER (Haike).pdf` en `assets/Verduidelijking Thema-Subthema-doelen.pdf`. Bij tegenspraak met de v0.4-tekst geldt deze bijlage. Volledige onderbouwing en bronvermelding per punt: [`Gap-analyse_Opstap_referentie.md`](Gap-analyse_Opstap_referentie.md). Deze verfijningen zijn verwerkt in [`CONSTITUTION.md`](../CONSTITUTION.md) (de bindende bron voor de bouw).

### A.1 Juridisch principe — wat ligt vast, wat is vrij
De Vlaamse overheid bepaalt **enkel** de minimumdoelen, de leerinhouden en dat scholen systematisch kennis opbouwen richting een leerlijn (kennisrijk curriculum). De overheid bepaalt **niet** welke thema's of subthema's een school kiest, noch hoe ze die organiseert — dat is **professionele autonomie**, en de inspectie toetst de themalaag niet. **Dekking wordt bewezen op minimumdoel-niveau, niet op themaniveau.** Dit verklaart waarom Op.stap-doelen read-only zijn en thema's volledig bewerkbaar.

### A.2 Correctie op de ordeningstaxonomie (vervangt de "domein/subdomein/cluster"-formulering)
Er zijn **twee onderscheiden structuren**:
1. **Ordeningskader** — officiële groeperingstaxonomie met exact drie niveaus: **`Discipline → Domein → Subdomein`**. Geen `cluster`, geen `leergebied` op dit niveau.
2. **Per-discipline doel-Excel** — de rijen leerplandoelen, met daarnaast `cluster` (**optioneel/nullable**), `code`, `jaarFase`, `voorbeelden`, `toelichting`, `woordenschat` en de `minimumdoelRef`-concordantie.

Regels: `cluster` is nullable; `subdomein`-namen zijn **niet globaal uniek** → groeperingssleutel `(domein, subdomein)`, rij-identiteit = `code`. `leergebied`/`Wereldoriëntatie` is leerkrachttaal, geen kaderniveau (enkel presentatiemapping).

### A.3 Disciplines (genummerd) — ontbrekende opsomming
`Discipline` draagt een **string-`nummer`** (bv. `"9.2"`) en een optionele `parentDiscipline`. Lijst: 1 Nederlands en communicatie · 2 Wiskunde · 3 Wetenschap en techniek · 4 Aardrijkskunde · 5 Geschiedenis · 6 Muzische vorming · 7 Lichamelijke opvoeding en motoriek · 8 ICT · 9.1 Veilige en gezonde levensstijl · 9.2 Leren leren · 9.3 Sociaal en emotioneel leren · 10 Frans · 11 Rooms-katholieke godsdienst.

### A.4 Rijker gegevensmodel voor de themalaag (verfijnt hoofdstuk 4 en FR-3)
- **Themadoel** — 2–3 overkoepelende, **schoolbrede** doelen die een heel thema ankeren (verbreed/verdiept/herhaald); gekoppeld aan leerplan-/minimumdoelen. Apart van een doelkoppeling op een activiteit.
- **Subdoel** — concreet, **leeftijdsgedifferentieerd** doel op niveau `(subthema × leeftijd)`, dat opbouwt richting de themadoelen. Thema's zijn **interdisciplinair**: subdoelen overspannen meerdere disciplines.
- **Rijke thema-attributen** — `duurWeken` (thema 4–6, subthema ±2), `probleemstelling` + `onderzoeksvraag` per subthema, `kernwoordenschat[]` + `rijkeWoordenschat[]`, `activiteitType` (experiment, prentenboek, hoek, uitstap, spel, waarneming, beweging, onderzoek), optionele `hoek` en `verwachteUitkomsten`.

### A.5 Schoolbreed vs. per klas — beslist per niveau (vervangt FR-3.3 als open binaire vraag)
**Schoolbreed gelijk:** thema, themadoelen, kernwoordenschat, kennisopbouw/leerlijn, welke minimumdoelen aan bod komen. **Per klas/leeftijd:** subthema's, subdoelen, activiteiten, hoeken, lessen. Eigendom: `Thema`/`Themadoel`/`kernwoordenschat` op schoolniveau (team/directie, gedeelde thema-bibliotheek); `Subthema`/`Subdoel`/`Activiteit` op klas/leeftijdsniveau.

### A.6 Planningsblok-granulariteit (verfijnt §2.4, FR-5, FR-6)
De pedagogische cadans is **themaperiode (4–6 wk)** en **subthemaperiode (~2 wk)**; deze lijnen niet zuiver uit op maandgrenzen. De "maand"-default uit v0.4 is dus geen vanzelfsprekendheid — de keuze blijft een open beslissing en wordt achter een duidelijke naad geïsoleerd.

### A.7 Doel-eerst authoringworkflow (verfijnt FR-3/FR-4) — **MVP-feature**
De "thema-opbouw wizard" volgens de 10-stappenmethode is een **vaste MVP-feature** (niet optioneel): (1) sterk thema → (2) 2–3 themadoelen → (3) brainstorm → (4) subthema's (~2 wk) → (5) onderzoeksvragen → (6) subdoelen uit meerdere leergebieden → (7) rijk aanbod → (8) woordenschat → (9) samenhang → (10) reflectie. AI-assistentie (FR-4) plugt in op stap 2 (themadoelen) en stap 6 (subdoelen).

### A.8 Bijkomende open vragen
Zie de bijgewerkte open-beslissingenlijst in [`CONSTITUTION.md` Art. XIV](../CONSTITUTION.md#article-xiv--open-decisions-awaiting-directie): aanwezigheid van `cluster` per discipline, `leergebied`/Wereldoriëntatie-mapping, dekkingsdiepte (binair vs. herhaling/opbouw), en de vorm van `jaarFase`-codes (1K/2K/3K ↔ JK/K2/K3).

### A.9 Nieuwe begrippen
De glossary (§2.4) wordt aangevuld met: Discipline (genummerd), Leergebied/Wereldoriëntatie, Themadoel, Subdoel, Onderzoeksvraag/probleemstelling, Kernwoordenschat vs. rijke woordenschat, Rijk aanbod/activiteittype, Hoek, Themaperiode/subthemaperiode, Leerlijn (verticale samenhang, ≠ leerroute), Professionele autonomie, Kennisrijk curriculum/kennisrijk thema. Definities: zie [`CONSTITUTION.md` Art. XII](../CONSTITUTION.md#article-xii--glossary-nl--en).
