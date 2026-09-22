---
id: TB-066
titel: API en app sturen beveiligingsheaders mee en aanvaarden alleen hun eigen hostnaam
soort: technisch
status: nieuw
prioriteit: laag
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 00:22
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Gevonden bij de securityscan van 2026-09-23. De API en de app, die door de API geserveerd wordt, sturen geen
beveiligingsheaders mee (`Api/Program.cs`): geen `Content-Security-Policy`, geen `frame-ancestors` of
`X-Frame-Options`, geen algemene `X-Content-Type-Options` en geen `Referrer-Policy`. Het risico is vandaag klein:
`SameSite=Lax` houdt de sessiecookie uit een vreemd iframe, en React ontsnapt alle tekst. Maar een CSP is de tweede
verdedigingslinie als er ooit toch een XSS binnensluipt.

Daarnaast staat `AllowedHosts` op `*`. `Aanmelding.EntraAfmeldAdres` bouwt het terugkeeradres na afmelden uit
`Request.Host`. Entra aanvaardt alleen geregistreerde adressen, dus dat is geen open redirect, maar een vaste lijst
hostnamen per omgeving is netter.

## Voorgestelde wijziging

- Een middleware in `Program.cs` die op elk antwoord `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` en een `Content-Security-Policy` zet, met `frame-ancestors 'none'`,
  `default-src 'self'` en de bronnen die de app echt gebruikt. Het inline themascript in `frontend/index.html` krijgt
  een hash in de CSP of wordt een apart bestand.
- In Development mag de CSP soepeler zijn voor Vite (HMR).
- `AllowedHosts` krijgt per omgeving de echte hostnaam (voor de demo: de hostnaam van de web app), via de configuratie
  in `infra/main.bicep`.

## Acceptatiecriteria

- [ ] Gegeven de app in de Azure-demo, wanneer de browser een pagina of een API-antwoord ophaalt, dan staan de vier
  headers erop.
- [ ] Gegeven die CSP, wanneer een leerkracht de belangrijkste schermen opent (agenda, thema's, dekking, instellingen,
  ontwikkelingsrapport), dan meldt de browserconsole geen CSP-overtreding en werkt alles zoals vandaag.
- [ ] Gegeven een pagina van een andere site die de app in een iframe laadt, dan weigert de browser dat.
- [ ] Gegeven een verzoek met een vreemde `Host`-header, dan weigert de API het in de Azure-demo.

## Buiten scope

- HSTS en de omleiding naar HTTPS: die staan al aan.
- CORS: er is geen CORS-beleid, en dat blijft zo.

## Open vragen

Geen.

## Werklog

- 2026-09-23 00:22 · claude-securityscan · aangemaakt (status nieuw)
