namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The guard that stops the Postgres-backed suite from silently degrading.
/// <para>
/// Every real-database test is a <see cref="PostgresFactAttribute"/>, which skips when
/// <c>JAARPLANNER_TEST_POSTGRES</c> is unset. That is the right behaviour on a developer machine and the
/// <b>wrong</b> behaviour on CI: a green build made entirely of skips is what allowed a required
/// <c>Restrict</c> FK with no data to satisfy it to ship through two epics. So on CI, an unset variable
/// fails here — loudly, once, with instructions — instead of quietly skipping everywhere.
/// </para>
/// </summary>
public sealed class PostgresAvailabilityTests
{
    [Fact]
    public void Ci_must_have_a_real_postgres_configured()
    {
        if (!PostgresTestDatabase.IsCi)
        {
            // Local machine: nothing to assert. The Postgres tests report as skipped.
            return;
        }

        Assert.True(
            PostgresTestDatabase.IsBeschikbaar,
            $"CI must run the integration tests against a real PostgreSQL, but " +
            $"{PostgresTestDatabase.ConnectionStringVariable} is not set. Add the Postgres service " +
            "container to the CI workflow and export the variable. Refusing to pass a suite whose " +
            "database-level guarantees (FKs, unique indexes, collation) were never exercised.");
    }
}
