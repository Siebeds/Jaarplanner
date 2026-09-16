namespace Jaarplanner.Domain.Planning;

/// <summary>
/// One run of a thema in a plan: the placements of the same thema that follow each other with no schooldag between
/// them, which in practice are the parts the service stored around a vacation (ADR-0049 decision 4).
/// <para>
/// <b>Derived, never stored.</b> A reeks has no identity of its own: moving one part away from the other makes two
/// reeksen, and that is what the teacher did. Storing a link between the parts would be a second fact to keep in step.
/// </para>
/// </summary>
/// <param name="ThemaId">The thema the parts belong to.</param>
/// <param name="Delen">The parts, chronological; at least one.</param>
public sealed record Themareeks(Guid ThemaId, IReadOnlyList<Themaplaatsing> Delen)
{
    /// <summary>The first day of the first part.</summary>
    public DateOnly Van => Delen[0].Van;

    /// <summary>The last day of the last part.</summary>
    public DateOnly Tot => Delen[^1].Tot;

    /// <summary>
    /// Groups the planned placements of a plan into reeksen, chronologically. A rejected placement is left out: nothing
    /// is taught on its account (<see cref="Themaplaatsing.IsGepland"/>).
    /// </summary>
    public static IReadOnlyList<Themareeks> Bepaal(IEnumerable<Themaplaatsing> plaatsingen, Themakalender kalender)
    {
        ArgumentNullException.ThrowIfNull(plaatsingen);
        ArgumentNullException.ThrowIfNull(kalender);

        var reeksen = new List<Themareeks>();
        List<Themaplaatsing>? huidige = null;

        foreach (var plaatsing in plaatsingen.Where(p => p.IsGepland).OrderBy(p => p.Van).ThenBy(p => p.Tot))
        {
            var vorige = huidige?[^1];
            if (vorige is not null
                && vorige.ThemaId == plaatsing.ThemaId
                && kalender.TelSchooldagen(vorige.Tot.AddDays(1), plaatsing.Van.AddDays(-1)) == 0)
            {
                huidige!.Add(plaatsing);
                continue;
            }

            huidige = [plaatsing];
            reeksen.Add(new Themareeks(plaatsing.ThemaId, huidige));
        }

        return reeksen;
    }
}
