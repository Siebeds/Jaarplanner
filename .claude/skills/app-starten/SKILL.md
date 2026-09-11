---
name: app-starten
description: >-
  Start the Jaarplanner app locally (ASP.NET Core API + Vite frontend) against the owner's dev database, so
  the owner can look at it in a browser, and verify it actually renders before saying it is up. Use when the
  user says "zet de app aan", "start de frontend en backend", "ik wil zien waar we zitten", "draai de app",
  "/app-starten", or asks for a local URL to click through. Also covers stopping and restarting after a
  backend change. Not for a story's own browser pass: that one uses a throwaway database (see step 3).
---

# App starten — API + frontend, locally

Recipe for bringing up the Jaarplanner **for the owner to look at**: the API on the owner's dev database
(`jaarplanner` on the local PostgreSQL 17 service) and the Vite dev server proxying `/api` to it. Every
step below was run end to end on 2026-09-10; each trap listed has cost a session real time.

Use **Bash** (Git Bash) for everything except where PowerShell is named. Report to the owner in **Dutch**.

```bash
REPO=/c/source/Jaarplanner
COORD=$REPO/.claude/coordination
LOGS=<your scratchpad directory>   # never the repo
```

## 1. Read the room and pick ports

Defaults: **API 5184** (the `http` launch profile, and Vite's default proxy target) and **Vite 5177**
(`strictPort` in `frontend/vite.config.ts`, so it fails rather than drifting to another port).

```bash
for p in 5184 5185 5177; do printf '%s http=%s claim=%s\n' "$p" \
  "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$p/)" \
  "$(sed -n 's/^owner: //p' $COORD/claims/port-$p.md 2>/dev/null)"; done
```

- `http=000` and no claim: the port is free. Anything else: already served, or claimed.
- **Is it already running?** If 5177 answers 200 and `/api/klassen` through it answers 200, the app is up.
  Tell the owner the URL and stop here.
- **A claimed port is not yours, even if its claim is stale.** Only the technical lead breaks a claim. Pick
  the next free port for the API (5185, 5186, …) and point Vite at it in step 5. That is all it costs.

Join the groepschat and claim what you use (protocol: `.claude/skills/groepschat/SKILL.md`):
`port-<api>`, `port-5177`, and `maintree` only while you run a git command that moves HEAD.

**Run it from the tree that holds the code the owner wants to see.** Usually the main tree on `main` (or the
branch he is working on). Check with `git -C $REPO status -sb` before starting; switching branches later
under a running Vite changes what he sees mid-look.

## 2. Database: running, and migrated

```bash
powershell -NoProfile -Command "Get-Service postgresql-x64-17 | Select Status"   # must be Running
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
`SSL Mode=Disable`, or Npgsql hangs. `dotnet ef` 8.x works against this EF 10 model.

## 3. Which database — decide before anything writes

This recipe runs on the **shared dev database `jaarplanner`**, which holds the owner's own demo data. That is
right when the owner wants to look. It is **wrong for a session testing its own change**: create a throwaway
database instead (copy the connection string, change `Database=`, migrate it, pass it as
`ConnectionStrings__Postgres`). **Any other key name is ignored silently** and you land on `jaarplanner`
anyway, with every symptom saying it worked. Never create or delete rows in `jaarplanner` to "try something";
the owner may have a page open on it.

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

- **pnpm is not on PATH**; only `corepack pnpm` works.
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
curl -s -o /dev/null -w 'api %{http_code}\n'   http://localhost:5185/api/klassen
curl -s --retry 20 --retry-connrefused --retry-delay 1 -o /dev/null -w 'vite %{http_code}\n' http://localhost:5177/
curl -s -o /dev/null -w 'proxy %{http_code}\n' http://localhost:5177/api/klassen
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --user-data-dir="$(cygpath -w "$LOGS")\\chrome-profile" --window-size=1440,900 \
  --virtual-time-budget=8000 --screenshot="$(cygpath -w "$LOGS")\\app.png" http://localhost:5177/
```

All three must be **200**. Then **Read the screenshot**. Three 200s do not prove the page renders. Use your
own `--user-data-dir` so you never touch the owner's Chrome profile.

- **White page** → almost always Vite's optimizer failing with `EBUSY … node_modules/.vite/deps`. Read
  `vite.log`, not the browser console. Fix: stop Vite, `rm -rf $REPO/frontend/node_modules/.vite`, start again.
- **Screen loads but lists are empty / errors** → the API side: read `api.log` (pending migration, wrong
  environment, wrong database).

Tell the owner, in Dutch: the URL **http://localhost:5177**, which branch/commit it serves, which database,
and on which port the API runs. Update your session file and post an `INFO` in the groepschat naming the two
ports, so no other session kills or reuses them.

## 7. When a server dies on its own

On this machine the harness stops background tasks when memory runs low (the notification says *"stopped
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

Check each port answers `000` with curl (netstat's PID attribution can be stale), then release your
`port-*` claims with the groepschat `release` helper and set your session file to `done`. **Leave the
servers running if the owner is still looking.** Say so instead, and keep the claims.
