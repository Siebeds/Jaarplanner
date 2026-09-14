namespace Jaarplanner.Eval;

/// <summary>
/// How one model answer compares to the gold set of one case. Codes compare <b>ordinally</b>, the same strict policy
/// production applies to a code the AI supplies (<c>DoelMatchingService</c>, "Case policy").
/// </summary>
public sealed record GevalScore
{
    /// <summary>The gold codes, trimmed and without duplicates.</summary>
    public required IReadOnlyList<string> Gouden { get; init; }

    /// <summary>The proposed codes that are in the candidate list, without duplicates, in the model's order.</summary>
    public required IReadOnlyList<string> Gekozen { get; init; }

    /// <summary>
    /// The proposed codes that are <b>not</b> in the candidate list. Production would skip them as unresolvable; here
    /// they count as wrong answers, and never as a hit, even when the same code is in the gold set.
    /// </summary>
    public required IReadOnlyList<string> Onbekend { get; init; }

    /// <summary>The chosen codes that are in the gold set.</summary>
    public required IReadOnlyList<string> Treffers { get; init; }

    /// <summary>The gold codes the model did not choose.</summary>
    public required IReadOnlyList<string> Gemist { get; init; }

    /// <summary>The chosen codes that are not in the gold set.</summary>
    public required IReadOnlyList<string> Extra { get; init; }

    /// <summary>How many candidates the model could choose from.</summary>
    public required int AantalKandidaten { get; init; }

    /// <summary>How many gold codes were among the candidates: the ceiling for <see cref="Recall"/>.</summary>
    public required int GoudenInKandidaten { get; init; }

    /// <summary>Everything the model proposed: chosen and unknown codes together.</summary>
    public int AantalVoorgesteld => Gekozen.Count + Onbekend.Count;

    /// <summary>The share of proposed codes that are hits, or null when nothing was proposed.</summary>
    public double? Precisie => AantalVoorgesteld == 0 ? null : (double)Treffers.Count / AantalVoorgesteld;

    /// <summary>The share of gold codes the model chose.</summary>
    public double? Recall => Gouden.Count == 0 ? null : (double)Treffers.Count / Gouden.Count;

    /// <summary>The share of gold codes that were among the candidates.</summary>
    public double? KandidaatRecall => Gouden.Count == 0 ? null : (double)GoudenInKandidaten / Gouden.Count;
}

/// <summary>Scores a model answer against a gold set.</summary>
public static class Scoring
{
    /// <summary>Scores <paramref name="voorgesteld"/> against <paramref name="gouden"/>, given the candidate codes.</summary>
    public static GevalScore Score(
        IEnumerable<string> gouden,
        IEnumerable<string> kandidaatCodes,
        IEnumerable<string> voorgesteld)
    {
        ArgumentNullException.ThrowIfNull(gouden);
        ArgumentNullException.ThrowIfNull(kandidaatCodes);
        ArgumentNullException.ThrowIfNull(voorgesteld);

        var goudenLijst = gouden
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var goudenSet = new HashSet<string>(goudenLijst, StringComparer.Ordinal);
        var kandidaten = new HashSet<string>(kandidaatCodes, StringComparer.Ordinal);

        var gezien = new HashSet<string>(StringComparer.Ordinal);
        var gekozen = new List<string>();
        var onbekend = new List<string>();
        foreach (var code in voorgesteld)
        {
            if (!gezien.Add(code))
            {
                continue;
            }

            (kandidaten.Contains(code) ? gekozen : onbekend).Add(code);
        }

        var gekozenSet = new HashSet<string>(gekozen, StringComparer.Ordinal);

        return new GevalScore
        {
            Gouden = goudenLijst,
            Gekozen = gekozen,
            Onbekend = onbekend,
            Treffers = gekozen.Where(goudenSet.Contains).ToList(),
            Gemist = goudenLijst.Where(c => !gekozenSet.Contains(c)).ToList(),
            Extra = gekozen.Where(c => !goudenSet.Contains(c)).ToList(),
            AantalKandidaten = kandidaten.Count,
            GoudenInKandidaten = goudenLijst.Count(kandidaten.Contains),
        };
    }
}
