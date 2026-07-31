namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// Orders Op.stap discipline numbers the way a teacher reads them: 1, 2, 3, …, 9.1, 9.2, 9.3, 10, 11.
/// <para>
/// <see cref="Discipline.Nummer"/> is a <b>string</b> because the numbering is partly nested (the 9.x split,
/// Art. VII.0), and a plain ordinal sort therefore yields <c>1, 10, 11, 2, 3</c>. That is not a hypothetical:
/// the Art. VII.0 authoritative list runs to 11, so a full import shows it (antagonist finding 5). An earlier
/// comment in the facets query defended ordinal as "the only ordering that is stable without assuming the
/// numbering scheme", which was simply wrong: stable and correct are different properties, and comparing the
/// dot-separated segments numerically assumes nothing beyond what the list already is.
/// </para>
/// <para>
/// A segment that is not an integer falls back to an ordinal comparison of that segment, so an unexpected value
/// sorts deterministically instead of throwing. Numeric segments always sort before non-numeric ones, which
/// keeps the official list contiguous if Op.stap ever adds something like <c>"9.x"</c>.
/// </para>
/// </summary>
public sealed class DisciplinenummerVergelijker : IComparer<string>
{
    /// <summary>The shared instance; the comparer is stateless.</summary>
    public static readonly DisciplinenummerVergelijker Instantie = new();

    private DisciplinenummerVergelijker()
    {
    }

    public int Compare(string? links, string? rechts)
    {
        if (ReferenceEquals(links, rechts))
        {
            return 0;
        }

        if (links is null)
        {
            return -1;
        }

        if (rechts is null)
        {
            return 1;
        }

        var linkerDelen = links.Split('.');
        var rechterDelen = rechts.Split('.');

        for (var i = 0; i < Math.Min(linkerDelen.Length, rechterDelen.Length); i++)
        {
            var vergelijking = VergelijkSegment(linkerDelen[i], rechterDelen[i]);
            if (vergelijking != 0)
            {
                return vergelijking;
            }
        }

        // A prefix sorts before the longer value it prefixes, so "9" precedes "9.1".
        return linkerDelen.Length.CompareTo(rechterDelen.Length);
    }

    private static int VergelijkSegment(string links, string rechts)
    {
        var linksIsGetal = int.TryParse(links, out var linkerGetal);
        var rechtsIsGetal = int.TryParse(rechts, out var rechterGetal);

        return (linksIsGetal, rechtsIsGetal) switch
        {
            (true, true) => linkerGetal.CompareTo(rechterGetal),
            // Numeric before non-numeric, so the official numbered list stays contiguous.
            (true, false) => -1,
            (false, true) => 1,
            _ => string.CompareOrdinal(links, rechts),
        };
    }
}
