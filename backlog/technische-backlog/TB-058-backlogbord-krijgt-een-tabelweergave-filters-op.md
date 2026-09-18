---
id: TB-058
titel: Backlogbord krijgt een tabelweergave, filters op prioriteit en aanmaakdatum, en sortering
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 18:10
opgepakt-door: bord-filters
branch: ticket/TB-bord-filters-sorteren
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Het backlogbord telt meer dan honderd tickets, waarvan 54 in 'Nieuw', elk als een kaart onder de andere. De eigenaar
kan vandaag alleen filteren op soort (FB/TB) en zoeken op tekst. De volgorde per kolom ligt vast. Wie de tickets van
deze week zoekt, of alle tickets met een hoge prioriteit, moet de kolommen doorscrollen: "nu staan alle tickets in een
droge lijst" (eigenaar, 2026-09-18).

## Voorgestelde wijziging

De pagina van het bord (`tools/backlog-board/public/`: `index.html`, `app.js`, `style.css` en een nieuwe module `view.js`
met de filter- en sorteerlogica), plus één regel in `server.mjs` die `view.js` serveert. CLI en parser veranderen niet:
de pagina filtert en sorteert wat de server al stuurt.

- **Weergave:** een schakelaar *Bord* of *Tabel*. Het bord blijft de kanban met kolommen. De tabel toont één rij per
  ticket met id, soort, titel, kolom, prioriteit, opgepakt door, aangemaakt en bijgewerkt. Een klik op een rij opent
  het detail, zoals een kaart dat doet.
- **Filters** (beslissingen van de eigenaar, 2026-09-18), bovenop soort en zoeken:
  - **prioriteit:** alle, hoog, middel of laag;
  - **aangemaakt:** alles, vandaag, deze week, laatste 7 dagen of laatste 30 dagen.
  De filters gelden voor beide weergaven.
- **Sorteren:** één keuze 'Sorteer op' voor alle kolommen: *standaard* (de huidige volgorde per kolom), prioriteit,
  nummer, laatst bijgewerkt of aangemaakt. In de tabel sorteert ook een klik op een kolomkop, en een tweede klik keert de
  richting om. Het is dezelfde keuze als de keuzelijst.
- **Onthouden:** de weergave, de nieuwe filters en de sortering worden niet onthouden. Het filter op soort en 'Toon
  alle' onthoudt het bord zoals vandaag.
- Een lege uitkomst zegt dat geen ticket aan de filters voldoet.

## Acceptatiecriteria

- [x] Gegeven het bord, wanneer de eigenaar op *Tabel* klikt, dan staat elk ticket dat aan de filters voldoet op één rij met id, soort, titel, kolom, prioriteit, opgepakt door, aangemaakt en bijgewerkt, en opent een klik op een rij het detail.
- [x] Gegeven de prioriteitsfilter op 'hoog', dan tonen het bord en de tabel alleen tickets met prioriteit hoog, en tellen de kolomkoppen alleen die.
- [x] Gegeven de filter 'aangemaakt: laatste 7 dagen', dan staan alleen tickets waarvan de aanmaakdatum in de laatste zeven dagen valt, vandaag inbegrepen.
- [x] Gegeven 'Sorteer op: aangemaakt', dan staan de tickets in elke kolom en in de tabel van nieuw naar oud; 'standaard' geeft de huidige volgorde terug.
- [x] Gegeven de tabel, wanneer de eigenaar twee keer op de kolomkop 'Nummer' klikt, dan wordt eerst oplopend en daarna aflopend gesorteerd, en toont de kop de richting met een pijl en een toegankelijke naam.
- [x] Gegeven een herladen pagina, dan staan de weergave, de prioriteit, de aanmaakdatum en de sortering terug op hun standaard, en blijft het filter op soort onthouden.
- [x] Gegeven de tests van het bord (`node --test "test/*.test.mjs"`), dan slagen ze, en de filter- en sorteerlogica heeft eigen tests.

## Buiten scope

- Filteren op status, op geblokkeerd, op FR-nummer of op sessie.
- Filters en sortering in de URL, of onthouden in de browser.
- Een aangepaste periode met twee datumvelden.
- Tickets wijzigen vanuit het bord.

## Open vragen

Geen.

## Werklog

- 2026-09-18 18:02 · bord-filters · aangemaakt (status in-uitvoering)
- 2026-09-18 18:10 · bord-filters · gebouwd: view.js (filters, sortering) met 9 eigen tests; tabelweergave, prioriteit- en aanmaakdatumfilter, 'Sorteer op' en 'Wis filters'. Alle 103 bordtests groen. Browserpas op 1440px en 390px: filters, sortering per kolomkop (aria-sort), rij opent detail, herladen zet alles terug behalve soort. Geen antagonist: alleen het lokale bord, geen appcode.
- 2026-09-18 18:10 · bord-filters · in-uitvoering → klaar: bord filtert op prioriteit en aanmaakdatum, sorteert, en heeft een tabelweergave; tests en browserpas groen
