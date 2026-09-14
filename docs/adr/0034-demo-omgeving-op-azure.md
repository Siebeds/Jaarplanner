# ADR-0034 — A demo environment on Azure: the cheapest services, the API serves the frontend, and the owner's waiver of the E7-11 deployment clause

- **Status:** Accepted (project owner ruling, 2026-09-13)
- **Date:** 2026-09-13
- **Deciders:** Siebe De Saedeleir (projecteigenaar)
- **Realises:** [ADR-0016](0016-azure-hosting-eu-residency.md), which fixed Azure in an EU region and left *"the specific
  Azure services"* to an ADR of their own. This is that ADR, **for a demo environment only**.
- **Amends:** [ADR-0031](0031-sessielogin-via-de-api.md) decision 2, the list of anonymous routes. The frontend's
  `index.html` for a client route joins it (decision 3 below): a browser without a session has to load the page that
  sends it to the sign-in. The route excludes `api/` and `health/`, so the list gains no API path.
- **Relates to:** [ADR-0012](0012-secrets-config-management.md) (secrets), [ADR-0021](0021-frontend-routing-and-url-selection.md)
  (real URLs need an SPA fallback), [ADR-0030](0030-rollen-en-rechten-in-de-app.md) (directie holds every right).
- **Backlog:** E7-04 (hosting and the SPA fallback), E7-11 (the gate, where the waiver is recorded), E7-05 (a
  least-privilege database role is owed), E7-09 (backups).

## Context

The owner wants the app online for demos and tests, including a test of the Entra sign-in, at as close to zero cost as
possible. Three things stood in the way:

- **E7-11**'s Done-when ends *"and no deployment to a reachable environment happens before then"*, that is, before the
  role matrix (E6-02) is enforced. E6-01 closed the authentication half on 2026-09-11; the authorisation half has not
  started.
- **E7-04** requires whatever serves the frontend to answer every client route with `index.html`, and nothing in the
  repo did: the API served no files at all.
- **ADR-0016** fixed the constraints (Azure, an EU region, the EU AI data zone, encryption, no pupil data) but named no
  services.

The subscription is Pay-As-You-Go **without a spending limit**. It still carries the 12-month free services, PostgreSQL
Flexible Server B1ms among them, which the owner checked in the portal on 2026-09-13.

## Decision

1. **The owner waives E7-11's deployment clause for this one environment.**
   - On 2026-09-13 the owner was offered two options, quoted here as they were put, in Dutch:
     - *"A. Eerst E6-02 bouwen."*
     - *"B. Een uitzondering vastleggen voor een demo-omgeving (mijn advies). De voorwaarden: alleen fictieve data,
       alleen testaccounts die jij zelf uitnodigt, en AI uit of met een budgetplafond."*
   - The owner answered: *"niet E6-02 bouwen, doe maar infra en deploy"*.
   - **What is waived is the backlog clause, not Art. VI.1.** The codebase does not meet Art. VI.1 until E6-02 lands,
     deployed or not, and this ADR changes nothing about that.
   - **The implementer's reading of the conditions**, which is how this environment is run. These are not the owner's
     words:
     - *"alleen fictieve data"*: no school's thema's, plans or staff go into it, only the test accounts;
     - *"alleen testaccounts die jij zelf uitnodigt"*: accounts created in the owner's own tenant and assigned to the app
       one by one. Until E6-04 lets directie invite people, that is one account: the first directie from configuration;
     - *"AI uit of met een budgetplafond"*: the first branch. No `AzureAI` configuration is set, so no endpoint can run
       up a bill;
     - **E7-11 stays `[!]` for any environment that holds real school data.** The waiver names this environment, not a
       class of environments.
   - **Why the waiver costs less than it looks.** The only `Gebruiker` that can exist here is the directie the bootstrap
     creates while the table is empty (`ToegangService.ZorgVoorEersteDirectieAsync`). No other code path creates one, and
     the development sign-in is not mapped outside `Ontwikkeling`, which refuses to start outside Development.
     ADR-0030 gives directie every right, so every session this environment can issue has exactly the rights the matrix
     would give it.
   - *Amended 2026-09-14 (TB-003, owner ruling the same day).* The paragraph above is no longer true of the running
     environment:
     - On 2026-09-13 at 19:44 the `azure-demo` session added five non-directie invitations to the demo database:
       `demo.leerkracht1` to `demo.leerkracht5`, accounts in the owner's tenant, each assigned to the app.
     - No code path in the repo creates a `Gebruiker` except the bootstrap for an empty table, so they were written
       outside the app. The coordination log records the session and the time, not the mechanism.
     - Until E6-02 enforces the ADR-0030 matrix, a session of one of them can do nearly everything directie can.
     - Asked on 2026-09-14 whether the waiver still holds knowing this, the owner chose *"Ja, en leg het vast"*. The
       conditions stay as read above, with six test accounts instead of one. E7-11 stays `[!]` for any environment
       with real school data.
2. **The services**, all in one resource group `rg-jaarplanner-demo`, in **Belgium Central**.
   - West Europe was the first choice. At the validation before deployment on 2026-09-13 it refused all four resources:
     *"The selected region is currently not accepting new customers"*.
   - Belgium Central validated and is closer to the school.
   - The resource group itself stayed in West Europe. It holds only metadata, and moving it buys nothing.

   | Resource | SKU | Why |
   | --- | --- | --- |
   | App Service plan and web app | F1, Linux | Free. Its limits are accepted: 60 CPU-minutes a day, 1 GB of memory, it sleeps when idle, and only `*.azurewebsites.net` (with TLS) |
   | PostgreSQL Flexible Server 17 | Burstable B1ms, 32 GB, no high availability, 7-day local backups | Inside the free services for 12 months; about €16 a month after that (€0.0171 an hour and €0.1176 per GB-month, Belgium Central retail prices on 2026-09-13, the same as West Europe's) |
   | Key Vault | Standard, RBAC | Holds the connection string, the Entra client secret and the key that wraps the session keys. A few cents a month |

   - **On the subscription, not in the resource group:** a Cost Management budget of €10 a month, with e-mail alerts at
     80% and 100% of actual cost and at 100% of forecast cost. It warns and does not cap, because the subscription has
     no spending limit. `infra/README.md` gives the command.
3. **The API serves the frontend.**
   - `UseDefaultFiles` and `UseStaticFiles` serve the built bundle from `wwwroot`.
   - `MapFallbackToFile` answers every path without a file extension with `index.html`, except paths under `api/` and
     `health/`, also behind extra leading slashes and in any case (`SpaHosting.Route`). An unknown API path keeps the
     API's own answer instead of a 200 carrying HTML.
   - Both are **anonymous**: the bundle holds no data, and a browser without a session must be able to load the page
     that sends it to the sign-in. This is the ADR-0031 amendment in the header. The route is on the anonymous list that
     `ElkeRouteVraagtEenSessieTests` pins, and `SpaHostingTests` covers deep links, `HEAD`, the bundle's files and the
     excluded paths.
   - One origin keeps ADR-0031's cookie design intact: no CORS, `SameSite=Lax`, the `__Host-` prefix.
4. **A self-contained publish.** The API is published for `linux-x64` with its own runtime and started by `start.sh`.
   ADR-0031 requires the .NET shared framework at 10.0.10 or later, and which patch an App Service image carries is not
   ours to choose. A self-contained app runs on the runtime pack the SDK resolved, and `infra/deploy-app.ps1` reads
   that version from the published `Jaarplanner.Api.deps.json` and refuses to deploy below 10.0.10.
5. **Secrets and identity** (ADR-0012).
   - The web app's system-assigned managed identity holds **Key Vault Secrets User** on the vault and **Key Vault Crypto
     User on the one key only**.
   - The Key Vault configuration provider maps `ConnectionStrings--Postgres` and `Authenticatie--Entra--ClientSecret`
     to their configuration keys.
   - Nothing secret is in the repo, in the Bicep or in an app setting. At rest, the PostgreSQL password exists only
     inside the connection string in the vault. During a migration it is also in the environment of the operator's
     process.
   - **The app connects as the PostgreSQL server administrator.** That login holds DDL rights and more (`CREATEDB`,
     `CREATEROLE`, membership of `azure_pg_admin`). Accepted for a demo that holds only fictional data. **Before any
     environment holds real data** the app needs a role of its own with DML rights only, and the admin credential is kept
     for `migrate-db.ps1`. That is recorded on E7-05.
   - *Amended 2026-09-14 (TB-003).* A second operator procedure, `infra/seed-demo.ps1`, fills the demo with
     fictional content through the app's own API. It adds three facts to this decision:
     - during a seed run the PostgreSQL password is also in the operator's process and in the environment of the
       local API, of the `az` processes that API starts for Key Vault tokens, of the docker CLI and of each psql
       container. All of them end with the run; the build runs before the password is read;
     - the operator gets **Key Vault Crypto User on the Data Protection key** for the run, unless they hold a role that
       covers it, and the script removes that assignment again;
     - the local API runs in Development with the development sign-in, against the demo database, as the existing
       directie. It writes no `Gebruiker`, and it runs with the demo's key setting, so every Data Protection key it
       could create is wrapped. The script deletes an unwrapped key row that appears anyway, and the run then fails.
6. **The network, a demo trade-off.**
   - F1 has no virtual network integration, so PostgreSQL keeps its public endpoint. Its firewall rule
     `AllowAllAzureServicesAndResourcesWithinAzureIps` admits **any Azure-hosted address, in any tenant**, not only
     ours. What keeps others out is the random 31-character password and TLS with certificate verification
     (`SSL Mode=VerifyFull`).
   - Migrations run from the operator's machine (`infra/migrate-db.ps1`). The script opens the firewall to that
     machine's address for the run and closes it again, also when the migration fails. The app never migrates itself.
   - *Amended 2026-09-14 (TB-003).* `infra/seed-demo.ps1` opens the firewall the same way, for its own run, and
     closes it again when the run ends or fails. Closing the window skips that clean-up; `infra/README.md` says how to
     find a leftover rule.
   - **Not acceptable for production**, where private networking needs at least a Basic plan.
7. **Entra, in the owner's tenant.**
   - A single-tenant web app registration, with the redirect URIs `https://<host>/api/signin-oidc` and `https://<host>/`.
   - The `acct` optional claim in the ID token, and `openid profile` consented by the administrator.
   - *Assignment required* on, with the test users assigned **one by one**: assigning a group needs Entra ID P1.
   - A client secret valid for six months.
8. **Infrastructure as code.**
   - `infra/main.bicep` is deployed with the Azure CLI, and `infra/README.md` gives the order of the steps, the budget
     included.
   - `infra/deploy-app.ps1` builds and deploys the app. It refuses a working tree with uncommitted changes unless it is
     told otherwise, and it writes into the package which commit it was built from and whether the tree was clean. Only
     a package from a clean tree identifies its code exactly.

## Alternatives considered

- **Build E6-02 first.** The owner declined it (decision 1).
- **Azure Container Apps on the consumption plan.** A free monthly grant and scale to zero, but it needs a container
  registry (ACR Basic, about €5 a month) and a log workspace. More moving parts, and no saving over F1.
- **Static Web Apps for the frontend.** The free plan cannot link a backend onto the same origin; that needs Standard,
  about €9 a month. A second origin would break ADR-0031's cookie design.
- **A framework-dependent publish on the platform's runtime.** Smaller, but it leaves the 10.0.10 floor to the image's
  patch level.
- **Migrating at startup.** Not rejected for lack of rights, since the app holds them here (decision 5), but for how it
  fails: a failed migration at startup takes the site down with it, while one run by hand fails in front of the operator
  and leaves the running app alone.
- **App Service Easy Auth.** Rejected by ADR-0031.

## Consequences

**Positive**

- The demo costs nothing while the free services last.
- E7-11's last prerequisite, *one real-tenant round trip*, can now be met.
- E7-04's SPA fallback exists and is tested.

**Negative / trade-offs**

- F1 sleeps, so the first request after a quiet spell takes several seconds, and heavy use can exhaust the 60
  CPU-minutes a day. B1, about €11 a month, is the step up.
- Only the first directie can sign in until E6-04 lets directie invite others.
- *Amended 2026-09-14 (TB-003):* the bullet above stopped being true on 2026-09-13, when five leerkracht invitations
  were added outside the app (decision 1). Their sessions carry nearly directie's rights until E6-02.
- The AI endpoints answer 500 without configuration; E2-09 records that they should answer 503.
- The app runs as the database administrator, and the database answers any Azure-hosted address that has the password
  (decisions 5 and 6).
- A PostgreSQL server that is stopped by hand starts itself again after seven days.

## Compliance trace

- **Constitution:**
  - Art. VI.1: **unmet by the codebase until E6-02, and not changed by this ADR.** What the owner waived is E7-11's
    deployment clause, for this environment only. In it the one possible session is directie's, whose rights equal the
    matrix's (decision 1).
  - Art. VI.2: no pupil data, fictional data only.
  - Art. VI.3: an EU region. No AI is configured, so the EU AI data zone is not in play.
  - Art. VI.4: Key Vault and a managed identity; nothing in the repo.
  - Art. VI.5: TLS everywhere (HTTPS only, TLS 1.2, PostgreSQL with certificate verification), encryption at rest by the
    platform, and session keys wrapped by a Key Vault key. The database login is broader than it should be (decision 5).
  - Art. VI.6: the environment stores the test accounts' staff identity data (naam, sign-in name, `tid`, `oid`) and the
    session keys. The processing register for them is still open under E7-06.
  - Art. VIII: Azure.
- **Backlog:** E7-04, E7-11, E7-05, E7-09.
- **FR/NFR:** NFR-4, NFR-5, NFR-6, NFR-9.
