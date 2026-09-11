# ADR-0031 — Personal login as a session held by the API (Entra ID over OpenID Connect, no token in the browser)

- **Status:** Proposed. It becomes Accepted when the owner approves the E6-01 plan.
- **Date:** 2026-09-11
- **Deciders:** Session `E6-01` (technical design), within the owner's rulings of [ADR-0030](0030-rollen-en-rechten-in-de-app.md).
- **Realises:** [ADR-0011](0011-authn-authz-rbac-gdpr.md) §1 (personal login over Microsoft Entra ID, the auth
  mechanism wrapped so use cases do not depend on it). **Supersedes nothing.**
- **Relates to:** [ADR-0003](0003-spa-over-rest-json-api.md) (SPA over REST/JSON, the SPA is untrusted),
  [ADR-0012](0012-secrets-management.md) (secrets in user-secrets and Key Vault),
  [ADR-0022](0022-curriculum-administration-authorisation-seam.md) (the `Curriculumbeheer` seam, which stops
  admitting anonymous callers here).
- **Backlog:** E6-01. Closes the authentication half of E7-11.

## Context

The API has no authentication scheme. `UseAuthorization()` is wired, and exactly one policy exists, which admits
everyone (ADR-0022). The frontend reaches the API through relative `/api/...` paths, same-origin: through the
Vite proxy in development, and from one host in Azure.

A browser SPA can log in to Entra in two ways:

1. **Tokens in the browser.** MSAL.js acquires an access token, and every fetch carries `Authorization: Bearer`.
   The API validates JWTs.
2. **A session held by the server** (the "backend for frontend" pattern). The API runs the OpenID Connect flow
   itself as a confidential client, then gives the browser an encrypted, `HttpOnly` session cookie. The SPA never
   sees a token.

## Decision

1. **The API holds the session (option 2).** It signs users in with Microsoft Entra ID over OpenID Connect
   (authorization code flow, confidential client, single tenant: the school's own tenant, per ADR-0030 ruling 1),
   using **Microsoft.Identity.Web** (`AddMicrosoftIdentityWebApp`). It then issues its own cookie. The browser
   holds no access, ID or refresh token. The client secret or certificate lives in user-secrets locally and in
   Key Vault in the cloud (Art. VI.4).
2. **Every route requires an authenticated user unless it says otherwise.** A fallback authorization policy
   requires an authenticated user. Only the health checks, the login and logout routes and the development-only
   OpenAPI document are anonymous. `Curriculumbeheer` gains the same requirement, because a named policy replaces
   the fallback rather than adding to it. Its role half is still E6-02's to add.
3. **Authenticated means invited** (ADR-0030 ruling 2). During sign-in the API looks up the `Gebruiker`.
   - On a person's **first** login, the lookup is by e-mail address within the configured tenant, which is how
     directie invited them. The Entra object id is then bound to the `Gebruiker` for good.
   - **Afterwards** the lookup is by tenant id and object id only, because an e-mail address can be reassigned to
     someone else.
   - With no matching `Gebruiker`, no session is issued, and the browser lands on a Dutch page saying that
     directie has to add you first.
4. **An `/api` request is answered with 401, never with a redirect.** A redirect to `login.microsoftonline.com`
   is useless to `fetch`. The SPA reacts to a 401 by sending the browser to `GET /api/aanmelden?terugNaar=…`,
   which starts the flow and returns the teacher to where they were. `POST /api/afmelden` ends the session and
   the Entra session. `GET /api/ik` tells the frontend who is logged in: naam, e-mail, and whether the person is
   directie. The OpenID Connect callback paths sit **under `/api`** (`/api/signin-oidc`,
   `/api/signout-callback-oidc`), so the existing single proxy rule covers them.
5. **The cookie:**
   - `HttpOnly`, `Secure`, `SameSite=Lax`, with the `__Host-` prefix wherever the app is served over HTTPS.
   - Sliding expiry, configurable.
   - Encrypted with ASP.NET Core Data Protection. Its keys are **persisted in the application database**, so a
     restart or a second instance does not log everyone out. In the cloud those keys are protected with a Key
     Vault key.
   - **Cross-site request forgery:** `Lax` already keeps the cookie off cross-site POSTs. As a second layer,
     every state-changing `/api` request must carry a custom header that the frontend's `apiFetch` always sends.
     A cross-site form cannot set that header, and a cross-site script cannot send it without a CORS preflight
     that the API refuses.
6. **Development and tests do not need a tenant.**
   - **Development:** a *development* sign-in replaces the Entra challenge. It lets you choose which existing
     `Gebruiker` to be. It is only registered when the environment is Development **and** configuration asks for
     it explicitly, it refuses requests that are not from loopback, and the app refuses to start when it is asked
     for outside Development. Past that point it issues **the same cookie**, so the invitation check, the 401
     handling and the CSRF header are the production path.
   - **Integration tests:** they register a test scheme that authenticates from a request header naming a seeded
     `Gebruiker`. One test enumerates every `/api` endpoint from the endpoint data source and asserts that each
     answers 401 without it, so a new controller cannot ship anonymous by accident. That is the gap
     ADR-0022's route-prefix test left open.
7. **The first directie account comes from configuration.** At startup, when no `Gebruiker` who is directie
   exists, one is created for the configured e-mail address. The step is idempotent, and it does nothing once
   directie exists.

## Alternatives considered

- **Tokens in the browser (MSAL.js + bearer).** Rejected:
  - it puts tokens within reach of any script on the page;
  - it adds MSAL and token refresh to a frontend that today has neither;
  - it buys nothing here, because the SPA and the API already share an origin.

  Current guidance for browser-based OAuth apps (IETF *OAuth 2.0 for Browser-Based Applications*) prefers the
  server-held session for exactly this shape.
- **Azure App Service "Easy Auth".** Rejected as the mechanism. It works only when hosted on App Service, it
  cannot run locally or in the integration tests, and the invitation check would still have to live in the app.
  ADR-0011 §1 asks for the mechanism to be swappable, not tied to a host.
- **Roles or the invitation gate in Entra.** Rejected by ADR-0030 rulings 1 and 2. Still **recommended as a second
  layer** at deployment: set *assignment required* on the app registration and assign the staff group, so that a
  pupil account is refused by Entra before it ever reaches the app's own check.
- **Keep anonymous access until E6-02 and add authentication and roles together.** Rejected. E7-11 has held
  deployment for six weeks while the anonymous surface grew to 91 endpoints. Authentication is the part that
  closes "an unauthenticated caller can bill the school in a loop" (E7-11, the AI endpoints), and it does not
  depend on the open questions ADR-0030 leaves to E6-02.

## Consequences

**Positive**
- No token can leak from the browser.
- The frontend change is small: `apiFetch` sends a header and reacts to a 401, and the shell shows who is logged
  in and offers "Afmelden".
- The whole API surface is authenticated by default, and a test holds that default.

**Negative / trade-offs**
- The API becomes stateful in one respect: the Data Protection keys. They move into the database, which needs a
  migration (a table for the keys), next to the `gebruikers` table.
- A local login against a real tenant needs the Vite proxy to preserve the `Host` header, so that the redirect URI
  Entra sees matches the registered one. Day-to-day development uses the development sign-in and never meets this.
- **After E6-01, every invited user can still do everything except the curriculum import.** Authentication is
  not authorisation: until E6-02 enforces the ADR-0030 matrix, a logged-in leerkracht can edit another klas.
  **E7-11 therefore stays `[!]` until E6-02 lands.** Its authentication half is done, its authorisation half is
  not.

**Deployment prerequisites** (recorded for E7, not built here):
- an app registration in the school's tenant, of type single tenant, on the web platform, with redirect URI
  `https://<host>/api/signin-oidc`;
- claims limited to `openid profile email`;
- a secret or certificate in Key Vault;
- *assignment required* on, with the staff group assigned;
- HTTPS only, with HSTS.

## Compliance trace

- **Constitution:** Art. VI.1 (the login that role-based permissions need), Art. VI.2 (the invitation gate plus
  Entra assignment keep pupil accounts out), Art. VI.4 (secret in user-secrets and Key Vault, none in the repo,
  none in the browser), Art. VI.5 (personal login, encrypted in transit and at rest), Art. VIII (the mechanism in
  Api and Infrastructure; `Application` sees a current-user abstraction, never an Entra type), Art. II.3 (the
  refusal a teacher reads is Dutch).
- **Backlog:** E6-01; E7-11 (its authentication half); E6-02 (binds roles onto the principal this creates).
- **FR/NFR:** FR-10, NFR-5.
