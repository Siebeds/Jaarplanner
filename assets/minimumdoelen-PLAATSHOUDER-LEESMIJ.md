# Plaatshouder voor de decretale minimumdoelen

*Aangemaakt 3 augustus 2026 door de technical-lead sessie, op vraag van de projecteigenaar. Directie is in verlof en de bouw stond stil op E1-12.*

## Wat dit is

`minimumdoelen-PLAATSHOUDER-niet-decretaal.xlsx` en `.csv` zijn **verzonnen bestanden**. Ze zijn gegenereerd door de app-bouwers, niet ontvangen van directie en niet afkomstig uit het decreet. Ze bestaan om één reden: zolang er geen enkele `Minimumdoel`-rij kan bestaan, kan een groot deel van de toepassing niet gebouwd of getest worden.

Elke rij zegt in zijn eigen tekst wat hij is:

> `PLAATSHOUDER 6-12: geen decretale tekst. Vervang dit bestand door de officiële lijst van directie.`

Dat is opzettelijk. De `omschrijving` is het veld dat op het scherm van de leerkracht terechtkomt en in elke export, dus de waarschuwing reist mee tot in het dekkingsoverzicht. Je kan geen dekkingsrapport bekijken zonder ze te zien.

## Wat er in zit

| | |
| --- | --- |
| Kolommen | `Leeftijd`, `Nr`, `Ref`, `Omschrijving` (exact wat `docs/besluiten-gevraagd.md` §1 aan directie vroeg) |
| Leeftijdsniveaus | `K-`, `4-`, `6-` |
| Nummers | 1 tot 200 per niveau, **bewust ruimer dan het werkelijke aantal** minimumdoelen |
| Rijen | 627 |
| `Ref` | `Leeftijd` + `Nr`, letterlijk aan elkaar geplakt |

**Waarom nummers 1 tot 9 twee keer voorkomen (`6-1` én `6-01`).** De concordantie wordt vergeleken met `StringComparer.Ordinal` (`OpstapImportService.ControleerVoorwaardenAsync`), dus `6-1` en `6-01` zijn twee verschillende sleutels. De repo's eigen testfixtures gebruiken bovendien **beide** vormen door elkaar (`4-07` naast `4-2`). Zolang niemand weet welke vorm de echte Op.stap-bestanden gebruiken, staan beide vormen in dit bestand zodat elke verwijzing oplost. Wanneer het echte bestand komt, beslist dat bestand de vraag en verdwijnt deze verdubbeling.

## Wat dit wél deblokkeert

- **E1-12** kan gebouwd worden: het importpad, de kolomtoewijzing en de tests kunnen tegen een echt bestand geschreven worden in plaats van tegen een vermoeden.
- **E1-03 / E1-04**: MD-geconcordeerde leerplandoelen kunnen eindelijk wegschrijven zonder FK-fout, dus de concordantielogica is te bouwen en te testen.
- **E1-15 / FR-2.1**: een echt per-discipline Op.stap-bestand antwoordt vandaag 409 omdat de refs niet oplossen. Met deze rijen geladen kan die import doorlopen.
- **E5-04** (dekking op minimumdoelniveau) kan berekend, weergegeven en gedemonstreerd worden.
- Een demo aan directie of leerkrachten kan de volledige keten tonen, met de plaatshoudertekst zichtbaar in beeld.

## Wat dit **niet** deblokkeert

**Geen enkele mijlpaal.** Met dit bestand geladen kan de school **niet** aantonen dat de minimumdoelen gedekt zijn, want de doelen waartegen gemeten wordt bestaan niet. Dat is precies het niveau waarop de onderwijsinspectie kijkt.

Concreet:

- **E1-12 blijft `[!]` en mag niet op `[x]`** komen op basis van dit bestand. Zijn *Done when* leest *"minimumdoel-level coverage returns results"*, en dat is met plaatshouders letterlijk waar en inhoudelijk leeg. Precies het soort `[x]` dat deze backlog al drie keer heeft moeten intrekken.
- **M1 en M5 blijven onbereikt** tot de echte lijst geladen is.
- Er mag **geen** export, rapport of dekkingscijfer naar buiten dat op deze rijen gebaseerd is (Art. V.2: nooit dekking claimen die je niet kan bewijzen).

## Voorwaarde om dit weg te halen

Zodra directie de officiële lijst levert: vervang de twee bestanden, herimporteer, en controleer dat **geen enkele** `Minimumdoel.Omschrijving` nog met `PLAATSHOUDER` begint.

**Voorgestelde waarborg, nog niet gebouwd** (te noteren als een clausule op E1-12): laat de app weigeren om dekking als betrouwbaar te rapporteren zolang er één `Minimumdoel` bestaat waarvan de `omschrijving` met `PLAATSHOUDER` begint, op dezelfde manier waarop een jaarplan met onopgeloste vervallen plaatsingen zijn cijfer als *onbetrouwbaar / te herzien* moet melden (Art. XIV-beslissing van 28 juli, punt 4). Dan is deze tussenoplossing niet afhankelijk van iemands geheugen.

## Hoe het opnieuw te genereren

Het generatiescript is opzettelijk **niet** gecommit: dit is een tijdelijk bestand, geen productiegereedschap, en een script in de repo nodigt uit om er opnieuw op te bouwen. Het stond in de scratchpad van de sessie van 3 augustus 2026. Regenereren is triviaal: vier kolommen, drie leeftijdsniveaus, nummers 1 tot 200, plus de nul-opgevulde vormen voor 1 tot 9.
