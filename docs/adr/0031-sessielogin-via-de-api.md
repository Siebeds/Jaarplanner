# ADR-0031 — Personal login as a session held by the API (Entra ID over OpenID Connect, no token in the browser)

- **Status:** Accepted. The owner gave the go on 2026-09-11 (ADR-0030 statement 10). One detail changed during the
  build and is marked below: the library.
- **Date:** 2026-09-11
- **Deciders:** Session `E6-01` (technical design), within the owner's rulings of
  [ADR-0030](0030-rollen-en-rechten-in-de-app.md).
- **Realises:** [ADR-0011](0011-authn-authz-rbac-gdpr.md) §1 (personal login over Microsoft Entra ID, the auth
  mechanism wrapped so use cases do not depend on it).
- **Amends:** [ADR-0022](0022-curriculum-administration-authorisation-seam.md) §1.
  - ADR-0022 made the `Curriculumbeheer` policy *"deliberately not `RequireAuthenticatedUser()`"*, because no
    authentication scheme existed. Once one does, the policy gains that requirement (decision 2).
  - ADR-0022's follow-up line, *"E6-01 … at which point an unauthenticated call starts producing 401"*, becomes true
    only because of this amendment: a named policy is not affected by the fallback.
- **Relates to:** [ADR-0003](0003-spa-over-rest-json-api.md) (SPA over REST/JSON, the SPA is untrusted),
  [ADR-0012](0012-secrets-config-management.md) (secrets in user-secrets and Key Vault).
- **Backlog:** E6-01. Closes the authentication half of E7-11. Routes staff data to E7-06.

> **Revised twice the same day on its antagonist's findings.**
> - **Round 1** (`30b7031`):
>   - the first-login binding was under-specified on the one gate that keeps pupils out;
>   - the CSRF rule would have refused the login callback;
>   - `terugNaar` was an open redirect;
>   - 403 was left to a default that redirects;
>   - the ADR-0022 amendment was unmarked.
> - **Round 2** (`68e296e`):
>   - the rationale for `preferred_username` misstated Microsoft's guidance;
>   - the `terugNaar` rule missed the control-character bypass;
>   - the Vite proxy was described as sending a header it did not send;
>   - the front-channel logout was mapped to the wrong path.

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
   - It signs users in with Microsoft Entra ID over OpenID Connect, using the authorization code flow with PKCE as a
     confidential client in a **single tenant**: the school's own (ADR-0030 R1).
   - After sign-in it issues its own cookie. The browser holds no access, ID or refresh token.
   - The client secret lives in user-secrets locally and in Key Vault in the cloud (Art. VI.4).
   - **The handler is the framework's own**, `Microsoft.AspNetCore.Authentication.OpenIdConnect`.
     *Changed during the build:* the Proposed version named Microsoft.Identity.Web. It was dropped because the API
     calls no downstream API, so it needs no token acquisition and no token cache. The framework handler also keeps
     every event this design depends on in plain sight.
2. **Every route requires an authenticated user unless it says otherwise.**
   - A fallback authorization policy requires an authenticated user.
   - The anonymous routes are: the health checks, `GET /api/aanmelden`, `POST /api/afmelden`, the development
     sign-in (Development only, decision 6), and the development-only OpenAPI document.
   - The OpenID Connect callback, `/api/signin-oidc`, is consumed by the authentication middleware before routing
     policy applies, so it is not an endpoint at all.
   - `Curriculumbeheer` gains the same requirement. ASP.NET Core applies the fallback only to endpoints that carry
     **no** authorization metadata, so without this the import would stay anonymous. **This is the ADR-0022
     amendment.** `CurriculumbeheerAutorisatieTests` flips in the same commit. The policy's role half remains
     E6-02's to add.
3. **Authenticated means invited** (ADR-0030 R2). After Entra has authenticated a person, the API decides whether
   they get a session.
   - **Tenant and membership, every login.**
     - The `tid` claim must equal the configured tenant id.
     - The account must be a **member**, not a guest, as stated by the `acct` optional claim, which the app
       registration must emit: `0` means member.
     - **A token without `acct` is refused (fail closed)**, so a registration that forgot the claim lets nobody in,
       rather than letting guests in.
   - **Returning user.** The lookup is by `tid` and `oid`, the pair Microsoft documents as the stable identity. No
     other claim is used for authorization.
   - **First login, and its residual risk.** When no `Gebruiker` carries this `oid`, the API reads
     `preferred_username` once, to find the invitation.
     - Microsoft documents that claim as mutable and warns against authorizing on it, just as it does for `email`.
       It is used here anyway, under three conditions that narrow it to the user principal name the tenant
       administrator assigns:
       - a single tenant;
       - member accounts only;
       - binding **only onto an invitation whose `oid` is still empty**.
     - The address is compared case-insensitively after trimming. Directie cannot create two invitations for one
       address, because addresses are stored normalised and are unique.
     - The binding is then permanent, and every later login uses `tid` and `oid`.
     - **Residual risk, stated:** if the tenant administrator reassigns a UPN to another member *before* the invitee's
       first login, that other member binds the invitation. E6-04 shows whether an invitation is bound yet, so
       directie can see it.
     - The `email` claim is not requested and never read.
   - **The invitation holds the sign-in name.** E6-04's invite field asks for the person's Microsoft sign-in name
     (their UPN), not for "an e-mail address". The two often differ, and inviting by mailbox address would lock
     legitimate staff out.
   - **Refusal.** With no match, no session is issued, and the browser lands on a Dutch page saying that directie has
     to add you first.
4. **An `/api` request is answered with a status, never with a redirect.**
   - For `/api` requests, the cookie handler's redirect-to-login becomes **401** and its redirect-to-access-denied
     becomes **403**. Both carry ProblemDetails. The handler's defaults would send `fetch` to
     `login.microsoftonline.com` and to `/Account/AccessDenied`.
   - **The OpenID Connect challenge runs only on `GET /api/aanmelden`.** It is never the challenge scheme for any
     other route.
   - The SPA reacts to a 401 by sending the browser to `/api/aanmelden?terugNaar=…`.
   - **`terugNaar` must be a local path, with `IsLocalUrl` semantics:**
     - it starts with a single `/`;
     - it does not start with `//` or `/\`;
     - it contains no control character. A decoded tab or newline is exactly what turns `/%09/evil.example` into a
       navigation to `//evil.example`.

     Anything else becomes `/`.
   - `POST /api/afmelden` ends the cookie session and answers with where the browser should go next:
     - with Entra: the Entra sign-out address, with `post_logout_redirect_uri` set to the app's root;
     - in development: the root.

     The SPA navigates there, because the Entra sign-out needs a top-level navigation. The Entra step matters on a
     shared classroom computer, where the next teacher would otherwise be signed in silently as the previous one.
   - **No front-channel logout.** Entra calls it from a cross-site iframe, where a `SameSite=Lax` cookie is never
     sent, so it could not end this session anyway.
   - `GET /api/ik` tells the frontend who is logged in: naam, sign-in address, and whether the person is directie.
   - **A sign-in that does not complete** lands on `/aanmelden-mislukt`, a Dutch page offering to try again. The
     causes include cancelled consent, an error returned by Entra and an expired correlation cookie. The list is not
     exhaustive: the handler also routes here any exception thrown while it processes the token, the invitation
     gate's own database call included. So the page says only that signing in did not work, never whose side failed. It is wired through
     `OnRemoteFailure` and `AccessDeniedPath`; without them the framework answers with an English 500 in a
     top-level page. It is a page of its own because the refusal page's sentences would be false for it: nobody
     refused anything.
5. **The cookie:**
   - `HttpOnly`, `Secure`, `SameSite=Lax`, with the `__Host-` prefix outside Development.
   - Sliding expiry, configurable.
   - **Checked against the database on every request.** A `Gebruiker` that directie removes loses its session
     immediately rather than at expiry.
   - Encrypted with ASP.NET Core Data Protection. Its keys are **persisted in the application database**, so a
     restart or a second instance does not log everyone out.
   - **Outside Development those keys must be wrapped with a Key Vault key** (`DataProtection:KeyVaultSleutel`).
     The app refuses to start without it. The cookie carries only a `Gebruiker` id, so unwrapped keys would let a
     copy of the database mint a session for anyone, directie included. *Tightened on the code round's
     antagonist finding: the first build only wrapped them "when one is configured".*
   - **Cross-site request forgery.**
     - `Lax` already keeps the cookie off cross-site POSTs.
     - As a second layer, every `POST`, `PUT`, `PATCH` or `DELETE` to `/api` must carry the header
       `X-Jaarplanner-Csrf`, which the frontend's `apiFetch` always sends.
     - The check **exempts the OpenID Connect callback paths by name**, because the sign-in callback is a form POST
       from Entra and can never carry the header. It also runs after `UseAuthentication()`, which has already
       consumed that callback.
     - No CORS policy is registered, so a cross-site script cannot get a preflight for that header approved.
6. **Development and tests do not need a tenant.**
   - **Development.**
     - A *development* sign-in replaces the Entra challenge and lets you choose which existing `Gebruiker` to be.
     - It is only mapped when the environment is Development **and** configuration asks for it explicitly
       (`Authenticatie:Modus = Ontwikkeling`). The app refuses to start when that is asked for outside Development.
     - It refuses any request whose remote address is not loopback, or whose `X-Forwarded-For` header has **any**
       non-loopback entry.
     - **E6-01 must set `xfwd: true` on the Vite proxy**, and its done-when says so. Without it, a device on the
       local network that reaches a Vite server started with `--host` arrives as loopback.
     - Past the sign-in it issues **the same cookie**, so the invitation check, the 401/403 handling and the CSRF
       header all run the production path.
   - **Integration tests.**
     - They register a test scheme that authenticates every request unless it asks to be anonymous, or names a
       seeded `Gebruiker`.
     - One test enumerates **every** endpoint in the endpoint data source. It fails if an endpoint is anonymous
       without being on the list in decision 2, and it asserts that every other one answers 401 to an anonymous
       request. So a new controller cannot ship anonymous by accident, which closes the gap ADR-0022's route-prefix
       test left.
7. **The first directie account comes from configuration** (ADR-0030 D1).
   - At startup, **while the `gebruikers` table is empty**, one `Gebruiker` who is directie is created for the
     configured address (`Authenticatie:EersteDirectie`). It is bound like any other invitation (decision 3).
   - The step does nothing once any `Gebruiker` exists. **Removing the last directie therefore does not reopen the
     bootstrap.** E6-04 must refuse to remove or demote the last directie.

## Alternatives considered

- **Tokens in the browser (MSAL.js and bearer tokens).** Rejected:
  - it puts tokens within reach of any script on the page;
  - it adds MSAL and token refresh to a frontend that today has neither;
  - it buys nothing here, because the SPA and the API already share an origin.

  Current guidance for browser-based OAuth apps (IETF *OAuth 2.0 for Browser-Based Applications*) prefers the
  server-held session for exactly this shape.
- **Microsoft.Identity.Web.** Named in the Proposed version, dropped in decision 1: it earns its place when a web app
  calls downstream APIs on the user's behalf, which this one does not.
- **Azure App Service "Easy Auth".** Rejected as the mechanism. It works only when hosted on App Service, it cannot
  run locally or in the integration tests, and the invitation check would still have to live in the app. ADR-0011
  §1 asks for the mechanism to be swappable, not tied to a host.
- **Roles or the invitation gate in Entra.** Rejected by ADR-0030 R1 and R2. Still **recommended as a second
  layer** at deployment: set *assignment required* on the app registration and assign the staff group, so that
  Entra refuses a pupil account before it ever reaches the app's own check.
- **Bind the first login on the `email` claim.** Rejected in decision 3. It is not administrator-controlled, and
  often not even present.
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
- **Every authenticated request costs one lookup of the `Gebruiker`.** That lookup is what makes a removal take
  effect immediately. It is a primary-key read on a small table.
- **A local login against a real tenant needs the Vite proxy to preserve the `Host` header**, so the redirect URI
  Entra sees matches the registered one. Day-to-day development uses the development sign-in and never meets this.
- **Staff personal data** (naam, sign-in address, `tid`, `oid`) and session cookies need an entry in the processing
  register and a retention period (Art. VI.6). That is routed to **E7-06**.
- **After E6-01, every invited user can still do everything except the curriculum import.** Authentication is not
  authorisation: until E6-02 enforces the ADR-0030 matrix, a logged-in leerkracht can edit another klas.
  **E7-11 therefore stays `[!]` until E6-02 lands.** Its authentication half is done, its authorisation half is
  not.

**Deployment prerequisites** (recorded for E7, not built here):

- An app registration in the school's tenant:
  - single tenant, web platform;
  - redirect URI `https://<host>/api/signin-oidc`, and post-logout redirect URI `https://<host>/`;
  - no front-channel logout URL;
  - the scopes `openid profile`, with no Microsoft Graph permissions;
  - the `acct` optional claim in the ID token.
- The client secret in Key Vault, as `Authenticatie--Entra--ClientSecret`.
- **A Key Vault key for the Data Protection keys**, as `DataProtection:KeyVaultSleutel`. It is required: the app
  refuses to start outside Development without it.
- *Assignment required* on, with the staff group assigned.
- HTTPS only, with HSTS.
- **Forwarded headers.** The app has no `UseForwardedHeaders`, so on App Service set
  `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true`. Otherwise the sign-in's `redirect_uri` and the post-logout address
  are built with `http`, and Entra refuses them.
- The .NET and ASP.NET Core shared frameworks at **10.0.10 or later**, the first release that patches the five
  `System.Security.Cryptography.Xml` advisories. The package pin does not reach a web project, which loads the
  shared framework's copy.
- One real-tenant round trip before the gate opens. The tests stop at the configured events and a static discovery
  document.

These prerequisites are also written on E7-11, which owns them.

## Compliance trace

- **Constitution:**
  - Art. VI.1: the login that role-based permissions need.
  - Art. VI.2: the invitation gate, member-only binding that fails closed, and Entra assignment keep pupil accounts
    out.
  - Art. VI.4: the secret is in user-secrets and Key Vault, none in the repo, none in the browser.
  - Art. VI.5: personal login, encrypted in transit and at rest.
  - Art. VI.6: staff data is routed to E7-06.
  - Art. VIII: the mechanism lives in Api and Infrastructure. `Application` sees `IToegangService` and an
    `EntraIdentiteit` record, never an OpenID Connect type.
  - Art. II.3: the refusal a teacher reads is Dutch. The development sign-in page, which only a developer sees, is
    English.
- **Backlog:** E6-01; E7-11 (its authentication half); E6-02 (binds roles onto the principal this creates); E6-04
  (the invitation holds the UPN; the last directie cannot be removed); E7-06 (processing register).
- **FR/NFR:** FR-10, NFR-5, NFR-6.
