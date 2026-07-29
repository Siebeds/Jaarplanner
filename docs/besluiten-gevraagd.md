# Beslissingen die we nodig hebben van de directie

*Bijgewerkt: 28 juli 2026. Bedoeld om door te sturen — geen technische kennis vereist.*

Hieronder staan de vragen waarop we een antwoord nodig hebben om verder te kunnen bouwen. Ze staan op volgorde van dringendheid. Bij elke vraag staat waarom ze belangrijk is en wat er gebeurt zolang ze open blijft.

We **gokken niet** op een antwoord. Waar een keuze nog openstaat, bouwen we zo dat ze later zonder herbouw kan worden omgezet — maar sommige zaken (de eerste vraag) kunnen we zonder antwoord helemaal niet maken.

---

## 1. De lijst met minimumdoelen (eindtermen) — **blokkeert het belangrijkste onderdeel**

**Wat we vragen:** de officiële lijst van de door de overheid vastgelegde **minimumdoelen** voor het basisonderwijs, mét de tekst van elk doel. Een Excel of CSV is prima — in de vorm waarin ze gepubliceerd is.

Per rij hebben we vier gegevens nodig:

| Gegeven | Voorbeeld |
| --- | --- |
| Leeftijdsaanduiding | `K-` (einde 3e kleuter), `4-` (4e leerjaar) of `6-` (6e leerjaar) |
| Nummer | `12` |
| Referentie (leeftijd + nummer samen) | `6-12` |
| **Omschrijving — de eigenlijke tekst van het doel** | *"De leerling kan …"* |

**Waarom dit nodig is.** De Op.stap-bestanden vertellen ons bij elk leerplandoel *naar welk* minimumdoel het verwijst — bijvoorbeeld `6-12` — maar nooit *wat* dat minimumdoel zegt. We hebben dus het verwijsnummer zonder de tekst: een voetnootnummer zonder voetnoot.

**Gevolg zolang dit ontbreekt.** De tool kan **niet aantonen dat de minimumdoelen gedekt zijn**. Dat is precies het niveau waarop de onderwijsinspectie kijkt, en het is de kernbelofte van de toepassing. Alles eromheen werkt al; dit ene ontbrekende bestand houdt het tegen.

**Belangrijk om te weten:** de referenties in die lijst moeten **exact** overeenkomen met de codes in de Op.stap-bestanden. Stuur eventueel eerst een klein stukje van de lijst door — dan controleren we of de nummering overeenkomt vóór iemand het volledige bestand samenstelt. Een gedeeltelijke lijst (bijvoorbeeld één leeftijdsniveau) is ook al bruikbaar om de invoer te testen.

---

## 2. Hoe heet discipline 9 officieel?

**Wat we vragen:** de officiële naam van discipline 9 in Op.stap — of de bevestiging dat 9.1, 9.2 en 9.3 zelfstandige disciplines zijn die niet onder één gemeenschappelijke noemer vallen.

**Waarom.** De officiële lijst die we volgen bevat 9.1, 9.2 en 9.3, maar geen rij `9` en nergens een naam ervoor. Andere documentatie beschrijft 9 wél als één vak dat opgesplitst is.

**Gevolg zolang dit ontbreekt.** We kunnen 9.1/9.2/9.3 in de tool niet onder een kop groeperen — ze verschijnen als drie losse vakken. Puur een weergavekwestie, geen blokkering.

---

## 3. Met welke disciplines starten we?

**Wat we vragen:** nemen we vanaf het begin alle 13 disciplines mee, of starten we met een selectie (bijvoorbeeld enkel de vakken van de klassen die als eerste met de tool werken)?

**Waarom.** Het inladen van de leerplandoelen gebeurt per discipline, met één bestand per vak. Minder disciplines betekent sneller kunnen starten en minder bestanden te verzamelen.

**Gevolg zolang dit openstaat.** Geen blokkering — de keuze is een instelling, geen herbouw. Wel: in overzichten verschijnen momenteel alle 13 disciplines, ook als er nog geen doelen voor ingeladen zijn.

---

## 4. Wie mag wat van elkaar zien?

**Wat we vragen:** mag een leerkracht de jaarplannen van collega's inkijken — van alle klassen, alleen van het eigen leerjaar, of enkel na toestemming? En mag de directie alles zien?

**Waarom.** Dit bepaalt de rechtenstructuur, en daarmee wat er op elk scherm te zien is.

**Gevolg zolang dit openstaat.** Het samenwerkingsgedeelte kan niet af. De rest van de tool werkt wel.

---

## 5. Hoe moet de dekking eruitzien op papier?

**Wat we vragen:** twee dingen.
- **Uitvoerformaat:** in welke vorm wilt u het dekkingsoverzicht kunnen meenemen naar een inspectiebezoek of teamoverleg — PDF, Excel, of beide? Zijn er vormvereisten?
- **Diepgang:** is "dit doel is behandeld" voldoende, of wilt u ook kunnen zien of het *herhaald* of *verdiept* is?

**Waarom.** Het tweede punt raakt aan wat de tool moet bijhouden, niet enkel aan hoe het toont — dus het is meer dan een lay-outkeuze.

**Gevolg zolang dit openstaat.** We bouwen de dekking eerst als "behandeld / niet behandeld". Wordt het later fijnmaziger, dan is dat uitbreidbaar, maar dan moet er wel opnieuw ingevuld worden wat al ingevuld was.

---

## Ter info: wat we zelf beslist hebben

Deze keuzes hebben we genomen zonder ze aan u voor te leggen, omdat ze het bouwen betreffen en niet het onderwijs. Ze zijn omkeerbaar — laat weten als u er anders over denkt.

- **Duur van een planningsperiode:** standaard een themaperiode van 4–6 weken met daarin subperiodes van ongeveer 2 weken, instelbaar. (Eerder door u bekrachtigd op 14 juli.)
- **Vakantie versus vrije dag:** de school duidt bij elke sluiting aan of het een *vakantie* is (die een planningsperiode afsluit) of een *vrije dag* (Hemelvaart, pedagogische studiedag — een dag vrij *binnen* een periode). Zonder dat onderscheid werd mei in onplanbare stukjes van één week gehakt. (Bekrachtigd op 28 juli.)
- **Als u vakantiedata wijzigt** en een al ingepland thema daardoor niet meer klopt, verplaatst de tool het **nooit zelf**. U krijgt een melding die blijft staan tot een mens het oplost, en zolang dat niet gebeurd is meldt het dekkingsoverzicht dat de cijfers **onbetrouwbaar** zijn in plaats van een getal te tonen dat zou misleiden. (Bekrachtigd op 28 juli.)
