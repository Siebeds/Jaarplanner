# ADR-0031 — Personal login as a session held by the API (Entra ID over OpenID Connect, no token in the browser)

- **Status:** Proposed. It becomes Accepted when the owner approves the E6-01 plan.
- **Date:** 2026-09-11
- **Deciders:** Session `E6-01` (technical design), within the owner's rulings of
  [ADR-0030](0030-rollen-en-rechten-in-de-app.md).
- **Realises:** [ADR-0011](0011-authn-authz-rbac-gdpr.md) §1 (personal login over Microsoft Entra ID, the auth
  mechanism wrapped so use cases do not depend on it).
- **Amends:** [ADR-0022](0022-curriculum-administration-authorisation-seam.md) §1. The `Curriculumbeheer` policy
  was *"deliberately not `RequireAuthenticatedUser()`"* because no scheme existed. Once one does, it gains that
  requirement (decision 2). ADR-0022's follow-up line, *"E6-01 … at which point an unauthenticated call starts
  producing 401"*, becomes true only because of this amendment, since a named policy is not affected by the
  fallback.
- **Relates to:** [ADR-0003](0003-spa-over-rest-json-api.md) (SPA over REST/JSON, the SPA is untrusted),
  [ADR-0012](0012-secrets-config-management.md) (secrets in user-secrets and Key Vault).
- **Backlog:** E6-01. Closes the authentication half of E7-11. Routes staff data to E7-06.

> **Revised the same day on its antagonist's findings** (`30b7031` → this version):
> - the first-login binding was under-specified on the one gate that keeps pupils out;
> - the CSRF rule would have refused the login callback;
> - `terugNaar` was an open redirect;
> - 403 was left to a default that redirects;
> - the development sign-in's loopback check could be reached through a proxy;
> - the ADR-0022 amendment was unmarked.

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

1. **The API holds the session (option 2).**
   - It signs users in with Microsoft Entra ID over OpenID Connect, using the authorization code flow as a
     confidential client in a **single tenant**: the school's own (ADR-0030 R1). The library is
     **Microsoft.Identity.Web** (`AddMicrosoftIdentityWebApp`).
   - After sign-in it issues its own cookie. The browser holds no access, ID or refresh token.
   - The client secret or certificate lives in user-secrets locally and in Key Vault in the cloud (Art. VI.4).
2. **Every route requires an authenticated user unless it says otherwise.**
   - A fallback authorization policy requires an authenticated user.
   - Only these routes are anonymous: the health checks, `/api/aanmelden`, the two OpenID Connect callback paths,
     and the development-only OpenAPI document.
   - `Curriculumbeheer` gains the same requirement. ASP.NET Core applies the fallback only to endpoints that carry
     **no** authorization metadata, so without this the import would stay anonymous. **This is the ADR-0022
     amendment.** `CurriculumbeheerAutorisatieTests` flips in the same commit. The policy's role half remains
     E6-02's to add.
3. **Authenticated means invited** (ADR-0030 R2). After Entra has authenticated a person, the API decides whether
   they get a session.
   - **Tenant.** The `tid` claim must equal the configured tenant id, and the account must be a **member**, not a
     guest. That is checked through the `acct` optional claim, which the app registration must emit: `0` means
     member.
   - **Returning user.** The lookup is by `tid` and `oid`, the pair Microsoft documents as the stable identity.
     **No e-mail claim is used for authorization.**
   - **First login.** When no `Gebruiker` carries this `oid`, the API reads `preferred_username`. In a
     single-tenant app for member accounts, that is the UPN the tenant administrator assigns; the user cannot
     change it.
     - It is compared case-insensitively with the e-mail directie entered, after trimming.
     - A match binds **only a `Gebruiker` whose `oid` is still empty**, and the binding is permanent. An address
       that is later reassigned to someone else cannot take over a bound account.
     - The `email` claim is never read, because a user can influence it and Microsoft does not verify it for
       authorization.
   - **Refusal.** With no match, no session is issued, and the browser lands on a Dutch page saying that directie
     has to add you first.
4. **An `/api` request is answered with a status, never with a redirect.**
   - For `/api` requests, the cookie handler's redirect-to-login becomes **401** and its redirect-to-access-denied
     becomes **403**. Both carry ProblemDetails. The cookie handler's defaults would send `fetch` to
     `login.microsoftonline.com` and to `/Account/AccessDenied`.
   - **The OpenID Connect challenge runs only on `GET /api/aanmelden`.** It is never the challenge scheme for any
     other route.
   - The SPA reacts to a 401 by sending the browser to `/api/aanmelden?terugNaar=…`. `terugNaar` must be a
     **local path**: it starts with a single `/`, and does not start with `//` or `/\`. Anything else becomes `/`,
     so the login cannot be turned into an open redirect.
   - `POST /api/afmelden` ends the cookie session and answers with the Entra sign-out address. The SPA then
     navigates there, because the Entra sign-out needs a top-level navigation.
   - `GET /api/ik` tells the frontend who is logged in: naam, e-mail, and whether the person is directie.
   - The callback paths sit **under `/api`** (`/api/signin-oidc`, `/api/signout-callback-oidc`), so the existing
     single proxy rule covers them.
5. **The cookie:**
   - `HttpOnly`, `Secure`, `SameSite=Lax`, with the `__Host-` prefix wherever the app is served over HTTPS.
   - Sliding expiry, configurable.
   - Encrypted with ASP.NET Core Data Protection. Its keys are **persisted in the application database**, so a
     restart or a second instance does not log everyone out. In the cloud those keys are protected with a Key Vault
     key.
   - **Cross-site request forgery.** `Lax` already keeps the cookie off cross-site POSTs. As a second layer, every
     `POST`, `PUT`, `PATCH` or `DELETE` to `/api` must carry a custom header, which the frontend's `apiFetch` always
     sends. The check **exempts the two OpenID Connect callback paths by name**, because the sign-in callback is a
     form POST from Entra and can never carry the header. It also runs after `UseAuthentication()`. No CORS policy
     is registered, so a cross-site script cannot get a preflight for that header approved.
6. **Development and tests do not need a tenant.**
   - **Development.** A *development* sign-in replaces the Entra challenge and lets you choose which existing
     `Gebruiker` to be. It is only registered when the environment is Development **and** configuration asks for it
     explicitly. It refuses any request whose remote address is not loopback, or that carries an
     `X-Forwarded-For` naming a non-loopback address. **The Vite proxy is configured to send that header
     (`xfwd`)**, so a device on the local network that reaches a Vite server started with `--host` is still
     refused. The app refuses to start when the development sign-in is asked for outside Development. Past the
     sign-in it issues **the same cookie**, so the invitation check, the 401/403 handling and the CSRF header all
     run the production path.
   - **Integration tests.** They register a test scheme that authenticates from a request header naming a seeded
     `Gebruiker`. One test enumerates **every** endpoint in the endpoint data source and asserts that each one not
     on the anonymous list answers 401 without that header. So a new controller cannot ship anonymous by accident,
     which closes the gap ADR-0022's route-prefix test left.
7. **The first directie account comes from configuration** (ADR-0030 D1).
   - At startup, **when the `gebruikers` table is empty**, one `Gebruiker` who is directie is created for the
     configured e-mail address. It is bound like any other invitation (decision 3).
   - The step does nothing once any `Gebruiker` exists. **Removing the last directie therefore does not reopen the
     bootstrap.** E6-04 must refuse to remove or demote the last directie.

## Alternatives considered

- **Tokens in the browser (MSAL.js and bearer tokens).** Rejected:
  - it puts tokens within reach of any script on the page;
  - it adds MSAL and token refresh to a frontend that today has neither;
  - it buys nothing here, because the SPA and the API already share an origin.

  Current guidance for browser-based OAuth apps (IETF *OAuth 2.0 for Browser-Based Applications*) prefers the
  server-held session for exactly this shape.
- **Azure App Service "Easy Auth".** Rejected as the mechanism. It works only when hosted on App Service, it cannot
  run locally or in the integration tests, and the invitation check would still have to live in the app. ADR-0011
  §1 asks for the mechanism to be swappable, not tied to a host.
- **Roles or the invitation gate in Entra.** Rejected by ADR-0030 R1 and R2. Still **recommended as a second
  layer** at deployment: set *assignment required* on the app registration and assign the staff group, so that
  Entra refuses a pupil account before it ever reaches the app's own check.
- **Bind the first login on the `email` claim.** Rejected in decision 3. The claim is not administrator-controlled,
  and Microsoft advises against authorizing on it.
- **Keep anonymous access until E6-02, and add authentication and roles together.** Rejected:
  - E7-11 has held deployment for six weeks while the anonymous surface grew to 91 endpoints;
  - authentication is what closes "an unauthenticated caller can bill the school in a loop" (E7-11, the AI
    endpoints);
  - it depends on none of the questions ADR-0030 leaves open.

## Consequences

**Positive**

- No token can leak from the browser.
- The frontend change is small:
  - `apiFetch` sends a header and reacts to a 401;
  - the shell shows who is logged in and offers "Afmelden";
  - one page explains a refused login.
- The whole API surface is authenticated by default, and a test holds that default.

**Negative / trade-offs**

- **The API becomes stateful in one respect: the Data Protection keys.** They move into the database. One
  migration adds a table for them, next to the `gebruikers` table.
- **A local login against a real tenant needs the Vite proxy to preserve the `Host` header**, so the redirect URI
  Entra sees matches the registered one. Day-to-day development uses the development sign-in and never meets this.
- **Staff personal data** (naam, e-mail, `tid`, `oid`) and session cookies need an entry in the processing register
  and a retention period (Art. VI.6). That is routed to **E7-06**.
- **After E6-01, every invited user can still do everything except the curriculum import.** Authentication is not
  authorisation: until E6-02 enforces the ADR-0030 matrix, a logged-in leerkracht can edit another klas.
  **E7-11 therefore stays `[!]` until E6-02 lands.** Its authentication half is done, its authorisation half is
  not.

**Deployment prerequisites** (recorded for E7, not built here):

- An app registration in the school's tenant:
  - single tenant, web platform;
  - redirect URI `https://<host>/api/signin-oidc`, front-channel logout `https://<host>/api/signout-callback-oidc`;
  - the scopes `openid profile email`, with no Microsoft Graph permissions;
  - the `acct` optional claim in the ID token.
- A secret or certificate in Key Vault.
- *Assignment required* on, with the staff group assigned.
- HTTPS only, with HSTS.

## Compliance trace

- **Constitution:**
  - Art. VI.1: the login that role-based permissions need.
  - Art. VI.2: the invitation gate, member-only binding and Entra assignment keep pupil accounts out.
  - Art. VI.4: the secret is in user-secrets and Key Vault, none in the repo, none in the browser.
  - Art. VI.5: personal login, encrypted in transit and at rest.
  - Art. VI.6: staff data is routed to E7-06.
  - Art. VIII: the mechanism lives in Api and Infrastructure. `Application` sees a current-user abstraction, never
    an Entra type.
  - Art. II.3: the refusal a teacher reads is Dutch.
- **Backlog:** E6-01; E7-11 (its authentication half); E6-02 (binds roles onto the principal this creates); E6-04
  (the last directie cannot be removed); E7-06 (processing register).
- **FR/NFR:** FR-10, NFR-5, NFR-6.
