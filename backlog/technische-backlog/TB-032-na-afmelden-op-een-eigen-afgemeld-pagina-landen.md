---
id: TB-032
titel: Na afmelden op een eigen afgemeld-pagina landen, niet meteen opnieuw aangemeld worden
soort: technisch
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-18 18:34
opgepakt-door: claude-tb032
branch: ticket/TB-032-afgemeld-pagina
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Op de Azure-demo lijkt de knop *Afmelden* niets te doen: wie afmeldt, zit na een paar seconden weer in de app. De
eigenaar merkte het op; onderzocht op 2026-09-15.

Wat er gebeurt:

1. `POST /api/afmelden` werkt: het wist de sessiecookie en antwoordt met het afmeldadres van Microsoft (https, met
   `post_logout_redirect_uri` naar de root). Dat adres staat ook in de app-registratie.
2. Zonder `id_token_hint` moet Microsoft eerst vragen welk account afgemeld wordt (OpenID Connect RP-Initiated Logout
   1.0): de accountkiezer.
3. Na de afmelding stuurt Microsoft de browser terug naar `/`. Daar antwoordt `/api/ik` met 401 en stuurt
   `aanmeldOmleiding` (`frontend/src/lib/api.ts`) de browser meteen naar `/api/aanmelden`, dus terug naar Microsoft.
4. Kent de browser of Windows dat account nog (Primary Refresh Token), dan meldt Microsoft na de accountkiezer aan
   zonder wachtwoord. Dat gedrag is van Microsoft en valt niet te voorkomen door de app.

De gangbare praktijk is een eigen, anonieme pagina na het afmelden (ASP.NET Core-documentatie, *Configure OpenID
Connect Web (UI) authentication*: `RedirectUri = "/SignedOut"` met `[AllowAnonymous]`). Microsoft raadt voor gedeelde
toestellen aan alle browservensters te sluiten, en zegt dat een app die niet op de Microsoft-afmeldpagina eindigt, dat
zelf kan melden. OWASP (*Session Management Cheat Sheet*) raadt de header `Clear-Site-Data` aan bij het afmelden. Op
een gedeelde klascomputer weegt dit extra (ADR-0031).

## Voorgestelde wijziging

**Frontend.** Een nieuwe pagina `/afgemeld`, zoals `GeenToegangScherm`: buiten de shell, en ze vraagt de API niets
bij het openen. Ze zegt dat je afgemeld bent, herinnert eraan op een gedeelde computer alle browservensters te sluiten,
en heeft één hoofdknop *Opnieuw aanmelden* naar `aanmeldAdres("/")`. Tekst in `nl.json`. `/afgemeld` komt in
`ZONDER_OMLEIDING` in `frontend/src/lib/api.ts`, zodat een 401 daar nooit naar de aanmelding stuurt. Het ontwerp
begint met de skill `frontend-design` (CLAUDE.md, UI work).

**Backend.** `Aanmelding.EntraAfmeldAdres` zet `post_logout_redirect_uri` op `https://<host>/afgemeld`; in de modus
Ontwikkeling antwoordt `POST /api/afmelden` met `/afgemeld` in plaats van `/`. Het antwoord van `POST /api/afmelden`
krijgt de header `Clear-Site-Data` (het OWASP-voorbeeld: `"cache", "cookies", "storage"`).

**Configuratie en documentatie.** `https://<host>/afgemeld` als redirect-URI in de app-registratie van de demo, en in
`infra/README.md` (stap 4). ADR-0031 noemt de root als terugkeeradres na het afmelden: dat krijgt een amendement.

**Tests.** Vitest: de pagina roept de API niet aan en de knop wijst naar de aanmelding; `aanmeldOmleiding` stuurt niet
door vanaf `/afgemeld`. Integratietest: het afmeldantwoord (adres en header), in beide modi.

## Acceptatiecriteria

- [ ] Gegeven een aangemelde gebruiker op de demo, wanneer die op *Afmelden* klikt en de afmelding bij Microsoft
  afrondt, dan landt de browser op `/afgemeld` en start er vanzelf geen nieuwe aanmelding.
- [ ] Gegeven de pagina `/afgemeld`, wanneer ze opent, dan vraagt ze de API niets, zegt ze dat je afgemeld bent, geeft
  ze de herinnering voor een gedeelde computer, en start *Opnieuw aanmelden* de aanmelding met terugkeer naar `/`.
- [ ] Gegeven `POST /api/afmelden`, dan draagt het antwoord `Clear-Site-Data` en wijst `doorsturenNaar` naar
  `/afgemeld`: via Microsoft in de modus Entra, rechtstreeks in de modus Ontwikkeling (integratietest).
- [ ] Gegeven de app-registratie van de demo en `infra/README.md`, dan staat `https://<host>/afgemeld` erin als
  redirect-URI.
- [ ] Gegeven de pagina op desktop en op ~390px, dan staat alle tekst in `nl.json` en haalt ze WCAG 2.2 AA, gemeten in
  een echte browser.

## Buiten scope

- De sessie op de server ongeldig maken bij het afmelden (OWASP): apart ticket.
- `logout_hint` of `id_token_hint` om de accountkiezer over te slaan: vraagt dat de sessie meer bewaart dan het
  gebruikers-id, dus een nieuwe ADR.
- `SameSite=Strict` en front-channel logout (die laatste bewust niet, ADR-0031).
- De automatische aanmelding die Microsoft doet op een toestel met een Primary Refresh Token.

## Open vragen

Geen.

## Werklog

- 2026-09-15 22:14 · claude · aangemaakt (status nieuw)
- 2026-09-18 18:16 · claude-tb032 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-18 18:34 · claude-tb032 · Gebouwd: /afgemeld-pagina, Clear-Site-Data, terugkeeradres naar /afgemeld; gates groen (Vitest 1232, lint, format, backend 2134 + 569, één flaky test die los 3/3 slaagt); browsercheck desktop en 390px, contrast AA. Antagonist loopt.
