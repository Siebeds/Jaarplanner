# Beslissingen die we nodig hebben van de directie

*Bijgewerkt: 19 augustus 2026. Bedoeld om door te sturen: geen technische kennis vereist.*

Hieronder staan de vragen waarop we een antwoord nodig hebben om verder te kunnen bouwen. Ze staan op volgorde van dringendheid. Bij elke vraag staat waarom ze belangrijk is en wat er gebeurt zolang ze open blijft.

We **gokken niet** op een antwoord. Waar een keuze nog openstaat, bouwen we zo dat ze later zonder herbouw kan worden omgezet, maar sommige zaken (de eerste vraag) kunnen we zonder antwoord helemaal niet maken. Op twee punten geldt die belofte niet meer: **vraag 6** in zijn geheel, en het uitvoerformaat in **vraag 5**. Bij allebei staat het met zoveel woorden vermeld.

---

## 1. De lijst met minimumdoelen (eindtermen): **blokkeert het belangrijkste onderdeel**

**Wat we vragen:** de officiële lijst van de door de overheid vastgelegde **minimumdoelen** voor het basisonderwijs, mét de tekst van elk doel. Een Excel of CSV is prima, in de vorm waarin ze gepubliceerd is.

Per rij hebben we vier gegevens nodig:

| Gegeven | Voorbeeld |
| --- | --- |
| Leeftijdsaanduiding | `K-` (einde 3e kleuter), `4-` (4e leerjaar) of `6-` (6e leerjaar) |
| Nummer | `12` |
| Referentie (leeftijd + nummer samen) | `6-12` |
| **Omschrijving: de eigenlijke tekst van het doel** | *"De leerling kan …"* |

**Waarom dit nodig is.** De Op.stap-bestanden vertellen ons bij elk leerplandoel *naar welk* minimumdoel het verwijst (bijvoorbeeld `6-12`), maar nooit *wat* dat minimumdoel zegt. We hebben dus het verwijsnummer zonder de tekst: een voetnootnummer zonder voetnoot.

**Gevolg zolang dit ontbreekt.** De tool kan **niet aantonen dat de minimumdoelen gedekt zijn**. Dat is precies het niveau waarop de onderwijsinspectie kijkt, en het is de kernbelofte van de toepassing. Alles eromheen werkt al; dit ene ontbrekende bestand houdt het tegen.

**Belangrijk om te weten:** de referenties in die lijst moeten **exact** overeenkomen met de codes in de Op.stap-bestanden. Stuur eventueel eerst een klein stukje van de lijst door. Dan controleren we of de nummering overeenkomt vóór iemand het volledige bestand samenstelt. Een gedeeltelijke lijst (bijvoorbeeld één leeftijdsniveau) is ook al bruikbaar om de invoer te testen.

---

## 2. Hoe heet discipline 9 officieel?

**Wat we vragen:** de officiële naam van discipline 9 in Op.stap, of de bevestiging dat 9.1, 9.2 en 9.3 zelfstandige disciplines zijn die niet onder één gemeenschappelijke noemer vallen.

**Waarom.** De officiële lijst die we volgen bevat 9.1, 9.2 en 9.3, maar geen rij `9` en nergens een naam ervoor. Andere documentatie beschrijft 9 wél als één vak dat opgesplitst is.

**Gevolg zolang dit ontbreekt.** We kunnen 9.1/9.2/9.3 in de tool niet onder een kop groeperen: ze verschijnen als drie losse vakken. Puur een weergavekwestie, geen blokkering.

---

## 3. Met welke disciplines starten we?

**Wat we vragen:** nemen we vanaf het begin alle 13 disciplines mee, of starten we met een selectie (bijvoorbeeld enkel de vakken van de klassen die als eerste met de tool werken)?

**Waarom.** Het inladen van de leerplandoelen gebeurt per discipline, met één bestand per vak. Minder disciplines betekent sneller kunnen starten en minder bestanden te verzamelen.

**Gevolg zolang dit openstaat.** Geen blokkering: de keuze is een instelling, geen herbouw. Wel: in overzichten verschijnen momenteel alle 13 disciplines, ook als er nog geen doelen voor ingeladen zijn.

---

## 4. Wie mag wat van elkaar zien?

**Wat we vragen:** mag een leerkracht de jaarplannen van collega's inkijken: van alle klassen, alleen van het eigen leerjaar, of enkel na toestemming? En mag de directie alles zien?

**Waarom.** Dit bepaalt de rechtenstructuur, en daarmee wat er op elk scherm te zien is.

**Gevolg zolang dit openstaat.** Het samenwerkingsgedeelte kan niet af. De rest van de tool werkt wel.

---

## 5. Hoe moet de dekking eruitzien op papier?

**Wat we vragen:** twee dingen.
- **Uitvoerformaat:** in welke vorm wilt u het dekkingsoverzicht kunnen meenemen naar een inspectiebezoek of teamoverleg? PDF, Excel, of beide? Zijn er vormvereisten?
- **Diepgang:** is "dit doel is behandeld" voldoende, of wilt u ook kunnen zien of het *herhaald* of *verdiept* is?

**Waarom.** Het tweede punt raakt aan wat de tool moet bijhouden, niet enkel aan hoe het toont, dus het is meer dan een lay-outkeuze.

**Gevolg zolang dit openstaat.** We bouwen de dekking eerst als "behandeld / niet behandeld". Wordt het later fijnmaziger, dan is dat uitbreidbaar, maar dan moet er wel opnieuw ingevuld worden wat al ingevuld was.

**Op het eerste punt hebben we intussen niet gewacht, en dat hoort u te weten.** Op 6 augustus 2026 heeft de projecteigenaar beslist om het dekkingsoverzicht als **Excel** te laten downloaden, en dat is gebouwd. **Uw vraag blijft dus open, maar niet meer op een leeg blad:** wilt u er PDF bij, of in plaats van, of gelden er vormvereisten voor een inspectiebezoek, dan verandert er iets wat er al is. Het diepgangpunt hierboven staat helemaal open en is het punt met de grootste gevolgen.

---

## 6. Wat gebeurt er met het werk van de leerkracht als de tool opnieuw genereert?

**Ook op deze vraag hebben we niet gewacht** (de andere is het uitvoerformaat bij vraag 5). Ze hield het werk tegen, dus de projecteigenaar heeft ze op 19 augustus 2026 beslist, in de voorzichtige richting. **We vragen u die beslissing te bevestigen of om te draaien.** Anders dan bij de vragen hierboven is dit antwoord niet gratis om te draaien: er staan vandaag zinnen op het scherm van de leerkracht die dit met zoveel woorden beloven.

- **Wat de leerkracht zelf beslist heeft, blijft staan als de tool het jaarplan opnieuw genereert.** Heeft een leerkracht een thema aanvaard, geweigerd, zelf geplaatst, naar een andere periode verplaatst of vastgezet, dan raakt een hergeneratie het niet aan: niet bij een hergeneratie van het hele jaarplan, en niet bij die van één periode. De AI-voorstellen waar de leerkracht nog niets mee gedaan heeft en die niet vastgezet zijn, verdwijnen wel, en of er nieuwe voor in de plaats komen hangt af van wat de AI die keer voorstelt.
  **Eén randgeval, omdat u de regel bekrachtigt en niet alleen leest:** sleept een leerkracht een kaartje binnen dezelfde periode heen en weer, dan verandert er niets aan de planning en telt dat dus niet als verplaatsen. Zo'n voorstel verdwijnt wél bij een hergeneratie, ook al heeft de leerkracht het aangeraakt.
  **Waarom deze kant op:** van de twee mogelijkheden is dit de voorzichtige. De tool neemt uit zichzelf nooit een beslissing van een leerkracht terug. *(Wissen kan wel, maar altijd doordat een mens erom vraagt: wie een thema verwijdert of een doelkoppeling overschrijft, krijgt vooraf te zien wat er verdwijnt.)*
  **De andere mogelijkheid was:** een hergeneratie mag alles vervangen behalve wat de leerkracht op slot heeft gezet. Dan wordt het slotje het enige vangnet, en moet een leerkracht eraan denken het te gebruiken. **Kiest u die kant op, dan verandert het scherm mee:** op iets wat de leerkracht al beslist heeft en nog niet vastgezet is, tonen we dat slotje vandaag niet, precies omdat het nu niets toevoegt. *(Heeft ze het wél vastgezet, dan staat de knop er wel, anders kon ze het slot niet meer weghalen.)* Het zou dan overal moeten verschijnen, en dat is werk bovenop het herschrijven van de zinnen.
  **Zegt u hier iets anders over, dan is dat een echte wijziging.** Een hele reeks zinnen op het scherm belooft vandaag deze regel, waaronder verschillende op de kalender zelf. Die moeten dan stuk voor stuk mee veranderen. *(De precieze lijst staat bij de ontwikkelaars, in de backlog onder E4-07; ze wordt daar bijgehouden en hier bewust niet geteld, omdat een getal dat op twee plaatsen staat er maar op één klopt.)*

---

## 7. Blijft er náást de weekweergave ook een jaarbrede fijne weergave bestaan?

**Deze vraag stond al opgeschreven in onze eigen planning, met de mededeling dat ze hier stond. Dat was niet zo, en dat is precies het probleem dat we u willen voorleggen.** Ze is hier bijgevoegd op 20 augustus 2026, nadat een controleronde vaststelde dat ze nergens terechtgekomen was waar u ze kon zien. Ondertussen is het scherm dat van het antwoord afhangt al gebouwd.

De kalender kan een jaarplan op twee grofheden tonen: per **themaperiode** (4–6 weken) en per **subthemaperiode** (ongeveer 2 weken). Sinds deze maand kan een leerkracht daarnaast **in** één themaperiode duiken en die week per week plannen, met de activiteiten op een concrete dag.

- **De vraag:** is die jaarbrede subthemaperiode-weergave nog nodig nu de leerkracht in een periode kan duiken? Of zijn er nu twee manieren om hetzelfde te zien, waarvan er één weg mag?
- **Waarom wij het niet beslissen:** het is een onderwijskundige keuze over hoe een leerkracht plant, niet een technische. Beide bestaan vandaag naast elkaar, en dat is de toestand die onze eigen notitie *"kies expliciet, laat niet beide staan en hoop maar"* verbiedt — we staan er dus nu in.
- **Wat het kost om te laten zoals het is:** twee weergaven onderhouden die grotendeels hetzelfde vertellen, en een leerkracht die moet uitzoeken welke van de twee ze nodig heeft.

---

## 8. Mag de doelenkiezer zich richten op de klas, ook waar het thema van de hele school is?

Sinds deze maand krijgt een leerkracht die een leerplandoel opzoekt standaard de doelen van **haar eigen leerjaar** te zien, met een knop om het hele curriculum erbij te halen. Dat is wat u vroeg: een leerkracht van het derde leerjaar kreeg kleuterdoelen voorgeschoteld.

**Er zit één plek waar dat wringt en die willen we u niet stil laten passeren.** Een **thema** en zijn twee of drie overkoepelende doelen zijn van de **hele school**, niet van één klas: elke klas werkt hetzelfde thema op haar eigen manier uit. Toch hangt de standaardselectie op dat niveau nu af van welke klas er bovenaan het scherm gekozen staat. Twee leerkrachten die hetzelfde schoolthema bewerken, zien dus een andere beginlijst.

- **De vraag:** mag dat zo, of moet de kiezer op het schoolbrede niveau (thema en themadoel) juist het hele curriculum aanbieden, en alleen op klasniveau (subthema en activiteit) versmallen?
- **Wat er al voor pleit om het te laten:** wie een doel van een ander jaar zoekt, ziet een knop *"Heel curriculum"* en een zin die vertelt in welke doelen er gezocht is. Er verdwijnt niets, het staat alleen niet vooraan.
- **Waarom we het toch vragen:** een schoolbreed gegeven dat er per klas anders uitziet, is precies het soort verschil waar niemand aan denkt tot twee mensen elkaar tegenspreken.

---

## 9. Moet het verwijderen van een klas tegengehouden worden als er nog dagplanning aan hangt?

**Dit is een technische vraag met een onderwijskundige kern, en beide antwoorden hebben een prijs.** Een controleronde vond op 20 augustus 2026 dat een beveiliging die dit had moeten tegenhouden, in werkelijkheid nooit afgaat: een klas verwijderen kan vandaag de weekplanning die eraan hangt stil meenemen.

- **Antwoord A — tegenhouden.** De tool weigert de klas te verwijderen zolang er nog activiteiten op dagen staan, en zegt wat er eerst weg moet. Nadeel: er is een omweg waarlangs inhoud van een *andere* klas onder deze klas terecht kan komen, en dan kan een directie een klas niet meer verwijderen om iets wat ze zelf niet heeft gepland en misschien niet ziet.
- **Antwoord B — laten gebeuren, maar het zeggen.** Verwijderen mag, en de tool waarschuwt vooraf hoeveel ingeplande activiteiten daarmee verdwijnen. Nadeel: werk van een leerkracht verdwijnt op één bevestiging.
- **Wat wij zouden doen als u niets zegt:** antwoord A, want de tool hoort nooit uit zichzelf werk van een leerkracht weg te gooien. Maar de omweg hierboven maakt dat minder duidelijk dan het klinkt, en daarom leggen we het voor.

---

## Ter info: wat we zelf beslist hebben

Deze keuzes hebben we genomen zonder ze aan u voor te leggen, omdat ze het bouwen betreffen en niet het onderwijs. Ze zijn omkeerbaar. Laat weten als u er anders over denkt.

- **Duur van een planningsperiode:** standaard een themaperiode van 4–6 weken met daarin subperiodes van ongeveer 2 weken, instelbaar. (Eerder door u bekrachtigd op 14 juli.)
- **Vakantie versus vrije dag:** de school duidt bij elke sluiting aan of het een *vakantie* is (die een planningsperiode afsluit) of een *vrije dag* (bijvoorbeeld Hemelvaart of een pedagogische studiedag, dus een dag vrij *binnen* een periode). Zonder dat onderscheid werd mei in onplanbare stukjes van één week gehakt. (Bekrachtigd op 28 juli.)
- **Als u vakantiedata wijzigt** en een al ingepland thema daardoor niet meer klopt, verplaatst de tool het **nooit zelf**. U krijgt een melding die blijft staan tot een mens het oplost, en zolang dat niet gebeurd is meldt het dekkingsoverzicht dat de cijfers **onbetrouwbaar** zijn in plaats van een getal te tonen dat zou misleiden. (Bekrachtigd op 28 juli.)

