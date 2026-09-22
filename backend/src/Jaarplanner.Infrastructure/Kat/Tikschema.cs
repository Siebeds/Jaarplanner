namespace Jaarplanner.Infrastructure.Kat;

/// <summary>
/// When the cat's background job ticks (ADR-0059 D1: fixed Brussels times, 07:00 and 19:00). Pure arithmetic over a
/// clock and a zone, so the schedule can be tested without waiting for one.
/// <para>
/// The moments are read in the school's zone, not the host's: a host in UTC would otherwise tick at 09:00 and 21:00
/// Belgian time in summer, and the evening round would reach a teacher after she has stopped looking.
/// </para>
/// </summary>
public static class Tikschema
{
    /// <summary>
    /// The first moment after <paramref name="nu"/> at which the job should run, in UTC.
    /// </summary>
    /// <param name="momenten">The times of day, on the school's clock. Order does not matter; duplicates are ignored.</param>
    /// <param name="zone">The school's zone, or <c>null</c> on a host that does not know it, which reads them as UTC.</param>
    /// <exception cref="ArgumentException"><paramref name="momenten"/> is empty: a job with no moment would never run.</exception>
    public static DateTimeOffset VolgendeNa(DateTimeOffset nu, IReadOnlyCollection<TimeOnly> momenten, TimeZoneInfo? zone)
    {
        ArgumentNullException.ThrowIfNull(momenten);
        if (momenten.Count == 0)
        {
            throw new ArgumentException("A tick schedule needs at least one moment.", nameof(momenten));
        }

        var lokaalNu = zone is null ? nu.UtcDateTime : TimeZoneInfo.ConvertTime(nu, zone).DateTime;
        var geordend = momenten.Distinct().Order().ToList();

        // Today's remaining moments first, then tomorrow's; a schedule always has one within a day.
        foreach (var dagen in (int[])[0, 1])
        {
            var datum = DateOnly.FromDateTime(lokaalNu).AddDays(dagen);
            foreach (var moment in geordend)
            {
                var lokaal = datum.ToDateTime(moment);
                if (lokaal > lokaalNu)
                {
                    return NaarUtc(lokaal, zone);
                }
            }
        }

        // Unreachable while the schedule holds a moment: tomorrow's first is always later than now.
        throw new InvalidOperationException("The tick schedule yielded no moment after now.");
    }

    private static DateTimeOffset NaarUtc(DateTime lokaal, TimeZoneInfo? zone)
    {
        if (zone is null)
        {
            return new DateTimeOffset(lokaal, TimeSpan.Zero);
        }

        // The hour the clock skips in spring does not exist; the job runs at the next one that does.
        if (zone.IsInvalidTime(lokaal))
        {
            lokaal = lokaal.AddHours(1);
        }

        // The hour the clock repeats in autumn happens twice; the first pass is the one a teacher means.
        var offset = zone.IsAmbiguousTime(lokaal)
            ? zone.GetAmbiguousTimeOffsets(lokaal).Max()
            : zone.GetUtcOffset(lokaal);

        return new DateTimeOffset(lokaal, offset).ToUniversalTime();
    }
}
