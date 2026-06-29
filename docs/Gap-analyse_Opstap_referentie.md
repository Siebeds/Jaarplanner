# Gap-analyse — Functionele Analyse vs. Op.stap-referentiemateriaal

Status: **gevalideerd** — de bevindingen, incl. GAP 0a (taxonomie `Discipline → Domein → Subdomein`, `cluster` nullable) en GAP 0c (professionele autonomie / decretale grens), zijn op **29-06-2026** aanvaard door auteur/directie (Siebe De Saedeleir) en verwerkt als bindend in [`CONSTITUTION.md`](../CONSTITUTION.md). Dit document vergelijkt de functionele analyse (`Functionele_Analyse_Jaarplanner.md`, v0.4) en de build-constitution (`CONSTITUTION.md`) met drie referentiebronnen die de school aanleverde:

- **A** — `assets/Op.stap_ordeningskader.pdf` — de officiële ordeningskader-matrix.
- **B** — `assets/Uitwerken kennisrijk thema KLEUTER (Haike).pdf` — 10-stappenmethode om een kennisrijk thema op te bouwen.
- **C** — `assets/Verduidelijking Thema-Subthema-doelen.pdf` — juridisch/pedagogische verduidelijking van de thema/subthema/doel-structuur.

> Methodenoot: de grote PDF (C) kon niet als beeld gerenderd worden; de tekst is geëxtraheerd met `pdftotext -layout`. Bullet-glyphs en accenten kwamen soms als `�` door, maar de inhoud is volledig leesbaar.

Elke bevinding is verwerkt in de FA en/of de constitution. Domeinfeiten die de oorspronkelijke FA tegenspraken (m.n. GAP 0a en GAP 0c) zijn op **29-06-2026 door auteur/directie aanvaard** en gelden nu als bindend (zie [`CONSTITUTION.md` Art. III](../CONSTITUTION.md#article-iii--curriculum-data-integrity--professional-autonomy-non-negotiable) en [Art. VII.0](../CONSTITUTION.md#article-vii--opstap-taxonomy--excel--model-mapping)).

---

## Deel 1 — Structurele kernbevindingen

### GAP 0a — De ordeningstaxonomie is `Discipline → Domein → Subdomein`, NIET `…→ Cluster` (+ geen `leergebied` in het kader)
- **Bron A:** de matrix toont exact drie hiërarchische niveaus — **discipline** (11 genummerde disciplines), dan herhalende rijen **domein** en **subdomein**. Geen kolom/rij `cluster`, `leergebied` of `leerlijn`.
- **Status in FA:** **tegengesproken / onderbepaald.** FA (§2.4, §4, FR-2.1, §8) en CONSTITUTION (Art. VII) stellen een keten `domein/subdomein/cluster` voor met `cluster` als Excel-kolom I. `cluster` bestaat mogelijk wél in de **per-discipline Excel**, maar is geen deel van de officiële **overzichtstaxonomie**.
- **Waarom het telt:** ruggengraat van het datamodel en alle dekkingsroll-ups/filters. Een verplichte 4-niveauketen breekt als de data enkel domein→subdomein draagt met optionele cluster.
- **Voorstel:** onderscheid expliciet **(1) ordeningskader** = `Discipline → Domein → Subdomein` (browse/groepering) van **(2) per-discipline doel-Excel** (rijen met optionele `cluster`, `code`, `jaarFase`, concordantie). Maak `cluster` nullable. Open vraag: is `cluster` in elke discipline-Excel aanwezig/gevuld?

### GAP 0b — `Discipline`-nummering en samengestelde disciplines (9.1/9.2/9.3) ontbreken in het model
- **Bron A:** disciplines dragen stabiele nummers 1–11; **9 is gesplitst** in 9.1 Veilige en gezonde levensstijl, 9.2 Leren leren, 9.3 Sociaal en emotioneel leren. Volledige lijst: 1 Nederlands en communicatie, 2 Wiskunde, 3 Wetenschap en techniek, 4 Aardrijkskunde, 5 Geschiedenis, 6 Muzische vorming, 7 Lichamelijke opvoeding en motoriek, 8 ICT, 9.1/9.2/9.3, 10 Frans, 11 Rooms-katholieke godsdienst.
- **Status in FA:** **ontbreekt.** FA somt de disciplines nooit op.
- **Voorstel:** `Discipline`-entiteit met `nummer` (string, bv. "9.2"), `naam`, optionele `parentDiscipline`. Lijst opnemen in een FA-bijlage zodat "welke disciplines eerst?" (§11) concreet bespreekbaar is.

### GAP 0c — De FA spreekt de PDF's tegen over wat wettelijk vastligt
- **Bron C (§1, §10):** de overheid bepaalt *minimumdoelen, leerinhouden, kennisrijk curriculum*; **niet** welke thema's/subthema's of hoe je ze organiseert — dat is **professionele autonomie**. Themawerking is niet verplicht; doelgericht werken, kennisopbouw, minimumdoelen realiseren en een leerlijn uitwerken wel.
- **Status in FA:** **onderbepaald / subtiel tegengesproken.** FA §2.1 stelt enkel dat de overheid "de leerdoelen bepaalt"; nergens staat dat de **themalaag vrij en niet-getoetst** is.
- **Waarom het telt:** dit is de juridische grond voor de architectuur — Op.stap-doelen zijn *read-only* omdat ze decretaal zijn; thema's zijn 100% bewerkbaar omdat ze autonoom zijn. Dekking wordt bewezen op **minimumdoel-niveau**, niet op themaniveau.
- **Voorstel:** voeg dit als FA-paragraaf én constitution-principe toe.

---

## Deel 2 — Gaps uit de kennisrijk-thema-methode (B) en de thema/subthema-verduidelijking (C)

### GAP 1 — `Themadoel` is een eersteklas concept (≠ doelkoppeling op een activiteit)
- **Bron B (stap 2), C (§4, §7, §10):** een thema vertrekt vanuit **2 à 3 grote themadoelen** die doorheen het thema *verbreed, verdiept, herhaald* worden; **schoolbreed gelijk**, gekoppeld aan leerplan-/minimumdoelen.
- **Status in FA:** **ontbreekt** (FA kent enkel `ThemaDoel` als AI-link Thema↔Leerplandoel).
- **Voorstel:** `Themadoel` = kleine set (2–3) aangeduide leerplan-/minimumdoelen, vlag `schoolbreed`; voeden aan de AI-prompt als anker. Toevoegen aan FR-3.

### GAP 2 — `Subdoel` (concreet doel per leeftijd/subthema) is een apart niveau
- **Bron C (§6, §7, §10), B (stap 6):** subdoelen zijn concreet **per leeftijd/groep/subthema**, interdisciplinair, bouwen op richting de themadoelen (voorbeeld WATER: 1K nat/droog, gieten; 3K voorspellen, vergelijken, redeneren).
- **Status in FA:** **ontbreekt** (model is Thema→subthema's→activiteiten; geen subdoel, geen leeftijdsdimensie op doelen).
- **Voorstel:** `Subdoel` = doelkoppelingen op niveau (Subthema × leeftijd/klas), verwijzend naar leerplan-/minimumdoelen uit meerdere disciplines. Leeftijd expliciet (1K/2K/3K → JK/K2/K3).

### GAP 3 — Een thema draagt veel meer attributen dan `naam`
- **Bron B:** **onderzoeksvraag + probleemstelling** per subthema; **woordenschat in twee lagen** (kern/basis vs. rijke themawoorden); **rijk aanbod / activiteittypes** (experiment, prentenboek, hoek, uitstap, spel, waarneming, beweging, onderzoek); **duur** (thema 4–6 wk, subthema ±2 wk); **invalshoeken**; **reflectie/evaluatie**.
- **Status in FA:** **ontbreekt/onderbepaald.**
- **Voorstel:** breid `Thema`/`Subthema`/`Activiteit` uit met `duurWeken`, `onderzoeksvraag`+`probleemstelling`, `kernwoordenschat[]`+`rijkeWoordenschat[]`, `activiteitType` (enum), optionele `verwachteUitkomsten`. Definieer in het FR-1 importsjabloon. Voeg duur-conventies toe aan FR-5/FR-6.

### GAP 4 — Een thema is per definitie interdisciplinair; doelen overspannen meerdere disciplines
- **Bron B (stap 6) + C (§7):** "kennisrijk thema is interdisciplinair"; subdoelen uit verschillende **leergebieden** (B/C gebruiken "leergebied" en "Wereldoriëntatie" — termen die niet in kader A staan).
- **Status in FA:** **onderbepaald** + terminologie-mismatch leergebied/discipline.
- **Voorstel:** stel dekking rolt op *over* disciplines heen; beslis of "leergebied" (incl. kleuterkoepel "Wereldoriëntatie") als gebruikersgerichte groepering naast "discipline" getoond wordt. Open vraag: mapping Wereldoriëntatie → {Aardrijkskunde, Geschiedenis, Wetenschap en techniek}.

### GAP 5 — Schoolbreed-vs-per-klas is pedagogisch *voorgeschreven per niveau*, geen open vraag
- **Bron C (§2,§4,§5,§8,§10):** **schoolbreed gelijk** = thema, themadoelen, kernwoordenschat, kennisopbouw, leerlijnen, welke minimumdoelen aan bod komen. **Niet noodzakelijk gelijk** = subthema's, subdoelen (leeftijdsverschillend), activiteiten, hoeken, lessen. Drijfveer: verticale samenhang 1K→3K→lager.
- **Status in FA:** **onderbepaald** (FR-3.3/§11 behandelen het als onbesliste binaire keuze).
- **Voorstel:** vervang de binaire open vraag door de niveau-per-niveau-regel. `Thema`+`Themadoel`+`kernwoordenschat` = school-scoped; `Subthema`+`Subdoel`+`Activiteit` = klas/leeftijd-scoped.

### GAP 6 — Planningsblok-granulariteit: thema-cadans (4–6 wk / 2 wk) botst met default "maand"
- **Bron B (stap 4):** thema 4–6 weken; subthema ≈ 2 weken (week-range-tabel).
- **Status in FA:** **onderbepaald / milde tegenspraak** (default planningsblok = maand).
- **Voorstel:** ondersteun **themaperiode (4–6 wk)** en **subthemaperiode (~2 wk)** als blok-opties; benoem de maand/thema-misalignment expliciet.

### GAP 7 — De doel-eerst-authoringworkflow (10 stappen) ontbreekt in de FA
- **Bron B:** (1) kies sterk thema → (2) 2–3 themadoelen → (3) brainstorm → (4) subthema's (~2 wk) → (5) onderzoeksvragen → (6) subdoelen uit meerdere leergebieden → (7) rijk aanbod → (8) woordenschat → (9) samenhang → (10) reflectie/evaluatie.
- **Status in FA:** **ontbreekt** (FR-3 is generieke CRUD).
- **Beslist (29-06-2026):** de "thema-opbouw wizard" in FR-3 is een **vaste MVP-feature** (niet optioneel); AI-assistentie (FR-4) plugt in op stap 2 (themadoelen) en stap 6 (subdoelen). Zie [`CONSTITUTION.md` Art. IV.8](../CONSTITUTION.md) en FA Bijlage A.7.

---

## Deel 3 — Kleinere / bevestigende gaps

### GAP 8 — Muzische vorming heeft een *herhalend* subdomein-patroon
- **Bron A:** discipline 6 heeft domeinen Muziek/Beeld/Drama/Dans/Media, elk met dezelfde subdomeinen *Repertorium / Bouwstenen / Vaardigheden en vormgevingsmiddelen* (+ "Domeinoverschrijdend").
- **Gevolg:** subdomein-namen zijn **niet globaal uniek**; identiteit = `(domein, subdomein)`. Groeperingssleutels moeten samengesteld zijn (de unieke `code` per leerplandoel blijft de rij-sleutel).

### GAP 9 — `jaarFase`/mijlpalen: kleutercodes bevestigen (1K/2K/3K ↔ JK/K2/K3)
- **Bron C** gebruikt 1K/2K/3K (leerkrachttaal); model gebruikt JK/K2/K3. Mijlpalen: K- (einde 3e kleuter), 4- (4e lj), 6- (6e lj).
- **Voorstel:** mappingtabel 1K↔JK, 2K↔K2, 3K↔K3, L1–L6 in glossary/i18n; bevestig welke vorm Excel-kolom F gebruikt.

### GAP 10 — `Leerroute` vs. `leerlijn` worden door elkaar gebruikt
- **Bron C (§8/§10):** "leerlijn" = school-gegarandeerde continuïteit/opbouw over leeftijden ("geen gaten in de leerlijn"); ≠ Op.stap **leerroute** (aangereikt traject).
- **Voorstel:** voeg `leerlijn` toe aan de glossary, los van `leerroute`; verticale-samenhang-controle als mogelijke fast-follow van FR-9.

### GAP 11 — Dekkingssemantiek mist mogelijk "opbouw/herhaling" (niet enkel binair gedekt)
- **Bron B (stap 2), C (§6,§9):** themadoelen moeten *verbreed/verdiept/herhaald* terugkomen; subdoelen bouwen logisch op.
- **Voorstel:** behoud binaire dekking voor MVP als bewuste vereenvoudiging; open vraag of "herhaling/opbouw" later getoond wordt (aantal plaatsingen, spreiding over periodes/leeftijden).

### GAP 12 — Het "schoolbrede standaard-themaset"-werkmodel wordt niet benoemd
- **Bron C (§2):** scholen spreken bewust dezelfde grote thema's, centrale kennis, kernwoordenschat en themadoelen schoolbreed af.
- **Voorstel:** promoveer de gedeelde **thema-bibliotheek** van "ter beslissing" naar verwachte feature, eigendom op schoolniveau (directie/team), met per-klas afgeleide subthema's/subdoelen.

---

## Deel 4 — Ontbrekende glossarytermen

| Term | Definitie / waarom nodig |
|---|---|
| **Discipline (genummerd)** | 11 genummerde Op.stap-vakken (1 Nederlands…11 RKG), met splitsing 9.1/9.2/9.3. Stabiele import-/groeperingssleutel. |
| **Leergebied / Wereldoriëntatie** | Groeperingsvocabulaire van de leerkrachten (Wereldoriëntatie als koepel over aardrijkskunde/geschiedenis/wetenschap). Te mappen op "discipline". |
| **Themadoel** | 2–3 overkoepelende, schoolbrede doelen die een heel thema ankeren; verbreed/verdiept/herhaald. |
| **Subdoel** | Concrete, leeftijdsgedifferentieerde doelen per (subthema × leeftijd) die opbouwen richting themadoelen. |
| **Onderzoeksvraag / probleemstelling** | Sturende vraag/vragen per subthema in een kennisrijk thema. |
| **Kernwoordenschat vs. rijke (thema)woordenschat** | Twee-lagen woordenschat per thema (basiswoorden vs. rijke themawoorden). |
| **Rijk aanbod / activiteittype** | Palet aan activiteitsvormen: experiment, prentenboek, hoek, uitstap, spel, waarneming, beweging, onderzoek. |
| **Hoek** | Een leerhoek (ontdektafel, techniekhoek, boekenhoek…). |
| **Themaperiode / subthemaperiode** | Duureenheden: thema 4–6 wk, subthema ±2 wk — kandidaat-planningsblokken. |
| **Leerlijn (verticale samenhang)** | School-gegarandeerde opbouw van een doel over leeftijden; ≠ Op.stap **leerroute**. |
| **Professionele autonomie** | Juridisch principe: thema's/subthema's/volgorde zijn vrije keuze; enkel minimumdoelen/leerinhouden/kennisopbouw zijn decretaal. |
| **Kennisrijk curriculum / kennisrijk thema** | Het pedagogische kader (doel-eerst, interdisciplinair, kennisopbouwend, 4–6 wk) dat de tool bedient. |

---

## Hoogste-impact aanbevelingen
1. **Taxonomie corrigeren (GAP 0a/0b):** ordeningskader (Discipline→Domein→Subdomein) onderscheiden van de per-discipline doel-Excel (optionele cluster, code, jaarFase, concordantie). `cluster` nullable; `subdomein` sleutelen op `(domein, subdomein)`; `Discipline` met string-`nummer` en 9.x-splitsing.
2. **Doel-/themalagen toevoegen (GAP 1–3):** `Themadoel` (2–3, schoolbreed), `Subdoel` (per subthema × leeftijd), rijke `Thema`/`Subthema`-attributen.
3. **Juridische/eigendomsregels coderen (GAP 0c, 5, 12):** thema/themadoel/kernwoordenschat = schoolbreed; subthema/subdoel/activiteit = per klas & per leeftijd; dekking bewezen op minimumdoel-niveau.
4. **Planningsblok-granulariteit afstemmen op echte cadans (GAP 6):** themaperiode 4–6 wk en subthema ~2 wk.
5. **FR-3/FR-4 vormgeven rond de 10-stappenmethode (GAP 7)** zodat AI inplugt op themadoel-/subdoelselectie.
