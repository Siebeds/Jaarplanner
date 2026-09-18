<#
.SYNOPSIS
    Fills the demo environment with fictional kleuter content, through the app's own API (TB-003, ADR-0034).

.DESCRIPTION
    Builds the API from this checkout, starts it on the operator's machine against the demo database, signs in as the
    demo's admin with the development sign-in, and creates what seed-demo.data.json describes: klassen, thema's with
    their themadoelen and subthema's, the subthema's activiteiten, and per klas algemene fiches and hoeken. All content
    goes through the API, so every domain rule applies. The only direct database write is the safeguard's delete
    described below.

    The session keys (ADR-0031 decision 5). The Data Protection keys live in the demo database, wrapped by a Key Vault
    key. The local API runs with the same DataProtection__KeyVaultSleutel setting, so any key it creates is wrapped or
    not written at all. For the run, the script gives the operator 'Key Vault Crypto User' on that one key (unless they
    hold a role that covers it), so the API can unwrap the existing key and has no reason to create another. As a last
    line it compares the key rows before and after the run: an unwrapped row that appeared is deleted and the run ends
    with an error. A new wrapped row is only reported, because the Azure app may already be using it.

    What it opens, it closes again when the run ends or fails, in this order: the local API, the temporary key role,
    and the PostgreSQL firewall rule for this machine's address. Closing the window skips all of that; README.md says
    how to find leftovers.

    Secrets. The connection string is read from Key Vault into this process. The PG* variables exist only around each
    psql call (the docker CLI and the container see them), and the API process gets the connection string in its
    environment, which the az processes it starts for Key Vault tokens inherit. All of those end with the run. The
    build runs before any secret is read and without build servers, so no build process inherits one.

    A second run creates nothing twice. Items are matched by name (klas; thema; subthema by name and leeftijd;
    activiteit within its subthema; fiche and hoek within their klas). An item that exists gets the goal links from the
    data file that it lacks, as far as the API accepts them (a thema holds at most three themadoelen); its other fields
    are left as they are. An activiteit in the data file may also list withdrawn codes (doelenWeg): every run removes
    those links through the API, a link someone made by hand with that code included, and no other link. A code in
    both doelen and doelenWeg is refused before anything else happens.

    Needs: the Azure CLI signed in to the subscription, the .NET SDK from global.json, Docker (psql runs in a
    container), and a clean working tree unless -AllowDirty is passed. Run it from the commit that is deployed, after
    migrate-db.ps1: it refuses when the database lacks any migration of the checkout, or holds one the checkout lacks.

.EXAMPLE
    ./infra/seed-demo.ps1 -ServerName pg-jaarplanner-demo-ertren -VaultName kv-jpdemo-ertren -AppName jaarplanner-demo-ertren
#>
param(
    [Parameter(Mandatory = $true)][string]$ServerName,
    [Parameter(Mandatory = $true)][string]$VaultName,
    [Parameter(Mandatory = $true)][string]$AppName,
    [string]$ResourceGroup = 'rg-jaarplanner-demo',
    [int]$Port = 5190,
    [string]$DataFile = (Join-Path $PSScriptRoot 'seed-demo.data.json'),
    [switch]$AllowDirty
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$apiProject = Join-Path $root 'backend/src/Jaarplanner.Api'
$migrationsFolder = Join-Path $root 'backend/src/Jaarplanner.Infrastructure/Persistence/Migrations'
$firewallRule = 'seed-from-operator'
# Pinned by digest: this image receives the database administrator's password.
$psqlImage = 'postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
$baseUrl = "http://127.0.0.1:$Port"
$keyRoles = @('Key Vault Crypto User', 'Key Vault Crypto Officer', 'Key Vault Administrator')

$pgNames = @('PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGSSLROOTCERT')
$apiEnvNames = @('ASPNETCORE_ENVIRONMENT', 'ASPNETCORE_URLS', 'ConnectionStrings__Postgres',
    'DataProtection__KeyVaultSleutel', 'Authenticatie__Modus', 'Authenticatie__EersteAdmin', 'Demo__Seed',
    'AZURE_TOKEN_CREDENTIALS')
$previousEnv = @{}
foreach ($name in ($pgNames + $apiEnvNames)) { $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

# --- Helpers -------------------------------------------------------------------------------------------------------

function Restore-Env([string[]]$Names) {
    foreach ($name in $Names) { [Environment]::SetEnvironmentVariable($name, $previousEnv[$name], 'Process') }
}

function Invoke-Az {
    # Runs the Azure CLI and fails loudly; the CLI's own exit code is the only signal Windows PowerShell gives.
    $output = & az @args
    if ($LASTEXITCODE -ne 0) { throw "az $($args[0]) $($args[1]) failed with exit code $LASTEXITCODE." }
    return $output
}

function Test-Native([scriptblock]$Command) {
    # Windows PowerShell turns a native command's redirected stderr into error records, which 'Stop' makes
    # terminating; this scope lowers the preference so only the exit code decides.
    $ErrorActionPreference = 'Continue'
    & $Command *> $null
    return ($LASTEXITCODE -eq 0)
}

function Write-Cleanup([string]$Message) {
    # A plain console write: after Ctrl+C the pipeline is stopping, and the stream cmdlets can throw there.
    [Console]::WriteLine($Message)
}

function Invoke-Psql([string]$Sql) {
    # The PG* variables exist only for this docker call, which passes them into the container by name, so the
    # password is on no command line and in the environment of no other child process.
    try {
        $env:PGHOST = $script:pg['Host']
        $env:PGUSER = $script:pg['Username']
        $env:PGPASSWORD = $script:pg['Password']
        $env:PGDATABASE = $script:pg['Database']
        # Certificate and host name verified, like the app's own SSL Mode=VerifyFull, against the container's CA store.
        $env:PGSSLMODE = 'verify-full'
        $env:PGSSLROOTCERT = 'system'
        $output = $Sql | docker run --rm -i -e PGHOST -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE -e PGSSLROOTCERT `
            $psqlImage psql -X -q -t -A -v ON_ERROR_STOP=1
        if ($LASTEXITCODE -ne 0) { throw "psql failed with exit code $LASTEXITCODE." }
        return @($output | Where-Object { $_ -ne '' })
    }
    finally {
        Restore-Env $pgNames
    }
}

function Get-KeyRows {
    # Id|wrapped: a key element wrapped by Key Vault carries an encryptedSecret; an unwrapped one does not.
    return @(Invoke-Psql 'select "Id" || ''|'' || ("Xml" like ''%encryptedSecret%'') from data_protection_keys order by "Id";')
}

function Invoke-Api {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        $Body,
        [switch]$AllowNotFound
    )
    $request = @{
        Uri             = "$baseUrl$Path"
        Method          = $Method
        WebSession      = $script:session
        # The API's anti-forgery check wants this header on every unsafe method; its value is not checked.
        Headers         = @{ 'X-Jaarplanner-Csrf' = '1' }
        UseBasicParsing = $true
    }
    if ($null -ne $Body) {
        # Bytes, not a string: Windows PowerShell would send a string body as ISO-8859-1 and mangle every emoji.
        $request.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 10 -Compress))
        $request.ContentType = 'application/json; charset=utf-8'
    }
    try {
        $response = Invoke-WebRequest @request
    }
    catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($AllowNotFound -and $status -eq 404) { return $null }
        throw "$Method $Path answered $status. $($_.ErrorDetails.Message)"
    }
    $text = [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray())
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    return ($text | ConvertFrom-Json)
}

function Find-ByName($Items, [string]$Name) {
    # Case-insensitive, like the API's uniqueness rule for klas, fiche and hoek names. Thema and subthema names are
    # not unique in the API; the script treats them as if they were, so it never adds a second one.
    return @($Items | Where-Object { $_.naam -eq $Name }) | Select-Object -First 1
}

$stats = [ordered]@{}
function Add-Stat([string]$Name) { $stats[$Name] = 1 + [int]$stats[$Name] }

function Add-GoalLinks {
    # Links the codes from the data file that the item lacks. A refusal (a thema holds at most three themadoelen) is
    # reported and skipped, so one full item does not stop the run.
    param($Wanted, $Present, [string]$Path, [string]$Label, [string]$What)
    foreach ($code in @($Wanted | Where-Object { $_ -and $knownCodes[$_] -and (@($Present) -notcontains $_) })) {
        try {
            Invoke-Api POST $Path @{ leerplandoelCode = $code } | Out-Null
            Add-Stat "$Label linked"
        }
        catch { Write-Warning "Could not link $code to $What. $_" }
    }
}

# --- Preconditions, before any secret is read or anything in Azure is touched ----------------------------------------

$data = Get-Content $DataFile -Raw -Encoding UTF8 | ConvertFrom-Json

# A code in both doelen and doelenWeg would be linked and unlinked on alternate runs.
foreach ($act in @($data.themas | ForEach-Object { $_.subthemas } | ForEach-Object { $_.activiteiten } | Where-Object { $_ })) {
    $overlap = @($act.doelen | Where-Object { $_ -and (@($act.doelenWeg) -contains $_) })
    if ($overlap.Count -gt 0) { throw "Activiteit '$($act.naam)' lists $($overlap -join ', ') in both doelen and doelenWeg." }
}

if (-not (Test-Native { docker info --format '{{.ServerVersion}}' })) { throw 'Docker is not running; it is needed for psql.' }

try {
    Invoke-WebRequest "$baseUrl/health" -UseBasicParsing -TimeoutSec 3 | Out-Null
    throw "Something already answers on $baseUrl. Pick another -Port."
}
catch [System.Net.WebException] { }

if (-not $AllowDirty) {
    $dirty = git -C $root status --porcelain
    if ($LASTEXITCODE -ne 0) { throw 'git status failed.' }
    if ($dirty) { throw 'The working tree has uncommitted changes, and the API is built from it. Commit them, or pass -AllowDirty.' }
}

# Every migration this checkout carries, by the id EF writes to __EFMigrationsHistory (the file name without .cs). The
# whole set, not the newest: migrations from parallel branches interleave by timestamp, so a database that holds the
# newest one can still lack an older one that was merged after it.
$checkoutMigrations = @(Get-ChildItem $migrationsFolder -Filter '2*.cs' |
    Where-Object { $_.Name -notlike '*.Designer.cs' } | Sort-Object Name | ForEach-Object { $_.BaseName })
if ($checkoutMigrations.Count -eq 0) { throw "No migrations found in $migrationsFolder." }

Write-Host 'Building the API (before any secret is read, and without build servers).'
dotnet build $apiProject --nologo --verbosity quiet --disable-build-servers
if ($LASTEXITCODE -ne 0) { throw "dotnet build failed with exit code $LASTEXITCODE." }
$apiDll = Get-ChildItem (Join-Path $apiProject 'bin/Debug') -Recurse -Filter 'Jaarplanner.Api.dll' |
    Sort-Object LastWriteTime | Select-Object -Last 1

# No '|' in these queries: az is a .cmd file, and cmd.exe would read a pipe in an argument as its own.
$keyUri = Invoke-Az webapp config appsettings list --resource-group $ResourceGroup --name $AppName `
    --query "[?name=='DataProtection__KeyVaultSleutel'].value" -o tsv
$adminEmail = Invoke-Az webapp config appsettings list --resource-group $ResourceGroup --name $AppName `
    --query "[?name=='Authenticatie__EersteAdmin'].value" -o tsv
if ([string]::IsNullOrWhiteSpace($adminEmail)) {
    # The setting's name before the role was called admin (FB-072), on a web app not redeployed since.
    $adminEmail = Invoke-Az webapp config appsettings list --resource-group $ResourceGroup --name $AppName `
        --query "[?name=='Authenticatie__EersteDirectie'].value" -o tsv
}
if ([string]::IsNullOrWhiteSpace($keyUri) -or [string]::IsNullOrWhiteSpace($adminEmail)) {
    throw "The web app $AppName has no DataProtection__KeyVaultSleutel or Authenticatie__EersteAdmin setting."
}
$keyScope = (Invoke-Az keyvault show --name $VaultName --query id -o tsv) + '/keys/' + ($keyUri.TrimEnd('/') -split '/')[-1]
$operator = Invoke-Az ad signed-in-user show --query id -o tsv

$connection = Invoke-Az keyvault secret show --vault-name $VaultName --name 'ConnectionStrings--Postgres' --query value -o tsv
$script:pg = @{}
foreach ($pair in ($connection -split ';')) {
    $i = $pair.IndexOf('=')
    if ($i -gt 0) { $script:pg[$pair.Substring(0, $i).Trim()] = $pair.Substring($i + 1) }
}

# --- The run ---------------------------------------------------------------------------------------------------------

$firewallOpen = $false
$roleAssignmentId = $null
$api = $null
$keysBefore = $null
$succeeded = $false
$unwrappedFound = $false
$keyCheckFailed = $false
$logFile = Join-Path ([IO.Path]::GetTempPath()) "jaarplanner-seed-api-$PID.log"
$script:session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$knownCodes = @{}

try {
    $ip = (Invoke-RestMethod -Uri 'https://api.ipify.org').Trim()
    Invoke-Az postgres flexible-server firewall-rule create --resource-group $ResourceGroup --server-name $ServerName `
        --name $firewallRule --start-ip-address $ip --end-ip-address $ip --output none | Out-Null
    $firewallOpen = $true
    Write-Host "Firewall open for $ip."

    $databaseMigrations = @(Invoke-Psql 'select "MigrationId" from "__EFMigrationsHistory" order by "MigrationId";')
    $missing = @($checkoutMigrations | Where-Object { $databaseMigrations -notcontains $_ })
    if ($missing.Count -gt 0) {
        throw "The demo database lacks migration(s) $($missing -join ', ') from this checkout. Seed from the commit that is deployed, after migrate-db.ps1."
    }
    $unknown = @($databaseMigrations | Where-Object { $checkoutMigrations -notcontains $_ })
    if ($unknown.Count -gt 0) {
        throw "The demo database holds migration(s) $($unknown -join ', ') that this checkout does not. Seed from the commit that is deployed."
    }

    $escapedEmail = $adminEmail.Trim().ToLowerInvariant().Replace("'", "''")
    # @(): PowerShell unrolls a one-element array returned from a function, and [0] of the string that is left would
    # be its first character.
    $adminIds = @(Invoke-Psql "select ""Id"" from gebruikers where ""Email"" = '$escapedEmail' and ""IsAdmin"";")
    if ($adminIds.Count -ne 1) { throw "Expected one admin $adminEmail in the demo database, found $($adminIds.Count)." }
    $adminId = $adminIds[0]

    $keysBefore = @(Get-KeyRows)
    Write-Host "Data Protection keys before the run: $($keysBefore.Count)."

    $heldRoles = @(Invoke-Az role assignment list --assignee $operator --scope $keyScope --include-inherited `
        --query '[].roleDefinitionName' -o tsv)
    if (-not ($heldRoles | Where-Object { $keyRoles -contains $_ })) {
        $roleAssignmentId = Invoke-Az role assignment create --assignee-object-id $operator --assignee-principal-type User `
            --role 'Key Vault Crypto User' --scope $keyScope --query id -o tsv
        Write-Host 'Granted Key Vault Crypto User on the Data Protection key for this run.'
    }
    # A new role assignment takes a while to reach the vault's data plane. This probe proves read access only. If
    # unwrap has not arrived when the API starts, the API cannot use the existing key; a key it writes instead is still
    # wrapped (DataProtection__KeyVaultSleutel below), and the comparison after the run reports it.
    $deadline = (Get-Date).AddMinutes(10)
    while ($true) {
        if (Test-Native { az keyvault key show --id $keyUri --output none }) { break }
        if ((Get-Date) -gt $deadline) { throw 'The Data Protection key is still not readable after ten minutes.' }
        Start-Sleep -Seconds 15
    }

    # Development maps the development sign-in, which answers loopback only. Environment variables override
    # appsettings and user-secrets, so the demo's connection string and key are the ones used.
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = $baseUrl
    $env:ConnectionStrings__Postgres = $connection
    $env:DataProtection__KeyVaultSleutel = $keyUri
    # The identity the key role was granted to; DefaultAzureCredential would otherwise try a signed-in Visual Studio
    # account first.
    $env:AZURE_TOKEN_CREDENTIALS = 'AzureCliCredential'
    $env:Authenticatie__Modus = 'Ontwikkeling'
    # The bootstrap writes only into an empty gebruikers table, which the check above rules out; pinning the demo's
    # own address means that even then it could only create the demo's admin.
    $env:Authenticatie__EersteAdmin = $adminEmail
    $env:Demo__Seed = 'false'
    try {
        $api = Start-Process dotnet -ArgumentList "`"$($apiDll.FullName)`"" -WorkingDirectory $apiProject -PassThru `
            -NoNewWindow -RedirectStandardOutput $logFile -RedirectStandardError "$logFile.err"
    }
    finally {
        # The API has its copy; nothing else started from here should.
        Restore-Env $apiEnvNames
    }

    $deadline = (Get-Date).AddMinutes(2)
    while ($true) {
        if ($api.HasExited) { throw "The API stopped during startup. Log: $logFile" }
        try {
            if ((Invoke-WebRequest "$baseUrl/health/ready" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { break }
        }
        catch { }
        if ((Get-Date) -gt $deadline) { throw "The API did not become ready within two minutes. Log: $logFile" }
        Start-Sleep -Seconds 2
    }
    Write-Host "API ready on $baseUrl."

    # Signs in as the existing admin and lands on /health; the cookie stays in the session.
    Invoke-WebRequest ("$baseUrl/api/aanmelden/ontwikkeling/$adminId" + '?terugNaar=%2Fhealth') `
        -WebSession $script:session -UseBasicParsing | Out-Null
    $ik = Invoke-Api GET '/api/ik'
    if (-not $ik.isAdmin) { throw "Signed in as $($ik.email), who is not admin." }
    Write-Host "Signed in as $($ik.naam)."

    # --- Seed ---------------------------------------------------------------------------------------------------------

    $schooljaar = Find-ByName (Invoke-Api GET '/api/schooljaren') $data.schooljaar
    if (-not $schooljaar) { throw "The demo has no schooljaar $($data.schooljaar)." }

    # Every goal code the data file names, checked once. A missing code is skipped rather than failing the run.
    $allCodes = @($data.themas | ForEach-Object {
            $_.themadoelen
            $_.subthemas | ForEach-Object { $_.subdoelen; $_.activiteiten | ForEach-Object { $_.doelen } }
        }) +
        @($data.algemeneFiches | ForEach-Object { $_.doelen.PSObject.Properties | ForEach-Object { $_.Value } })
    foreach ($code in ($allCodes | Where-Object { $_ } | Sort-Object -Unique)) {
        if (Invoke-Api GET "/api/leerplandoelen/$([Uri]::EscapeDataString($code))" -AllowNotFound) { $knownCodes[$code] = $true }
        else { Write-Warning "Leerplandoel $code is not in the demo database; its links are skipped." }
    }

    $existingKlassen = @(Invoke-Api GET '/api/klassen')
    $klassen = @()
    foreach ($entry in $data.klassen) {
        $klas = Find-ByName $existingKlassen $entry.naam
        if ($klas) {
            if ($klas.schooljaarId -ne $schooljaar.id) {
                Write-Warning "Klas '$($entry.naam)' exists in another schooljaar; skipped."
                continue
            }
            Add-Stat 'klassen found'
        }
        else {
            $klas = Invoke-Api POST "/api/schooljaren/$($schooljaar.id)/klassen" @{ naam = $entry.naam; jaarfase = $entry.jaarfase }
            Add-Stat 'klassen created'
        }
        $klassen += [pscustomobject]@{ id = $klas.id; naam = $klas.naam; jaarfase = $klas.jaarfase }
    }

    $existingThemas = @(Invoke-Api GET '/api/themas')
    foreach ($entry in $data.themas) {
        $thema = Find-ByName $existingThemas $entry.naam
        if ($thema) {
            Add-Stat "thema's found"
        }
        else {
            $thema = Invoke-Api POST '/api/themas' @{
                naam              = $entry.naam
                duurWeken         = $entry.duurWeken
                invalshoeken      = $entry.invalshoeken
                kernwoordenschat  = @($entry.kernwoordenschat)
                rijkeWoordenschat = @()
            }
            Add-Stat "thema's created"
        }
        Add-GoalLinks -Wanted $entry.themadoelen -Present @($thema.themadoelen | ForEach-Object { $_.koppeling.leerplandoelCode }) `
            -Path "/api/themas/$($thema.id)/themadoelen" -Label 'themadoelen' -What $entry.naam

        foreach ($sub in @($entry.subthemas)) {
            if (-not $sub) { continue }
            $subthema = @($thema.subthemas | Where-Object { $_.naam -eq $sub.naam -and $_.leeftijd -eq $sub.leeftijd }) |
                Select-Object -First 1
            if ($subthema) {
                Add-Stat "subthema's found"
            }
            else {
                $subthema = Invoke-Api POST "/api/themas/$($thema.id)/subthemas" @{
                    naam             = $sub.naam
                    duurWeken        = $sub.duurWeken
                    leeftijd         = $sub.leeftijd
                    onderzoeksvragen = @(@{ vraag = $sub.onderzoeksvraag; probleemstelling = $null })
                }
                Add-Stat "subthema's created"
            }
            Add-GoalLinks -Wanted $sub.subdoelen -Present @($subthema.subdoelen | ForEach-Object { $_.koppeling.leerplandoelCode }) `
                -Path "/api/subthemas/$($subthema.id)/doelkoppelingen" -Label 'subdoelen' -What "$($entry.naam) / $($sub.naam)"

            # Activiteiten belong to the subthema, so every klas of its leeftijd sees them (ADR-0025).
            foreach ($act in @($sub.activiteiten)) {
                if (-not $act) { continue }
                $what = "$($entry.naam) / $($sub.naam) / $($act.naam)"
                $activiteit = @($subthema.activiteiten | Where-Object { $_.naam -eq $act.naam }) | Select-Object -First 1
                if ($activiteit) {
                    Add-Stat 'activiteiten found'
                    # A link the data file withdrew (doelenWeg) is removed on every run; no other link is ever touched.
                    # A refusal is reported and skipped, like a refused link in Add-GoalLinks.
                    $withdrawn = @($act.doelenWeg | Where-Object { $_ })
                    foreach ($koppeling in @($activiteit.doelkoppelingen | Where-Object { $withdrawn -contains $_.leerplandoelCode })) {
                        try {
                            Invoke-Api DELETE "/api/activiteiten/$($activiteit.id)/doelkoppelingen/$($koppeling.id)" | Out-Null
                            Add-Stat 'activiteit goals removed'
                        }
                        catch { Write-Warning "Could not remove $($koppeling.leerplandoelCode) from $what. $_" }
                    }
                    Add-GoalLinks -Wanted $act.doelen -Present @($activiteit.doelkoppelingen | ForEach-Object { $_.leerplandoelCode }) `
                        -Path "/api/activiteiten/$($activiteit.id)/doelkoppelingen" -Label 'activiteit goals' -What $what
                    continue
                }
                # The subthema's vraag with the data file's text, else its first one. Both belong to this subthema,
                # which is the only kind the API accepts.
                $vragen = @($subthema.onderzoeksvragen)
                $onderzoeksvraag = @($vragen | Where-Object { $_.vraag -eq $sub.onderzoeksvraag }) | Select-Object -First 1
                if (-not $onderzoeksvraag) { $onderzoeksvraag = $vragen | Select-Object -First 1 }
                $onderzoeksvraagId = $null
                if ($onderzoeksvraag) { $onderzoeksvraagId = $onderzoeksvraag.id }
                else { Write-Warning "Subthema '$($sub.naam)' has no onderzoeksvraag; '$($act.naam)' is created without one." }
                $codes = @($act.doelen | Where-Object { $_ -and $knownCodes[$_] })
                Invoke-Api POST "/api/subthemas/$($subthema.id)/activiteiten" @{
                    naam                = $act.naam
                    activiteitType      = $act.type
                    hoek                = $act.hoek
                    verwachteUitkomsten = $act.verwachteUitkomsten
                    onderzoeksvraagId   = $onderzoeksvraagId
                    kleur               = $null
                    lengteInLesuren     = $act.lengteInLesuren
                    leerplandoelCodes   = $codes
                } | Out-Null
                Add-Stat 'activiteiten created'
                foreach ($code in $codes) { Add-Stat 'activiteit goals linked' }
            }
        }
    }

    foreach ($klas in $klassen) {
        $existingFiches = @(Invoke-Api GET "/api/klassen/$($klas.id)/algemene-fiches")
        foreach ($entry in $data.algemeneFiches) {
            $fiche = Find-ByName $existingFiches $entry.naam
            if ($fiche) {
                Add-Stat 'algemene fiches found'
            }
            else {
                $fiche = Invoke-Api POST "/api/klassen/$($klas.id)/algemene-fiches" @{ naam = $entry.naam; omschrijving = $entry.omschrijving }
                Add-Stat 'algemene fiches created'
            }
            Add-GoalLinks -Wanted @($entry.doelen.($klas.jaarfase)) -Present @($fiche.doelen | ForEach-Object { $_.leerplandoelCode }) `
                -Path "/api/algemene-fiches/$($fiche.id)/doelkoppelingen" -Label 'fiche goals' -What "$($klas.naam) / $($entry.naam)"
        }

        $existingHoeken = @(Invoke-Api GET "/api/klassen/$($klas.id)/hoeken")
        foreach ($entry in $data.hoeken) {
            if ($entry.jaarfasen -and (@($entry.jaarfasen) -notcontains $klas.jaarfase)) { continue }
            if (Find-ByName $existingHoeken $entry.naam) { Add-Stat 'hoeken found'; continue }
            Invoke-Api POST "/api/klassen/$($klas.id)/hoeken" @{ naam = $entry.naam; omschrijving = $entry.omschrijving } | Out-Null
            Add-Stat 'hoeken created'
        }
    }

    Write-Host ''
    Write-Host 'Seed finished:'
    foreach ($name in $stats.Keys) { Write-Host ("  {0,-26} {1}" -f $name, $stats[$name]) }
    $succeeded = $true
}
finally {
    # Each step in its own try, so one failing step does not skip the ones after it.
    try {
        if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force }
    }
    catch { Write-Cleanup "WARNING: could not stop the API process: $_" }

    if ($roleAssignmentId) {
        try {
            az role assignment delete --ids $roleAssignmentId --output none
            if ($LASTEXITCODE -eq 0) { Write-Cleanup 'Removed the temporary key role.' }
            else { Write-Cleanup "WARNING: could not remove role assignment $roleAssignmentId; remove it by hand." }
        }
        catch { Write-Cleanup "WARNING: could not remove role assignment $roleAssignmentId ($_); remove it by hand." }
    }

    if ($firewallOpen -and $null -ne $keysBefore) {
        try {
            $keysAfter = @(Get-KeyRows)
            $newRows = @($keysAfter | Where-Object { $keysBefore -notcontains $_ })
            $unwrapped = @($newRows | Where-Object { $_ -like '*|false' } | ForEach-Object { ($_ -split '\|')[0] })
            if ($unwrapped.Count -gt 0) {
                $unwrappedFound = $true
                $null = Invoke-Psql "delete from data_protection_keys where ""Id"" in ($($unwrapped -join ','));"
                Write-Cleanup "ERROR: the run created $($unwrapped.Count) unwrapped Data Protection key(s); deleted them. API log: $logFile"
            }
            elseif ($newRows.Count -gt 0) {
                Write-Cleanup "WARNING: the run added $($newRows.Count) Key Vault-wrapped Data Protection key(s); left in place, because the Azure app may already use them."
            }
            else {
                Write-Cleanup "Data Protection keys unchanged ($($keysAfter.Count))."
            }
        }
        catch {
            $keyCheckFailed = $true
            Write-Cleanup "ERROR: could not compare the Data Protection keys: $_"
        }
    }

    if ($firewallOpen) {
        try {
            az postgres flexible-server firewall-rule delete --resource-group $ResourceGroup --server-name $ServerName `
                --name $firewallRule --yes --output none
            if ($LASTEXITCODE -eq 0) { Write-Cleanup 'Firewall closed.' }
            else { Write-Cleanup "WARNING: could not delete firewall rule $firewallRule; delete it by hand." }
        }
        catch { Write-Cleanup "WARNING: could not delete firewall rule $firewallRule ($_); delete it by hand." }
    }

    Restore-Env ($pgNames + $apiEnvNames)
    $connection = $null
    $script:pg = $null
    if ($succeeded -and -not $unwrappedFound -and -not $keyCheckFailed) {
        Remove-Item $logFile, "$logFile.err" -ErrorAction SilentlyContinue
    }
}

if ($unwrappedFound) { throw "An unwrapped Data Protection key appeared during the run and was deleted. API log: $logFile" }
if ($keyCheckFailed) { throw 'The Data Protection keys could not be compared after the run. Check data_protection_keys by hand.' }
