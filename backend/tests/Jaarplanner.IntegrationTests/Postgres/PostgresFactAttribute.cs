namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// A <see cref="FactAttribute"/> that skips itself when no test PostgreSQL is configured, so a
/// developer without a running database gets a visible "Skipped" rather than a confusing failure.
/// <para>
/// This deliberately does <b>not</b> make the gap invisible: on CI a missing connection string is a
/// hard failure (<see cref="PostgresAvailabilityTests"/>), because "skipped everywhere" is precisely
/// how the in-memory provider hid real FK violations for two whole epics.
/// </para>
/// </summary>
public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            Skip = PostgresTestDatabase.SkipReden;
        }
    }
}
