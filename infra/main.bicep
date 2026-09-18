// The Jaarplanner demo environment (ADR-0034): one resource group, the lowest-cost SKUs, one EU region.
// Deployed with the Azure CLI; see infra/README.md for the order of the steps.
targetScope = 'resourceGroup'

@description('Azure region for every resource. Belgium Central: West Europe refused new customers on 2026-09-13 (ADR-0034). The resource group itself stays in West Europe, which only holds its metadata.')
param location string = 'belgiumcentral'

@description('Makes the globally unique names unique. Derived from the resource group, so a redeploy keeps the same names.')
param suffix string = take(uniqueString(resourceGroup().id), 6)

@description('Object id of the person who deploys. They write the Entra client secret into the vault by hand.')
param deployerObjectId string

@description('The Entra tenant whose member accounts may sign in (ADR-0030 R1).')
param entraTenantId string = tenant().tenantId

@description('Client id of the app registration. Empty on the first run, before the registration exists.')
param entraClientId string = ''

@description('Sign-in name (UPN) of the first admin account, created while the gebruikers table is empty (ADR-0031 decision 7).')
param eersteAdmin string

@description('PostgreSQL administrator login. The app connects with it too: a demo trade-off (ADR-0034 decision 5).')
param postgresAdminLogin string = 'jaarplanner'

@secure()
@description('PostgreSQL administrator password. At rest it is stored only in Key Vault, inside the connection string.')
param postgresAdminPassword string

@description('Which model provider serves the AI calls (Ai:Provider, ADR-0048). Anthropic needs the Key Vault secret Anthropic--ApiKey; an empty value means Azure AI Foundry, which the demo does not configure.')
@allowed([
  ''
  'AzureAI'
  'Anthropic'
])
param aiProvider string = 'Anthropic'

var appName = 'jaarplanner-demo-${suffix}'
var keyVaultName = 'kv-jpdemo-${suffix}'
var postgresName = 'pg-jaarplanner-demo-${suffix}'
var databaseName = 'jaarplanner'
var tags = {
  project: 'jaarplanner'
  environment: 'demo'
}

// Built-in role definitions.
var roleKeyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var roleKeyVaultCryptoUser = '12338af0-0e69-4776-bea7-57ae8d297424'
var roleKeyVaultSecretsOfficer = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'

// --- App Service: the free Linux tier. No Always On, 60 CPU minutes a day, one shared instance.
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'plan-jaarplanner-demo'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'F1'
    tier: 'Free'
  }
  properties: {
    reserved: true
  }
}

// --- Key Vault: the connection string, the Entra client secret and the key that wraps the session keys.
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

// Wraps the Data Protection keys that encrypt the session cookie (ADR-0031 decision 5); the app refuses to start
// outside Development without it. An ARM PUT on a key only creates it when it does not exist yet, so a redeploy
// never rotates it underneath the running app.
resource dataProtectionKey 'Microsoft.KeyVault/vaults/keys@2023-07-01' = {
  parent: kv
  name: 'dataprotection'
  properties: {
    kty: 'RSA'
    keySize: 2048
    keyOps: [
      'wrapKey'
      'unwrapKey'
    ]
  }
}

// --- PostgreSQL: Burstable B1ms with 32 GB, the size the free services cover. No high availability, local backups.
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2025-08-01' = {
  name: postgresName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '17'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
      autoGrow: 'Disabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    authConfig: {
      passwordAuth: 'Enabled'
      activeDirectoryAuth: 'Disabled'
    }
  }
}

resource db 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2025-08-01' = {
  parent: pg
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// The free tier has no virtual network integration, so the app reaches the server over its public endpoint. This
// rule admits any Azure-hosted address, in any tenant, not only ours; the password and verified TLS are what keep
// others out. A demo trade-off (ADR-0034 decision 6). After the database: the server refuses a second child
// operation while one is still running.
resource postgresAzureFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2025-08-01' = {
  parent: pg
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
  dependsOn: [
    db
  ]
}

resource postgresConnectionSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  // Read by the app as ConnectionStrings:Postgres through the Key Vault configuration provider (ADR-0012).
  name: 'ConnectionStrings--Postgres'
  properties: {
    value: 'Host=${pg.properties.fullyQualifiedDomainName};Port=5432;Database=${databaseName};Username=${postgresAdminLogin};Password=${postgresAdminPassword};SSL Mode=VerifyFull'
  }
}

// --- The web app. Self-contained .NET, started by start.sh from the deployed package (ADR-0034).
resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      appCommandLine: 'sh /home/site/wwwroot/start.sh'
      alwaysOn: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          // App Service terminates TLS. Without this the sign-in's redirect_uri and the post-logout address are built
          // with http and Entra refuses them (ADR-0031, deployment prerequisites).
          name: 'ASPNETCORE_FORWARDEDHEADERS_ENABLED'
          value: 'true'
        }
        {
          name: 'ASPNETCORE_HTTP_PORTS'
          value: '8080'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          // The package is built on the operator's machine; the platform must not try to build it again.
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'KeyVault__Uri'
          value: kv.properties.vaultUri
        }
        {
          // Versionless on purpose: wrapping uses the current version, unwrapping the version each key was wrapped with.
          name: 'DataProtection__KeyVaultSleutel'
          value: dataProtectionKey.properties.keyUri
        }
        {
          name: 'Authenticatie__Modus'
          value: 'Entra'
        }
        {
          name: 'Authenticatie__Entra__TenantId'
          value: entraTenantId
        }
        {
          name: 'Authenticatie__Entra__ClientId'
          value: entraClientId
        }
        {
          name: 'Authenticatie__EersteAdmin'
          value: eersteAdmin
        }
        {
          // The key itself is the Key Vault secret Anthropic--ApiKey, never an app setting (Art. VI.4).
          name: 'Ai__Provider'
          value: aiProvider
        }
      ]
    }
  }
}

// --- Least privilege for the app's managed identity: read secrets from this vault, and use only the one key.
resource appReadsSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, app.id, roleKeyVaultSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultSecretsUser)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appUsesKey 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(dataProtectionKey.id, app.id, roleKeyVaultCryptoUser)
  scope: dataProtectionKey
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultCryptoUser)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// The operator writes the Entra client secret with the CLI, which is a data-plane write the vault's RBAC must allow.
resource deployerWritesSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, deployerObjectId, roleKeyVaultSecretsOfficer)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultSecretsOfficer)
    principalId: deployerObjectId
    principalType: 'User'
  }
}

output appName string = app.name
output appHost string = app.properties.defaultHostName
output keyVaultName string = kv.name
output postgresName string = pg.name
output postgresHost string = pg.properties.fullyQualifiedDomainName
