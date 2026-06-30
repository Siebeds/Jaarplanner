using Azure.Identity;
using Azure.Extensions.AspNetCore.Configuration.Secrets;

namespace Jaarplanner.Api.Configuration;

/// <summary>
/// Wires Azure Key Vault as a configuration source (E0-07 / ADR-0012, Art. VI.4 / VIII).
///
/// <para>
/// Cloud secrets (the Postgres connection string and — most critically — the future
/// Azure AI Foundry key) live in Key Vault and are injected at runtime, never committed.
/// Locally and in the test suite secrets come from .NET user-secrets instead, so this
/// binding is a deliberate <b>no-op when no vault URI is configured</b>: <c>dotnet run</c>
/// and <c>dotnet test</c> work with zero Azure dependencies.
/// </para>
/// </summary>
public static class KeyVaultConfiguration
{
    /// <summary>
    /// Configuration key holding the Key Vault URI (e.g. <c>https://my-vault.vault.azure.net/</c>).
    /// Bindable from appsettings (<c>KeyVault:Uri</c>) or the environment variable
    /// <c>KeyVault__Uri</c>. No URI is committed — it is supplied per environment.
    /// </summary>
    public const string VaultUriConfigKey = "KeyVault:Uri";

    /// <summary>
    /// Adds Azure Key Vault to the configuration pipeline <b>only</b> when:
    /// <list type="bullet">
    ///   <item>the environment is non-Development, and</item>
    ///   <item>a non-empty, well-formed <see cref="VaultUriConfigKey"/> is present.</item>
    /// </list>
    /// When either condition fails this method returns without touching the pipeline, so
    /// local dev and tests never require Azure (Art. VI.4 — no secret in the repo; the
    /// vault URI is read from config/env, never hard-coded).
    ///
    /// <para>
    /// Uses <see cref="DefaultAzureCredential"/> so the running service authenticates via
    /// its managed identity in Azure (no secret to store). This is the cloud-secrets seam;
    /// real vault contents (connection string, AI key) are provisioned in E7, not here.
    /// </para>
    /// </summary>
    public static IConfigurationBuilder AddAzureKeyVaultIfConfigured(
        this IConfigurationBuilder configuration,
        IHostEnvironment environment)
    {
        // Local dev relies on user-secrets; never reach for Azure in Development.
        if (environment.IsDevelopment())
        {
            return configuration;
        }

        var vaultUri = configuration.Build()[VaultUriConfigKey];

        // No vault configured → no-op. Keeps the binding inert when the URI is absent.
        if (string.IsNullOrWhiteSpace(vaultUri))
        {
            return configuration;
        }

        if (!Uri.TryCreate(vaultUri, UriKind.Absolute, out var uri))
        {
            throw new InvalidOperationException(
                $"'{VaultUriConfigKey}' is set but is not a valid absolute URI: '{vaultUri}'.");
        }

        // DefaultAzureCredential picks up the managed identity in Azure; no secret stored.
        configuration.AddAzureKeyVault(uri, new DefaultAzureCredential());

        return configuration;
    }
}
