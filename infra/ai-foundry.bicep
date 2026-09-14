// A Foundry (Azure OpenAI) resource for measuring the AI doelsuggesties (TB-004, ADR-0036): Sweden Central, Data Zone
// Standard (EU) deployments only, and no keys: every caller signs in with Microsoft Entra. It lives in its own resource
// group, apart from the demo (ADR-0034) and from any school's environment, so deleting it removes nothing else.
// Deployed with the Azure CLI; see infra/ai-foundry.md.
targetScope = 'resourceGroup'

@description('Region. Sweden Central offers every model below as Data Zone Standard (EU); Belgium Central offers none of them.')
param location string = 'swedencentral'

@description('Makes the globally unique names unique. Derived from the resource group, so a redeploy keeps the same names.')
param suffix string = take(uniqueString(resourceGroup().id), 6)

@description('Object id of the person who runs the eval. Gets Cognitive Services OpenAI User on this resource and nothing else.')
param evaluatorObjectId string

@description('The model deployments. Capacity is in thousands of tokens per minute: it caps how fast the eval can spend, not what a token costs. Kept low on purpose (TB-004).')
param modelDeployments array = [
  {
    name: 'gpt-5.4-mini'
    model: 'gpt-5.4-mini'
    version: '2026-03-17'
    capacity: 50
  }
  {
    name: 'gpt-5-mini'
    model: 'gpt-5-mini'
    version: '2025-08-07'
    capacity: 50
  }
  {
    name: 'text-embedding-3-small'
    model: 'text-embedding-3-small'
    version: '1'
    capacity: 100
  }
  {
    name: 'text-embedding-3-large'
    model: 'text-embedding-3-large'
    version: '1'
    capacity: 100
  }
]

var accountName = 'ai-jaarplanner-${suffix}'
var tags = {
  project: 'jaarplanner'
  purpose: 'ai-eval'
}

// Built-in role: call the models, nothing else (no keys, no deployments, no management).
var roleCognitiveServicesOpenAiUser = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  properties: {
    // Required for Entra tokens, and it gives the endpoint its name.
    customSubDomainName: accountName
    // No keys exist, so none can leak: every call carries an Entra token (Art. VI.4).
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

// One at a time: the account refuses a second deployment operation while one is still running.
@batchSize(1)
resource deployments 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = [
  for d in modelDeployments: {
    parent: account
    name: d.name
    sku: {
      // Prompts and completions are processed within the EU data zone only (ADR-0016).
      name: 'DataZoneStandard'
      capacity: d.capacity
    }
    properties: {
      model: {
        format: 'OpenAI'
        name: d.model
        version: d.version
      }
      // A measurement is only comparable against the same model version.
      versionUpgradeOption: 'NoAutoUpgrade'
    }
  }
]

resource evaluatorCallsModels 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(account.id, evaluatorObjectId, roleCognitiveServicesOpenAiUser)
  scope: account
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleCognitiveServicesOpenAiUser)
    principalId: evaluatorObjectId
    principalType: 'User'
  }
}

output accountName string = account.name
output endpoint string = 'https://${accountName}.openai.azure.com/'
