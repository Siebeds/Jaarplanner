<#
.SYNOPSIS
    Applies the EF Core migrations to the demo database from this machine (ADR-0034).

.DESCRIPTION
    Reads the connection string from Key Vault, opens the PostgreSQL firewall to this machine's public address for the
    duration of the run, and closes it again, also when the migration fails. The app never migrates itself at startup.
    `dotnet dnx` runs dotnet-ef at the version of Microsoft.EntityFrameworkCore.Design in the API project, read from its
    csproj, so nothing is installed globally and a package bump cannot leave this script behind.

.EXAMPLE
    ./infra/migrate-db.ps1 -ServerName pg-jaarplanner-demo-abc123 -VaultName kv-jpdemo-abc123
#>
param(
    [Parameter(Mandatory = $true)][string]$ServerName,
    [Parameter(Mandatory = $true)][string]$VaultName,
    [string]$ResourceGroup = 'rg-jaarplanner-demo'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$rule = 'migration-from-operator'

$csproj = Get-Content (Join-Path $backend 'src/Jaarplanner.Api/Jaarplanner.Api.csproj') -Raw
if ($csproj -notmatch 'Include="Microsoft\.EntityFrameworkCore\.Design"\s+Version="([^"]+)"') {
    throw 'Could not read the Microsoft.EntityFrameworkCore.Design version from Jaarplanner.Api.csproj.'
}
$efVersion = $Matches[1]

$connection = az keyvault secret show --vault-name $VaultName --name 'ConnectionStrings--Postgres' --query value -o tsv
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($connection)) {
    throw 'Could not read ConnectionStrings--Postgres from Key Vault.'
}

$ip = (Invoke-RestMethod -Uri 'https://api.ipify.org').Trim()
az postgres flexible-server firewall-rule create --resource-group $ResourceGroup --server-name $ServerName `
    --name $rule --start-ip-address $ip --end-ip-address $ip --output none
if ($LASTEXITCODE -ne 0) { throw "Could not open the PostgreSQL firewall to $ip." }

$previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
$previousConnection = $env:ConnectionStrings__Postgres
try {
    # The design-time host builds the API. Outside Development it refuses to start without the Entra and Key Vault
    # settings, which a migration does not need.
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    # Through the environment rather than --connection, so the password is not on a command line that every process
    # on the machine can list. Environment variables override user-secrets in the configuration order.
    $env:ConnectionStrings__Postgres = $connection
    dotnet dnx "dotnet-ef@$efVersion" -- database update `
        --project (Join-Path $backend 'src/Jaarplanner.Infrastructure') `
        --startup-project (Join-Path $backend 'src/Jaarplanner.Api')
    if ($LASTEXITCODE -ne 0) { throw "dotnet ef database update failed with exit code $LASTEXITCODE." }
}
finally {
    $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
    $env:ConnectionStrings__Postgres = $previousConnection
    $connection = $null
    az postgres flexible-server firewall-rule delete --resource-group $ResourceGroup --server-name $ServerName `
        --name $rule --yes --output none
}
