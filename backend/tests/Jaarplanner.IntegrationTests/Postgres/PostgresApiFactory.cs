using Jaarplanner.Application.Ai;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Hosts the real API against a throwaway PostgreSQL database (<see cref="PostgresTestDatabase"/>).
/// <para>
/// Unlike the in-memory factory this replaces, only the <b>connection string</b> is overridden — the
/// production Npgsql provider, migrations, FKs, unique indexes and seed data all stay in force, so an
/// endpoint test exercises the same database guarantees the deployed app has.
/// </para>
/// </summary>
public sealed class PostgresApiFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString;

    public PostgresApiFactory(string connectionString) => _connectionString = connectionString;

    /// <summary>
    /// The canned completion the stubbed <see cref="IAiClient"/> returns, or <c>null</c> to make any model call fail
    /// the test (E3-03).
    /// <para>
    /// <b>The stub is always registered, deliberately.</b> Left unset it throws rather than answering, so a Postgres
    /// test that reaches the model by accident says so instead of trying to call Azure from CI. Art. IV.6 asks for the
    /// client to be injectable exactly so this is possible; every other seam here stays production.
    /// </para>
    /// </summary>
    public string? AiAntwoord { get; set; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(Environments.Development);

        // Supply the connection string through configuration, the same key production reads, so the
        // Infrastructure wiring stays untouched.
        builder.UseSetting("ConnectionStrings:Postgres", _connectionString);

        builder.ConfigureServices(services =>
        {
            // Re-point the DbContext at the test database. The provider is already Npgsql, so only the
            // options descriptor is replaced — no "two providers in one container" juggling needed.
            var options = services
                .Where(d =>
                    d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                    d.ServiceType == typeof(DbContextOptions))
                .ToList();
            foreach (var descriptor in options)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AppDbContext>(o => o.UseNpgsql(_connectionString));

            foreach (var descriptor in services.Where(d => d.ServiceType == typeof(IAiClient)).ToList())
            {
                services.Remove(descriptor);
            }

            services.AddSingleton<IAiClient>(new StubAiClient(() => AiAntwoord));
        });
    }

    /// <summary>Reads the canned answer at call time, so a test can set it after the host is built.</summary>
    private sealed class StubAiClient : IAiClient
    {
        private readonly Func<string?> _antwoord;

        public StubAiClient(Func<string?> antwoord) => _antwoord = antwoord;

        public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(new AiCompletion
            {
                Content = _antwoord()
                    ?? throw new InvalidOperationException(
                        "The AI client was reached on a Postgres test that set no canned answer."),
            });
    }
}
