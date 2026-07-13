using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching;
using Jaarplanner.Infrastructure.Ai;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.Infrastructure;

/// <summary>
/// Composition root for the Infrastructure layer. The (thin) Api calls
/// <see cref="AddInfrastructure"/> from Program.cs so that data-access concerns
/// stay in Infrastructure (Art. VIII layering: Domain ← Application ← Infrastructure).
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Configuration key holding the PostgreSQL connection string.
    /// Provided via .NET user-secrets locally and Azure Key Vault in the cloud (E0-07,
    /// ADR-0012) — never committed (Art. VI.4). Read as <c>ConnectionStrings:Postgres</c>.
    /// </summary>
    public const string PostgresConnectionStringName = "Postgres";

    /// <summary>
    /// Registers the EF Core <see cref="AppDbContext"/> on the Npgsql (PostgreSQL) provider
    /// and a database readiness health check (tagged "db", "ready") that <c>/health</c> uses.
    /// The connection string is resolved from configuration; if absent the app still starts
    /// and the health check reports Unhealthy rather than crashing.
    /// </summary>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(PostgresConnectionStringName);

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString));

        // AI seam (E2-01, Art. IV.6 / VI.4). The matching/plan logic depends on the injectable
        // IAiClient interface (Application) so it is fakeable with no network in tests; the real
        // implementation is the Azure AI Foundry client (Infrastructure, Art. VIII). Its key/endpoint
        // are read from the server-side `AzureAI` config section only (user-secrets / Key Vault) —
        // the key never reaches the frontend (Art. VI.4).
        services.Configure<AzureAIOptions>(configuration.GetSection(AzureAIOptions.SectionName));
        services.AddHttpClient<IAiClient, AzureAiFoundryClient>();

        // The AI goal-matching service seam (FR-4) that E2-02..E2-04 flesh out; it depends only on
        // IAiClient, so the same registration works against the fake in tests.
        services.AddScoped<DoelMatchingService>();

        services.AddHealthChecks()
            .AddDbContextCheck<AppDbContext>(
                name: "postgres",
                tags: ["db", "ready"]);

        return services;
    }
}
