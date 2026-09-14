namespace Jaarplanner.Infrastructure;

/// <summary>
/// The school's own wall clock: now and today in Belgian time, whatever zone the host runs in.
/// <para>
/// A cloud host runs in UTC (Art. VI.3 puts it in an EU region, not in Belgium's zone). Read in UTC, "today" would
/// switch at 01:00 or 02:00 Belgian time, so a hoofdleerkracht appointment would lapse in the small hours of the day
/// after its schooljaar's last school day rather than at midnight (ADR-0030 R20), and the coverage export's stamp
/// would be up to two hours off the reader's clock. One zone, resolved once, for both.
/// </para>
/// </summary>
public static class Schoolklok
{
    /// <summary>
    /// The school's time zone, or <c>null</c> when the host knows neither spelling, in which case callers fall back to
    /// UTC and say so. IANA id first, which .NET maps on Windows too since it uses ICU; the Windows id is the fallback
    /// for a host built with the legacy NLS mapping.
    /// </summary>
    public static TimeZoneInfo? Zone { get; } = ZoekZone();

    /// <summary>Now, in the school's zone when the host knows it, otherwise in UTC.</summary>
    public static DateTimeOffset Nu(TimeProvider tijd)
    {
        ArgumentNullException.ThrowIfNull(tijd);
        var nu = tijd.GetUtcNow();
        return Zone is null ? nu.ToUniversalTime() : TimeZoneInfo.ConvertTime(nu, Zone);
    }

    /// <summary>Today's date on the school's wall clock.</summary>
    public static DateOnly Vandaag(TimeProvider tijd) => DateOnly.FromDateTime(Nu(tijd).DateTime);

    private static TimeZoneInfo? ZoekZone()
    {
        foreach (var id in new[] { "Europe/Brussels", "W. Europe Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
                // Try the next spelling; a host with neither falls back to UTC.
            }
            catch (InvalidTimeZoneException)
            {
                // Corrupt zone data on this host. Same fallback.
            }
        }

        return null;
    }
}
