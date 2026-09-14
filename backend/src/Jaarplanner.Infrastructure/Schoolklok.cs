using Microsoft.Extensions.Logging;

namespace Jaarplanner.Infrastructure;

/// <summary>
/// The school's own wall clock: now and today in Belgian time, whatever zone the host runs in.
/// <para>
/// A cloud host runs in UTC (Art. VI.3 puts it in an EU region, not in Belgium's zone). Read in UTC, "today" would
/// switch at 01:00 or 02:00 Belgian time, so a hoofdleerkracht appointment would lapse in the small hours of the day
/// after its schooljaar's last school day rather than at midnight (ADR-0030 R20), and the coverage export's stamp
/// would be up to two hours off the reader's clock. One zone, resolved once, for both.
/// </para>
/// <para>
/// <b>On a host that knows neither spelling of the zone</b>, <see cref="Nu"/> and <see cref="Vandaag"/> fall back to UTC
/// and log one warning per process, whichever caller meets it first. That is all this class does about it. The coverage
/// export also labels its stamp "(UTC)". The rights path does not fail closed: on such a host a right on shared content
/// lasts until 01:00 or 02:00 Belgian time after its schooljaar's last day, and the warning is what makes that visible.
/// </para>
/// </summary>
public static class Schoolklok
{
    private static readonly Eenmalig ZoneOntbreekt = new();

    /// <summary>
    /// The school's time zone, or <c>null</c> when the host knows neither spelling. IANA id first, which .NET maps on
    /// Windows too since it uses ICU; the Windows id is the fallback for a host built with the legacy NLS mapping.
    /// </summary>
    public static TimeZoneInfo? Zone { get; } = ZoekZone();

    /// <summary>Now, in the school's zone when the host knows it, otherwise in UTC (logged once, see the class).</summary>
    /// <param name="logger">The caller's logger. Required, so no caller can meet the fallback without it being logged.</param>
    public static DateTimeOffset Nu(TimeProvider tijd, ILogger logger) => Nu(tijd, logger, Zone, ZoneOntbreekt);

    /// <summary>Today's date on the school's wall clock (UTC on a host without the zone, logged once).</summary>
    public static DateOnly Vandaag(TimeProvider tijd, ILogger logger) => DateOnly.FromDateTime(Nu(tijd, logger).DateTime);

    /// <summary>The conversion, with the zone and the once-only state passed in, so a test can take the fallback.</summary>
    internal static DateTimeOffset Nu(TimeProvider tijd, ILogger logger, TimeZoneInfo? zone, Eenmalig waarschuwing)
    {
        ArgumentNullException.ThrowIfNull(tijd);
        ArgumentNullException.ThrowIfNull(logger);

        var nu = tijd.GetUtcNow();
        if (zone is not null)
        {
            return TimeZoneInfo.ConvertTime(nu, zone);
        }

        if (waarschuwing.EersteKeer())
        {
            logger.LogWarning(
                "The host has no time zone data for Europe/Brussels; the school's clock falls back to UTC. Rights on "
                + "shared content then lapse up to two hours after midnight Belgian time (ADR-0030 R20), and the coverage "
                + "export stamps UTC. Install the host's time zone data (tzdata or ICU).");
        }

        return nu.ToUniversalTime();
    }

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

    /// <summary>Answers <c>true</c> exactly once, across threads.</summary>
    internal sealed class Eenmalig
    {
        private int _gebeurd;

        public bool EersteKeer() => Interlocked.Exchange(ref _gebeurd, 1) == 0;
    }
}
