namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// A bounding filter over the Op.stap leerplandoel reference data for the authoring assist (E2-07)
/// and the FR-4 goal matching (E2-08). It keeps a grounded prompt small and relevant: a kennisrijk
/// thema is interdisciplinary, so the caller typically scopes the candidate set to a handful of
/// disciplines and/or the class's jaar/fase rather than the whole curriculum. Every dimension is
/// optional — a <c>null</c> or empty collection means "no filter on that dimension".
/// <para>
/// <b>Which disciplines come first is an open Art. XIV decision</b>, so this filter is the seam that
/// keeps it open: no layer picks a set on the school's behalf. The caller passes what it wants, and an
/// omitted selection resolves to <see cref="Alles"/> at the one place that documents it — visible in
/// the UI and changeable per run, never compiled in.
/// </para>
/// <para>
/// <b>Every dimension matches case-insensitively</b> (part of the <see cref="ILeerdoelCatalogus"/>
/// contract, honoured by the EF implementation and the test fake alike). A teacher types <c>k3</c> or
/// <c>L3</c> by hand, and a case-sensitive filter would answer with an empty candidate set that is
/// indistinguishable from "the curriculum holds nothing for your class".
/// </para>
/// </summary>
public sealed record LeerdoelSelectie
{
    /// <summary>A selection that applies no filter — the full loaded leerplandoel set.</summary>
    public static readonly LeerdoelSelectie Alles = new();

    /// <summary>The discipline numbers to include (<see cref="Domain.Curriculum.Leerplandoel.DisciplineNummer"/>); null/empty = all.</summary>
    public IReadOnlyCollection<string>? Disciplines { get; init; }

    /// <summary>The jaar/fase codes to include (JK, K2, K3, L1–L6, or a fase); null/empty = all.</summary>
    public IReadOnlyCollection<string>? JaarFasen { get; init; }

    /// <summary>
    /// The exact leerplandoel codes to include; null/empty = no filter on code. Added by E2-08 to
    /// <b>resolve</b> one or a few known codes through the same read-only seam rather than loading the
    /// whole curriculum to check whether a code exists (Art. III.1/III.5 — the substitution of FR-4.3
    /// may only point at a code Op.stap actually carries).
    /// </summary>
    public IReadOnlyCollection<string>? Codes { get; init; }
}
