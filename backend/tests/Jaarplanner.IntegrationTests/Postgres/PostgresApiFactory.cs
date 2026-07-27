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
        });
    }
}
