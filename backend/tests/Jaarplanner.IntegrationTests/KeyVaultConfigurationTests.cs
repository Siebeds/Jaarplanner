using Jaarplanner.Api.Configuration;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Pins the E0-07 acceptance criterion (Art. VI.4 / ADR-0012): the Azure Key Vault
/// configuration binding is a <b>no-op when no vault URI is configured</b>, so local dev
/// and the test suite require zero Azure dependencies and never break when the URI is absent.
/// It must only ever try to reach Azure in a non-Development environment with a URI set.
/// </summary>
public class KeyVaultConfigurationTests
{
    private static IConfigurationBuilder NewBuilder(IDictionary<string, string?> values)
    {
        var builder = new ConfigurationBuilder();
        builder.AddInMemoryCollection(values);
        return builder;
    }

    private static IHostEnvironment Env(string environmentName) =>
        new FakeHostEnvironment { EnvironmentName = environmentName };

    private sealed class FakeHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "Jaarplanner.Api";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } =
            new NullFileProvider();
    }

    [Fact]
    public void No_vault_uri_in_production_is_a_no_op_and_does_not_touch_Azure()
    {
        var builder = NewBuilder(new Dictionary<string, string?>());

        // Should NOT throw and should NOT add a Key Vault source (which would need Azure).
        var result = builder.AddAzureKeyVaultIfConfigured(Env(Environments.Production));

        Assert.Same(builder, result);
        // No source that requires network/credentials was added → Build() stays offline.
        var config = builder.Build();
        Assert.Null(config[KeyVaultConfiguration.VaultUriConfigKey]);
    }

    [Fact]
    public void Development_environment_never_binds_Azure_even_if_a_uri_is_present()
    {
        var builder = NewBuilder(new Dictionary<string, string?>
        {
            [KeyVaultConfiguration.VaultUriConfigKey] = "https://example-vault.vault.azure.net/",
        });

        // In Development we rely on user-secrets; Key Vault must be skipped regardless.
        var result = builder.AddAzureKeyVaultIfConfigured(Env(Environments.Development));

        Assert.Same(builder, result);
    }

    [Fact]
    public void Empty_vault_uri_in_production_is_a_no_op()
    {
        var builder = NewBuilder(new Dictionary<string, string?>
        {
            [KeyVaultConfiguration.VaultUriConfigKey] = "   ",
        });

        var result = builder.AddAzureKeyVaultIfConfigured(Env(Environments.Production));

        Assert.Same(builder, result);
    }

    [Fact]
    public void Malformed_vault_uri_in_production_fails_fast_with_a_clear_message()
    {
        var builder = NewBuilder(new Dictionary<string, string?>
        {
            [KeyVaultConfiguration.VaultUriConfigKey] = "not-a-uri",
        });

        var ex = Assert.Throws<InvalidOperationException>(
            () => builder.AddAzureKeyVaultIfConfigured(Env(Environments.Production)));

        Assert.Contains(KeyVaultConfiguration.VaultUriConfigKey, ex.Message);
    }
}
