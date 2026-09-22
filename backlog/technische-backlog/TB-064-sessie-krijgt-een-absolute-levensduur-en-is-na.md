---
id: TB-064
titel: Sessie krijgt een absolute levensduur en is na afmelden niet meer bruikbaar
soort: technisch
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 00:21
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Gevonden bij de securityscan van 2026-09-23. De sessiecookie (`Api/Infrastructure/Authenticatie/Aanmelding.cs`) blijft
10 uur geldig en verlengt zich bij elk gebruik (`SlidingExpiration`), zonder absoluut einde. `ValideerSessieAsync`
controleert alleen dat de gebruiker nog bestaat. Gevolgen:

- Een sessie die elke dag gebruikt wordt, verloopt nooit.
- Afmelden wist de cookie in de browser, maar een gekopieerde cookie blijft werken tot ze 10 uur niet gebruikt is.
- Een account dat de school in Entra uitschakelt of dat gast wordt, houdt toegang zolang de sessie loopt. De controle
  op gasten (Art. VI.2) gebeurt alleen bij het aanmelden.

Op een gedeelde klascomputer weegt dat door.

## Voorgestelde wijziging

- Een absolute levensduur van de sessie, los van de glijdende 10 uur. Na die tijd meldt de gebruiker zich opnieuw aan
  via Entra, waar het account en de gaststatus opnieuw gecontroleerd worden.
- De sessie intrekbaar maken: een sessieversie (security stamp) op de gebruiker, meegegeven in de cookie en bij elk
  verzoek vergeleken in `ValideerSessieAsync`. Afmelden en het intrekken door een admin verhogen de versie.
- Code: `Aanmelding.cs`, het gebruikersmodel en een migratie, `GebruikersController` voor het intrekken, en
  integratietests.

## Acceptatiecriteria

- [ ] Gegeven een sessie die ouder is dan de absolute levensduur, wanneer de gebruiker een verzoek doet, dan is de
  sessie ongeldig en moet hij zich opnieuw aanmelden, ook als hij ze onafgebroken gebruikte.
- [ ] Gegeven een kopie van de cookie van vóór het afmelden, wanneer iemand ze na het afmelden gebruikt, dan weigert de
  server ze.
- [ ] Gegeven een admin die de sessies van een gebruiker intrekt, wanneer die gebruiker nog een verzoek doet, dan
  weigert de server de sessie.
- [ ] Gegeven een gewone aanmelding, dan merkt de leerkracht binnen een schooldag niets van deze wijziging.

## Buiten scope

- De aanmelding via Entra zelf (ADR-0031).
- Een overzicht van actieve sessies per gebruiker.

## Open vragen

- De absolute levensduur. Voorstel: 12 uur, zodat een schooldag altijd past en de sessie 's nachts vervalt.
- Of afmelden alle sessies van de gebruiker beëindigt, ook op een ander toestel, of alleen die van dit toestel. Met één
  sessieversie per gebruiker wordt het het eerste.

## Werklog

- 2026-09-23 00:21 · claude-securityscan · aangemaakt (status nieuw)
