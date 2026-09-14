// The Foundry account, its model deployments and the evaluator's role, inside the resource group ai-foundry.bicep
// creates (TB-004, ADR-0036). Not deployed on its own: ai-foundry.bicep is the entry point.
targetScope = 'resourceGroup'

@description('Region. Sweden Central offers every model below as Data Zone Standard (EU); Belgium Central offers none of them.')
param location string

@description('Makes the globally unique names unique. Derived from the resource group, so a redeploy keeps the same names.')
param suffix string = take(uniqueString(resourceGroup().id), 6)

@description('Object id of the person who runs the eval. Gets Cognitive Services OpenAI User on this resource and nothing else.')
param evaluatorObjectId string

@description('The model deployments, each { name, model, version, capacity }. Capacity is in thousands of tokens per minute.')
param modelDeployments array

param tags object

var accountName = 'ai-jaarplanner-${suffix}'

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
output deploymentNames array = [for (d, i) in modelDeployments: deployments[i].name]
