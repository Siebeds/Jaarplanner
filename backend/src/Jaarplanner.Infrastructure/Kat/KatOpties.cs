using System.Globalization;

namespace Jaarplanner.Infrastructure.Kat;

/// <summary>
/// How the cat's background job is configured (TB-057, ADR-0059 D1). The defaults are the ADR's: 07:00 and 19:00 on
/// the school's clock.
/// <para>
/// <b>Off by default.</b> The job is a process that writes without anybody asking, so an environment says out loud
/// that it wants one: a developer's machine, the test runs and the demo do not tick unless they are told to. In Azure
/// it needs Always On, or the process the job lives in is recycled between ticks (D1).
/// </para>
/// </summary>
public sealed class KatOpties
{
    /// <summary>The configuration section.</summary>
    public const string SectionName = "Kat";

    /// <summary>Whether the background job runs at all.</summary>
    public bool Ingeschakeld { get; set; }

    /// <summary>The times of day it ticks, on the school's clock, as <c>HH:mm</c>.</summary>
    public IList<string> Tikmomenten { get; set; } = ["07:00", "19:00"];

    /// <summary>
    /// <see cref="Tikmomenten"/> parsed, each once. Validated at startup, so a bad value never reaches the job.
    /// </summary>
    public IReadOnlyCollection<TimeOnly> Momenten() =>
        Tikmomenten.Select(Ontleed).Distinct().Order().ToList();

    /// <summary>Whether every moment parses and there is at least one; the message says which value is wrong.</summary>
    public bool IsGeldig(out string? fout)
    {
        if (Tikmomenten.Count == 0)
        {
            fout = $"{SectionName}:Tikmomenten needs at least one time of day, as HH:mm.";
            return false;
        }

        foreach (var moment in Tikmomenten)
        {
            if (!TimeOnly.TryParseExact(moment, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            {
                fout = $"{SectionName}:Tikmomenten holds '{moment}', which is not a time of day as HH:mm.";
                return false;
            }
        }

        fout = null;
        return true;
    }

    private static TimeOnly Ontleed(string moment) =>
        TimeOnly.ParseExact(moment, "HH:mm", CultureInfo.InvariantCulture);
}
