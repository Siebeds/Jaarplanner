using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// A throwaway PostgreSQL database for one test class, created from the real EF Core migrations.
/// <para>
/// <b>Why this replaced the EF Core in-memory provider.</b> The in-memory provider enforces <b>no
/// foreign keys, no unique indexes and no collation</b>. That is not a smaller database — it is a
/// different one, and it silently green-lit a whole class of defects: the previous suite seeded a
/// <c>Leerplandoel</c> with <c>disciplineNummer "1"</c> while no <c>Discipline "1"</c> existed and
/// <c>SaveChanges</c> succeeded, so the required <c>Restrict</c> FK that breaks the first real Op.stap
/// import was invisible to CI. CLAUDE.md has always required "integration-test the API against a
/// Postgres test container"; this is that.
/// </para>
/// <para>
/// <b>Isolation.</b> Each test class gets its own uniquely named database, created by connecting to the
/// <c>postgres</c> maintenance database, then migrated with <see cref="RelationalDatabaseFacadeExtensions.Migrate"/>
/// so the schema under test is exactly the migrated production schema — indexes, FKs and seed data
/// included. It is dropped on dispose. Per-class databases matter now that <c>klassen.Naam</c> is
/// unique: two classes seeding the same class name would otherwise collide.
/// </para>
/// <para>
/// <b>Availability.</b> The base connection string comes from the <c>JAARPLANNER_TEST_POSTGRES</c>
/// environment variable (CI sets it from the workflow's Postgres service container; locally, point it at
/// <c>docker compose up -d db</c>). When it is absent the Postgres-backed tests are <b>skipped</b> — except
/// in CI, where <see cref="PostgresAvailabilityTests"/> turns a missing variable into a hard failure so
/// the suite can never silently degrade back to "no real database".
/// </para>
/// </summary>
public sealed class PostgresTestDatabase : IAsyncDisposable
{
    /// <summary>The environment variable holding the base (maintenance) connection string.</summary>
    public const string ConnectionStringVariable = "JAARPLANNER_TEST_POSTGRES";

    private readonly string _databaseNaam;

    private PostgresTestDatabase(string databaseNaam, string connectionString)
    {
        _databaseNaam = databaseNaam;
        ConnectionString = connectionString;
    }

    /// <summary>The connection string for this test's own database.</summary>
    public string ConnectionString { get; }

    /// <summary>The configured base connection string, or null when Postgres is not configured.</summary>
    public static string? BasisConnectionString =>
        Environment.GetEnvironmentVariable(ConnectionStringVariable) is { Length: > 0 } value ? value : null;

    /// <summary>True when a Postgres connection string is configured for the test run.</summary>
    public static bool IsBeschikbaar => BasisConnectionString is not null;

    /// <summary>True when running on a CI runner (GitHub Actions and most CI systems set <c>CI</c>).</summary>
    public static bool IsCi =>
        Environment.GetEnvironmentVariable("CI") is { Length: > 0 } value &&
        !string.Equals(value, "false", StringComparison.OrdinalIgnoreCase);

    /// <summary>The reason shown on a skipped Postgres test.</summary>
    public const string SkipReden =
        $"Requires PostgreSQL: set {ConnectionStringVariable} (e.g. run `docker compose up -d db` and point it at that instance). " +
        "These tests exercise real FK/unique-index enforcement, which the EF in-memory provider cannot.";

    /// <summary>
    /// Creates and migrates a fresh database for one test class. Throws when Postgres is not
    /// configured — callers gate on <see cref="IsBeschikbaar"/> (see <c>PostgresFactAttribute</c>).
    /// </summary>
    public static async Task<PostgresTestDatabase> MaakAsync(string prefix)
    {
        var basis = BasisConnectionString
            ?? throw new InvalidOperationException(SkipReden);

        // A unique, valid identifier: lowercase, no hyphens (unquoted identifiers fold to lowercase).
        var naam = $"jp_test_{prefix.ToLowerInvariant()}_{Guid.NewGuid():N}";

        var builder = new NpgsqlConnectionStringBuilder(basis) { Database = "postgres" };
        await using (var admin = new NpgsqlConnection(builder.ConnectionString))
        {
            await admin.OpenAsync();
            await using var cmd = admin.CreateCommand();
            // Identifier is generated above from a GUID, not from test input — no injection surface,
            // and CREATE DATABASE cannot be parameterised.
            cmd.CommandText = $"CREATE DATABASE \"{naam}\"";
            await cmd.ExecuteNonQueryAsync();
        }

        var testConnectionString = new NpgsqlConnectionStringBuilder(basis) { Database = naam }.ConnectionString;

        // Apply the real migrations, so the schema under test carries the production FKs, unique
        // indexes and seed data (including the seeded disciplines).
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(testConnectionString)
            .Options;
        await using (var context = new AppDbContext(options))
        {
            await context.Database.MigrateAsync();
        }

        return new PostgresTestDatabase(naam, testConnectionString);
    }

    /// <summary>Creates a context against this test database.</summary>
    public AppDbContext MaakContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options);

    public async ValueTask DisposeAsync()
    {
        // Npgsql pools connections per connection string; the pool must be cleared before the
        // database can be dropped, otherwise DROP fails with "database is being accessed by other users".
        NpgsqlConnection.ClearAllPools();

        var builder = new NpgsqlConnectionStringBuilder(ConnectionString) { Database = "postgres" };
        await using var admin = new NpgsqlConnection(builder.ConnectionString);
        await admin.OpenAsync();
        await using var cmd = admin.CreateCommand();
        cmd.CommandText = $"DROP DATABASE IF EXISTS \"{_databaseNaam}\" WITH (FORCE)";
        await cmd.ExecuteNonQueryAsync();
    }
}
