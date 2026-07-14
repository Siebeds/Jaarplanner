namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// A bounding filter over the Op.stap leerplandoel reference data for the authoring assist (E2-07).
/// It keeps a grounded prompt small and relevant: a kennisrijk thema is interdisciplinary, so the
/// wizard typically scopes the candidate set to a handful of disciplines and/or the class's
/// jaar/fase rather than the whole curriculum. Both dimensions are optional — a <c>null</c> or empty
/// collection means "no filter on that dimension".
/// </summary>
public sealed record LeerdoelSelectie
{
    /// <summary>A selection that applies no filter — the full loaded leerplandoel set.</summary>
    public static readonly LeerdoelSelectie Alles = new();

    /// <summary>The discipline numbers to include (<see cref="Domain.Curriculum.Leerplandoel.DisciplineNummer"/>); null/empty = all.</summary>
    public IReadOnlyCollection<string>? Disciplines { get; init; }

    /// <summary>The jaar/fase codes to include (JK, K2, K3, L1–L6, or a fase); null/empty = all.</summary>
    public IReadOnlyCollection<string>? JaarFasen { get; init; }
}
