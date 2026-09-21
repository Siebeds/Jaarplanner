# TB-037 — browsercontrole, 2026-09-21

Chromium (Chrome), frontend in mockmodus (`pnpm dev:mock`). Chrome is de engine die bij `type="search"` zelf een
kruisje tekent, dus de engine waarin de fout zichtbaar is.

## Hoe er gemeten is

`getComputedStyle(input, '::-webkit-search-cancel-button')` is voor deze vraag onbruikbaar: Chrome geeft daar de box
van de input zelf terug (identiek mét en zonder de klasse). Het kruisje is daarom gemeten als echte knoop in de
user-agent shadow DOM, via CDP: `DOM.describeNode(pierce: true)` levert de knoop met
`pseudo=-webkit-search-cancel-button`, waarna `CSS.getComputedStyleForNode` de `display` geeft en `DOM.getBoxModel`
zegt of hij überhaupt gelayout wordt.

Per veld is er een controleproef gedaan: de klasse in de draaiende pagina van dat ene element halen en opnieuw meten.
Dat is het bewijs dat de meting het kruisje echt ziet, en niet altijd "niets" meldt.

## Uitkomst

Alle punten geslaagd.

| Veld | Met `eigen-wisknop` | Controle: klasse weg |
| --- | --- | --- |
| Doelenregister, 1280x800 | native `display: none`, geen boxmodel; 1 eigen wisknop | `display: block`, box 10x10 op x 1150-1160: twee kruisjes |
| Doelenregister, 390x844 | native `display: none`, geen boxmodel; 1 eigen wisknop | `display: block`, box 10x10 op x 268-278 |
| Bestemmingsblad, 1280x800 | native `display: none`, geen boxmodel; 1 eigen wisknop | `display: block`, box op x 1206-1216 |

Wissen werkt onveranderd: teller 26 doelen, zoekterm "woord" geeft 2 doelen, na een klik op de eigen knop is het veld
leeg en staat de teller weer op 26. Op 1280 en op 390.

De klasse werkt niet te breed. Op de twee zoekvelden zonder eigen wisknop staat het native kruisje er nog:
rapportdoelen (`display: block`, box 10x10 op x 1234-1244) en de emojikiezer (box 10x10 op x 873-883). Op allebei
leegt een klik erop het veld. Daar is dat ene kruisje van de browser dus de enige muisweg om te wissen, en die blijft.

In de door Vite geserveerde CSS staat de regel als `.eigen-wisknop::-webkit-search-cancel-button { display: none; }`,
klassegebonden en niet als elementselector.

## Buiten dit ticket opgemerkt

Op `/doelen` staat er al een consolewaarschuwing van React voordat er iets gezocht wordt: `Cannot update a component
(DoelenScherm) while rendering a different component (DoelenScherm)`. Die staat los van deze wijziging (de diff raakt
alleen twee `className`-strings en een utility), maar is het bekijken waard.

Voor het openen van het rapportdoelenformulier is in de draaiende pagina het antwoord van `GET /api/ik` gepatcht
(de mockgebruiker is admin, en admin haalt `RapportsetBewerken` bewust niet). Er is geen bestand gewijzigd; het
zoekveld zelf is ongewijzigde productcode.
