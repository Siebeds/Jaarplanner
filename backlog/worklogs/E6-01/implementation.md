# E6-01 — Authentication (personal login): implementation worklog

- **Session:** `E6-01`, 2026-09-11. Branch `story/E6-01-authenticatie`, rebased onto `origin/main` `f047cef` (PR #44).
- **Decisions:** [ADR-0030](../../../docs/adr/0030-rollen-en-rechten-in-de-app.md) (the owner's role rulings, verbatim,
  with every inferred default kept apart in §2) and [ADR-0031](../../../docs/adr/0031-sessielogin-via-de-api.md) (the
  login mechanism, Accepted on the owner's go).

## What was built

**Backend (`e03f92f`, `8bb3be0`)**

- `Gebruiker` (Domain/Toegang): an invitation by sign-in name. On the first login it is bound to one Entra account
  (`tid` + `oid`), and the binding is permanent.
- `IToegangService` / `ToegangService`, the invitation gate:
  - the tenant must be the school's, and the account must be a member; a token without `acct` is refused, so the gate
    fails closed;
  - an account that is already bound is found by `tid` + `oid` only;
  - a first login binds only an **unbound** invitation, matching the UPN case-insensitively.
- `EersteDirectieBootstrap`: provisions the first directie from `Authenticatie:EersteDirectie`, and only while the
  `gebruikers` table is empty.
- `Aanmelding`:
  - the cookie scheme: `/api` answers 401/403 and never redirects; every request re-checks that the `Gebruiker` still
    exists;
  - the Entra handler: the framework's OpenIdConnect, PKCE, scopes `openid profile`, no saved tokens;
  - the fallback policy;
  - Key Vault wrapping of the Data Protection keys, when configured.
- `CsrfHeaderControle`: state-changing `/api` requests must carry `X-Jaarplanner-Csrf`. The OIDC callbacks are exempt by
  name.
- The development sign-in (`OntwikkelAanmelding`) has three locks:
  - it only runs in the Development environment, with explicit configuration;
  - it only accepts loopback, including every `X-Forwarded-For` entry;
  - the app refuses to start with it anywhere else.
- `AanmeldController`:
  - `GET /api/aanmelden`, which accepts only a local `terugNaar` and refuses control characters;
  - `POST /api/afmelden`, which returns the Entra sign-out address;
  - `GET /api/ik`.
- `Curriculumbeheer` now requires an authenticated user (ADR-0031 amends ADR-0022 §1). Its role half is E6-02's.
- Migration `20260911150216_GebruikersEnSessiesleutels` creates `gebruikers` and `data_protection_keys`. It was
  regenerated on top of PR #44's migration, because E6-01 reached main second.
- `System.Security.Cryptography.Xml` is pinned to 10.0.12. The Data Protection package pulled in 10.0.9, which carries
  six high-severity advisories.

**Frontend (`85ec582`)**

- `apiFetch` sends the CSRF header and `credentials: "same-origin"`.
- A 401 sends the browser to the sign-in, once per page, and never from `/geen-toegang`.
- `useIk` and `useAfmelden`.
- `Aanmeldregel` shows the signed-in person and a quiet way out. There is one per viewport:
  - in the `lg` sidebar, under Instellingen;
  - in the 56px rail, as an icon that keeps the name in its label;
  - on a phone, at the foot of Instellingen.
- `GeenToegangScherm` lives outside the shell and makes no request on load. Its sentences are true for every refusal
  reason.
- `xfwd` on the Vite proxy.
- A new `aanmelding` block in `nl.json`.

## Test design

- `JaarplannerApiFactory` is the base of every test host. It:
  - authenticates through a test scheme by default;
  - sends the CSRF header;
  - blanks `EersteDirectie`;
  - keeps Data Protection keys in memory (`GeheugenSleutelopslag`).

  The 152 existing client call sites are unchanged.
- `ElkeRouteVraagtEenSessieTests` sends **every** endpoint in the data source anonymously and expects 401. It also pins
  the anonymous allow-list and guards against enumerating fewer than 90 requests.
- Postgres tests:
  - `ToegangServiceTests`: binding, takeover refusal, fail-closed `acct`, other tenant, and the bootstrap only in an
    empty table;
  - `AanmeldEndpointsTests`:
    - the real cookie through the dev sign-in;
    - removing the user ends the session;
    - CSRF with a cookie;
    - sign-out;
    - the loopback lock;
    - the configured `OnTokenValidated` run against real claims.
- `AanmeldModusTests` covers the startup refusal outside Development, a missing client secret, the Entra options, the
  challenge against a static discovery document, and the sign-out address.

## Gates

| Gate | Result |
| --- | --- |
| Backend unit tests | **845 passed**, 0 failed, 0 skipped |
| Backend integration tests (real PostgreSQL, `JAARPLANNER_TEST_POSTGRES` set) | **318 passed**, 0 failed, 0 skipped (after the code-round fixes; 316 before them) |
| `dotnet list package --vulnerable --include-transitive` | no vulnerable packages |
| `dotnet format --verify-no-changes` | clean |
| Frontend `pnpm lint` (oxlint + tsc) | clean |
| Frontend `pnpm test` | **170 passed**, 28 files (169 before the code-round fixes) |
| Mutations the code-round antagonist used to show two tests were vacuous | both re-run, **both now fail their test** |
| Browser pass (CDP, real API + throwaway db, 1440 and 390) | see below |

**Browser pass.** Run over headless Chrome driven by CDP, against the API on 5201 with the throwaway database
`jaarplanner_e601` and Vite on 5202:

- **Sign-in round trip:** `/agenda` without a session goes to `/api/aanmelden/ontwikkeling?terugNaar=%2Fagenda`, and
  signing in there returns to `/agenda`.
- **Sidebar:** 1 control. The Afmelden button is 44px high with contrast 6.49:1; the name has contrast 17.72:1.
- **Rail:** 1 icon control, labelled "Afmelden (…)", 39×44, contrast 6.49:1.
- **Phone:**
  - Instellingen: 1 control at the foot, contrast 6.08:1.
  - Agenda: 0 controls, as designed.
  - Bottom bar: 5 tabs.
  - Horizontal scroll: none on either page.
- **`/geen-toegang`, at both widths:** 0 `/api` requests; heading 16.58:1, text 6.08:1; no horizontal scroll.
- **axe (WCAG 2.2 AA):** 0 violations and 0 incomplete contrast entries on every page measured.
- **Sign-out:** lands back at the sign-in, and `/api/ik` then answers 401.

**One measurement was wrong and is not counted.** The script's own contrast figure for "Opnieuw proberen" (1.07:1)
compared the text with the *parent's* background rather than the button's accent fill. axe measures that button
correctly and reports no contrast finding.

## Found along the way

- **A test host touched the developer's own database.**
  - What happened: a host that does not replace the database inherits the Api's user-secrets. The first Entra-mode
    test's sign-in challenge read `data_protection_keys` in the owner's dev database. It could not write there only
    because the table did not exist.
  - Why the first fix fell short: the ephemeral provider left Data Protection's startup key-ring read in place.
  - Final fix: an in-memory key repository for every test host without a throwaway database of its own. The final run
    has 0 "does not exist" errors.
- **Npgsql timeouts in one full run.** Run 3 had 19 failures, all Npgsql timeouts, spread over other stories' Postgres
  tests. Postgres itself was idle and lock-free when inspected, with 326 leaked `jp_test_` databases (E7-14). The
  timeouts did not recur in the two runs since. Recorded, not explained.
- **Process slip.** The two new files under `Persistence/Configurations` were committed at 17:01, before the folder
  claim was handed over at 17:18. It had been announced in the chat at 16:55, and the lead later confirmed the claim
  was stale. The rule is to wait for the claim, and that is noted here rather than smoothed over.

## What merging this changes for everyone

- **Every API test host now authenticates by default** through the base factory. A new host must derive from
  `JaarplannerApiFactory`, or its requests answer 401.
- **Every developer database needs the migration** (`dotnet ef database update`). Without it, the key ring cannot be
  read and signing in fails. After the next start, `directie@jaarplanner.local` exists and can be picked on the
  development sign-in.

## Still open (not E6-01's)

- **E6-02:** rights per klas and per jaar. Until then, a signed-in leerkracht can edit another klas, so **E7-11 stays
  `[!]`**.
- **Part 1 of the Art. XI amendment** (ADR-0030 §5) is owed before E6-02 or E6-04 builds on the role model.
- **ADR-0030 §4 (f):** an accepted doelsuggestie moves the dekking of every klas that plans that thema. The owner has
  not yet been asked about that consequence.

## Antagonist

The documents had three rounds before any code existed: `30b7031`, `68e296e` and `a30344d`. The findings of each are
in the ADR revision notes.

### Code round 1 on `e03f92f`, `85ec582` and `8bb3be0`

**Verdict: VIOLATIONS FOUND, 1 MAJOR, 10 MINOR and 2 QUESTION.** The auditor confirmed the security design itself.
What it faulted was mostly what the tests proved and what the documents still claimed. Every finding is listed below
with what was done.

| # | Finding | Done |
| --- | --- | --- |
| MAJOR | "Removing a user ends the session" passed with `OnValidatePrincipal` deleted, because it asked `/api/ik`, which refuses a missing user by itself | The test now asserts 200 on `/api/klassen` before the delete, then 401 there and a deleted cookie after it. **Mutation re-run: with the per-request check removed, the test now fails.** |
| MINOR | The whole-surface 401 test could not tell "refused" from "matched no route", because the fallback policy answers 401 to an unmatched URL as well. Its comment claimed a 404. | The host now records which endpoint each tagged request reached, and the test requires it to be the endpoint under test. The comment is corrected. **Mutation re-run: with every guid route unmatched, the test now fails.** |
| MINOR | Stale "the API is unauthenticated" text in `Program.cs`, in E7-11, and in the E6-02 and E6-03 carry-forwards | Corrected in all four. On E7-11 the old sentence is kept and marked, because its endpoint list is still what E6-02 must cover. E7-11 is now blocked on E6-02 only. |
| MINOR | The deployment prerequisites were routed to E7 by name only, and forwarded headers are missing | Written out on E7-11, including `ASPNETCORE_FORWARDEDHEADERS_ENABLED`, the Key Vault key, the runtime patch level and one real-tenant round trip |
| MINOR | The Key Vault wrapping of the session keys was optional outside Development | Now required: the app refuses to start without it. ADR-0031 decision 5 is updated, and a test covers the refusal. |
| MINOR | The `System.Security.Cryptography.Xml` pin does not reach the running API, and "six" named five | The csproj comment now says so and counts five. E7-12 carries the requirement on the runtime patch level. |
| MINOR | A failed Entra callback ended in an English 500 | `OnRemoteFailure` and `AccessDeniedPath` now go to `/aanmelden-mislukt`, a Dutch page that is a variant of the refusal page: its own text, retry only, no API call. A test runs the configured event. Browser pass: axe 0 at 1440 and 390, 0 API requests. |
| MINOR | The `app-starten` skill breaks after merge | Steps 1 and 6 now expect 401 through the proxy and check the development sign-in. They say to migrate first and that a person is picked before anything else. |
| MINOR | The race comment was wrong, and binding two accounts to one invitation was unguarded in the database | The binding is now a conditional `ExecuteUpdate` (`EntraObjectId IS NULL`) that checks the rows affected. The comment is rewritten. The page comment now lists all five refusal reasons. |
| MINOR | Generic types have Dutch names | Routed to E7-15, written in the story |
| QUESTION | May E6-01 close without a real-tenant round trip? | **Put to the owner.** The round trip is a prerequisite on E7-11 either way. E6-01 stays `[~]` until the owner answers. |
| QUESTION | R8 reads FA §3.2's "eigen klas" as "every leerkracht" | **Put to the owner**, together with §4 (f) |

**Gates after the fixes:**
- backend 845 unit and 318 integration tests on real PostgreSQL, 0 failed and 0 skipped;
- 0 "does not exist" errors;
- `dotnet format --verify-no-changes` clean;
- frontend lint clean and 170/170;
- both mutations re-run and both now bite.

**A gate that did not count, recorded because it looked green.** One run between the fixes reported 845 + 316
green while its build had failed. The API left running for the browser pass locked the Api's `bin`, so the tests
ran the previous binaries. The totals gave it away: 316, not 318. The API was stopped by its port and the run
repeated.
