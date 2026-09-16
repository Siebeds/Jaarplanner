---
name: app-starten
description: >-
  Start the Jaarplanner app locally (ASP.NET Core API + Vite frontend) against the owner's dev database, so
  the owner can look at it in a browser, and verify it actually renders before saying it is up. Use when the
  user says "zet de app aan", "start de frontend en backend", "ik wil zien waar we zitten", "draai de app",
  "/app-starten", or asks for a local URL to click through. Also covers the frontend alone on fixed mock data
  ("alleen de frontend", "met nepdata", "mockmodus"), and stopping and restarting after a backend change. Not
  for a story's own browser pass: that one uses a throwaway database (see step 3).
---

# App starten — API + frontend, locally

Recipe for bringing up the Jaarplanner **for the owner to look at**: the API on the owner's dev database
`jaarplanner` and the Vite dev server proxying `/api` to it. Every step below was run end to end on
2026-09-10; each trap listed has cost a session real time.

**Two ways to start it.** By default, the whole app: steps 1 to 6. **Only when the owner asks for the frontend
alone** ("alleen de frontend", "met nepdata", "mockmodus"), the mock mode below instead, and skip the rest.

### Frontend alone, on mock data

`pnpm dev:mock` runs Vite in mode `mock` (TB-046): every `/api` request is answered in the page by
`frontend/src/mocks/`, so no API, no Docker and no database run, and the machine keeps its memory. What it holds:
one K3 klas "K3 De Uilen" in 2026-2027, one thema of 4 weeks with three minimumdoelen, two subthema's of one week
with their leerplandoelen and activiteiten, and a full agenda for 16 to 27 november 2026 (8u30 to 15u30, lunch
12u to 13u free, wednesday only until 12u). The goals are invented and do not exist in Op.stap. The user is
directie, without a sign-in page, and the app opens on the week of 16 november.

```bash
cd $REPO/frontend && corepack pnpm dev:mock > $LOGS/vite-mock.log 2>&1   # in the background
```

- **Port 5177 as usual**, so check it is free first (step 1). If a normal Vite runs there, stop it only if you
  started it, or pass `--port <free port>` and give the owner that URL.
- **Writes work until a reload**: dragging, adding a link or an activiteit. A reload starts again from the fixed
  content. A route the mock mode does not answer returns a 501, and the dark label bottom right lists it.
- **Not for** backend changes, rights per role, the real dekking calculation (the mock counts a simplified one),
  AI buttons or the ontwikkelingsrapport: those need the whole app.
- **A new screen or route** needs its answer in `frontend/src/mocks/routes.ts`, or it shows the 501.
- **Verify** with the Chrome line of step 6 on the mock URL: the screenshot shows the agenda at once, not the
  sign-in page.

**The owner works on three machines, and they differ.** Find out which one you are on before step 2:

| | Machine A | Machine B (set up 2026-09-13) | Machine C (set up 2026-09-15) |
|---|---|---|---|
| PostgreSQL | Windows service `postgresql-x64-17` | Docker container `jaarplanner-db`, host port 5433 | as machine B |
| Docker Desktop | not used | `C:\Program Files\Docker\Docker` | per user, `%LOCALAPPDATA%\Programs\DockerDesktop` |
| pnpm | only through `corepack pnpm` | `corepack pnpm`; also installed globally in `%APPDATA%\npm` | only through `corepack pnpm` |

```bash
powershell -NoProfile -Command "Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue | Select Status"
command -v docker
```

The first prints the service on machine A only. The second tells B from C: a path under `Program Files` is
machine B, one under `AppData/Local/Programs/DockerDesktop` is machine C. The machine B route was run end to
end on 2026-09-13, on a commit from before E6-01, so the sign-in checks in step 6 have not been run there yet.
The machine C route has not been run end to end at all; *A new machine* below says where its set-up stands.

### A new machine

What a fresh Windows machine needs before step 1. Machine C lacked every item:

- **.NET SDK 10.0.4xx**, the band `global.json` pins: `winget install Microsoft.DotNet.SDK.10`.
- **Node 24**: `frontend/package.json` asks `>=24`, and 24 still bundles the corepack step 5 uses.
  `winget install OpenJS.NodeJS.LTS`. Both winget installs ask for UAC consent.
- **`dotnet tool restore`** in `backend`, for the `dotnet-ef` pinned in `backend/.config/dotnet-tools.json`.
- **A git identity and a GitHub sign-in.** Git for Windows starts without an identity, and the first commit
  fails with *"Author identity unknown"*. Ask the owner which one; the history is no guide, since every commit
  there is `Siebeds` while machine C uses the GitHub account `dyllisd` with its no-reply address. Git pushes
  through Git Credential Manager, but `gh` needs its own `gh auth login`, which the owner runs in a separate window.
- **For Docker, WSL 2 and hardware virtualization.** In an elevated PowerShell, `wsl --install
  --no-distribution` turns on Virtual Machine Platform and WSL and installs the WSL package. Virtualization must
  also be on in the firmware (SVM Mode on AMD, VT-x on Intel): `Get-CimInstance Win32_Processor | Select
  VirtualizationFirmwareEnabled` must say `True`. Both take effect only after a restart.
- **`.env` and the user-secret** of step 2.
- **A program installed during a session is not on that session's PATH.** Until a new session starts, prefix
  commands with `export PATH="/c/Program Files/dotnet:/c/Program Files/nodejs:$PATH"`.

Machine C on 2026-09-15: every item is done except the firmware setting and the restart, which only the owner
can do. Until then `VirtualizationFirmwareEnabled` says `False` and Docker cannot start (step 2).

Use **Bash** (Git Bash) for everything except where PowerShell is named. Report to the owner in **Dutch**.

```bash
REPO=/c/source/Jaarplanner
LOGS=<your scratchpad directory>   # never the repo
```

## 1. Read the room and pick ports

Defaults: **API 5184** (the `http` launch profile, and Vite's default proxy target) and **Vite 5177**
(`strictPort` in `frontend/vite.config.ts`, so it fails rather than drifting to another port).

```bash
for p in 5184 5185 5177; do printf '%s http=%s\n' "$p" \
  "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$p/)"; done
```

- `http=000`: the port is free. Anything else: already served.
- **Is it already running?** If 5177 answers 200 and `/api/klassen` through it answers **401**, the app is up.
  Every route needs a session since E6-01, so 401 is the healthy answer without one, and 200 there means an
  API from before E6-01.
  Tell the owner the URL and stop here.
- **A port that answers is not yours unless you started it**: another session may be using it. Pick the next
  free port for the API (5185, 5186, …) and point Vite at it in step 5. That is all it costs.
- **Check the port right before you start, every time, and read your own log after.** An API or Vite started on
  a taken port exits at once ("address already in use", "Port … is already in use"), and every curl, screenshot
  and stop-by-port after that reaches the other session's server instead of yours.

**Run it from the tree that holds the code the owner wants to see.** Usually the main tree on `main` (or the
branch he is working on). Check with `git -C $REPO status -sb` before starting; switching branches later
under a running Vite changes what he sees mid-look.

## 2. Database: running, and migrated

**Machine A**, the Windows service:

```bash
powershell -NoProfile -Command "Get-Service postgresql-x64-17 | Select Status"   # must be Running
```

**Machines B and C**, the Docker container. Docker Desktop has to be running first; start it from the Start
menu, or with `"/c/Program Files/Docker/Docker/Docker Desktop.exe" &` on machine B and
`"$LOCALAPPDATA/Programs/DockerDesktop/Docker Desktop.exe" &` on machine C, and give it a minute.

```bash
docker info --format '{{.ServerVersion}}'                            # must print a version, e.g. 29.7.2
cd $REPO && docker compose up -d db
docker inspect --format '{{.State.Health.Status}}' jaarplanner-db   # must be healthy
```

- **`docker info` exits 0 on an engine that failed to start.** It then prints *"Error response from daemon:
  Docker Desktop is unable to start"*, or with no virtualization at all *"request returned 500 Internal Server
  Error for API route and version …"*, with exit code 0, so a readiness loop that checks only the exit code
  reports a daemon that is not there. Accept only a version number.
- **The reason is in the logs, not in Docker's error dialog**: `%LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log`
  and `monitor.log` beside it, in a line near the engine's start that can be a `[W]` rather than an `[E]` (on
  machine C: *"no virtualization found: … Virtual Machine Platform not enabled"*). After it the backend log
  repeats *"event streamer: error: http response error status 500"* every 45 seconds, so its tail shows only
  that. Search with `grep 'failed to start'` instead.
- `docker compose up` reads the gitignored `.env` in the repo root (a copy of `.env.example`). Without it,
  compose refuses to start with *"set POSTGRES_USER in .env"*.

Then, on every machine:

```bash
cd $REPO/backend && dotnet ef migrations list \
  --project src/Jaarplanner.Infrastructure --startup-project src/Jaarplanner.Api | tail -5
```

**The API does not migrate on startup.** A migration marked `(Pending)` makes every request 500 with
`relation "…" does not exist`, which reads like a broken API. Apply it:

```bash
dotnet ef database update --project src/Jaarplanner.Infrastructure --startup-project src/Jaarplanner.Api
```

The connection string comes from **user-secrets**, key `ConnectionStrings:Postgres`
(`dotnet user-secrets list` in `backend/src/Jaarplanner.Api`). It must use `Host=127.0.0.1` and
`SSL Mode=Disable`, or Npgsql hangs. On machines B and C it also needs `Port=5433` and the password from `.env`.
`dotnet ef` 8.x works against this EF 10 model.

## 3. Which database — decide before anything writes

This recipe runs on the **shared dev database `jaarplanner`**, which holds the owner's own demo data. That is
right when the owner wants to look. It is **wrong for a session testing its own change**: create a throwaway
database instead (copy the connection string, change `Database=`, migrate it, pass it as
`ConnectionStrings__Postgres`). **Any other key name is ignored silently** and you land on `jaarplanner`
anyway, with every symptom saying it worked. Never create or delete rows in `jaarplanner` to "try something";
the owner may have a page open on it.

The machines do not share this database. Machine B's was created empty on 2026-09-13 and started with
only what the demo seeder (step 4) put in it; machine C's first `docker compose up` creates it the same way.

## 4. Build and start the API

Build into **`bin-run`**, not `bin/Debug`. A running API locks its own binaries, so running it from
`bin/Debug` makes the next `dotnet build` / `dotnet test` in the same tree fail. `bin-*/` is gitignored
and excluded from the Web SDK's item globs in `Jaarplanner.Api.csproj`.

```bash
cd $REPO/backend && dotnet build src/Jaarplanner.Api/Jaarplanner.Api.csproj -o src/Jaarplanner.Api/bin-run
```

Start it **in the background** (`run_in_background: true`), from the project folder so the content root
finds `appsettings*.json`:

```bash
cd $REPO/backend/src/Jaarplanner.Api && ASPNETCORE_ENVIRONMENT=Development Demo__Seed=true \
  ASPNETCORE_URLS=http://localhost:5185 ./bin-run/Jaarplanner.Api.exe > $LOGS/api.log 2>&1
```

- **`ASPNETCORE_ENVIRONMENT=Development` is required.** Without it the exe runs as Production, user-secrets
  are not loaded, it starts and listens, and then throws *"The ConnectionString property has not been
  initialized"* on the first query. The demo seeder also only runs in Development.
- `ASPNETCORE_URLS` wins here because `launchSettings.json` applies only to `dotnet run`.
- Healthy log: `Now listening on: http://localhost:5185` and `Hosting environment: Development`. On an
  existing database the seeder says *"Demo seed skipped: schooljaar … already exists"*, which is expected.

## 5. Start the frontend

```bash
cd $REPO/frontend && corepack pnpm install --frozen-lockfile     # quick when nothing changed
```

Then, **in the background, with the `cd` inside the same command**:

```bash
cd $REPO/frontend && VITE_API_PROXY_TARGET=http://localhost:5185 corepack pnpm dev > $LOGS/vite.log 2>&1
```

- **Use `corepack pnpm` on every machine.** On machines A and C pnpm is not on PATH at all. On machine B it is
  installed globally in `%APPDATA%\npm`, but a session started before that install inherits a PATH without
  it, so plain `pnpm` fails there while `corepack pnpm` works (both checked 2026-09-13).
- **A background command does not inherit the directory you think it does.** Started without its own `cd`,
  `pnpm dev` ran outside `frontend/`, missed `frontend/.npmrc` (which turns off pnpm 11's pre-run install
  check) and died with *"'pnpm' is not recognized … Command failed: pnpm install"*. That error looks like a
  pnpm problem and is a working-directory problem.
- `VITE_API_PROXY_TARGET` is only needed when the API is not on 5184. The browser stays same-origin, so no
  CORS configuration is involved.
- Healthy log: `VITE … ready` and `Local: http://localhost:5177/`. Vite binds **`localhost`, not
  `127.0.0.1`**; a curl to `127.0.0.1:5177` answers `000` while the server is fine.

## 6. Verify, and look at it

```bash
curl -s -o /dev/null -w 'api %{http_code}\n'   http://localhost:5185/health
curl -s --retry 20 --retry-connrefused --retry-delay 1 -o /dev/null -w 'vite %{http_code}\n' http://localhost:5177/
curl -s -o /dev/null -w 'proxy %{http_code}\n' http://localhost:5177/api/klassen
curl -s -o /dev/null -w 'signin %{http_code}\n' 'http://localhost:5177/api/aanmelden/ontwikkeling?terugNaar=%2F'
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --user-data-dir="$(cygpath -w "$LOGS")\\chrome-profile" --window-size=1440,900 \
  --virtual-time-budget=8000 --screenshot="$(cygpath -w "$LOGS")\\app.png" http://localhost:5177/
```

Expect `api 200`, `vite 200`, **`proxy 401`** and `signin 200`. Since E6-01 (ADR-0031) every route needs a
session, so a 401 through the proxy is the healthy answer, and `signin` is the development sign-in page. Then
**Read the screenshot**: without a session it shows that English "Development sign-in" page, which proves the API
and the proxy work. It does not show the app itself.

- **`signin` answers 500, or the page lists no users** → the database lacks the E6-01 migration
  (`20260911150216_GebruikersEnSessiesleutels`). Run `dotnet ef database update` against it, then **restart the
  API**. On its next start the API creates `directie@jaarplanner.local` from `appsettings.Development.json`, and
  only then is there someone to pick.
- **Telling the owner:** say that the first page is a sign-in on which they pick a person. Nothing in the app is
  reachable before that.

Use your own `--user-data-dir` so you never touch the owner's Chrome profile.

- **White page** → almost always Vite's optimizer failing with `EBUSY … node_modules/.vite/deps`. Read
  `vite.log`, not the browser console. Fix: stop Vite, `rm -rf $REPO/frontend/node_modules/.vite`, start again.
- **Screen loads but lists are empty / errors** → the API side: read `api.log` (pending migration, wrong
  environment, wrong database).

Tell the owner, in Dutch: the URL **http://localhost:5177**, which branch/commit it serves, which database,
and on which port the API runs.

## 7. When a server dies on its own

On machine A the harness stops background tasks when memory runs low (the notification says *"stopped
because the system is running low on memory"*). On 2026-09-10 that killed the API and left Vite running,
so the page loaded and every request through it failed. **Check each port separately** with the step 1
loop, confirm a surviving listener is yours by its command line (PowerShell:
`(Get-CimInstance Win32_Process -Filter "ProcessId=<pid>").CommandLine` should name
`C:\source\Jaarplanner\frontend` or `bin-run`), and restart only what is dead with the step 4 or step 5
command. No rebuild is needed if no backend code changed. Then run step 6 again and tell the owner it was
down.

**If it is killed a second time, stop restarting it.** The same day the restarted API was killed again
within minutes, with 4.5 GB of 31 GB free. Restarting in a loop only feeds the guard, and starting the
process detached to get past it would be overriding a safety mechanism the owner never agreed to switch
off. Hand the owner the command to run in **his own terminal**, where the harness does not manage it
(PowerShell, from `backend\src\Jaarplanner.Api`):

```powershell
$env:ASPNETCORE_ENVIRONMENT="Development"; $env:Demo__Seed="true"; $env:ASPNETCORE_URLS="http://localhost:5185"
.\bin-run\Jaarplanner.Api.exe
```

Use the same port Vite is proxying to, and say which memory-heavy programs are running if that helps him
free some.

## 8. After a code change

- **Frontend:** Vite hot-reloads; nothing to do. Restart it after editing the `@theme` block in
  `frontend/src/index.css` or adding a font (a running server keeps the old config and silently generates
  no CSS for new utilities).
- **Backend:** the exe in `bin-run` is locked while it runs, so **stop → build → start** (steps 9, 4).
  Always rebuild before trusting what the API serves: a stale binary happily serves old code while
  `git diff` looks clean.
- **New migration:** `dotnet ef database update` before restarting the API.

## 9. Stop

Stop **by port, never by process name**. Several `Jaarplanner.Api.exe` / `node.exe` may belong to other
sessions or to the owner. In PowerShell:

```powershell
foreach ($p in 5185, 5177) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
}
```

Check each port answers `000` with curl (netstat's PID attribution can be stale). **Leave the servers running
if the owner is still looking.** Say so instead.
