using System.Net;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Pins the E0-04 acceptance criterion: the API starts and serves a working <c>/health</c> liveness endpoint
/// that returns 200 even when no database is reachable. The DB readiness state lives on a separate
/// <c>/health/ready</c> probe and must not crash the app.
/// <para>
/// <b>The unreachable database is forced, not assumed</b> (fixed 2026-07-29). This class previously used a
/// bare <see cref="WebApplicationFactory{T}"/>, so it inherited whatever <c>ConnectionStrings:Postgres</c>
/// the ambient configuration happened to hold — which is <i>empty</i> in CI and on a machine with no local
/// Postgres, and therefore looked green. The moment a developer set a working connection string in
/// user-secrets, `/health/ready` correctly returned 200 and the test failed: it was asserting "this
/// developer has no database" rather than the behaviour in its own name. Overriding the connection string
/// here makes the test mean the same thing on every machine.
/// </para>
/// </summary>
public class HealthEndpointTests : IClassFixture<HealthEndpointTests.OnbereikbareDatabaseFactory>
{
    private readonly OnbereikbareDatabaseFactory _factory;

    public HealthEndpointTests(OnbereikbareDatabaseFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_liveness_returns_200_even_without_a_database()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Health_ready_responds_without_crashing_when_database_is_unreachable()
    {
        var client = _factory.CreateClient();

        // The factory points the DbContext at a closed port, so the readiness check reports Unhealthy
        // (503). The point of this test is that the app stays up and responds rather than crashing.
        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("Unhealthy", await response.Content.ReadAsStringAsync());
    }

    /// <summary>
    /// Host whose <see cref="AppDbContext"/> points at a <b>closed port</b>, so "the database is
    /// unreachable" is a fact this test establishes rather than a property of the machine it runs on.
    /// <para>
    /// The <see cref="AppDbContext"/> registration is <b>replaced</b> rather than the configuration being
    /// overridden. Overriding <c>ConnectionStrings:Postgres</c> via <c>ConfigureAppConfiguration</c> was
    /// tried first and did <i>not</i> win over user-secrets, so the test still saw the developer's real
    /// database. Removing and re-adding the descriptor is unambiguous, and it is the same technique the
    /// other factories in this suite use to swap the provider.
    /// </para>
    /// <para>
    /// Port 1 is not listening, so the connection is refused immediately rather than waiting on a timeout.
    /// </para>
    /// </summary>
    public sealed class OnbereikbareDatabaseFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder) =>
            builder.ConfigureServices(services =>
            {
                var toRemove = services
                    .Where(d =>
                        d.ServiceType == typeof(AppDbContext) ||
                        d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                        (d.ServiceType.FullName?.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ?? false) ||
                        (d.ServiceType.Namespace?.StartsWith("Npgsql", StringComparison.Ordinal) ?? false))
                    .ToList();
                foreach (var descriptor in toRemove)
                {
                    services.Remove(descriptor);
                }

                services.AddDbContext<AppDbContext>(options => options.UseNpgsql(
                    "Host=127.0.0.1;Port=1;Database=onbereikbaar;Username=x;Password=x;Timeout=1"));
            });
    }
}
